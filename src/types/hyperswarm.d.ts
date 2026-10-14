/**
 * Type definitions for `hyperswarm` (v4.17.2).
 *
 * The package ships only `index.js` (CommonJS, `module.exports = class ...`)
 * with no `types`/`typings` field, so TypeScript reports TS7016 for it. This
 * file provides an ambient module declaration so the library can be used in a
 * TypeScript project.
 *
 * Source of truth: `node_modules/hyperswarm/index.js` and the `lib/*.js`
 * helpers. Types were derived from that source, NOT guessed from docs.
 *
 * Dependency notes (why some types are marked FOLLO-UP at the bottom):
 *  - The connection stream emitted on the `connection` event is a
 *    `@hyperswarm/secret-stream` `NoiseSecretStream` (a `streamx` `Duplex`
 *    subclass). `streamx` ships types, but `@hyperswarm/secret-stream` does
 *    not, so {@link Connection} is a best-guess of its *observable* surface.
 *  - `swarm.dht` and `swarm.server` are created by `hyperdht`, which ships no
 *    types, so {@link HyperDht} and {@link Server} are best-guess interfaces
 *    covering only the surface `hyperswarm` itself calls on them.
 *  - `swarm.keyPair` reuses `hypercore-crypto`'s `KeyPair` (aliased below to
 *    `import('hypercore-crypto').KeyPair`), the same `{ publicKey: 32B,
 *    secretKey: 64B }` shape.
 */

declare module "hyperswarm" {
  /**
   * A key pair, reused from `hypercore-crypto`.
   *
   * `hyperswarm` uses `hyperdht`'s `createKeyPair` (Ed25519), which is
   * structurally identical to `hypercore-crypto`'s `keyPair()` output, so we
   * reuse that type. Declared as an inline `import()` type query (not a
   * top-level `import`) so this file stays an ambient module declaration and
   * keeps *declaring* `hyperswarm` rather than augmenting a non-existent
   * module.
   */
  type KeyPair = import("hypercore-crypto").KeyPair;

  /**
   * A generic event-emitter surface.
   *
   * `hyperswarm` extends Node's `events` `EventEmitter` (or `bare-events`
   * under the bare runtime). This mirrors the strongly-typed emitter shape
   * that `streamx` exposes, so `.on` / `.emit` are type-safe against an event
   * map. Only the events a given type declares are typed; everything else
   * falls through to the index signature on {@link EventMap}.
   */
  interface EventMap {
    [event: string | symbol]: unknown[];
  }

  /**
   * A listener for an event whose payload type is `A`.
   *
   * @typeParam A The event's argument tuple (e.g. `[conn: Connection, peer: PeerInfo]`).
   */
  interface EventHandler<A extends unknown[] = unknown[], R = unknown> {
    (...args: A): R;
  }

  /**
   * The event-emitter base shared by {@link Hyperswarm} and {@link Connection}.
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
   * A network address for a node (bootstrap node or relay).
   *
   * Reused from `hyperdht` (whose `Address` is the same `{ host, port }`
   * shape) via an inline `import()` type query (not a top-level `import`) so
   * this file stays an ambient module declaration and keeps *declaring*
   * `hyperswarm` rather than augmenting a non-existent module.
   * `hyperdht`/`hyperdht-address` also accept hostnames / strings, but the
   * options surfaced through `hyperswarm` are plain `{ host, port }` objects.
   */
  type NodeAddress = import("hyperdht").Address;

  /**
   * A relay target. Reused from `hyperdht` (resolves the previous best-guess
   * FOLLO-UP #4): the precise accepted union (a public key, an id string, an
   * address, an array, or a resolving function) is a `hyperdht`/`blind-relay`
   * concern.
   */
  type RelayTarget = import("hyperdht").RelayTarget;

  /**
   * The firewall callback.
   *
   * @param remotePublicKey The 32-byte public key of the incoming peer.
   * @param payload The decoded Noise handshake payload from the peer
   *   (`import('hyperdht').HandshakePayload`). `hyperswarm` itself always calls
   *   this with `null`; `hyperdht` calls it with a real payload (and a client
   *   address) for server (incoming) connections.
   * @returns `true` to reject (firewall) the peer, `false` to allow it.
   */
  export type Firewall = (
    remotePublicKey: Uint8Array,
    payload: import("hyperdht").HandshakePayload | null,
  ) => boolean;

