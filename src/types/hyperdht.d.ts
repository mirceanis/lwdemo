/**
 * Type definitions for `hyperdht` (v6.34.1).
 *
 * The package ships only `index.js` plus `lib/*.js` (CommonJS) with no
 * `types`/`typings` field, so TypeScript reports TS7016 for it. This file
 * provides an ambient module declaration so the library can be used in a
 * TypeScript project.
 *
 * Source of truth: `node_modules/hyperdht/index.js` and `lib/*.js`. `HyperDHT`
 * `extends DHT` (from the untyped `dht-rpc` package), and `connect()` returns a
 * `@hyperswarm/secret-stream` `NoiseSecretStream`. Both `dht-rpc` and
 * `@hyperswarm/secret-stream` ship no types, so the inherited DHT surface and
 * the connection type below are reconstructed from the actual source. Types
 * were derived from that source, NOT guessed from docs.
 *
 * Why some types are marked FOLLO-UP at the bottom:
 *  - The connection stream is `@hyperswarm/secret-stream`'s `NoiseSecretStream`
 *    (a `streamx` `Duplex` subclass). `streamx` ships types, but
 *    `@hyperswarm/secret-stream` does not, and `streamx` is a transitive
 *    dependency here (not resolvable from the project root), so {@link
 *    Connection} is hand-written from the `NoiseSecretStream` source rather
 *    than extending `import('streamx').Duplex`.
 *  - The DHT base class (`dht-rpc`) is a transitive dependency with no types;
 *    the inherited methods/events on {@link HyperDHT} are reconstructed from
 *    the `dht-rpc` package `index.js` + `lib/*.js`.
 *  - A few leaf types come from native/untyped deps ({@link RawStream} is
 *    `udx-native`, {@link RelayConnection} is `blind-relay`, the routing table
 *    is `kademlia-routing-table`). These have no `.d.ts` and are not resolvable
 *    from the project root, so they are best-guesses marked FOLLO-UP.
 *
 * `KeyPair` is reused from `hypercore-crypto` via an inline `import()` type
 * query: `hyperdht`'s `createKeyPair` (Ed25519) produces the same
 * `{ publicKey: 32B, secretKey: 64B }` shape as `hypercore-crypto`'s
 * `keyPair()`.
 */

declare module "hyperdht" {
  /**
   * A signing key pair (Ed25519), reused from `hypercore-crypto`.
   *
   * `hyperdht`'s `createKeyPair` / the default `HyperDHT.keyPair` produce
   * structurally identical `{ publicKey (32B), secretKey (64B) }` pairs.
   * Declared as an inline `import()` type query (not a top-level `import`) so
   * this file stays an ambient module declaration and keeps *declaring*
   * `hyperdht` rather than augmenting a non-existent module.
   */
  type KeyPair = import("hypercore-crypto").KeyPair;

  /**
   * A generic event-emitter surface.
   *
   * `HyperDHT`, `Server`, `Connection` and `Query` all extend Node's `events`
   * `EventEmitter` (or `bare-events` under the bare runtime). This mirrors the
   * strongly-typed emitter shape that `streamx` exposes, so `.on` / `.emit` are
   * type-safe against an event map.
   */
  interface EventMap {
    [event: string | symbol]: unknown[];
  }

  /**
   * A listener for an event whose payload type is `A`.
   *
   * @typeParam A The event's argument tuple (e.g. `[conn: Connection]`).
   */
  interface EventHandler<A extends unknown[] = unknown[], R = unknown> {
    (...args: A): R;
  }

  /**
   * The event-emitter base shared by {@link HyperDHT}, {@link Server},
   * {@link Connection} and {@link Query}.
   *
   * @typeParam M The event map for the emitter.
   */
  interface Emitter<M extends EventMap = EventMap> {
    /** Register a persistent listener. */
    on<E extends keyof M, R>(name: E, listener: EventHandler<M[E], R>): this;

    /** Register a one-shot listener (removed after it fires once). */
    once<E extends keyof M, R>(name: E, listener: EventHandler<M[E], R>): this;

    /** Remove a previously-registered listener. */
    off<E extends keyof M, R>(name: E, listener: EventHandler<M[E], R>): this;

    /** Add a listener (alias of {@link on}). */
    addListener<E extends keyof M, R>(
      name: E,
      listener: EventHandler<M[E], R>,
    ): this;

    /** Add a one-shot listener (alias of {@link once}). */
    addOnceListener<E extends keyof M, R>(
      name: E,
      listener: EventHandler<M[E], R>,
    ): this;

    /** Prepend a listener to the front of the list. */
    prependListener<E extends keyof M, R>(
      name: E,
      listener: EventHandler<M[E], R>,
    ): this;

    /** Prepend a one-shot listener to the front of the list. */
    prependOnceListener<E extends keyof M, R>(
      name: E,
      listener: EventHandler<M[E], R>,
    ): this;

    /** Remove a listener (alias of {@link off}). */
    removeListener<E extends keyof M, R>(
      name: E,
      listener: EventHandler<M[E], R>,
    ): this;

    /** Remove all listeners for an event (or all events when omitted). */
    removeAllListeners<E extends keyof M>(name?: E): this;

    /** Emit an event, invoking its listeners synchronously. */
    emit<E extends keyof M>(name: E, ...args: M[E]): boolean;

    /** Return the listeners registered for an event. */
    listeners<E extends keyof M, R>(name: E): EventHandler<M[E], R>[];

    /** Return the listeners for an event, including those hidden behind `once`. */
    rawListeners<E extends keyof M, R>(name: E): EventHandler<M[E], R>[];

    /** Return the names of all events with listeners. */
    eventNames(): (string | symbol)[];

    /** Return the number of listeners for an event. */
    listenerCount<E extends keyof M>(name: E): number;

    /** Return the current max-listener threshold. */
    getMaxListeners(): number;

    /** Set the max-listener threshold. */
    setMaxListeners(n: number): this;
  }

  /**
   * A network address (`{ host, port }`), as used for bootstrap nodes, relays
   * and DHT peers. `hyperdht` encodes these with `compact-encoding`'s
   * `ipv4Address` / `ipv6Address`, i.e. a host string plus a numeric port.
   */
  export interface Address {
    /** Host or hostname (IPv4/IPv6 literal, or a hostname). */
    host: string;
    /** UDP/TCP port. */
    port: number;
  }

  /**
   * A node of the Kademlia DHT, as seen in a query and emitted on
   * `add-node` / `remove-node`.
   *
   * FOLLO-UP: `id` is a 32-byte BLAKE2 hash of `host:port`
   * (`peer.id(host, port)`); it can be `null` for a not-yet-identified node
   * (e.g. a raw reply before its id is derived). `host`/`port` come from the
   * `compact-encoding` `ipv4Address`/`ipv6Address` decode.
   */
  export interface Node {
    /** The node's 32-byte id (hash of `host:port`), or `null`. */
    id: Uint8Array | null;
    /** The node's host. */
    host: string;
    /** The node's port. */
    port: number;
  }

  /**
   * A discovered peer, as encoded by `hyperdht`'s `peer` compact-encoding
   * schema and carried in a {@link LookupReply} / {@link FindPeerReply}.
   */
  export interface Peer {
    /** The peer's 32-byte public key. */
    publicKey: Uint8Array;
    /** Known relay addresses for this peer (may be empty). */
    relayAddresses: Address[];
  }

