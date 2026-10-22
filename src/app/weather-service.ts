// The weather service: a process that answers questions about the weather at a place.
// It is a call, so it takes two light writers, one each way:
//
//   the caller's light writer -> the service's reader (an Autobee) - the requests
//   the service's light writer -> whoever follows it - the replies
//
// A caller's writer is made in the caller's own store. The service is told its key (`pair`) and takes it
// in as an input of its reader, without ever adding it as a writer. apply() only records what was
// asked; the answering is done from the reader's update hook, for the rows it has not answered yet.

import * as b4a from "b4a";
import * as c from "compact-encoding";
import * as hc from "hypercore-crypto";
import type { AutobeeNode, Hyperbee } from "autobee";
import Autobee from "autobee";
import Corestore, { type Corestore as CorestoreT } from "corestore";
import Hyperswarm from "hyperswarm";
import HyperDHT, { type Connection } from "hyperdht";
import ProtomuxRPC from "protomux-rpc";
import { LightWriter } from "../light-writer/light-writer";
import { createRpc, type Message, routeMessages } from "../light-writer/rpc";

// ---------------------------------------------------------------------------
// What the service publishes
// ---------------------------------------------------------------------------

/** Where to find it: the service announces on this topic. */
export const topic = hc.hash(b4a.from("weather"));

export interface Coordinates {
  lon: number;
  lat: number;
}

/** What comes back: the place asked about, and what was measured there. */
export interface Measurement extends Coordinates {
  value: number;
}

const coordinates: c.Encoder<Coordinates> = {
  preencode(state, at) {
    c.float64.preencode(state, at.lon);
    c.float64.preencode(state, at.lat);
  },
  encode(state, at) {
    c.float64.encode(state, at.lon);
    c.float64.encode(state, at.lat);
  },
  decode(state) {
    return { lon: c.float64.decode(state), lat: c.float64.decode(state) };
  },
};

const measurement: c.Encoder<Measurement> = {
  preencode(state, r) {
    coordinates.preencode(state, r);
    c.float64.preencode(state, r.value);
  },
  encode(state, r) {
    coordinates.encode(state, r);
    c.float64.encode(state, r.value);
  },
  decode(state) {
    const at = coordinates.decode(state);
    return { ...at, value: c.float64.decode(state) };
  },
};

/**
 * The methods. A method's position is its wire id, in both vocabularies below: append only, never
 * reorder.
 */
export const METHODS = [
  "time",
  "temperature",
  "uvIndex",
  "wind",
  "cloudCoverage",
] as const;
export type Method = (typeof METHODS)[number];

/** What a caller says, on its own writer. */
export const requests: Message<Coordinates>[] = METHODS.map((name) => ({
  name,
  encoding: coordinates,
}));

/** What the service says back, on its own: the answer to the request at the same position. */
export const replies: Message<Measurement>[] = METHODS.map((name) => ({
  name,
  encoding: measurement,
}));

/**
 * What a caller uses (from the sketch). Its light writer lives in the caller's own store
 * and every request it sends says where the reply goes, so there is one per (store, reply address).
 */
export class WeatherClient {
  private writer: LightWriter;
  private rpc;

  private constructor(writer: LightWriter, replyTo: Uint8Array) {
    this.writer = writer;
    this.rpc = createRpc(writer, requests, { auth: replyTo });
  }

  static async from(store: CorestoreT, caps: { replyTo: Uint8Array }) {
    const name = `weather/${b4a.toString(caps.replyTo, "hex")}`;
    const writer = new LightWriter(store, { name });
    await writer.ready();
    return new WeatherClient(writer, caps.replyTo);
  }

  /** The key of the caller's writer: all the service needs to read it (see `pair`). */
  get key(): Uint8Array {
    return this.writer.key as Uint8Array;
  }

  getTime(at: Coordinates) {
    return this.call("time", at);
  }
  getTemperature(at: Coordinates) {
    return this.call("temperature", at);
  }
  getUVIndex(at: Coordinates) {
    return this.call("uvIndex", at);
  }
  getWind(at: Coordinates) {
    return this.call("wind", at);
  }
  getCloudCoverage(at: Coordinates) {
    return this.call("cloudCoverage", at);
  }

  private call(method: Method, at: Coordinates) {
    return this.rpc[METHODS.indexOf(method)].send(at);
  }
}

// How to pair with it: a protomux-rpc request on any connection to it. The caller says which light
// writer to read and gets the key of the one the service answers on.
const HANDSHAKE = b4a.from("weather-service");
const PAIR = "pair";

/**
 * Pair with the service on `conn`, once per connection, and on every new one: the service listens to
 * the writers it has been told about since it started, and a restart forgets them. Resolves to the
 * key of the service's own light writer, the one its replies go to.
 */
export function pair(
  conn: Connection,
  callerKey: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const rpc = new ProtomuxRPC(conn, { handshake: HANDSHAKE });
    rpc.on("error", reject);
    rpc.on("open", async () => {
      try {
        resolve(
          await rpc.request(PAIR, callerKey, {
            requestEncoding: c.fixed32,
            responseEncoding: c.fixed32,
          }),
        );
      } catch (err) {
        reject(err);
      }
    });
  });
}

