import { createInterface } from "bare-readline";
import process from "bare-process";

import * as b4a from "b4a";
import * as hc from "hypercore-crypto";
import * as c from "compact-encoding";
import type { Corestore as CorestoreT } from "corestore";
import Corestore from "corestore";
import Hyperswarm from "hyperswarm";
import HyperDHT, { type Connection } from "hyperdht";
import Autobee from "autobee";
import ProtomuxRPC from "protomux-rpc";
import { decodeChat, encodeChat, putLine, type ChatMessage } from "./chat";
import * as priceService from "./price-service"; // where to find the price service
import * as priceFeed from "./price-feed"; // how the room takes its feed in
import * as weatherService from "./weather-service"; // where to find the weather service, how to ask it
import * as weatherFeed from "./weather-feed"; // how the room takes its answers in

const CHAT_TOPIC = hc.hash(b4a.from("chat"));
const BOOTSTRAP = [{ host: "127.0.0.1", port: 30001 }];
const HANDSHAKE = b4a.from("simple-chat");

const printed = new Set<number>();

// Read the chat history from the room's view. The view is re-read on every update(); `printed`
// dedups messages.
async function printFromView(room: Autobee) {
  const pending: ChatMessage[] = [];
  for await (const entry of room.view.createReadStream()) {
    // chat lines have an 8-byte key; anything else in the view is a service's state
    if (!entry.value || entry.key.byteLength !== 8) continue;
    let m: ChatMessage;
    try {
      m = decodeChat(entry.value);
    } catch {
      continue; // not a chat line; skip
    }
    pending.push(m);
  }
  // prints oldest-first.
  pending.sort((a, b) => a.timestamp - b.timestamp);
  for (const m of pending) {
    if (printed.has(m.timestamp)) continue;
    console.log(`${m.name}: ${m.text}`);
    printed.add(m.timestamp);
  }
}

// The corestore for this user (set in run()).
let store: CorestoreT | null = null;
// The shared room. Created either by joining (a discovered roomKey) or by
// bootstrapping (key = null, by the first peers on the network).
let room: Autobee | null = null;
let forming = false;
// Every connection we can replicate the room over once it exists.
const conns = new Set<Connection>();

type Swarm = InstanceType<typeof Hyperswarm>;

// One swarm per service, so every connection on it is to that service. Each has its own DHT node.
let priceSwarm: Swarm | null = null;
let weatherSwarm: Swarm | null = null;
// Set by `!service` / `!weather`; the next connection to that service delivers its key, which we invite.
let pendingPriceInvite = false;
let pendingWeatherInvite = false;
// The services' keys this peer is following
let followedPrice: string | null = null;
let followedWeather: string | null = null;
// How this peer asks the weather service: a light writer in its own store, for this room's reply address.
let weatherClient: Promise<weatherService.WeatherClient> | null = null;

// Form the room (join if roomKey is given, bootstrap if null), then replicate
// it over every connection we already have.
async function formRoom(roomKey: Uint8Array | null) {
  if (forming || room || !store) return;
  forming = true;
  try {
    console.log(
      "forming room",
      roomKey ? `from ${b4a.toString(roomKey, "hex")}` : "(bootstrap)",
    );
    // key = null -> this peer bootstraps the room (it becomes the owner and
    // db.key is the roomKey; a non-null roomKey -> this peer joins an existing
    // room and writes optimistically (admitted via addWriter in apply()).
    room = new Autobee(store, roomKey, {
      name: "chat",
      async apply(nodes, view, host) {
        // The services' feeds first: process() takes a service's nodes (and its invitation) in and
        // hands back the room's own appends.
        nodes = await priceFeed.process(nodes, view);
        nodes = await weatherFeed.process(nodes, view, host.key as Uint8Array);
        // .. other services' feeds

        // The room's own logic: chat lines.
        for (const node of nodes) {
          await host.addWriter(node.key); // grant every regular writer that shows up
          if (node.value == null) continue;
          let msg: ChatMessage;
          try {
            msg = decodeChat(node.value);
          } catch {
            continue; // not a chat line (e.g. a service invitation); ignore deterministically
          }
          await putLine(view, msg);
        }
      },
      // update() is the "something new arrived" hook (fires after apply); read
      // any new messages from the view and print them (deduped by `printed`).
      async update() {
        if (room) {
          printFromView(room);
          await followPrice(room);
          await followWeather(room);
        }
      },
    });
    await room.ready();
    await printFromView(room); // full history, read from the view
    // Kick the follow once here, not just from update(): on a restart the view is
    // already rebuilt from the log (so the service key is present), but update() won't
    // fire until a node is applied. Without this, followPrice never runs until
    // someone writes.
    await followPrice(room);
    await followWeather(room);
    replicateAll();
  } finally {
    forming = false;
  }
}