  /**
   * The raw (unencrypted) socket stream a {@link Connection} is built on.
   *
   * At runtime this is a `udx-native` `Stream` (created by
   * `HyperDHT.createRawStream` / the `RawStreamSet`). `udx-native` is a native
   * module that ships no types and is a transitive dependency (not resolvable
   * from the project root), so this is a best-guess of the surface `hyperdht`
   * and `@hyperswarm/secret-stream` touch.
   *
   * FOLLO-UP: if `udx-native` gains types, replace this with
   * `import('udx-native').Stream`.
   */
  export interface RawStream extends Emitter<RawStreamEvents> {
    /** The underlying socket this stream is bound to. */
    socket: unknown;
    /** The remote id (udx stream id) of the peer. */
    id: number;
    /** The remote host, once connected. */
    remoteHost: string;
    /** The remote port, once connected. */
    remotePort: number;
    /** Whether the raw stream is connected. */
    readonly connected: boolean;
    /** Whether the raw stream has been destroyed. */
    readonly destroyed: boolean;
    /** Whether the raw stream is being destroyed. */
    readonly destroying: boolean;

    /** Connect this raw stream to a socket/remote. */
    connect(socket: unknown, id: number, port: number, host: string): void;

    /** Re-point an already-connected raw stream at a new remote. */
    changeRemote(
      socket: unknown,
      id: number,
      port: number,
      host: string,
    ): Promise<boolean> | boolean;

    /** Hint the expected message size (used for congestion control). */
    setContentSize(size: number): void;

    /** Resume reading from the raw stream. */
    resume(): this;

    /** Pause reading from the raw stream. */
    pause(): this;

    /** End the raw stream. */
    end(): this;

    /** Destroy the raw stream. */
    destroy(err?: Error): void;

    /** Force the raw stream to flush any buffered data. */
    flush(): Promise<boolean>;

    /** Write data to the raw stream. */
    write(data: Uint8Array): boolean;

    /** Send an unordered (out-of-band) message. */
    send(buffer: Uint8Array): void;

    /** Fire-and-forget unordered message (best-effort). */
    trySend(buffer: Uint8Array): void;

    /** Set the keep-alive interval (ms). */
    setKeepAlive(ms: number): void;

    /** Return the local address of the raw stream. */
    address(): Address;
  }

  /**
   * The event map for a {@link RawStream}.
   */
  export interface RawStreamEvents extends EventMap {
    /** Emitted when the raw stream connects. */
    connect: [];
    /** Emitted when the raw stream closes. */
    close: [];
    /** Emitted when an error occurs. */
    error: [err: Error];
    /** Emitted with a chunk of readable data. */
    data: [data: Uint8Array];
    /** Emitted when the readable side ends. */
    end: [];
    /** Emitted when the writable side is drained. */
    drain: [];
    /** Emitted with an unordered (out-of-band) message. */
    message: [data: Uint8Array];
  }

  /**
   * An options object for {@link HyperDHT.createRawStream}.
   */
  export interface RawStreamOptions {
    /** Whether the stream is framed (length-prefixed). Default `true`. */
    framed?: boolean;

    /**
     * Firewall the incoming raw traffic. Return `true` to reject a packet from
     * the given `socket`/`port`/`host`.
     */
    firewall?(socket: unknown, port: number, host: string): boolean;
  }

  /**
   * A connection between two peers.
   *
   * At runtime this is a `@hyperswarm/secret-stream` `NoiseSecretStream`, a
   * `streamx` `Duplex` subclass. `hyperdht`'s `connect()` returns one, and a
   * `Server` emits them on its `connection` event. `@hyperswarm/secret-stream`
   * ships no types (and `streamx` is not resolvable from the project root), so
   * this is hand-written from the `NoiseSecretStream` source — it captures the
   * duplex read/write surface plus the secret-stream extras.
   *
   * FOLLO-UP: if `@hyperswarm/secret-stream` ships types, this should become
   * `import('streamx').Duplex` intersected with the secret-stream props/events
   * (or, better, `typeof (import('@hyperswarm/secret-stream')).default`).
   */
  export interface Connection extends Emitter<ConnectionEvents> {
    /**
     * Write data into the stream (encrypted). Accepts bytes or a string
     * (strings are encoded to UTF-8 internally).
     *
     * @returns `false` when the caller should pause (backpressure).
     */
    write(data: Uint8Array | string): boolean;

    /** End the writable side of the stream. */
    end(data?: Uint8Array | string): this;

    /** Force the stream to close (optionally with an error). */
    destroy(err?: Error | null): void;

    /** Resume reading from the stream. */
    resume(): this;

    /** Pause reading from the stream. */
    pause(): this;

    /** Pipe this stream (as a source) into `dest`. */
    pipe<S>(dest: S, cb?: (err: Error | null) => void): S;

    /** Set the default encoding for data read from the stream. */
    setEncoding(encoding: BufferEncoding): this;

    /** Cork buffering of writes (call `uncork()` to flush). */
    cork(): void;

    /** Flush corked writes. */
    uncork(): void;

    /** Whether the readable side is active. */
    readonly;
    readable: boolean;
    /** Whether the writable side is active. */
    readonly;
    writable: boolean;
    /** Whether the stream has been destroyed. */
    readonly;
    destroyed: boolean;
    /** Whether the stream is currently being destroyed. */
    readonly;
    destroying: boolean;

    /** Whether this side initiated the connection. */
    isInitiator: boolean;
    /** This peer's own (local) public key (32 bytes), once the handshake completes. */
    publicKey: Uint8Array | null;
    /** The remote peer's public key (32 bytes), once the handshake completes. */
    remotePublicKey: Uint8Array | null;
    /** The Noise handshake hash (32 bytes), once the handshake completes. */
    handshakeHash: Uint8Array | null;
    /** `true` once the stream has fully opened (handshake done). */
    connected: boolean;
    /** Keep-alive interval in ms (0 = disabled). */
    keepAlive: number;
    /** Idle timeout in ms (0 = disabled). */
    timeout: number;
    /** Whether sending (as opposed to just receiving) is enabled. */
    enableSend: boolean;
    /** Total bytes written to the underlying raw stream. */
    rawBytesWritten: number;
    /** Total bytes read from the underlying raw stream. */
    rawBytesRead: number;
    /** Arbitrary user data a caller may attach; `null` by default. */
    userData: unknown;
    /** The (unencrypted) raw stream this connection is built on, if any. */
    rawStream: RawStream | null;
    /** The relay connection, if this connection is relayed (else `null`). */
    relay: RelayConnection | null;
    /** The active holepuncher, if this connection is hole-punching (else `null`). */
    puncher: unknown;

    /**
     * A promise that resolves when the stream has opened.
     *
     * @note Resolves to `true` when opened, `false` when it was destroyed
     *   before opening.
     */
    opened: Promise<boolean>;

    /** Begin/continue the handshake against a raw stream. */
    start(
      rawStream: RawStream | null,
      opts?: {
        handshake?: NoiseHandshake | null;
        keyPair?: KeyPair | null;
        keepAlive?: number;
        timeout?: number;
        data?: Uint8Array;
        ended?: boolean;
      },
    ): void;

    /** Set the idle timeout (ms) after which the connection is destroyed. */
    setTimeout(ms: number): void;

    /** Set the keep-alive interval (ms); 0 disables it. */
    setKeepAlive(ms: number): void;

    /** Send an empty (zero-byte) keep-alive message. */
    sendKeepAlive(): void;

    /**
     * Wait for the stream to be opened and drained.
     *
     * @returns `true` if opened & drained, `false` if it failed/closed.
     */
    flush(): Promise<boolean>;

    /**
     * Send an unordered (out-of-band) message. Requires a `udx`-backed raw
     * stream; otherwise a no-op.
     */
    send(buffer: Uint8Array): void;

    /** Fire-and-forget unordered message (best-effort). */
    trySend(buffer: Uint8Array): void;

