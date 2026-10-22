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

import * as c from "compact-encoding";
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

export interface Envelope {
  header: {
    /** The writer's length when the message was appended: unique per writer. */
    id: number;
    /** The message's position in the list. */
    method: number;
    /** The payload's encryption scheme (see PLAINTEXT). */
    encryption: number;
    /** For authenticated services. */
    auth: Uint8Array | null;
  };
  payload: Uint8Array;
}

const envelope: c.Encoder<Envelope> = {
  preencode(state, m) {
    c.uint.preencode(state, m.header.id);
    c.uint.preencode(state, m.header.method);
    c.uint.preencode(state, m.header.encryption);
    c.optionalBuffer.preencode(state, m.header.auth);
    c.buffer.preencode(state, m.payload);
  },
  encode(state, m) {
    c.uint.encode(state, m.header.id);
    c.uint.encode(state, m.header.method);
    c.uint.encode(state, m.header.encryption);
    c.optionalBuffer.encode(state, m.header.auth);
    c.buffer.encode(state, m.payload);
  },
  decode(state) {
    const id = c.uint.decode(state);
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

export interface RpcMethod<T = any> {
  /** The wire id. */
  readonly method: number;
  readonly name: string;
  /** Resolves to the writer's new length. */
  send(value: T): Promise<number>;
}

/**
 * One sender per writer: a message's id is the writer's length when it is appended, which is
 * unique, and sends are serialized to keep it that way.
 */
export function createRpc(
  writer: LightWriter,
  messages: (Message | null)[],
): RpcMethod[] {
  let queue: Promise<unknown> = Promise.resolve();

  function send(method: number, payload: Uint8Array): Promise<number> {
    const task = queue.then(async () => {
      await writer.ready();
      const header = {
        id: writer.length,
        method,
        encryption: PLAINTEXT,
        auth: null,
      };
      return writer.append(encodeEnvelope({ header, payload }));
    });
    queue = task.catch(() => {});
    return task;
  }

  return messages.map((m, method) => ({
    method,
    name: m?.name ?? "(retired)",
    send: (value: unknown) =>
      m
        ? send(method, c.encode(m.encoding, value))
        : Promise.reject(new Error(`message ${method} is retired`)),
  }));
}

// ---------------------------------------------------------------------------
// Reader side
// ---------------------------------------------------------------------------

/** What a reader makes of each message, by message name. */
export type Handlers<R> = Record<
  string,
  (value: any, node: AutobeeNode) => R | Promise<R>
>;

/**
 * Reads the envelope of a node and calls the handler of the message it carries, returning what the
 * handler returned. A handler runs inside the reader's apply(), which can be re-run after a reorg,
 * so it only returns what to record and does nothing itself.
 *
 * Anything it can't or won't read (unknown or retired method, no handler for it, encrypted,
 * malformed) gives `undefined`: the writer is an outside party, and apply must not throw.
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
    return handlers[m.name](value, node);
  };
}