function replicateAll() {
  if (!room) return;
  for (const conn of conns) {
    try {
      console.log(
        `replicating room ${b4a.toString(room?.key ?? b4a.alloc(0), "hex")} over ${conn.remotePublicKey ? b4a.toString(conn.remotePublicKey, "hex") : "unknown peer"}`,
      );
      room.replicate(conn);
    } catch (err) {
      console.error(err);
    }
  }
}

// Every peer: once the room's view names a price service, find it on its topic and wake the room
// up on its light-writer core, once. Autobee then follows the core by itself (measured: polling
// wakeup() every second only added ~1 s of latency).
async function followPrice(room: Autobee) {
  const key = await priceFeed.serviceKey(room.view);
  if (!key) return;
  const id = b4a.toString(key, "hex");
  if (followedPrice === id) return;
  followedPrice = id;
  console.log(`following price service ${id}`);
  priceSwarm?.join(priceService.topic, { server: false, client: true });
  room.wakeup({ key, length: 0 }).catch(() => {});
}

// The same for the weather service, whose light writer carries the answers to the room. Every peer
// also gets ready to ask it (below), since any peer can.
async function followWeather(room: Autobee) {
  const key = await weatherFeed.serviceKey(room.view);
  if (!key) return;
  const id = b4a.toString(key, "hex");
  if (followedWeather === id) return;
  followedWeather = id;
  console.log(`following weather service ${id}`);
  await joinWeather(room);
  room.wakeup({ key, length: 0 }).catch(() => {});
}

// Look for the weather service on its topic and return this peer's way of asking it. The light
// writer exists before the first connection, because that is the connection that pairs it (see
// pairWeather).
async function joinWeather(room: Autobee) {
  weatherClient ??= weatherService.WeatherClient.from(store!, {
    replyTo: weatherFeed.replyAddress(room.key as Uint8Array),
  });
  const client = await weatherClient;
  weatherSwarm?.join(weatherService.topic, { server: false, client: true });
  return client;
}

// On every connection to the weather service: tell it which light writer is mine, so that it reads my
// requests, and learn which one is its own. The first connection after `!weather` also invites it.
async function pairWeather(conn: Connection) {
  if (!room || !weatherClient) return;
  try {
    const key = await weatherService.pair(conn, (await weatherClient).key);
    if (pendingWeatherInvite) {
      pendingWeatherInvite = false;
      await weatherFeed.invite(room, key);
      console.log(`invited weather service ${b4a.toString(key, "hex")}`);
    }
  } catch (err) {
    console.error("pairing with the weather service failed", err);
  }
}

// `!weather <method> <lat> <lon>`: ask the weather service. The request goes to this peer's own light
// writer, and the answer comes back to the room, for everyone, as a line.
const METHODS = {
  time: "getTime",
  temperature: "getTemperature",
  uv: "getUVIndex",
  wind: "getWind",
  cloud: "getCloudCoverage",
} as const;

async function askWeather(room: Autobee, text: string) {
  const [, what, lat, lon] = text.split(/\s+/);
  const method = METHODS[what as keyof typeof METHODS];
  if (!method || !isFinite(+lat) || !isFinite(+lon)) {
    console.error(
      `usage: !weather <${Object.keys(METHODS).join("|")}> <lat> <lon>`,
    );
    return;
  }
  if (!(await weatherFeed.serviceKey(room.view))) {
    console.error(
      "the room has not invited the weather service: type !weather",
    );
    return;
  }
  const client = await joinWeather(room);
  await client[method]({ lat: +lat, lon: +lon });
}

let myKey = b4a.alloc(0);
const knownDhtKeys = new Set<string>();
function amLeader() {
  const mine = b4a.toString(myKey, "hex");
  for (const k of knownDhtKeys) if (k < mine) return false;
  return true;
}