    /**
     * Allocate a (corked) plain buffer to write into directly. Returns a view
     * over the wrapped buffer; the caller fills it and then `write`s it.
     */
    alloc(len: number): Uint8Array;

    /** Serialize a debug snapshot of the stream. */
    toJSON(): {
      isInitiator: boolean;
      publicKey: string | null;
      remotePublicKey: string | null;
      connected: boolean;
      destroying: boolean;
      destroyed: boolean;
      rawStream: unknown;
    };
  }

  /**
   * The event map for a {@link Connection}.
   *
   * The first set is the standard `streamx` duplex events; `handshake`,
   * `connect` and `message` are `@hyperswarm/secret-stream` extensions.
   *
   * FOLLO-UP: the exact `streamx` `Duplex` event set (and whether `streamx`
   * emits an `open` event) is worth confirming against `streamx`'s own types
   * once `streamx` is resolvable; the source emits `handshake`, `connect` and
   * `message` explicitly.
   */
  export interface ConnectionEvents extends EventMap {
    /** Emitted when the stream closes. */
    close: [];
    /** Emitted when an error occurs. */
    error: [err: Error];
    /** Emitted with a chunk of readable data. */
    data: [data: Uint8Array];
    /** Emitted when the writable side is drained and more data can be written. */
    drain: [];
    /** Emitted when the readable side ends. */
    end: [];
    /** Emitted when the writable side is finished. */
    finish: [];
    /** Emitted when the stream becomes readable. */
    readable: [];
    /** Emitted with the destination when the stream is piped. */
    pipe: [dest: unknown];
    /** Emitted when the pipe is removed. */
    piping: [dest: unknown];
    /** Emitted once the Noise handshake completes. (secret-stream extension) */
    handshake: [];
    /** Emitted when the stream connects (opens). (secret-stream extension) */
    connect: [];
    /** Emitted with an out-of-band (unordered) message. (secret-stream extension) */
    message: [data: Uint8Array];
  }

  /**
   * The Noise handshake handle passed to {@link Connection.start}.
   *
   * FOLLO-UP: this is `@hyperswarm/secret-stream`'s `Handshake` (from
   * `noise-handshake`); it ships no types. Best-guess of the observable fields.
   */
  export interface NoiseHandshake {
    /** The local key pair used for the handshake. */
    keyPair: KeyPair;
    /** The outgoing (transmit) secret-stream keys. */
    tx: Uint8Array;
    /** The incoming (receive) secret-stream keys. */
    rx: Uint8Array;
    /** The 32-byte handshake hash. */
    hash: Uint8Array;
    /** The local public key. */
    publicKey: Uint8Array;
    /** The remote public key. */
    remotePublicKey: Uint8Array;
  }

  /**
   * A DHT query. Returned by {@link HyperDHT.query} and the higher-level
   * {@link HyperDHT.lookup} / {@link HyperDHT.announce} /
   * {@link HyperDHT.findPeer} helpers.
   *
   * A query is a `streamx` `Readable` (hence async-iterable): iterating it
   * yields the *mapped* reply items (see {@link LookupReply} and friends), and
   * `finished()` resolves once all closest nodes have replied. `streamx` is not
   * resolvable from the project root, so the read/emit surface is hand-written
   * from the `dht-rpc` `Query` source.
   *
   * @typeParam T The mapped reply item yielded by the query (e.g.
   *   {@link LookupReply} for a lookup).
   */
  export interface Query<T = QueryNode> extends Emitter<QueryEvents> {
    /** The local DHT this query runs against. */
    readonly dht: HyperDHT;
    /** The 32-byte query target. */
    readonly target: Uint8Array;
    /** The compact-encoding command id this query uses. */
    readonly command: number;
    /** The query value (request payload), if any. */
    readonly value: Uint8Array | null;
    /** Number of successful replies so far. */
    successes: number;
    /** Number of errored replies so far. */
    errors: number;
    /** Maximum concurrent in-flight requests. */
    concurrency: number;
    /** Whether the query is destroyed. */
    readonly destroyed: boolean;

    /**
     * The closest DHT nodes seen during the query (derived from
     * `closestReplies`).
     */
    readonly closestNodes: Node[];

    /**
     * Resolve when the query has finished (all nodes have replied).
     *
     * @rejects On a query error (a "too few nodes responded" style failure).
     */
    finished(): Promise<void>;

    /** Force the query to close immediately. */
    destroy(err?: Error): void;

    /** Resume reading from the query. */
    resume(): this;

    /** Pause reading from the query. */
    pause(): this;

    /** Async-iterate the mapped reply items. */
    [Symbol.asyncIterator](): AsyncIterator<T>;
  }

  /**
   * The event map for a {@link Query}.
   */
  export interface QueryEvents extends EventMap {
    /** Emitted with a mapped reply item. */
    data: [item: QueryNode];
    /** Emitted when the query errors. */
    error: [err: Error];
    /** Emitted when the query closes. */
    close: [];
  }

  /**
   * The base shape shared by every mapped reply item yielded by a query.
   */
  export interface QueryReplyBase {
    /** The token of this hop (used to commit/acknowledge a reply). */
    token: number;
    /** The DHT node that produced this reply. */
    from: Node;
    /** The DHT node the query was routed through on the way out. */
    to: Node;
  }

  /**
   * A query item yielded by {@link HyperDHT.lookup} /
   * {@link HyperDHT.announce} (from `mapLookup`).
   */
  export interface LookupReply extends QueryReplyBase {
    /** The peers advertised on this hop. */
    peers: Peer[];
    /** A monotonically-increasing bump counter for the topic (0 if absent). */
    bump: number;
  }

  /**
   * A query item yielded by {@link HyperDHT.findPeer} (from `mapFindPeer`).
   */
  export interface FindPeerReply extends QueryReplyBase {
    /** The single peer found on this hop. */
    peer: Peer;
  }

  /**
   * A query item yielded by {@link HyperDHT.immutableGet} (from `mapImmutable`).
   */
  export interface ImmutableReply extends QueryReplyBase {
    /** The immutable value stored at the target. */
    value: Uint8Array;
  }

  /**
   * A query item yielded by {@link HyperDHT.mutableGet} (from `mapMutable`).
   */
  export interface MutableReply extends QueryReplyBase {
    /** The sequence number of the value. */
    seq: number;
    /** The stored value. */
    value: Uint8Array;
    /** The 64-byte signature over the value. */
    signature: Uint8Array;
  }

  /**
   * The generic item type a {@link Query} yields.
   *
   * Most callers use a concrete reply type (e.g. {@link LookupReply}); this
   * default is only used when the query item shape is not pinned.
   */
  export type QueryNode = QueryReplyBase;

  /**
   * Options accepted by {@link HyperDHT.query} (and the higher-level lookup
   * helpers). These are forwarded to the underlying `dht-rpc` `Query`.
   */
  export interface QueryOptions {
    /** Custom map applied to each raw node before it is yielded. */
    map?(node: QueryNode): QueryNode;

    /** Commit callback invoked for each closest reply once the query flushes. */
    commit?(
      reply: QueryReplyBase,
      dht: HyperDHT,
      query: Query,
    ): Promise<unknown>;

    /** Reuse an existing session instead of creating one. */
    session?: Session;
    /** Pre-seed the query with these nodes (as `{ host, port }` or {@link Node}). */
    nodes?: (Address | Node)[];
    /** Pre-seed the query with these closest replies (from a prior query). */
    closestReplies?: QueryNode[];
    /** Max concurrent in-flight requests. */
    concurrency?: number;
    /** Number of retries per node (0 disables; default 5, 3 for internal). */
    retries?: number;
    /** Force the request (no retries on the initial hop). */
    force?: boolean;
    /** Only consider the closest nodes (skip broadening). */
    onlyClosestNodes?: boolean;
  }