  /**
   * A single session of a topic discovery. This is what {@link Hyperswarm.join}
   * returns.
   *
   * A swarm may host several sessions on the same topic; each session
   * independently decides whether to act as a client (discover peers) and/or a
   * server (be discoverable).
   */
  export interface Session {
    /** Whether this session is currently a client (actively discovering peers). */
    readonly isClient: boolean;
    /** Whether this session is currently a server (being discoverable/announcing). */
    readonly isServer: boolean;
    /** `true` once this session has been destroyed. */
    readonly destroyed: boolean;
    /** The swarm this session belongs to. */
    readonly swarm: Hyperswarm;
    /** The 32-byte topic this session discovers for. */
    readonly topic: Uint8Array;
    /**
     * Re-run discovery for this session, optionally toggling its client/server
     * role.
     *
     * @param opts Discovery options. At least one of `client`/`server` must be
     *   truthy.
     * @returns `true` when the refresh completed successfully, `false` on a
     *   network failure, `undefined`/`null` when a refresh was already in flight.
     */
    refresh(opts?: SessionRefreshOptions): Promise<true | false | undefined>;
    /**
     * Wait for this session's discovery to settle (including any outstanding
     * announce).
     *
     * @returns `true` when it settled, `false` on failure.
     */
    flushed(): Promise<boolean>;
    /**
     * Destroy this session. If it is the last session on its topic, the topic
     * is left.
     */
    destroy(): Promise<undefined>;
  }

  /**
   * Options for {@link Session.refresh}. At least one of `client` / `server`
   * must be truthy.
   */
  export interface SessionRefreshOptions {
    /** Act as a client (discover and connect to peers) when refreshing. */
    client?: boolean;
    /** Act as a server (be discoverable / announce) when refreshing. */
    server?: boolean;
    /**
     * Max number of peers to try to connect to. Defaults to `Infinity`.
     */
    limit?: number;
  }

  /**
   * Options for {@link Hyperswarm.join}. Passed straight to the underlying
   * topic's {@link Session} (its `session()` factory).
   */
  export interface JoinOptions {
    /** Be a server (announce/advertise this topic) for the session. Default `true`. */
    server?: boolean;
    /** Be a client (discover peers) for the session. Default `true`. */
    client?: boolean;
    /** Max number of peers to connect to. Default `Infinity`. */
    limit?: number;
    /** Called with any error raised during the (background) refresh. */
    onerror?: (err: Error) => void;
  }

  /**
   * The per-connection statistics exposed on {@link Hyperswarm.stats}.
   */
  export interface SwarmStats {
    /** Number of `update` events emitted. */
    updates: number;
    /** Client-initiated and server-initiated connection counts. */
    connects: {
      client: {
        /** Client connections that opened. */
        opened: number;
        /** Client connections that closed. */
        closed: number;
        /** Client connection attempts. */
        attempted: number;
      };
      server: {
        /** Server connections that opened. */
        opened: number;
        /** Server connections that closed. */
        closed: number;
      };
    };
    /** Number of peers currently banned. */
    bannedPeers: number;
  }

  /**
   * The connection stream emitted on the `connection` event.
   *
   * At runtime this is a `@hyperswarm/secret-stream` `NoiseSecretStream` (a
   * `streamx` `Duplex` subclass) — the same object `hyperdht`'s `connect()`
   * returns and a `Server` emits on its `connection` event. Reused from
   * `hyperdht` (resolves the previous best-guess FOLLO-UP #1).
   */
  type Connection = import("hyperdht").Connection;

