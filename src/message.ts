// The light-writer message format

import * as c from "compact-encoding";

// payload encryption scheme identifiers (referenced by header.encryption)
export const PLAINTEXT = 0;

// the codec: header (id, method, encryption, auth) + payload
export const message: c.Encoder<Message> = {
  preencode(state, m) {
    const { header } = m;
    c.uint.preencode(state, header.id);
    c.string.preencode(state, header.method);
    c.uint.preencode(state, header.encryption);
    c.optionalBuffer.preencode(state, header.auth);
    c.buffer.preencode(state, m.payload);
  },
  encode(state, m) {
    const { header } = m;
    c.uint.encode(state, header.id);
    c.string.encode(state, header.method);
    c.uint.encode(state, header.encryption);
    c.optionalBuffer.encode(state, header.auth);
    c.buffer.encode(state, m.payload);
  },
  decode(state) {
    const id = c.uint.decode(state);
    const method = c.string.decode(state);
    const encryption = c.uint.decode(state);
    const auth = c.optionalBuffer.decode(state);
    const payload = c.buffer.decode(state);

    return {
      header: { id, method, encryption, auth },
      payload,
    };
  },
};

// build a message with sane defaults: plaintext payload, an explicit id, and no
// auth (pass `auth` to make it an authenticated request)
export function createMessage(opts: CreateMessageOptions): Message {
  const { id = 0, method, payload, encryption = PLAINTEXT, auth = null } = opts;

  if (typeof method !== "string") throw new Error("method is required");

  return {
    header: {
      id,
      method,
      encryption,
      auth: auth ? Buffer.from(auth) : null,
    },
    payload: Buffer.from(payload),
  };
}

export const encode = (m: Message) => c.encode(message, m);
export const decode = (buf: Uint8Array) => c.decode(message, buf);

// the consumer side: decode a light-writer node and route by method.
//
// `handlers[method]` is `async (payload, header, ctx) => responseMessage|null`.
// Routing uses only the plaintext header, so a message can be accepted or
// rejected (unknown method, unsupported encryption, bad auth) without reading
// the payload - the stateless guarantee the header exists to provide.
//
// A handler that returns a message produces the response (typically written
// back through the paired light writer); null declines it.
export function dispatch(
  node: DispatchNode,
  handlers: Record<string, Handler>,
  ctx?: unknown,
): unknown {
  const m = c.decode(message, node.value);

  const handler = handlers[m.header.method];
  if (!handler) return null;

  return handler(m.payload, m.header, ctx);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The plaintext message header (decodable without touching the payload). */
export interface MessageHeader {
  /** The request id (a small integer, used by a consumer to de-dup responses). */
  id: number;
  /** The method name; the routing key (see {@link dispatch}). */
  method: string;
  /** The payload encryption scheme (see {@link PLAINTEXT}). */
  encryption: number;
  /** The auth token (a buffer), or `null` for an unauthenticated request. */
  auth: Uint8Array | null;
}

/** A message: a plaintext header plus a (possibly encrypted) payload. */
export interface Message {
  header: MessageHeader;
  payload: Uint8Array;
}

/** Options for {@link createMessage}. */
export interface CreateMessageOptions {
  id?: number;
  method: string;
  payload: Uint8Array | string;
  encryption?: number;
  auth?: Uint8Array | string | null;
}

/** A light-writer node as seen by {@link dispatch} (the consumer side). */
export interface DispatchNode {
  /** The encoded message bytes. */
  value: Uint8Array;
}

/** A dispatch handler: `(payload, header, ctx) => responseMessage|null`. */
export type Handler = (
  payload: Uint8Array,
  header: MessageHeader,
  ctx?: unknown,
) => unknown;