  /**
   * A DHT session. A session groups requests so congestion control and lifetime
   * can be scoped to one logical unit (e.g. a single connection's discovery).
   *
   * FOLLO-UP: this is `dht-rpc`'s `Session`; it ships no types. Reconstructed
   * from `lib/session.js`.
   */
  export interface Session {
    /** The DHT this session belongs to. */
    readonly dht: HyperDHT;
    /** The number of in-flight requests belonging to this session. */
    readonly inflight: unknown[];

    /** Run a query within this session. */
    query(
      req: { target: Uint8Array; command: number; value: Uint8Array | null },
      opts?: QueryOptions,
    ): Query;

    /** Make a single request within this session. */
    request(
      req: {
        token?: number;
        command: number;
        target?: Uint8Array | null;
        value?: Uint8Array | null;
      },
      to: Address,
      opts?: RequestOptions,
    ): Promise<Request>;

    /** Ping a host within this session. */
    ping(to: Address, opts?: RequestOptions): Promise<Request>;

    /** Destroy the session, aborting its in-flight requests. */
    destroy(err?: Error): void;
  }

  /**
   * Options for a low-level {@link HyperDHT.request} / {@link Session.request}.
   *
   * FOLLO-UP: reconstructed from `dht-rpc`'s `request`/`ping`/`session`; the
   * package ships no types. `socket` reuses a specific pooled socket.
   */
  export interface RequestOptions {
    /** Reuse this specific socket for the request. */
    socket?: unknown;
    /** Disable retries (0). */
    retry?: boolean;
    /** TTL (seconds) for the request, if supported by the socket. */
    ttl?: number;
  }

  /**
   * A single DHT request/reply, resolved by {@link HyperDHT.request} /
   * {@link HyperDHT.ping}.
   *
   * FOLLO-UP: this is the `dht-rpc` request object (from `io.js`); it ships no
   * types. Best-guess of the fields a caller reads.
   */
  export interface Request {
    /** The reply's public key / id, if any. */
    id: Uint8Array | null;
    /** The node the request was sent to. */
    to: Node;
    /** The node the reply came from. */
    from: Node;
    /** The round-trip token. */
    token: number;
    /** The query target, if any. */
    target: Uint8Array | null;
    /** The reply value, if any. */
    value: Uint8Array | null;
    /** The measured round-trip time (ms), if any. */
    rtt: number;
    /** The reply command. */
    command: number;
    /** A non-zero error code, if the request failed. */
    error: number;
    /** The closer nodes advertised in the reply, if any. */
    closerNodes: Node[] | null;
  }

  /**
   * A DHT plugin. Registered via {@link HyperDHT.register}; it can intercept
   * incoming requests, hook the DHT lifecycle, and issue plugin-scoped queries.
   */
  export interface Plugin {
    /** The plugin's name. */
    readonly name: string;
    /** The plugin's (numeric) version. */
    readonly version: number;
    /** The DHT this plugin is registered on (`null` until registered). */
    dht: HyperDHT | null;

    /** Called by the DHT once the plugin is registered. */
    onregister(dht: HyperDHT): void;

    /** Called when the DHT becomes persistent. Implement in subclasses. */
    onpersistent(): void;

    /** Intercept an incoming request. Return `true` if handled. */
    onrequest(req: unknown, outerReq: unknown): boolean;

    /** Destroy the plugin. Implement in subclasses. */
    destroy(): void;

    /** Issue a single plugin-scoped request. */
    request(
      req: {
        token?: number;
        command: number;
        target?: Uint8Array | null;
        value?: Uint8Array | null;
      },
      to: Address,
      opts?: RequestOptions,
    ): Promise<Request>;

    /** Run a plugin-scoped query. */
    query(
      req: {
        command: number;
        target?: Uint8Array | null;
        value?: Uint8Array | null;
      },
      opts?: QueryOptions,
    ): Query;
  }

  /**
   * A relay connection (from `blind-relay`).
   *
   * FOLLO-UP: `blind-relay` ships no types and is a transitive dependency
   * (not resolvable from the project root). Best-guess of the surface
   * `hyperdht`/`connect` touch. Replace with `import('blind-relay')` types if
   * they ever appear.
   */
  export interface RelayConnection extends Emitter<EventMap> {
    /** The underlying connection this relay rides on. */
    rawStream: RawStream;
    /** The relay's public key. */
    readonly publicKey: Uint8Array;

    /** Set the keep-alive interval (ms). */
    setKeepAlive(ms: number): void;
  }

  /**
   * A firewall callback: given the remote's public key and the decoded
   * handshake {@link HandshakePayload} (and, on the server, the client
   * address), return `true` to reject the peer.
   *
   * `hyperdht`'s own server calls this with a real `payload` and `clientAddress`;
   * `hyperswarm` calls it with `null`/`undefined` for those.
   */
  export type Firewall = (
    remotePublicKey: Uint8Array,
    payload: HandshakePayload | null,
    clientAddress?: Address,
  ) => boolean;

  /**
   * A relay target passed to {@link Server} / {@link connect} via
   * `relayThrough`. It may be a single relay (a public key, a hex id string, or
   * an {@link Address}), an array of them (a random one is chosen), or a
   * function resolving one per connection. `null` disables relaying.
   *
   * FOLLO-UP: this mirrors `hyperdht`'s internal `selectRelay`; the precise
   * accepted union (public key / id / address / array / function) is a
   * `blind-relay`/`hyperdht-address` concern.
   */
  export type RelayTarget =
    | Uint8Array
    | string
    | Address
    | RelayAddress
    | (RelayTarget | null)[]
    | (() => RelayTarget | null);

  /**
   * A relay reference: a relay node plus the peer it relays for.
   */
  export interface RelayAddress {
    /** The relay node. */
    relayAddress: Node;
    /** The peer this relay relays. */
    peerAddress: Node;
  }

  /**
   * Options for {@link HyperDHT.createServer} (and the `Server` constructor).
   */
  export interface ServerOptions {
    /** Firewall applied to incoming connections. Default allows all. */
    firewall?: Firewall;

    /** Gate a holepunch attempt. Return `false` to abort. Default allows. */
    holepunch?(
      remoteFirewall: number,
      localFirewall: number,
      remoteAddresses: Address[] | null,
      localAddresses: Address[] | null,
    ): boolean;

    /** Route server connections through a relay (if any). */
    relayThrough?: RelayTarget | null;
    /** Relay keep-alive interval (ms). Default `5000`. */
    relayKeepAlive?: number;
    /** How long (ms) to wait to recover a failed relayed connection. */
    relayRecoveryWait?: number;
    /** Connection pool to share this server's connections with. */
    pool?: ConnectionPool;

    /** Override the Noise handshake factory. */
    createHandshake?(
      keyPair: KeyPair,
      remotePublicKey: Uint8Array,
    ): NoiseHandshake;

    /** Override the secret-stream factory. */
    createSecretStream?(
      isInitiator: boolean,
      rawStream: RawStream | null,
      opts?: { handshake?: NoiseHandshake | null; keepAlive?: number },
    ): Connection;

    /** How long (ms) to wait to clear an in-flight handshake. Default `10000`. */
    handshakeClearWait?: number;
    /** Share local (LAN) addresses during the handshake. Default `true`. */
    shareLocalAddress?: boolean;
    /** Reuse sockets across connections. Default `false`. */
    reusableSocket?: boolean;
    /** Convenience: listen for connections (alias for the `connection` event). */
    onconnection?: (conn: Connection) => void;
  }