  /**
   * A peer managed by the swarm. This is the second argument of the
   * `connection` event and the first argument of the `ban` event.
   *
   * FOLLO-UP: this is `hyperswarm`'s internal `lib/peer-info.js` (an
   * `EventEmitter` subclass) and is NOT exported by the package. This interface
   * captures the fields a consumer would reasonably read. The internal
   * implementation has more (private) state; those are omitted.
   */
  export interface PeerInfo {
    /** The peer's 32-byte public key. */
    readonly publicKey: Uint8Array;
    /** Known relay addresses for this peer (may be empty). */
    readonly relayAddresses: NodeAddress[];
    /** `true` while the swarm will try to (re)connect to this peer. */
    reconnecting: boolean;
    /** `true` once a connection to this peer has been established at least once. */
    proven: boolean;
    /** Timestamp (ms) when the current connection opened, or `-1` if not connected. */
    connectedTime: number;
    /** Timestamp (ms) when the last connection closed. */
    disconnectedTime: number;
    /** `true` if the peer has been banned (e.g. by the firewall). */
    banned: boolean;
    /** `true` if a connection attempt has been made. */
    tried: boolean;
    /** `true` if this peer was added via {@link Hyperswarm.joinPeer}. */
    explicit: boolean;
    /** `true` while the swarm is waiting to (re)connect this peer. */
    waiting: boolean;
    /** `true` if the connection is being forced through a relay. */
    forceRelaying: boolean;
    /** `true` while the peer is queued for a connection attempt. */
    queued: boolean;
    /** `true` if the last connection was client-initiated (us -> peer). */
    client: boolean;
    /** `true` if this peer is connected to us as a server (peer -> us). Inverse of `client`. */
    readonly server: boolean;
    /** Number of connection attempts made for this peer. */
    attempts: number;
    /** The current connection-priority tier (0-4). */
    priority: number;
    /** Topics this peer was discovered for. */
    readonly topics: Uint8Array[];
  }

  /**
   * The event map for the {@link Hyperswarm} instance.
   */
  interface SwarmEvents extends EventMap {
    /**
     * Emitted when a (new or existing) connection to a peer is established.
     *
     * @param conn The opened connection stream.
     * @param peerInfo The peer that was connected.
     */
    connection: [conn: Connection, peerInfo: PeerInfo];
    /**
     * Emitted whenever the swarm's connection state changes (connections
     * opened/closed, discovery updates, etc.).
     */
    update: [];
    /**
     * Emitted when a peer is banned (e.g. rejected by the firewall).
     *
     * @param peerInfo The banned peer.
     * @param err The reason (an `Error`).
     */
    ban: [peerInfo: PeerInfo, err: Error];
  }

  /**
   * The `hyperdht` `HyperDHT` instance held on {@link Hyperswarm.dht}.
   *
   * Reused from `hyperdht` (resolves the previous best-guess FOLLO-UP #2). The
   * full `HyperDHT` surface (query/lookup/announce, servers, mutable/immutable
   * stores, events, …) is available; `hyperswarm` only touches a subset of it.
   */
  type HyperDht = import("hyperdht").HyperDHT;

  /**
   * The `hyperdht` `Server` instance held on {@link Hyperswarm.server}.
   *
   * Reused from `hyperdht` (resolves the previous best-guess FOLLO-UP #2).
   */
  type Server = import("hyperdht").Server;

  /**
   * Options for the {@link Hyperswarm} constructor.
   */
  export interface SwarmOptions {
    /**
     * Optional seed from which the local key pair is derived deterministically.
     * Ignored if `keyPair` is supplied.
     */
    seed?: Uint8Array;
    /** The local key pair. Defaults to a freshly-generated one. */
    keyPair?: KeyPair;
    /**
     * Whether to (optionally) route connections through a relay. May be a relay
     * target, an array of them, or a function deciding it per connection.
     */
    relayThrough?:
      RelayTarget | ((force: boolean, swarm: Hyperswarm) => RelayTarget | null);
    /** Max number of peers to hold simultaneously. Default `64`. */
    maxPeers?: number;
    /** Max number of (client-initiated) connections. Default `Infinity`. */
    maxClientConnections?: number;
    /** Max number of (server-initiated) connections. Default `Infinity`. */
    maxServerConnections?: number;
    /** Max number of simultaneous connection attempts. Default `3`. */
    maxParallel?: number;
    /**
     * The firewall callback. Receives `(remotePublicKey, payload)` and returns
     * `true` to reject. Default allows all (except self).
     */
    firewall?: Firewall;
    /**
     * Backoff schedule (in ms) for reconnection attempts.
     * Default `[1000, 5000, 15000, 600000]`.
     */
    backoffs?: number[];
    /** Random jitter (ms) added to each backoff. Default `500`. */
    jitter?: number;

    // --- Forwarded to the underlying `hyperdht` DHT ---
    /** Bootstrap nodes for the DHT. Default is the built-in set. */
    bootstrap?: NodeAddress[];
    /** Additional static nodes for the DHT. */
    nodes?: NodeAddress[];
    /** The local UDP port to bind (0 = ephemeral). Default `49737`. */
    port?: number;
    /** Defer the initial random hole-punch. */
    deferRandomPunch?: boolean;
    /** Interval (ms) between random hole-punches. Default `20000`. */
    randomPunchInterval?: number;
    /** How long (ms) to wait to clear an in-flight handshake on the server. */
    handshakeClearWait?: number;