function servePairing(conn: Connection, reader: Autobee, writer: LightWriter) {
  const rpc = new ProtomuxRPC(conn, { handshake: HANDSHAKE });
  rpc.respond(
    PAIR,
    { requestEncoding: c.fixed32, responseEncoding: c.fixed32 },
    async (callerKey: Uint8Array) => {
      await reader.wakeup({ key: callerKey, length: 0 });
      return writer.key as Uint8Array;
    },
  );
}

// ---------------------------------------------------------------------------
// The reader: what the service keeps of what it was asked
// ---------------------------------------------------------------------------
//
// One row per request, keyed by where it was written (`req/<writer>/<length>`), so a request is one
// row however many times apply() sees it.

interface Request {
  method: Method;
  lon: number;
  lat: number;
  /** The reply address, hex: it goes back on the reply and is not interpreted. */
  replyTo: string;
}

// ---------------------------------------------------------------------------
// Standing in for a weather API
// ---------------------------------------------------------------------------

/** Made up numbers. */
function measure(method: Method, now: number) {
  const r = Math.random();
  switch (method) {
    case "time":
      return now; // TODO: + skew based on longitude
    case "temperature":
      return Math.round((r * 50 - 10) * 10) / 10;
    case "uvIndex":
      return Math.round(r * 11 * 10) / 10;
    case "wind":
      return Math.round(r * 100 * 10) / 10;
    case "cloudCoverage":
      return Math.round(r * 100);
  }
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

/**
 * The service without its network: a reader, a light writer to answer on, and the answering. Whoever
 * runs it brings the transport: replicate `store`, and tell the reader about each caller's writer with
 * `reader.wakeup({ key, length: 0 })` (`main` does that when a caller pairs).
 */
export async function serve(store: CorestoreT) {
  // The light writer it answers on (it only appends bytes), and the typed sends on top of it.
  const writer = new LightWriter(store, { name: "weather-bot" });
  await writer.ready();
  const reply = createRpc(writer, replies);

  const answered = new Set<string>(); // not kept across restarts: a restarted service answers everything again

  // The reader. Its inputs are the callers' light writers, which it never adds as writers.
  const reader = new Autobee(store, null, {
    name: "weather",
    // Record each request as a row.
    async apply(nodes: AutobeeNode[], view: Hyperbee) {
      const receive = routeMessages<Request>(
        requests,
        Object.fromEntries(
          METHODS.map((method) => [
            method,
            (
              at: Coordinates,
              _node: AutobeeNode,
              header,
            ): Request | undefined =>
              // a request that says nowhere to send the answer cannot be answered
              header.auth
                ? { method, ...at, replyTo: b4a.toString(header.auth, "hex") }
                : undefined,
          ]),
        ),
      );
      for (const node of nodes) {
        const request = await receive(node); // also the owner's first node, which is not a request
        if (!request) continue;
        const w = view.write();
        w.tryPut(
          b4a.from(`req/${b4a.toString(node.key, "hex")}/${node.length}`),
          b4a.from(JSON.stringify(request)),
        );
        await w.flush();
      }
    },
    // Answer the rows that are new. (Writing to the reader from here would deadlock; the reply goes
    // to the service's own writer, which is another core.)
    async update(view: Hyperbee) {
      for await (const { key, value } of view.createReadStream()) {
        const id = b4a.toString(key, "hex");
        if (!value || answered.has(id)) continue;
        answered.add(id);
        const { method, lon, lat, replyTo } = JSON.parse(
          b4a.toString(value),
        ) as Request;
        const reading = { lon, lat, value: measure(method, Date.now()) };
        await reply[METHODS.indexOf(method)].send(reading, {
          auth: b4a.from(replyTo, "hex"),
        });
        console.log(
          `weather service: ${method} at ${lat},${lon} = ${reading.value}`,
        );
      }
    },
  });
  await reader.ready();

  // A reader holds light writers' nodes until its owner has written once.
  if (reader.local?.length === 0) {
    await reader.append(b4a.from("weather service"));
  }

  return { reader, writer };
}

// ---------------------------------------------------------------------------
// The service process
// ---------------------------------------------------------------------------

const BOOTSTRAP = [{ host: "127.0.0.1", port: 30001 }];

async function main() {
  const store = new Corestore(".corestores/weather", { writable: true });
  const { reader, writer } = await serve(store);

  console.log(
    "weather service: light writer key =",
    b4a.toString(writer.key as Uint8Array, "hex"),
  );

  // Announce on the topic. On each connection, replicate the whole store (so whoever finds the service
  // can pull its light writer's core, and it can pull theirs) and answer pairing.
  const dht = new HyperDHT({ bootstrap: BOOTSTRAP, firewalled: false });
  const swarm = new Hyperswarm({ dht });
  swarm.on("connection", (conn) => {
    try {
      store.replicate(conn as any);
    } catch (err) {
      console.error("weather service: replicate failed", err);
    }
    servePairing(conn, reader, writer);
  });
  await swarm.listen();
  await swarm.join(topic, { server: true, client: false }).flushed();
  console.log("weather service: ready");
}

// Only when run as the entry point: importing this file for what it publishes starts nothing.
if (import.meta.main) main();