  /**
   * A listening DHT server. Created by {@link HyperDHT.createServer}; it accepts
   * incoming connections and (optionally) relays through a relay.
   *
   * FOLLO-UP: this is `hyperdht`'s `lib/server.js`; it extends Node's
   * `EventEmitter`. Reconstructed from source.
   */
  export interface Server extends Emitter<ServerEvents> {
    /** The DHT this server runs on. */
    readonly dht: HyperDHT;
    /** `true` once the server has started listening. */
    readonly listening: boolean;
    /** `true` once the server has been closed. */
    readonly closed: boolean;
    /** The local public key the server listens under, once listening. */
    readonly publicKey: Uint8Array | null;
    /** Relay addresses advertised for this server (empty until announcing). */
    readonly relayAddresses: Address[];
    /** Whether the server is currently suspended. */
    readonly suspended: boolean;

    /**
     * Begin listening on the DHT with the given key pair.
     *
     * @param keyPair The key pair to listen under. Defaults to the DHT's
     *   `defaultKeyPair`.
     * @returns The (now listening) server.
     * @throws If already listening, the DHT is destroyed, or the key pair is
     *   already in use by another server.
     */
    listen(keyPair?: KeyPair, opts?: ServerOptions): Promise<Server>;

    /** Close the server (stops accepting connections and announcing). */
    close(): Promise<void>;

    /** Suspend the server (keeps state, drops active work). */
    suspend(opts?: { log?: (msg: string) => void }): Promise<void>;

    /** Resume a suspended server. */
    resume(): Promise<void>;

    /** Force a discovery/announce refresh. */
    refresh(): void;

    /** Notify the announcer that the DHT is online. */
    notifyOnline(): void;

    /**
     * Return this server's address, or `null` if not listening.
     *
     * @returns `{ publicKey, host, port }`, or `null`.
     */
    address(): { publicKey: Uint8Array; host: string; port: number } | null;
  }

  /**
   * The event map for a {@link Server}.
   */
  export interface ServerEvents extends EventMap {
    /** Emitted once the server has started listening. */
    listening: [];
    /** Emitted when a new (incoming) connection is accepted. */
    connection: [conn: Connection];
    /** Emitted when the server closes. */
    close: [];
  }

  /**
   * A connection pool: a shared cache of open (and in-progress) connections
   * keyed by remote public key, so that a `Server` and `HyperDHT.connect`
   * can deduplicate peers. Created by {@link HyperDHT.pool}.
   *
   * FOLLO-UP: this is `hyperdht`'s `lib/connection-pool.js`; it extends
   * `EventEmitter`. Reconstructed from source.
   */
  export interface ConnectionPool extends Emitter<EventMap> {
    /** The number of connections currently in-progress (not yet opened). */
    readonly connecting: number;
    /** The currently-open connections. */
    readonly connections: Iterable<Connection>;

    /** Whether a connection to the given public key exists (open or in-progress). */
    has(publicKey: Uint8Array): boolean;

    /** Get the connection for a public key (open or in-progress), or `null`. */
    get(publicKey: Uint8Array): Connection | null;
  }

  /**
   * The decoded Noise handshake/announce payload exchanged during a
   * connection. This is what {@link Firewall} receives as its `payload`
   * argument (on the server side). Decoded by `hyperdht`'s `noisePayload`
   * compact-encoding schema.
   */
  export interface HandshakePayload {
    /** The payload protocol version (currently `1`). */
    version: number;
    /** An error code (0 = none); see `hyperdht`'s `ERROR` table. */
    error: number;
    /** The peer's firewall status (see `hyperdht`'s `FIREWALL` table). */
    firewall: number;
    /** Hole-punch info, if the peer is willing to hole-punch (else `null`). */
    holepunch: HolepunchInfo | null;
    /** The peer's reachable IPv4 addresses. */
    addresses4: Address[];
    /** The peer's reachable IPv6 addresses. */
    addresses6: Address[];
    /** UDX stream info, if the peer offers a UDX raw stream (else `null`). */
    udx: UdxInfo | null;
    /** Secret-stream info. */
    secretStream: { version: number } | null;
    /** A relay to route through, if requested (else `null`). */
    relayThrough: RelayThroughInfo | null;
    /** The peer's relay addresses, if any (else `null`). */
    relayAddresses: Address[] | null;
  }

  /**
   * Hole-punch info from a {@link HandshakePayload}.
   */
  export interface HolepunchInfo {
    /** The hole-punch id. */
    id: number;
    /** The relays the peer can punch through. */
    relays: RelayAddress[];
  }

  /**
   * UDX raw-stream info from a {@link HandshakePayload}.
   */
  export interface UdxInfo {
    /** The UDX info version. */
    version: number;
    /** Whether the remote's socket is reusable. */
    reusableSocket: boolean;
    /** The remote's UDX stream id. */
    id: number;
    /** The remote's UDX stream sequence number. */
    seq: number;
  }

  /**
   * A relay-through request from a {@link HandshakePayload}.
   */
  export interface RelayThroughInfo {
    /** The info version. */
    version: number;
    /** The relay's 32-byte public key. */
    publicKey: Uint8Array;
    /** The relay's 32-byte token. */
    token: Uint8Array;
  }

  /**
   * Options for {@link HyperDHT.connect}.
   */
  export interface ConnectOptions {
    /** Reuse a connection pool so peers are deduplicated. */
    pool?: ConnectionPool;
    /** The local key pair to use (defaults to the DHT's `defaultKeyPair`). */
    keyPair?: KeyPair;
    /** Known relay addresses for the remote peer. */
    relayAddresses?: Address[];
    /** Route the connection through a relay (if any). */
    relayThrough?: RelayTarget | null;

    /** Override the secret-stream factory. */
    createSecretStream?(
      isInitiator: boolean,
      rawStream: RawStream | null,
      opts?: { handshake?: NoiseHandshake | null; keepAlive?: number },
    ): Connection;

    /** Override the Noise handshake factory. */
    createHandshake?(
      keyPair: KeyPair,
      remotePublicKey: Uint8Array,
    ): NoiseHandshake;

    /** Attempt a direct local (LAN) connection. Default `true`. */
    localConnection?: boolean;
    /** Reuse sockets across connections. Default `false`. */
    reusableSocket?: boolean;
    /** Relay keep-alive interval (ms). Default `5000`. */
    relayKeepAlive?: number;
    /** Fast-open the connection (probe first). Default `true`. */
    fastOpen?: boolean;

    /** Gate a holepunch attempt. Return `false` to abort. Default allows. */
    holepunch?(
      remoteFirewall: number,
      localFirewall: number,
      remoteAddresses: Address[] | null,
      localAddresses: Address[] | null,
    ): boolean;
  }

  /**
   * The result of {@link HyperDHT.immutablePut}.
   */
  export interface ImmutablePutResult {
    /** The 32-byte content hash of the stored value. */
    hash: Uint8Array;
    /** The closest DHT nodes the put was committed to. */
    closestNodes: Node[];
  }

  /**
   * The result of {@link HyperDHT.mutablePut}.
   */
  export interface MutablePutResult {
    /** The 32-byte public key the value was stored under. */
    publicKey: Uint8Array;
    /** The sequence number of the stored value. */
    seq: number;
    /** The 64-byte signature over the stored value. */
    signature: Uint8Array;
    /** The closest DHT nodes the put was committed to. */
    closestNodes: Node[];
  }

  /**
   * Options for the mutable/immutable get/put helpers.
   */
  export interface MutableGetOptions extends QueryOptions {
    /** The minimum sequence number to accept. Default `0`. */
    seq?: number;
    /** Whether to keep the latest value (default `true`). */
    latest?: boolean;