    // --- Advanced ---
    /**
     * A pre-built `hyperdht` `HyperDHT` to reuse instead of creating a new one.
     * FOLLO-UP: {@link HyperDht} is a best-guess of `hyperdht`'s type (which
     * ships none); replace with the real type when available.
     */
    dht?: HyperDht;
  }

  /**
   * A `hyperswarm` swarm: a distributed networking stack for connecting peers
   * over the `hyperdht` DHT, discovered by topic.
   *
   * Emits `connection`, `update` and `ban` events (see {@link SwarmEvents}).
   */
  export interface Hyperswarm extends Emitter<SwarmEvents> {
    /** The local key pair (from {@link SwarmOptions.keyPair} or generated). */
    keyPair: KeyPair;
    /** The underlying `hyperdht` DHT this swarm runs on. */
    readonly dht: HyperDht;
    /** The DHT server (listener) this swarm uses. */
    readonly server: Server;
    /** `true` once {@link destroy} has been called. */
    destroyed: boolean;
    /** `true` while the swarm (and its DHT/server) are suspended. */
    suspended: boolean;
    /** Max number of peers to hold. */
    maxPeers: number;
    /** Max number of (client-initiated) connections. */
    maxClientConnections: number;
    /** Max number of (server-initiated) connections. */
    maxServerConnections: number;
    /** Max number of simultaneous connection attempts. */
    maxParallel: number;
    /** The current relay target, if any (after {@link SwarmOptions.relayThrough} is resolved). */
    relayThrough:
      ((force: boolean, swarm: Hyperswarm) => RelayTarget | null) | null;
    /** Number of connections currently in the process of opening. */
    connecting: number;
    /** The set of currently-open connections. */
    readonly connections: Set<Connection>;
    /** Map of hex-encoded public key -> {@link PeerInfo} for known peers. */
    readonly peers: Map<string, PeerInfo>;
    /** The set of peers added via {@link joinPeer}. */
    readonly explicitPeers: Set<PeerInfo>;
    /**
     * A promise for the (first) listen to complete, or `null` if not yet started.
     * Awaits the server starting to listen.
     */
    readonly listening: Promise<Server> | null;
    /** Live connection statistics. */
    readonly stats: SwarmStats;

    /**
     * Begin listening for (incoming) connections. Idempotent — repeated calls
     * return the same promise.
     *
     * @returns A promise resolving once the server is listening.
     * @throws If the swarm has already been destroyed.
     */
    listen(): Promise<Server>;

    /**
     * Join a topic, returning a {@link Session} for it.
     *
     * @param topic A 32-byte topic buffer (e.g. a hashed namespace).
     * @param opts Session options (client/server role, limit, onerror).
     * @throws If the swarm has been destroyed, or if `topic` is missing.
     */
    join(topic: Uint8Array, opts?: JoinOptions): Session;

    /**
     * Leave a topic, destroying all its sessions.
     *
     * @param topic The 32-byte topic to leave.
     * @throws If `topic` is missing.
     */
    leave(topic: Uint8Array): Promise<void>;

    /**
     * Explicitly connect to a peer (regardless of topic discovery).
     *
     * @param publicKey The 32-byte public key of the peer.
     */
    joinPeer(publicKey: Uint8Array): void;

    /**
     * Stop explicitly connecting to a peer (leaves topic-discovered peers alone).
     *
     * @param publicKey The 32-byte public key of the peer.
     */
    leavePeer(publicKey: Uint8Array): void;

    /**
     * Wait for all in-flight connection attempts and discovery refreshes to
     * settle.
     *
     * @returns `true` once everything has flushed.
     */
    flush(): Promise<boolean>;

    /**
     * Clear all topics (destroy every session) and their discoveries.
     *
     * @returns The settled (fulfilled/rejected) results of each destroy.
     */
    clear(): Promise<PromiseSettledResult<unknown>[]>;

    /**
     * Destroy the swarm: clear topics, close the server, and destroy the DHT.
     *
     * @param opts If `force` is `true`, skip the graceful topic clear.
     */
    destroy(opts?: { force?: boolean }): Promise<void>;