// If a peer already has a room, the other adopts it (a one-way request).
// If neither has a room yet, they elect a leader by DHT-key comparison: the lexicographically-smallest key is the
// leader and bootstraps the room right away
function handshake(conn: Connection) {
  const rpc = new ProtomuxRPC(conn, { handshake: HANDSHAKE });
  rpc.respond("roomKey", { responseEncoding: c.optionalBuffer }, async () => {
    if (!room) {
      if (amLeader()) await formRoom(null);
    }
    return room?.key ?? null;
  });

  rpc.on("open", async () => {
    if (room) return; // we already have a room; the peer will adopt it
    try {
      const id = await rpc.request("roomKey", null, {
        responseEncoding: c.optionalBuffer,
      });
      if (id && id.byteLength > 0) {
        await formRoom(id);
      } else if (!room) {
        // Peer had no room at that instant, and neither did we; it may still have bootstrapped by now.
        if (amLeader()) {
          await formRoom(null);
        }
      }
    } catch (err) {
      console.error("handshake failed: could not get roomKey from peer", err);
    }
  });

  rpc.on("error", (what) => {
    console.error("handshake failed: connection error", what);
  });
}

export async function run(username: string) {
  // the corestore for this user (one per user, project-local)
  store = new Corestore(`.corestores/${username}`, { writable: true });

  const dht = new HyperDHT({ bootstrap: BOOTSTRAP, firewalled: false });
  const swarm = new Hyperswarm({ dht });

  // join the swarm (topic = discovery only) and, on each connection,
  // replicate the room AND run the one-shot roomKey handshake.
  swarm.on("connection", (conn, peerInfo) => {
    conns.add(conn);
    if (peerInfo?.publicKey)
      knownDhtKeys.add(b4a.toString(peerInfo.publicKey, "hex"));
    handshake(conn);
    if (room) replicateAll();
  });
  await swarm.listen();
  myKey = swarm.keyPair.publicKey;
  swarm.join(CHAT_TOPIC, { server: true, client: true });

  // One swarm per service: replicate the room's store over each service connection (it carries
  // the service's light-writer core once it is open here, and this peer's own light writers), and
  // answer an armed invite with the service's key.
  const openServiceSwarm = async (onConnection: (conn: Connection) => void) => {
    const serviceDht = new HyperDHT({
      bootstrap: BOOTSTRAP,
      firewalled: false,
    });
    const swarm = new Hyperswarm({ dht: serviceDht });
    swarm.on("connection", (conn: Connection) => {
      if (room) {
        try {
          room.replicate(conn);
        } catch (err) {
          console.error("service: replicate failed", err);
        }
      }
      onConnection(conn);
    });
    await swarm.listen();
    return swarm;
  };

  priceSwarm = await openServiceSwarm((conn) => {
    if (pendingPriceInvite && room) {
      pendingPriceInvite = false;
      priceFeed
        .invite(conn, room)
        .then((key) =>
          console.log(`invited price service ${b4a.toString(key, "hex")}`),
        )
        .catch((err) => console.error("invite failed", err));
    }
  });
  weatherSwarm = await openServiceSwarm((conn) => void pairWeather(conn));

  // interactive stdin: each Enter -> room.append(...)
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    if (!room) {
      console.error("not in the room yet, try again in a moment");
      return;
    }
    // `!service` invites the price service: look for it on its topic. The
    // first service connection answers with its key (see priceFeed.invite).
    if (text === "!service") {
      console.log(
        "inviting the price service - looking for it on the service topic",
      );
      pendingPriceInvite = true;
      priceSwarm?.join(priceService.topic, { server: false, client: true });
      return;
    }
    // `!weather` invites the weather service, the same way. With a method and a place it asks it.
    if (text === "!weather") {
      console.log(
        "inviting the weather service - looking for it on the weather topic",
      );
      pendingWeatherInvite = true;
      joinWeather(room).catch((err) => console.error(err));
      return;
    }
    if (text.startsWith("!weather ")) {
      askWeather(room, text).catch((err) => console.error(err));
      return;
    }
    const msg: ChatMessage = { name: username, text, timestamp: Date.now() };
    // optimistic is only *marked* while the writer is not yet added
    room
      .append(encodeChat(msg), { optimistic: !room.writable })
      .catch((err) => {
        console.error(err);
      });
  });
}

const username = process.argv[2];
if (!username) {
  console.error("usage: bare src/client.ts <username>");
  process.exit(1);
}

run(username).catch((err) => {
  console.error(err);
  process.exit(1);
});