    /** Refresh callback for mutable puts. */
    refresh?(value: MutableReply): boolean;
  }

  /**
   * Options for the announce/lookup helpers.
   */
  export interface AnnounceOptions extends QueryOptions {
    /** A bump counter to force a re-announce. */
    bump?: number;
    /** Re-use (unannounce) an existing announcement instead of announcing. */
    clear?: boolean;

    /** Override the announce-signing function. */
    signAnnounce?(
      target: Uint8Array,
      token: number,
      from: Uint8Array | null,
      announce: AnnounceRecord,
      keyPair: KeyPair,
    ): Promise<Uint8Array>;

    /** Override the unannounce-signing function. */
    signUnannounce?(
      target: Uint8Array,
      token: number,
      from: Uint8Array | null,
      announce: AnnounceRecord,
      keyPair: KeyPair,
    ): Promise<Uint8Array>;
  }

  /**
   * A signed announce/unannounce record (encoded by `hyperdht`'s `announce`
   * schema).
   *
   * FOLLO-UP: `refresh` is a 32-byte discovery key (may be `null`); `signature`
   * is a 64-byte signature (may be `null`); `bump` defaults to `0`.
   */
  export interface AnnounceRecord {
    /** The announcing peer. */
    peer: Peer;
    /** A 32-byte discovery key (may be `null`). */
    refresh: Uint8Array | null;
    /** A 64-byte signature over the record (may be `null`). */
    signature: Uint8Array | null;
    /** A monotonically-increasing bump counter. */
    bump: number;
  }

  /**
   * Options for the {@link HyperDHT} constructor.
   *
   * A superset of the `dht-rpc` `DHT` options plus the `hyperdht`-specific ones.
   * FOLLO-UP: `dht-rpc` ships no types; the `dht-rpc`-side options
   * (concurrency / ephemeral / adaptive / etc.) are reconstructed from its
   * source.
   */
  export interface HyperDHTOptions {
    /** The local UDP port to bind (0 = ephemeral). Default `49737`. */
    port?: number;
    /** The local host/interface to bind. Default `'0.0.0.0'`. */
    host?: string;
    /** Bootstrap nodes (strings like `'host:port'` or {@link Address}). */
    bootstrap?: (string | Address)[];
    /** Additional static nodes to seed the DHT with. */
    nodes?: (string | Address)[];
    /** The local key pair. Defaults to a freshly-generated one. */
    keyPair?: KeyPair;
    /** A seed to derive the key pair deterministically (ignored if `keyPair`). */
    seed?: Uint8Array;
    /**
     * Connection keep-alive interval (ms). Pass `false` to disable. Default
     * `5000`.
     */
    connectionKeepAlive?: number | false;
    /** Interval (ms) between random hole-punches. Default `20000`. */
    randomPunchInterval?: number;
    /** Defer the initial random hole-punch. */
    deferRandomPunch?: boolean;

    // --- Cache sizing ---
    /** Max size (bytes) of the caches. Default `65536`. */
    maxSize?: number;
    /** Max age (ms) of the caches. Default `20 * 60 * 1000` (20 min). */
    maxAge?: number;

    // --- Inherited `dht-rpc` options (FOLLO-UP) ---
    /** Max concurrent requests. Default `10`. */
    concurrency?: number;
    /** Max congestion window. Default `dht-rpc`'s `IO.DEFAULT_MAX_WINDOW`. */
    maxWindow?: number;
    /** Max ping delay (ms). Default `10000`. */
    maxPingDelay?: number;
    /** Whether the DHT is ephemeral (not persistent). Default `true`. */
    ephemeral?: boolean;
    /** Whether the DHT is firewalled. */
    firewalled?: boolean;
    /** Whether to adapt the DHT to NAT changes. Default `true`. */
    adaptive?: boolean;
    /** Whether to bind a random port. */
    anyPort?: boolean;
    /** Whether to use the quick-firewall heuristic. Default `true`. */
    quickFirewall?: boolean;
    /** Whether to send "node is down" hints. Default `true`. */
    sendDownHints?: boolean;
    /** Rate limit for down-hints. Default `50`. */
    downHintsRateLimit?: number;

    /** Filter nodes (return `false` to reject). Alias: `addNode`. */
    filterNode?(node: Node): boolean;

    /** (Deprecated) Alias for `filterNode`. */
    addNode?(node: Node): boolean;

    /** A custom `udx-native` instance. */
    udx?: unknown;
  }

  /**
   * Live statistics for a {@link HyperDHT}.
   *
   * FOLLO-UP: the nested `requests`/`commands` shapes are `dht-rpc` internals
   * (from `io.js`); they ship no types. Best-guess of the observed fields.
   */
  export interface DHTStats {
    /** Hole-punch counters. */
    punches: {
      /** Consistent NAT hole-punches. */
      consistent: number;
      /** Random NAT hole-punches. */
      random: number;
      /** Open (no hole-punch) connects. */
      open: number;
      /** Deferred ("try later") hole-punches. */
      tryLater: number;
      /** Relayed handshakes that had to retry at least once. */
      tryLaterRelayedHandshakesAtLeastOnce: number;
    };
    /** Relaying counters. */
    relaying: {
      /** Relaying attempts. */
      attempts: number;
      /** Successful relays. */
      successes: number;
      /** Aborted relays. */
      aborts: number;
    };
    /** Socket-pool counters. */
    socketPool: {
      /** Sockets added to the pool. */
      socketsAdded: number;
      /** Sockets removed from the pool. */
      socketsRemoved: number;
    };
    /** Query counters (inherited from `dht-rpc`). */
    queries: {
      /** Active (in-flight) queries. */
      active: number;
      /** Total queries started. */
      total: number;
    };
    /** Request counters (inherited from `dht-rpc`). */
    requests: {
      /** Active requests. */
      active: number;
      /** Total requests sent. */
      total: number;
    };
    /** Per-command counters (inherited from `dht-rpc`). */
    commands: {
      /** PING command counter. */
      ping: CommandStat;
      /** PING_NAT command counter. */
      pingNat: CommandStat;
      /** FIND_NODE command counter. */
      findNode: CommandStat;
      /** DOWN_HINT command counter. */
      downHint: CommandStat;
    };
  }

  /**
   * A per-command statistic.
   *
   * FOLLO-UP: this is a `dht-rpc` `io.js` internal; best-guess.
   */
  export interface CommandStat {
    /** Active invocations. */
    active: number;
    /** Total invocations. */
    total: number;
    /** Successful invocations. */
    success: number;
    /** Failed invocations. */
    error: number;
  }

  /**
   * A network interface, as emitted on the `network-change` event.
   *
   * FOLLO-UP: this comes from `udx-native`/the OS; best-guess of the fields
   * `dht-rpc` reads.
   */
  export interface NetworkInterface {
    /** The interface name (e.g. `'en0'`). */
    name: string;
    /** The interface host/IP. */
    host: string;
    /** The address family (`4` or `6`). */
    family: number;
    /** Whether the interface is internal (loopback). */
    internal: boolean;
  }

