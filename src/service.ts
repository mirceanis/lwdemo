// A light-writer service: a separate process that broadcasts a price every
// INTERVAL_MS through a LightWriter (an optimistic *input* to an autobee), with
// no knowledge of the autobee it will be fed into.
//
// The service:
//   - owns a LightWriter
//   - joins a *service* swarm topic so a room can discover it and replicate its light-writer core,
//   - doesn't care about the "room" ingesting its output

import process from "bare-process";
import * as b4a from "b4a";
import * as hc from "hypercore-crypto";
import Hyperswarm from "hyperswarm";
import HyperDHT, { type Connection } from "hyperdht";
import Corestore from "corestore";
import ProtomuxRPC from "protomux-rpc";
import * as c from "compact-encoding";
import { LightWriter } from "./light-writer";
import {
  createMessage,
  encode as encodeMessage,
  type Message,
} from "./message";

// A service topic (distinct from the chat topic). Both the service and an
// inviting client compute the same 32 bytes, so they discover each other.
const SERVICE_TOPIC = hc.hash(b4a.from("service"));
// the handshake and method under which the service hands out its light-writer key
const SERVICE_HANDSHAKE = b4a.from("feeder-service");
const SERVICE_KEY_METHOD = "serviceKey";
const BOOTSTRAP = [{ host: "127.0.0.1", port: 30001 }];
const INTERVAL_MS = 3000;

export async function runService() {
  // the service's own corestore — independent of any room's corestore, so the
  // light writer is a genuine, separate, replicated input.
  const store = new Corestore(".corestores/service", { writable: true });

  // the light writer: an optimistic input. It is never a writer of a room, only
  // an input that a consuming autobee ingests via wakeup().
  const lw = new LightWriter(store, { name: "price-bot" });
  await lw.ready();

  console.log(
    "price service: light writer key =",
    b4a.toString(lw.key as Uint8Array, "hex"),
  );
  console.log("price service: broadcasting a price every 3s");

  // join the service topic and replicate the light-writer core on each
  // connection, so a discovering client can pull the core into its own store
  // and then wakeup() on it.
  const dht = new HyperDHT({ bootstrap: BOOTSTRAP, firewalled: false });
  const swarm = new Hyperswarm({ dht });
  const conns: Set<Connection> = new Set();

  swarm.on("connection", (conn) => {
    conns.add(conn);
    try {
      // replicate the service's store (which holds the light-writer core) over
      // this connection. A client that joins the service topic pulls the core
      // into its own store from this.
      store.replicate(conn as any);
    } catch (err) {
      console.error("service: replicate failed", err);
    }
    // hand our light-writer key to whoever asks (the inviting peer does, once)
    const rpc = new ProtomuxRPC(conn, { handshake: SERVICE_HANDSHAKE });
    rpc.respond(
      SERVICE_KEY_METHOD,
      { responseEncoding: c.optionalBuffer },
      async () => lw.key,
    );
  });

  await swarm.listen();
  swarm.join(SERVICE_TOPIC, { server: true, client: true });

  // broadcast a price every INTERVAL_MS. The header is plaintext, so a peer can
  // route it by method without reading the payload; only the service appends it.
  let price = 100;
  let seq = 0;
  setInterval(() => {
    price *= 0.9 + Math.random() * 0.2; // random walk
    const msg = createMessage({
      id: seq++,
      method: "price",
      payload: b4a.from(String(price)),
    });

    (async function (message: Message): Promise<number> {
      return lw.append(encodeMessage(message));
    })(msg).catch((err) => {
      console.error("service: append failed", err);
    });
  }, INTERVAL_MS);

  // keep the process alive
  await new Promise(() => {});
}

runService().catch((err) => {
  console.error(err);
  process.exit(1);
});
