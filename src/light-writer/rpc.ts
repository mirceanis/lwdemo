// Typed messages over a light writer, protomux style. Optional: a bare light writer only appends
// bytes (./light-writer), and this is one way to give them meaning.
//
// A message list is the vocabulary of a service: what its messages are called and how they are
// encoded. A message's position is its wire id: append only, never reorder, retire one by replacing
// it with `null`.
//
//   writer side:  createRpc(writer, messages)[i].send(value)
//   reader side:  routeMessages(messages, handlers)(node)   reads a node and calls the handler of
//                                                           the message it carries
//
// The vocabulary is shared, what to do with a message is not: the writer only sends, and every
// reader brings its own handlers.
//
// A writer is a one-way channel. A call that is answered is two writers, one each way, with a
// vocabulary each: the caller's writer carries the requests, the callee's carries the replies, and the
// same position in both lists is the same method. The request names where its answer goes, in `auth`
// (an address the callee echoes), because a callee's writer can be read by many.

import * as c from "compact-encoding";
import * as hc from "hypercore-crypto";
import type { AutobeeNode } from "autobee";
import type { LightWriter } from "./light-writer";

export interface Message<T = any> {
  /** For logs and for binding handlers; the wire id is the position, not the name. */
  name: string;
  /** How the payload is encoded. Plaintext for now. */
  encoding: c.Encoder<T>;
}

// ---------------------------------------------------------------------------
// The envelope: a plaintext header plus the payload. The header can be read without the payload, so
// a message can be routed or rejected statelessly.
// ---------------------------------------------------------------------------

export const PLAINTEXT = 0;

export interface Header {
  /** Random, so unique across writers: a message can be referred to by it. */
  id: Uint8Array;
  /** The message's position in the list. */
  method: number;
  /** The payload's encryption scheme (see PLAINTEXT). */
  encryption: number;
  /**
   * Opaque to the library. A service reads it to accept or reject a request; whoever made it reads it
   * back. A callee that answers copies the request's onto its reply, so it is not for secrets.
   */
  auth: Uint8Array | null;
}

export interface Envelope {
  header: Header;
  payload: Uint8Array;
}

const envelope: c.Encoder<Envelope> = {
  preencode(state, m) {
    c.fixed16.preencode(state, m.header.id);
    c.uint.preencode(state, m.header.method);
    c.uint.preencode(state, m.header.encryption);
    c.optionalBuffer.preencode(state, m.header.auth);
    c.buffer.preencode(state, m.payload);
  },
  encode(state, m) {
    c.fixed16.encode(state, m.header.id);
    c.uint.encode(state, m.header.method);
    c.uint.encode(state, m.header.encryption);
    c.optionalBuffer.encode(state, m.header.auth);
    c.buffer.encode(state, m.payload);
  },
  decode(state) {
    const id = c.fixed16.decode(state);
    const method = c.uint.decode(state);
    const encryption = c.uint.decode(state);
    const auth = c.optionalBuffer.decode(state);
    const payload = c.buffer.decode(state);
    return { header: { id, method, encryption, auth }, payload };
  },
};

export const encodeEnvelope = (m: Envelope) => c.encode(envelope, m);
export const decodeEnvelope = (buf: Uint8Array) => c.decode(envelope, buf);

// ---------------------------------------------------------------------------
// Writer side
// ---------------------------------------------------------------------------

/** What a sender can put in a message's header besides what it must. */
export interface SendOptions {
  /** Plaintext, so a callee can accept, reject or route a message without reading the payload. */
  auth?: Uint8Array;
}

export interface RpcMethod<T = any> {
  /** The wire id. */
  readonly method: number;
  readonly name: string;
  /** Resolves to the writer's new length. `opts` override the writer's defaults for this message. */
  send(value: T, opts?: SendOptions): Promise<number>;
}

/**
 * Typed sends on a writer. Each message gets a random id, so sends need no coordination: they can
 * run concurrently, and several senders can share a writer. `defaults` go in the header of every
 * message the writer sends (a caller's writer is made for one reply address, carried in `auth`).
 */
export function createRpc(
  writer: LightWriter,
  messages: (Message | null)[],
  defaults: SendOptions = {},
): RpcMethod[] {
  const send = (method: number, payload: Uint8Array, opts: SendOptions) => {
    const header: Header = {
      id: hc.randomBytes(16),
      method,
      encryption: PLAINTEXT,
      auth: opts.auth ?? defaults.auth ?? null,
    };
    return writer.append(encodeEnvelope({ header, payload }));
  };

  return messages.map((m, method) => ({
    method,
    name: m?.name ?? "(retired)",
    send: (value: unknown, opts: SendOptions = {}) =>
      m
        ? send(method, c.encode(m.encoding, value), opts)
        : Promise.reject(new Error(`message ${method} is retired`)),
  }));
}

// ---------------------------------------------------------------------------
// Reader side
// ---------------------------------------------------------------------------

/**
 * What a reader makes of each message, by message name. The header comes with the value: a reader
 * that answers needs `auth`, and one that is not the addressee can tell. A handler can decline a
 * message it was given by returning `undefined`, as it can for one it was not.
 */
export type Handlers<R> = Record<
  string,
  (
    value: any,
    node: AutobeeNode,
    header: Header,
  ) => R | undefined | Promise<R | undefined>
>;

/**
 * Reads the envelope of a node and calls the handler of the message it carries, returning what the
 * handler returned. A handler runs inside the reader's apply(), which can be re-run after a reorg,
 * so it only returns what to record and does nothing itself.
 *
 * Anything it can't or won't read gives `undefined`: the writer is an outside party, and
 * apply must not throw.
 */
export function routeMessages<R>(
  messages: (Message | null)[],
  handlers: Handlers<R>,
): (node: AutobeeNode) => Promise<R | undefined> {
  for (const name of Object.keys(handlers)) {
    if (!messages.some((m) => m?.name === name)) {
      throw new Error(`there is no message named "${name}" to handle`);
    }
  }

  return async (node) => {
    if (!node.value) return undefined;

    let env: Envelope;
    try {
      env = decodeEnvelope(node.value);
    } catch {
      return undefined;
    }
    if (env.header.encryption !== PLAINTEXT) return undefined; // no stateless way to read it (yet)

    const m = messages[env.header.method];
    if (!m || !Object.hasOwn(handlers, m.name)) return undefined;

    let value: unknown;
    try {
      value = c.decode(m.encoding, env.payload);
    } catch {
      return undefined;
    }
    try {
      return await handlers[m.name](value, node, env.header);
    } catch {
      return undefined;
    }
  };
}
