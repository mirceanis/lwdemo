// The chat room's side of the weather service: how the room invites it, and how it folds its answers
// into the view. All of this is the room's. The service (./weather-service) knows nothing about it: it
// publishes where to find it, how to pair with it, what its methods look like and a client for them.
//
//   `!weather`:      invite(room, key)          record the service's key in the room (key from `pair`)
//   room's apply():  process(nodes, view, room) take the replies for this room in, observe invitations
//   every peer:      serviceKey(view)           the replies to follow, once the room knows the service
//
// Asking is not the room's business, it is a peer's: a peer's WeatherClient writes to its own light
// writer and the room never sees the request. The answer is the room's: it comes back on the service's
// light writer, which every peer of the room follows, and it only has to be for this room to become a
// line. As with any light writer, the service is never added to the room.

import * as b4a from "b4a";
import * as hc from "hypercore-crypto";
import type Autobee from "autobee";
import type { AutobeeNode, Hyperbee } from "autobee";
import { routeMessages, type Handlers } from "../light-writer/rpc";
import { putLine, type ChatMessage } from "./chat";
import * as service from "./weather-service";

/**
 * Where the room wants its answers sent. The service copies it onto its reply and cannot read
 * anything into it: it is a hash of the room's key, so a service never learns the key. It stands in
 * for a reply capability: an address, without the authority or the encryption a capability carries.
 */
export const replyAddress = (room: Uint8Array) =>
  hc.hash(b4a.concat([b4a.from("weather/"), room]));

// What a measurement says in a chat line.
const say: Record<service.Method, (r: service.Measurement) => string> = {
  time: (r) => `it is ${new Date(r.value).toISOString().slice(11, 16)}`,
  temperature: (r) => `${r.value} °C`,
  uvIndex: (r) => `UV index ${r.value}`,
  wind: (r) => `wind ${r.value} km/h`,
  cloudCoverage: (r) => `${r.value}% cloud cover`,
};

// What the room makes of each answer: a line from the weather bot, if the answer is for this room.
// The service's light writer carries the answers to every room that follows it.
function handlers(address: Uint8Array): Handlers<ChatMessage> {
  return Object.fromEntries(
    service.METHODS.map((method) => [
      method,
      (
        r: service.Measurement,
        node: AutobeeNode,
        header,
      ): ChatMessage | undefined =>
        header.auth && b4a.equals(header.auth, address)
          ? {
              name: "weather bot",
              text: `${say[method](r)} at ${r.lat},${r.lon}`,
              timestamp: node.timestamp,
            }
          : undefined,
    ]),
  );
}

// An invitation is a room append: a prefix and the service's key. (The room's other appends are
// chat lines, which are JSON.)
const INVITE = b4a.from("invite:weather:");

export const encodeInvite = (key: Uint8Array) => b4a.concat([INVITE, key]);

function decodeInvite(value: Uint8Array): Uint8Array | null {
  const ok =
    value.byteLength === INVITE.byteLength + 32 &&
    b4a.equals(value.subarray(0, INVITE.byteLength), INVITE);
  return ok ? value.subarray(INVITE.byteLength) : null;
}

// What the room knows about the service: its key, in the room's view. (Chat lines have 8-byte keys.)
const SERVICE_KEY = b4a.from("service/weather");

export async function serviceKey(view: Hyperbee): Promise<Uint8Array | null> {
  return (await view.get(SERVICE_KEY))?.value ?? null;
}

/** Append an invitation to the room: the key of the service's light writer, from pairing with it. */
export function invite(room: Autobee, key: Uint8Array): Promise<void> {
  return room.append(encodeInvite(key), { optimistic: !room.writable });
}

/**
 * Call from the room's apply(), before the room's own logic, and carry on with the nodes it returns.
 *
 *  - The service's nodes are consumed: read as answers, recorded as lines if they are for this room,
 *    and not returned. They are not room appends, and the room would admit their writer.
 *  - An invitation is observed: it records the service's key, and is still returned, because it is
 *    the room's own node and the room's policy still applies to its writer.
 */
export async function process(
  nodes: AutobeeNode[],
  view: Hyperbee,
  room: Uint8Array,
): Promise<AutobeeNode[]> {
  const receive = routeMessages(service.replies, handlers(replyAddress(room)));
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
