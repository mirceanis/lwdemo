/**
 * MINIMAL stub for `protomux-rpc` (untyped; ships no `types` field).
 *
 * ONLY the members the chat client touch are declared here. This is a temporary
 * stand-in so the project builds; another agent should replace it with a full
 * declaration (see `src/types/*.d.ts` for the house style) once the library
 * publishes types or the surface is stabilized.
 *
 * NOTE: the constructor's stream is the `hyperdht` `Connection` (a duplex) that
 * `hyperswarm` emits on its `connection` event. `request()` returns `any` so
 * callers can inspect the (optionally-encoded) response payload.
 */
declare module "protomux-rpc" {
  import { Connection } from "hyperdht";

  /** Options for a {@link ProtomuxRPC.request} / {@link ProtomuxRPC.respond}. */
  export interface RpcMessageOptions {
    requestEncoding?: unknown;
    responseEncoding?: unknown;
    valueEncoding?: unknown;
    timeout?: number;
  }

  /** Constructor options. */
  export interface ProtomuxRPCOptions {
    id?: number;
    protocol?: string;
    handshake?: Uint8Array | null;
    handshakeEncoding?: unknown;
  }

  /** A registered request handler. */
  export type RpcHandler = (value: any) => any | Promise<any>;

  /**
   * `protomux-rpc` — a request/response layer over a protomux channel. Extends
   * Node's `EventEmitter`; emits `open`, `error`, `close`, `destroy`.
   */
  export default class ProtomuxRPC {
    constructor(stream: Connection, options?: ProtomuxRPCOptions);

    /** Register a responder for `method` (3-arg: options + handler). */
    respond(
      method: string,
      options: RpcMessageOptions,
      handler: RpcHandler,
    ): this;
    /** Register a responder for `method` (2-arg: handler only). */
    respond(method: string, handler: RpcHandler): this;

    /** Remove a responder. */
    unrespond(method: string): this;

    /** Send a request; resolves with the (optionally-decoded) response. */
    request(
      method: string,
      value: any,
      options?: RpcMessageOptions,
    ): Promise<any>;

    /** Send a fire-and-forget event. */
    event(method: string, value: any, options?: RpcMessageOptions): void;

    cork(): void;
    uncork(): void;
    end(): Promise<void>;
    destroy(err?: unknown): void;

    // Event surface (subset the client uses).
    on(event: "open", listener: (handshake: Uint8Array) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }
}
