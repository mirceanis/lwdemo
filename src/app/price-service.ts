// The price service: a process that writes a price to a light writer every few seconds, and lets
// whoever wants the feed find it. Run it with `bare src/app/price-service.ts`. Other code imports
// this file for what the service publishes: where to find it, how to ask it for its key, and what
// its messages look like.
//
// Nothing here knows who reads the feed or what they make of it. Any number of readers can follow
// it, and the service never learns about them.

import * as b4a from "b4a";
import * as c from "compact-encoding";
import * as hc from "hypercore-crypto";
import Corestore from "corestore";
import Hyperswarm from "hyperswarm";
import HyperDHT, { type Connection } from "hyperdht";
import ProtomuxRPC from "protomux-rpc";
import { LightWriter } from "../light-writer/light-writer";
import { createRpc, type Message } from "../light-writer/rpc";

// ---------------------------------------------------------------------------
// What the service publishes
// ---------------------------------------------------------------------------

/** Where to find it: the service announces on this topic. */
export const topic = hc.hash(b4a.from("service"));

/** What it says. A message's position is its wire id: append only, never reorder. */
export const messages: Message[] = [{ name: "price", encoding: c.float64 }];
const PRICE = 0;

// How to ask it for its key: a protomux-rpc request on any connection to it. A reader needs the key
// to follow the feed.
const HANDSHAKE = b4a.from("feeder-service");
const KEY_METHOD = "serviceKey";

/** Ask the service on `conn` for the key of its light writer. */
export function requestKey(conn: Connection): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const rpc = new ProtomuxRPC(conn, { handshake: HANDSHAKE });
    rpc.on("error", reject);
    rpc.on("open", async () => {
      try {
        const key: Uint8Array | null = await rpc.request(KEY_METHOD, null, {
          responseEncoding: c.optionalBuffer,
        });
        if (!key) throw new Error("the service did not hand out a key");
        resolve(key);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function serveKey(conn: Connection, writer: LightWriter): void {
  const rpc = new ProtomuxRPC(conn, { handshake: HANDSHAKE });
  rpc.respond(
    KEY_METHOD,
    { responseEncoding: c.optionalBuffer },
    async () => writer.key,
  );
}

// ---------------------------------------------------------------------------
// The service process
// ---------------------------------------------------------------------------

const BOOTSTRAP = [{ host: "127.0.0.1", port: 30001 }];
const INTERVAL_MS = 3000;

async function main() {
  // The service's own corestore, so its light writer is a genuine, separate, replicated input.
  const store = new Corestore(".corestores/service", { writable: true });

  // the writer (it only appends bytes), and the typed messages on top of it
  const writer = new LightWriter(store, { name: "price-bot" });
  await writer.ready();
  const rpc = createRpc(writer, messages);

  console.log(
    "price service: light writer key =",
    b4a.toString(writer.key as Uint8Array, "hex"),
  );
  console.log(
    `price service: broadcasting a price every ${INTERVAL_MS / 1000}s`,
  );

  // Announce on the topic. On each connection, replicate the whole store (so whoever finds the
  // service can pull the light writer's core) and answer requests for the key.
  const dht = new HyperDHT({ bootstrap: BOOTSTRAP, firewalled: false });
  const swarm = new Hyperswarm({ dht });
  swarm.on("connection", (conn) => {
    try {
      store.replicate(conn as any);
    } catch (err) {
      console.error("service: replicate failed", err);
    }
    serveKey(conn, writer);
  });
  await swarm.listen();
  swarm.join(topic, { server: true, client: true });

  // the feed: a random-walk price every few seconds
  let price = 100;
  setInterval(() => {
    price *= 0.9 + Math.random() * 0.2;
    rpc[PRICE].send(price).catch((err) => {
      console.error("service: append failed", err);
    });
  }, INTERVAL_MS);
}

// Only when run as the entry point: importing this file for what it publishes starts nothing.
if (import.meta.main) main();
