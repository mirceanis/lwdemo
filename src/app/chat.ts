// The room's own data: a chat line, keyed by its 8-byte timestamp. The room folds the price
// service's feed into its view as lines of this kind too (see ./price-feed).

import * as b4a from "b4a";
import * as c from "compact-encoding";
import type { Hyperbee } from "autobee";

export interface ChatMessage {
  name: string;
  text: string;
  timestamp: number;
}

export const encodeChat = (m: ChatMessage): Uint8Array =>
  b4a.from(JSON.stringify(m), "utf8");
export const decodeChat = (buf: Uint8Array): ChatMessage =>
  JSON.parse(b4a.toString(buf, "utf8"));

/** Record a line in the room's view. Called from apply(). */
export async function putLine(view: Hyperbee, m: ChatMessage) {
  // lines are keyed by timestamp
  while (await view.get(c.encode(c.uint64, m.timestamp))) m.timestamp++;
  const w = view.write();
  w.tryPut(c.encode(c.uint64, m.timestamp), encodeChat(m));
  await w.flush();
}
