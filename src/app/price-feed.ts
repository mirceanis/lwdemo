// The chat room's side of the price service: how the room takes the service's feed in, reads it,
// and folds it into its view. All of this is the room's. The service (./price-service) knows
// nothing about it; it only publishes where to find it, how to ask it for its key and what its
// messages look like, and the room builds on that.
//
//   `!service`:      invite(conn, room)    ask the service for its key, record it in the room
//   room's apply():  process(nodes, view)  take the feed's nodes in, observe invitations
//   every peer:      serviceKey(view)      the feed to wake up on, once the room knows it
//
// The service's light writer is never added to the room. process() consumes its nodes, so the room's
// own logic (which admits writers) never sees them. All the room keeps is the service's public key.

import * as b4a from "b4a";
import type Autobee from "autobee";
import type { AutobeeNode, Hyperbee } from "autobee";
import type { Connection } from "hyperdht";
import { routeMessages } from "../light-writer/rpc";
import { putLine, type ChatMessage } from "./chat";
import * as service from "./price-service";

// What the room makes of each message the service can say: a line from the price bot.
const receive = routeMessages(service.messages, {
  price: (price: number, node): ChatMessage => ({
    name: "price bot",
    text: String(price),
    timestamp: node.timestamp,
  }),
});

// An invitation is a room append: a prefix and the service's key. (The room's other appends are
// chat lines, which are JSON.)
const INVITE = b4a.from("invite:price:");

export const encodeInvite = (key: Uint8Array) => b4a.concat([INVITE, key]);

function decodeInvite(value: Uint8Array): Uint8Array | null {
  const ok =
    value.byteLength === INVITE.byteLength + 32 &&
    b4a.equals(value.subarray(0, INVITE.byteLength), INVITE);
  return ok ? value.subarray(INVITE.byteLength) : null;
}

// What the room knows about the service: its key, in the room's view. (Chat lines have 8-byte keys.)
const SERVICE_KEY = b4a.from("service/price");

export async function serviceKey(view: Hyperbee): Promise<Uint8Array | null> {
  return (await view.get(SERVICE_KEY))?.value ?? null;
}

/**
 * Ask the service on `conn` for its key, then append an invitation to the room. Once it is applied,
 * every peer of the room knows the service.
 */
export async function invite(
  conn: Connection,
  room: Autobee,
): Promise<Uint8Array> {
  const key = await service.requestKey(conn);
  await room.append(encodeInvite(key), { optimistic: !room.writable });
  return key;
}

/**
 * Call from the room's apply(), before the room's own logic, and carry on with the nodes it returns.
 *
 *  - The service's nodes are consumed: read as messages, recorded as lines, and not returned. They
 *    are not room appends, and the room would admit their writer.
 *  - An invitation is observed: it records the service's key, and is still returned, because it is
 *    the room's own node and the room's policy still applies to its writer.
 */
export async function process(
  nodes: AutobeeNode[],
  view: Hyperbee,
): Promise<AutobeeNode[]> {
  const rest: AutobeeNode[] = [];
  for (const node of nodes) {
    const feed = await serviceKey(view);
    if (feed && node.value && b4a.equals(node.key, feed)) {
      const line = await receive(node);
      if (line) await putLine(view, line);
      continue; // consumed
    }
    const invited = node.value && decodeInvite(node.value);
    if (invited) {
      const w = view.write();
      w.tryPut(SERVICE_KEY, invited);
      await w.flush();
    }
    rest.push(node);
  }
  return rest;
}