  /**
   * The event map for a {@link HyperDHT}.
   *
   * The `hyperdht`-specific events (`network-change`, `network-update`,
   * `persistent`) are driven by the DHT base; the rest are `dht-rpc` events.
   */
  export interface DHTEvents extends EventMap {
    /** Emitted once the DHT socket is bound (listening). */
    listening: [];
    /** Emitted once the DHT has bootstrapped onto the network. */
    ready: [];
    /** Emitted for an inbound request the user may handle. */
    request: [req: Request];
    /** Emitted when a node is added to the routing table. */
    "add-node": [node: Node];
    /** Emitted when a node is removed from the routing table. */
    "remove-node": [node: Node];
    /** Emitted when the set of network interfaces changes. */
    "network-change": [interfaces: NetworkInterface[]];
    /** Emitted on a network state update (online/offline/degraded). */
    "network-update": [];
    /** Emitted when the DHT's NAT host/port changes. */
    "nat-update": [host: string, port: number];
    /** Emitted once the DHT becomes persistent (has a stable id). */
    persistent: [];
    /** Emitted when the DHT transitions to ephemeral. */
    ephemeral: [];
    /** Emitted when the DHT is suspended. */
    suspend: [];
    /** Emitted when the DHT is resumed. */
    resume: [];
    /** Emitted when the DHT "wakes up" after a sleep interval. */
    wakeup: [];
    /** Emitted when the DHT is destroyed. */
    close: [];
  }

  /**
   * The DHT instance. The main object a `hyperswarm` swarm wraps
   * (`swarm.dht`), and the thing you construct directly
   * (`new HyperDHT(opts)`).
   *
   * `extends` the `dht-rpc` `DHT` surface (query/request/ping/bind/etc. plus
   * the `dht-rpc` event map); those inherited members are modelled here since
   * `dht-rpc` ships no types.
   */
  export interface HyperDHT extends Emitter<DHTEvents> {
    /** The DHT's default key pair (used when none is supplied). */
    readonly defaultKeyPair: KeyPair;
    /** The set of servers currently listening on this DHT. */
    readonly listening: Set<Server>;
    /** The connection keep-alive interval (ms); 0 = disabled. */
    readonly connectionKeepAlive: number;
    /** The raw-stream set (created/destroyed by the DHT). */
    readonly rawStreams: RawStreamSet;
    /** Registered plugins, keyed by name. */
    readonly plugins: Map<string, Plugin>;
    /** Live statistics. */
    readonly stats: DHTStats;

    // --- Inherited `dht-rpc` state (FOLLO-UP) ---
    /** The DHT's public id, or `null` while ephemeral. */
    readonly id: Uint8Array | null;
    /** The DHT's (NAT) host. */
    readonly host: string;
    /** The DHT's (NAT) port. */
    readonly port: number;
    /** Whether the DHT's NAT is randomized (port `0`). */
    readonly randomized: boolean;
    /** Whether the DHT is currently online. */
    readonly online: boolean;
    /** Whether the DHT is degraded (online but unhealthy). */
    readonly degraded: boolean;
    /** Whether the DHT is bootstrapped. */
    readonly bootstrapped: boolean;
    /** Whether the DHT is ephemeral. */
    readonly ephemeral: boolean;
    /** Whether the DHT is firewalled. */
    readonly firewalled: boolean;
    /** Whether the DHT is suspended. */
    readonly suspended: boolean;
    /** Whether the DHT is destroyed. */
    readonly destroyed: boolean;
    /** The bootstrap nodes. */
    readonly bootstrapNodes: Address[];
    /** Max concurrent requests. */
    readonly concurrency: number;
    /** Max ping delay (ms). */
    readonly maxPingDelay: number;
    /** A configuration snapshot. */
    readonly config: {
      concurrency: number;
      maxWindow: number;
      randomPunchInterval: number;
      connectionKeepAlive: number;
      sendDownHints: boolean;
      downHintsRateLimit: number;
    };
    /** The Kademlia routing table. FOLLO-UP: `kademlia-routing-table`. */
    readonly table: RoutingTable;
    /** The time-ordered set of known nodes. FOLLO-UP: `time-ordered-set`. */
    readonly nodes: TimeOrderedSet;
    /** The `udx-native` instance. FOLLO-UP: `udx-native`. */
    readonly udx: unknown;
    /** The `dht-rpc` `IO` transport. FOLLO-UP: `dht-rpc` `io.js`. */
    readonly io: unknown;

    // --- `hyperdht` methods ---
    /**
     * Open a client connection to a peer's public key.
     *
     * @param remotePublicKey The peer's 32-byte public key (or a hex id string
     *   / encoded address buffer, which is decoded).
     * @returns The (in-progress) connection.
     */
    connect(
      remotePublicKey: Uint8Array | string,
      opts?: ConnectOptions,
    ): Connection;

    /** Create a (listening) server. */
    createServer(opts?: ServerOptions | ((conn: Connection) => void)): Server;

    /** Create a shared connection pool. */
    pool(): ConnectionPool;

    /**
     * Find a peer by public key (a `findPeer` query).
     */
    findPeer(publicKey: Uint8Array, opts?: QueryOptions): Query<FindPeerReply>;

    /**
     * Look up a topic (a `lookup` query).
     */
    lookup(target: Uint8Array, opts?: QueryOptions): Query<LookupReply>;

    /**
     * Look up a topic *and* unannounce an existing announcement for it.
     */
    lookupAndUnannounce(
      target: Uint8Array,
      keyPair: KeyPair,
      opts?: AnnounceOptions,
    ): Query<LookupReply>;

    /**
     * Unannounce a topic (a `lookupAndUnannounce` that resolves when done).
     */
    unannounce(
      target: Uint8Array,
      keyPair: KeyPair,
      opts?: AnnounceOptions,
    ): Promise<void>;

    /**
     * Announce this key pair under a topic (a `lookup`/`lookupAndUnannounce`).
     *
     * @returns the announce query (an async iterable of {@link LookupReply}).
     */
    announce(
      target: Uint8Array,
      keyPair: KeyPair,
      relayAddresses: Address[],
      opts?: AnnounceOptions,
    ): Query<LookupReply>;

    /** Get an immutable value by its hash. */
    immutableGet(
      target: Uint8Array,
      opts?: QueryOptions,
    ): Promise<ImmutableReply | null>;

    /** Put an immutable value, returning its hash. */
    immutablePut(
      value: Uint8Array,
      opts?: QueryOptions,
    ): Promise<ImmutablePutResult>;

    /** Get the latest mutable value for a public key. */
    mutableGet(
      publicKey: Uint8Array,
      opts?: MutableGetOptions,
    ): Promise<MutableReply | null>;

    /** Put a mutable value under a key pair. */
    mutablePut(
      keyPair: KeyPair,
      value: Uint8Array,
      opts?: QueryOptions,
    ): Promise<MutablePutResult>;

    /** Register a plugin with the DHT. */
    register(name: string, plugin: Plugin): void;

    /** Create a raw (unencrypted) stream. */
    createRawStream(opts?: RawStreamOptions): RawStream;

    /** Resume the DHT and its servers. */
    resume(opts?: { log?: (msg: string) => void }): Promise<void>;

    /** Suspend the DHT and its servers. */
    suspend(opts?: { log?: (msg: string) => void }): Promise<void>;

    /** Destroy the DHT (closes all servers unless `force`). */
    destroy(opts?: { force?: boolean }): Promise<void>;

    /** Validate a set of local addresses, returning the reachable ones. */
    validateLocalAddresses(addresses: Address[]): Promise<Address[]>;

    // --- Inherited `dht-rpc` methods (FOLLO-UP) ---
    /** Run a raw query. */
    query(
      req: { target: Uint8Array; command: number; value: Uint8Array | null },
      opts?: QueryOptions,
    ): Query;

    /** Make a single request to a node. */
    request(
      req: {
        token?: number;
        command: number;
        target?: Uint8Array | null;
        value?: Uint8Array | null;
      },
      to: Address,
      opts?: RequestOptions,
    ): Promise<Request>;

    /** Find a node for a target (a `findNode` query). */
    findNode(target: Uint8Array, opts?: QueryOptions): Query;

    /** Ping a host. */
    ping(to: Address, opts?: RequestOptions): Promise<Request>;