    /**
     * Suspend the swarm, its server, and its DHT. Connections are torn down.
     *
     * @param opts `log` is called with progress messages.
     */
    suspend(opts?: { log?: (msg: string) => void }): Promise<void>;

    /**
     * Resume a suspended swarm (DHT, server, and topics).
     *
     * @param opts `log` is called with progress messages.
     */
    resume(opts?: { log?: (msg: string) => void }): Promise<void>;

    /**
     * Return an iterator over the active topic discoveries.
     *
     * @note These are internal objects; treat them as opaque unless you know the
     *   `hyperdht`/`hyperswarm` internals.
     */
    topics(): IterableIterator<Discovery>;

    /**
     * Look up the (internal) discovery object for a topic, if any.
     *
     * @param key The 32-byte topic.
     * @returns The discovery, or `null` if not currently joined.
     */
    status(key: Uint8Array): Discovery | null;
  }

  /**
   * An internal per-topic discovery object (returned by {@link Hyperswarm.status}
   * and iterated by {@link Hyperswarm.topics}).
   *
   * FOLLO-UP: this is `hyperswarm`'s internal `lib/peer-discovery.js`. Not
   * exported by the package. Best-guess of the surface a consumer might touch.
   */
  interface Discovery {
    /** The 32-byte topic this discovery is for. */
    readonly topic: Uint8Array;
    /** The swarm this discovery belongs to. */
    readonly swarm: Hyperswarm;
    /** Max number of peers to connect to. */
    limit: number;
    /** `true` once this discovery has been destroyed. */
    readonly destroyed: boolean;
    /** `true` while this discovery is suspended. */
    readonly suspended: boolean;
    /** Create a new {@link Session} on this topic. */
    session(opts?: JoinOptions): Session;
    /** Re-run discovery. */
    refresh(): Promise<true | false | undefined>;
    /** Wait for discovery to settle. */
    flushed(): Promise<boolean>;
    /** Suspend this discovery. */
    suspend(opts?: { log?: (msg: string) => void }): Promise<void>;
    /** Resume a suspended discovery. */
    resume(): void;
    /** Destroy this discovery (leaves the topic when it is the last session). */
    destroy(): Promise<undefined>;
  }

  /**
   * The `hyperswarm` default export: the constructable swarm class.
   *
   * @param opts Swarm options.
   */
  const Hyperswarm: {
    new (opts?: SwarmOptions): Hyperswarm;
  };

  export default Hyperswarm;
}

/**
 * FOLLO-UP (best-guess / not fully recoverable from the source):
 *
 * The `hyperdht`-related best-guesses are now resolved by referencing the
 * hand-written `hyperdht` types (see `src/types/hyperdht.d.ts`):
 *
 *  1. {@link Connection} is now `import('hyperdht').Connection` — the
 *     `@hyperswarm/secret-stream` `NoiseSecretStream` surface, modeled in the
 *     `hyperdht` definitions.
 *
 *  2. {@link HyperDht} and {@link Server} are now
 *     `import('hyperdht').HyperDHT` / `import('hyperdht').Server`, so the full
 *     surface is available (previously only the subset `hyperswarm` calls was
 *     modeled).
 *
 *  3. {@link Firewall}'s `payload` is now `import('hyperdht').HandshakePayload`
 *     (the decoded Noise handshake payload; `hyperswarm` still passes `null`).
 *
 *  4. {@link RelayTarget} is now `import('hyperdht').RelayTarget` (the full
 *     `hyperdht`/`blind-relay` accepted union).
 *
 * Still best-guess (NOT resolved by `hyperdht` — these are `hyperswarm`
 * internals that ship no types and are not exported by the package):
 *
 *  5. {@link Discovery} / {@link Session} correspond to `hyperswarm`'s internal
 *     `lib/peer-discovery.js`. Only the observable surface is modeled.
 *
 *  6. {@link PeerInfo} corresponds to `hyperswarm`'s internal `lib/peer-info.js`
 *     (an `EventEmitter` subclass, not exported). The internal implementation
 *     has more (private) state; those are omitted.
 *
 * And a few things remain best-guess because the *leaf* dependencies still ship
 * no types / are not resolvable from the project root — see the FOLLO-UP notes
 * in `src/types/hyperdht.d.ts` for `RawStream` (`udx-native`), the DHT base
 * (`dht-rpc`), the routing table / time-ordered-set, and the `streamx` event
 * set.
 */