    /** Ping a host after a delay (ms). */
    delayedPing(
      to: Address,
      delayMs: number,
      opts?: RequestOptions,
    ): Promise<Request>;

    /** Bind the DHT socket. */
    bind(): Promise<void>;

    /** Return the DHT's remote address, or `null`. */
    remoteAddress(): Address | null;

    /** Return the DHT's local address, or `null`. */
    localAddress(): Address | null;

    /** Return the DHT's socket address, or `null`. */
    address(): Address | null;

    /** Add a node to the DHT. */
    addNode(node: Address): void;

    /** Return an array of known nodes (optionally limited). */
    toArray(opts?: { limit?: number }): Address[];

    /** Wait for the DHT to finish bootstrapping. */
    fullyBootstrapped(): Promise<void>;

    /** (Deprecated) Alias for {@link fullyBootstrapped}. */
    ready(): Promise<void>;

    /** Create a new session. */
    session(): Session;

    /** Collect round-trip-time statistics. */
    rttStats(): Promise<{
      successes: number;
      errors: number;
      responses: { avgRtt: number; errors: number; avgCloserNodes: number };
      closestReplies: {
        avgRtt: number;
        errors: number;
        avgCloserNodes: number;
      };
    }>;

    /** Refresh the DHT's routing table. */
    refresh(): void;

    /** Handle a raw inbound message. */
    onmessage(socket: unknown, buf: Uint8Array, rinfo: Address): void;
  }

  /**
   * The raw-stream set owned by a {@link HyperDHT}.
   *
   * FOLLO-UP: this is `hyperdht`'s `lib/raw-stream-set.js`; it is iterable and
   * best-guess of the observable surface.
   */
  export interface RawStreamSet extends Iterable<RawStream> {
    /** The number of active raw streams. */
    readonly size: number;

    /** Add a raw stream with the given options. */
    add(opts?: RawStreamOptions): RawStream;

    /** Clear (destroy) all raw streams. */
    clear(): Promise<void>;
  }

  /**
   * The Kademlia routing table.
   *
   * FOLLO-UP: this is `kademlia-routing-table` (untyped, transitive dep).
   * Best-guess of the surface `dht-rpc`/`hyperdht` touch.
   */
  export interface RoutingTable {
    /** The table's own (id) 32-byte key. */
    readonly id: Uint8Array;
    /** The table's replication factor (closest-node count). */
    readonly k: number;

    /** Add a node to the table. */
    add(node: Node): boolean;

    /** Remove a node by id. */
    remove(id: Uint8Array): void;

    /** Get a node by id, or `null`. */
    get(id: Uint8Array): Node | null;

    /** The closest nodes to a target. */
    closest(target: Uint8Array, count?: number): Node[];

    /** A random node, or `null`. */
    random(): Node | null;

    /** An array snapshot of all nodes. */
    toArray(): Node[];
  }

  /**
   * The time-ordered set of known nodes.
   *
   * FOLLO-UP: this is `time-ordered-set` (untyped, transitive dep).
   * Best-guess of the surface `dht-rpc` touches.
   */
  export interface TimeOrderedSet {
    /** The number of nodes in the set. */
    readonly length: number;
    /** The most-recently-seen node, or `null`. */
    readonly latest: Node | null;
    /** The oldest node, or `null`. */
    readonly oldest: Node | null;

    /** Whether the set contains a node. */
    has(node: Node): boolean;

    /** Add a node. */
    add(node: Node): void;

    /** Remove a node. */
    remove(node: Node): void;
  }

  /**
   * The `hyperdht` default export: the constructable `HyperDHT` class.
   *
   * @param opts DHT options.
   */
  const HyperDHT: {
    new (opts?: HyperDHTOptions): HyperDHT;

    /** The DHT's default options (merged with `dht-rpc`'s). */
    readonly DEFAULTS: {
      concurrency: number;
      maxWindow: number;
      maxPingDelay: number;
      connectionKeepAlive: number;
      randomPunchInterval: number;
    };
    /** The default bootstrap nodes (as `'host:port'` strings / {@link Address}). */
    readonly BOOTSTRAP: (string | Address)[];
    /** Firewall status codes. */
    readonly FIREWALL: { UNKNOWN: 0; OPEN: 1; CONSISTENT: 2; RANDOM: 3 };
    /** Generate a (signing) key pair, optionally from a seed. */
    keyPair(seed?: Uint8Array): KeyPair;
    /** Hash data (BLAKE2) to a 32-byte digest. */
    hash(data: Uint8Array): Uint8Array;
    /** Wire an already-open encrypted stream onto a raw stream. */
    connectRawStream(
      encryptedStream: Connection,
      rawStream: RawStream,
      remoteId: number,
    ): void;
    /** Create a bootstrapper DHT (fixed port/host, non-ephemeral). */
    bootstrapper(port: number, host: string, opts?: HyperDHTOptions): HyperDHT;
  };

  export default HyperDHT;
}

/**
 * FOLLO-UP (best-guess / not fully recoverable from the source):
 *
 * These types are accurate to what the *observable* source does, but several
 * underlying libraries ship no `.d.ts`, and most are transitive dependencies
 * (not resolvable from the project root), so a few things are best-guesses
 * rather than guaranteed-exact. Refine if/when the corresponding package adds
 * types or becomes resolvable:
 *
 *  1. {@link Connection} corresponds to `@hyperswarm/secret-stream`'s
 *     `NoiseSecretStream` (a `streamx` `Duplex` subclass). `streamx` IS typed,
 *     but it is a transitive dependency here (not resolvable from the project
 *     root) and `@hyperswarm/secret-stream` is NOT. Hand-written from the
 *     source. If `streamx` becomes resolvable, replace with
 *     `import('streamx').Duplex` intersected with the secret-stream
 *     props/events (or `typeof (import('@hyperswarm/secret-stream')).default`).
 *
 *  2. {@link RawStream} is `udx-native` (a native module with no types,
 *     transitive dep). Best-guess of the surface `hyperdht`/`secret-stream`
 *     touch.
 *
 *  3. {@link RelayConnection} / {@link RelayAddress} come from `blind-relay`
 *     (untyped, transitive dep). Best-guess.
 *
 *  4. {@link HyperDHT} `extends` the `dht-rpc` `DHT` base class (untyped,
 *     transitive dep). The inherited methods (query/request/ping/bind/…) and
 *     the event map are reconstructed from `dht-rpc`'s source; some are
 *     approximate. `table`/`nodes`/`udx`/`io` are best-guesses of
 *     `kademlia-routing-table` / `time-ordered-set` / `udx-native` /
 *     `dht-rpc` `io.js` (see {@link RoutingTable}, {@link TimeOrderedSet}).
 *
 *  5. {@link DHTStats}.`requests`/`commands` and {@link CommandStat} are
 *     `dht-rpc` `io.js` internals; best-guess.
 *
 *  6. {@link Request} is the `dht-rpc` request object; best-guess of the
 *     fields a caller reads.
 *
 *  7. {@link Connection}.`puncher` is `hyperdht`'s `Holepuncher` (untyped
 *     internal); left as `unknown`.
 *
 *  8. {@link HandshakePayload} / {@link Firewall}: the firewall `payload` is
 *     the decoded Noise handshake payload ({@link HandshakePayload});
 *     `hyperswarm` calls the firewall with `null`, `hyperdht` with a real
 *     payload + `clientAddress`.
 *
 *  9. {@link Query}.`finished()` and the read/emit surface are reconstructed
 *     from `dht-rpc`'s `Query` (a `streamx` `Readable`); the exact `streamx`
 *     `Duplex`/`Readable` event set is worth confirming against `streamx`'s
 *     own types once it is resolvable.
 */
