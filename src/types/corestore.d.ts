/**
 * Type definitions for `corestore` (v7.13.0).
 *
 * The package ships only `index.js` + `lib/*.js` (CommonJS, using `require` /
 * `module.exports = Corestore`) with no `types`/`typings` field, so
 * TypeScript reports TS7016 for it. This file provides an ambient module
 * declaration so the library can be used in a TypeScript project.
 *
 * Source of truth: `node_modules/corestore/index.js` and `lib/*.js`. The types
 * below were derived from that source (the actual runtime surface), NOT guessed
 * from docs. `Corestore` is `module.exports`, which `extends`
 * `ready-resource` (itself a Node `events` `EventEmitter`); its internals are a
 * handful of non-exported tracker classes (`StreamTracker`, `SessionTracker`,
 * `CoreTracker`, `FindingPeers`) plus a `GroupNotifyHandle` in
 * `lib/notify.js`.
 *
 * NOTE on buffers: `corestore`'s dependencies (`b4a`, `hypercore-crypto`)
 * expose their public types as plain `Uint8Array`, so this file uses
 * `Uint8Array` for every byte buffer. This is accurate, not a shortcut.
 *
 * NOTE on already-typed siblings: `corestore` is built on `hypercore` and
 * `hypercore-crypto`, both of which have hand-written definitions in this
 * project. So `Corestore`/`Hypercore`/`KeyPair`/`CoreStorage`/`ValueEncoding`/
 * `Manifest*`/`Duplex`/`EncryptionProvider` are reused via inline `import()`
 * type queries (not top-level imports) so this file stays an ambient module
 * *declaration* rather than augmenting a module.
 *
 * NOTE on `ready-resource` (the base class): it ships no types and is a
 * transitive dependency, so the ready/close/`opened`/`closing`/`opening`/
 * `closed` surface a {@link Corestore} inherits is modelled directly on the
 * class (see the FOLLO-UP block at the bottom).
 *
 * Dependency notes (why some types are marked FOLLO-UP at the bottom):
 *  - `ready-resource` (base), `sodium-universal` (signing), `hypercore-id-encoding`,
 *    `hypercore-errors` and `which-runtime` all ship no types. The ones that
 *    surface in the public API (the `ReadyResource` lifecycle, a storage
 *    `getAuth`/`createDiscoveryKeyStream`/`createGroupUpdateStream` result,
 *    and the `Core.audit` report) are best-guesses marked FOLLO-UP.
 *  - `sodium-universal` / `which-runtime` are used only by non-exported
 *    helpers in `index.js`, so they never appear in the public surface.
 */

declare module "corestore" {
  // ---------------------------------------------------------------------------
  // Reused types from already-typed siblings (via inline `import()` queries)
  // ---------------------------------------------------------------------------

  /** A `hypercore` session. This is what {@link Corestore.get} returns. */
  type Hypercore = import("hypercore").Hypercore;

  /** A `hypercore` core storage backend (the `storage` arg to the ctor). */
  type CoreStorage = import("hypercore").CoreStorage;

  /** A `hypercore` signing key pair `{ publicKey: 32B, secretKey: 64B }`. */
  type KeyPair = import("hypercore-crypto").KeyPair;

  /** A `hypercore` block value encoding. */
  type ValueEncoding = import("hypercore").ValueEncoding;

  /** A 32-byte core public key. */
  type Key = import("hypercore").Key;

  /** A core public key, or its hex-encoded `id` string. */
  type KeyLike = import("hypercore").KeyLike;

  /** A signed core manifest (the stored form). */
  type Manifest = import("hypercore").Manifest;

  /** A manifest to sign with (object or encoded buffer). */
  type ManifestInput = import("hypercore").ManifestInput;

  /** An encryption provider. */
  type EncryptionProvider = import("hypercore").EncryptionProvider;

  /** An encryption key input. */
  type EncryptionKeyInput = import("hypercore").EncryptionKeyInput;

  /** The replication duplex {@link Corestore.replicate} returns. */
  type Duplex = import("hypercore").Duplex;

  /** A `hypercore` construction option set (most {@link GetOptions} fields). */
  type HypercoreOptions = import("hypercore").HypercoreOptions;
  // ---------------------------------------------------------------------------
  // Event-emitter base (Corestore extends `ready-resource` → Node `EventEmitter`)
  // ---------------------------------------------------------------------------

  /**
   * A generic event map. Only the events a type declares are strongly typed;
   * everything else falls through to the index signature.
   */
  interface EventMap {
    [event: string | symbol]: unknown[];
  }

  /**
   * A listener for an event whose payload type is `A`.
   *
   * @typeParam A The event's argument tuple (e.g. `[core: Hypercore]`).
   */
  interface EventHandler<A extends unknown[] = unknown[], R = unknown> {
    (...args: A): R;
  }

  /**
   * The strongly-typed event-emitter surface shared by {@link Corestore}.
   * Mirrors the `Emitter` base the other definitions in this project use, so
   * `.on` / `.emit` are type-safe against an {@link EventMap}.
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
   * The event map for a {@link Corestore}.
   *
   * `Corestore` inherits `ready`/`close` from `ready-resource` (a Node
   * `EventEmitter`) and adds the group-activity events it emits.
   */
  export interface CoreEvents extends EventMap {
    /** Emitted once the store is opened/ready. */
    ready: [];
    /** Emitted once the store is closed. */
    close: [];
    /**
     * Emitted when a discovery group the store watches changes.
     * @param topic The 32-byte group topic.
     * @param update The group update (best-guess — see FOLLO-UP).
     */
    "group-active": [topic: Uint8Array, update: GroupUpdate];
    /**
     * Emitted once a {@link Corestore.watch} callback's core is available.
     * (Watchers are registered via {@link Corestore.watch}, not `.on`.)
     */
    added: [core: Hypercore];
  }
  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  /**
   * Options for the {@link Corestore} constructor (and, transitively, for
   * {@link Corestore.session} / {@link Corestore.namespace}).
   *
   * @note When `root` is set the new store shares the root's storage / trackers
   *   (it becomes a child store); otherwise `storage` defines its own backing
   *   storage (via `Hypercore.defaultStorage`).
   */
  export interface CorestoreOptions {
    /**
     * The backing storage: a directory path, or a `hypercore`
     * {@link CoreStorage}. Ignored when {@link CorestoreOptions.root} is set
     * (the child shares the root's storage).
     */
    storage?: string | CoreStorage;
    /** A parent store; this becomes a child view sharing its storage. */
    root?: Corestore | null;
    /** An explicit core id (used by the storage). */
    id?: Uint8Array;
    /** Whether to allow backups of the storage. */
    allowBackup?: boolean;
    /** Open the store read-only. */
    readOnly?: boolean;
    /**
     * Open the store read-only when `false`. (Equivalent to `readOnly: true`
     * when the flag is omitted; `readOnly: false` forces writable.)
     */
    writable?: boolean;
    /** Whether to wait (replicate) for missing blocks. Default `true`. */
    wait?: boolean;
    /** A block-tree cache size (advanced). */
    treeCache?: number;
    /** A primary key for a multi-store namespace (unsafe without `unsafe`). */
    primaryKey?: Uint8Array;
    /** Acknowledge that passing a `primaryKey` is intentional. */
    unsafe?: boolean;
    /** The namespace (32 bytes) this store derives names from. */
    namespace?: Uint8Array;
    /** The manifest version to sign with. Default `1`. */
    manifestVersion?: number;
    /** Whether to suspend the storage on Android. Default: runtime-dependent. */
    suspend?: boolean;
    /** Whether the store is active (replicating). Default `true`. */
    active?: boolean;
    /** Always request the latest block (advanced). */
    alwaysLatestBlock?: boolean;
    /** A global cache shared across cores (advanced). */
    globalCache?: unknown | null;
  }

  /**
   * Options for {@link Corestore.get} (open/create a {@link Hypercore} session).
   *
   * A {@link Corestore}.`get` call may be given either a {@link KeyLike}
   * (overloaded separately) or one of these. Most fields mirror
   * {@link HypercoreOptions}; the extra ones are corestore-specific.
   */
  export interface GetOptions extends Partial<HypercoreOptions> {
    /** A name to derive a discovery key from (namespaced by the store). */
    name?: string;
    /**
     * A discovery key (32-byte buffer or its hex string) to open a core by,
     * even when it is not stored locally yet.
     */
    discoveryKey?: Uint8Array | string;
    /** The manifest version to sign with. */
    manifestVersion?: number;
    /** Whether to create the core in storage if it is missing. */
    createIfMissing?: boolean;
    /** Whether this is a draft (uncommitted) session. */
    draft?: boolean;
    /**
     * An async (or sync) preload: its resolved value is merged into the
     * options. Used when `name`/`preload` require an RTT to resolve.
     */
    preload?: () => Partial<GetOptions> | Promise<Partial<GetOptions>>;
  }
  // ---------------------------------------------------------------------------
  // Best-guess dependency surfaces (FOLLO-UP — these deps ship no types)
  // ---------------------------------------------------------------------------

  /**
   * A read/byte stream produced by the storage layer
   * (`createDiscoveryKeyStream`, `createGroupUpdateStream`, …).
   *
   * FOLLO-UP: the storage streams are `streamx` `Readable`s (a transitive,
   * untyped dependency, not resolvable from the project root — see the note in
   * `hypercore.d.ts`). This mirrors the minimal readable surface a caller uses.
   * Replace with the real `streamx`/storage types if/when resolvable.
   */
  export interface Stream<T> extends Emitter<EventMap> {
    /** Whether the readable side is active. */
    readonly readable: boolean;
    /** Whether the stream has been destroyed. */
    readonly destroyed: boolean;
    /** Pipe this stream (as a source) into `dest`. */
    pipe(dest: Stream<T>): this;
    /** Async-iterate the yielded chunks. */
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
  }

  /**
   * A group update pushed through a {@link GroupNotifyHandle} / the
   * `group-active` event.
   *
   * FOLLO-UP: the concrete shape is produced by `hypercore-storage`
   * (`createGroupUpdateStream`), which ships no types. Only the observable
   * surface is modelled; refine if/when the shape is pinned.
   */
  export interface GroupUpdate {
    /** The discovery key of the group this update is for. */
    discoveryKey?: Uint8Array;
    /** The (decoded) group update payload. */
    update: unknown;
  }

  /**
   * A core authentication record returned by
   * {@link Corestore.getAuth} (from the storage layer).
   *
   * FOLLO-UP: the concrete shape is produced by `hypercore-storage`
   * (`getAuth`), which ships no types. Only the fields a caller observes are
   * modelled; refine if/when the shape is pinned.
   */
  export interface CoreAuth {
    /** The core's public key. */
    key?: Key;
    /** The core's discovery key. */
    discoveryKey?: Uint8Array;
    /** The signed manifest, if any. */
    manifest?: Manifest | null;
  }

  /**
   * A per-core audit report yielded by {@link Corestore.audit}
   * (the `audit` field of {@link CoreAuditRecord}).
   *
   * FOLLO-UP: `Core.audit()` (a `hypercore` internal, `lib/core.js`) ships no
   * types and is not exposed by `hypercore.d.ts`. The report is a best-guess of
   * its observable shape; refine against `hypercore`'s source.
   */
  export interface CoreAuditResult {
    /** The audit status (e.g. a human-readable outcome). */
    status: string;
  }

  /**
   * One record yielded by the {@link Corestore.audit} async generator.
   */
  export interface CoreAuditRecord {
    /** The discovery key of the audited core. */
    discoveryKey: Uint8Array;
    /** The public key of the audited core. */
    key: Key;
    /** The audit report for the core. */
    audit: CoreAuditResult;
  }

  /** Options for {@link Corestore.audit}. */
  export interface AuditOptions {
    /** When `true`, do not write fixes to storage. Default `false`. */
    dryRun?: boolean;
  }

  /** Options for {@link Corestore.suspend}. */
  export interface SuspendOptions {
    /** A progress callback invoked with log lines. */
    log?: (message: string) => void | Promise<void>;
  }

  /**
   * Options for {@link Corestore.replicate}. Mirrors the options
   * `Hypercore.createProtocolStream` accepts (spread into it by corestore).
   *
   * FOLLO-UP: the exact accepted set is `@hyperswarm/secret-stream`'s
   * (untyped) protocol-stream options; only the fields corestore touches are
   * modelled. Refine if/when the secret-stream types are available.
   */
  export interface ReplicateOptions {
    /** The underlying noise/secret stream to wrap. */
    stream?: Duplex;
    /** Keep the connection alive across inactivity. */
    keepAlive?: boolean;
  }
  // ---------------------------------------------------------------------------
  // GroupNotifyHandle (from `lib/notify.js`)
  // ---------------------------------------------------------------------------

  /**
   * A handle for a discovery-group notification, from {@link Corestore.notifyGroup}.
   *
   * Extends a Node `EventEmitter` (emits `update` when the group changes) and
   * exposes an async stream of group updates via {@link updates}.
   */
  /** The event map for a {@link GroupNotifyHandle}. */
  interface GroupNotifyEvents extends EventMap {
    /** Emitted when the group's head changes. */
    update: [update: GroupUpdate];
  }

  export class GroupNotifyHandle {
    /**
     * Create a group-notify handle.
     * @param store The store this handle is attached to.
     * @param topic The 32-byte group topic.
     */
    constructor(store: Corestore, topic: Uint8Array);

    /**
     * A stream of the group's updates (until {@link destroy}).
     * @returns A readable stream of {@link GroupUpdate}s.
     */
    updates(opts?: unknown): Stream<GroupUpdate>;
    /** Detach the handle from its store. */
    destroy(): void;
  }

  // A class can't inherit an interface via `extends`/`implements` in this TS
  // setup, so the event-emitter surface is merged in via a same-name interface
  // (declaration merge) — this is what gives {@link GroupNotifyHandle} the
  // `on`/`once`/`off`/`emit`/… surface (see the note in the FOLLO-UP block).
  export interface GroupNotifyHandle extends Emitter<GroupNotifyEvents> {}
  // ---------------------------------------------------------------------------
  // The Corestore class
  // ---------------------------------------------------------------------------

  /**
   * A Hypercore factory that simplifies managing a collection of cores.
   *
   * `Corestore` extends `ready-resource` (a Node `EventEmitter`); use
   * {@link ready} / {@link close} for its lifecycle, and {@link get} /
   * {@link session} / {@link namespace} to open cores.
   */
  export class Corestore {
    // -- constructor ---------------------------------------------------------

    /**
     * Create a store over a storage backend.
     *
     * @param storage A storage directory path or a {@link CoreStorage}.
     * @param opts    Construction options (see {@link CorestoreOptions}).
     */
    constructor(storage: string | CoreStorage, opts?: CorestoreOptions);
    /**
     * Create a store (over the default storage) from options alone.
     *
     * @param opts Construction options (see {@link CorestoreOptions}).
     */
    constructor(opts?: CorestoreOptions);

    // -- state -------------------------------------------------------------

    /** The parent store, or `null` for a root store. */
    root: Corestore | null;
    /** The backing storage. */
    storage: CoreStorage;
    /** Child stores sharing this store's storage. */
    corestores: Set<Corestore>;
    /** Whether this store is read-only. */
    readOnly: boolean;
    /** A global cache shared across cores, or `null`. */
    globalCache: unknown | null;
    /** The primary key for this namespace, or `null`. */
    primaryKey: Uint8Array | null;
    /** The namespace this store derives names from (32 bytes). */
    ns: Uint8Array;
    /** The manifest version this store signs with. */
    manifestVersion: number;
    /** Whether the store suspends its storage (Android). */
    shouldSuspend: boolean;
    /** Whether the store is active (replicating). */
    active: boolean;
    /** Always request the latest block. */
    alwaysLatestBlock: boolean;

    // -- lifecycle (inherited from `ready-resource`) -----------------------

    /** Whether the store is opened/ready. */
    opened: boolean;
    /** Whether the store is closed. */
    closed: boolean;
    /** A promise for the (first) open to complete. */
    opening: Promise<void>;
    /** A promise for the close to complete, or `null` while open. */
    closing: Promise<void> | null;

    /**
     * Ensure the store is opened (idempotent).
     * @returns A promise that resolves when the store is ready.
     */
    ready(): Promise<void>;
    /**
     * Close the store (and its cores).
     * @returns A promise that resolves when the store is closed.
     */
    close(): Promise<void>;

    // -- watching ------------------------------------------------------------

    /**
     * Watch for cores opened on this store.
     * @param fn Called with each {@link Hypercore} as it is opened.
     */
    watch(fn: (core: Hypercore) => void): void;
    /**
     * Stop watching for cores (registered via {@link watch}).
     * @param fn The exact listener passed to {@link watch}.
     */
    unwatch(fn: (core: Hypercore) => void): void;

    // -- groups ------------------------------------------------------------

    /**
     * Subscribe to a discovery group's updates.
     * @param topic The 32-byte group topic.
     * @returns A {@link GroupNotifyHandle} (emit `update` / {@link updates}).
     */
    notifyGroup(topic: Uint8Array): GroupNotifyHandle;

    // -- replication -------------------------------------------------------

    /**
     * Begin (or attach to) replication over the store's cores.
     *
     * @param isInitiator The initiating side: `true`, `false`, or an
     *   incoming stream to treat as the other side.
     * @param opts    Replication options (see {@link ReplicateOptions}).
     * @returns The replication duplex.
     */
    replicate(isInitiator: boolean | Duplex, opts?: ReplicateOptions): Duplex;

    /**
     * Track which cores are still finding peers; call the returned function
     * when done. Used to coordinate the "finding peers" lifecycle.
     * @returns A function to call once the peer search is complete.
     */
    findingPeers(): () => void;

    // -- sessions ---------------------------------------------------------

    /**
     * Open a child store (a "session" of this store) sharing its storage.
     *
     * @param opts Child-store options (see {@link CorestoreOptions}).
     * @returns The new child {@link Corestore}.
     */
    session(opts?: CorestoreOptions): Corestore;

    /**
     * Open a child store in a namespace derived from `name`.
     *
     * @param name The namespace name (string or bytes).
     * @param opts Child-store options (see {@link CorestoreOptions}).
     * @returns The new child {@link Corestore}.
     */
    namespace(name: string | Uint8Array, opts?: CorestoreOptions): Corestore;

    /**
     * Open / create a {@link Hypercore} session on this store.
     *
     * @param opts A {@link KeyLike} (buffer or id string) to open by.
     * @returns A {@link Hypercore} session.
     */
    get(opts: KeyLike): Hypercore;
    /**
     * Open / create a {@link Hypercore} session on this store.
     *
     * @param opts Session options (see {@link GetOptions}).
     * @returns A {@link Hypercore} session.
     */
    get(opts?: GetOptions): Hypercore;
    /**
     * Open a new (keyless) {@link Hypercore} session on this store.
     *
     * @returns A {@link Hypercore} session.
     */
    get(): Hypercore;

    /**
     * Create a signing key pair for a name within this store's namespace.
     *
     * @param name The name to derive the key pair from.
     * @param ns   An override namespace (defaults to this store's {@link ns}).
     * @returns The derived {@link KeyPair}.
     */
    createKeyPair(name: string, ns?: Uint8Array): Promise<KeyPair>;

    /**
     * Turn a core into a "static" (frozen) core snapshot.
     *
     * @param core The core to staticify.
     * @param opts Options for the resulting static core session.
     * @returns The static {@link Hypercore} session.
     */
    staticify(core: Hypercore, opts?: GetOptions): Promise<Hypercore>;

    // -- audit / suspend / resume ----------------------------------------

    /**
     * Audit every core on this store (async generator).
     *
     * @param opts Audit options (see {@link AuditOptions}).
     * @returns An async generator of {@link CoreAuditRecord}s.
     */
    audit(opts?: AuditOptions): AsyncGenerator<CoreAuditRecord, void, unknown>;

    /**
     * Suspend the storage (Android; a no-op unless `shouldSuspend`).
     * @param opts Suspend options (see {@link SuspendOptions}).
     */
    suspend(opts?: SuspendOptions): Promise<void>;

    /**
     * Resume the storage after a {@link suspend}.
     * @returns A promise that resolves when resumed.
     */
    resume(): Promise<void>;

    // -- storage passthroughs ----------------------------------------------

    /**
     * A stream of the discovery keys of the cores on this store.
     *
     * FOLLO-UP: the concrete stream is `hypercore-storage`'s
     * {@link CoreStorage} `createDiscoveryKeyStream` (untyped); best-guess
     * {@link Stream} of `Uint8Array` (see FOLLO-UP block).
     *
     * @param namespace Restrict to a namespace (optional).
     * @returns A readable stream of 32-byte discovery keys.
     */
    list(namespace?: Uint8Array): Stream<Uint8Array>;

    /**
     * Fetch the authentication (key/manifest) for a discovery key.
     *
     * FOLLO-UP: the concrete record is `hypercore-storage`'s
     * {@link CoreStorage} `getAuth` (untyped); best-guess {@link CoreAuth}.
     *
     * @param discoveryKey The 32-byte discovery key.
     * @returns The auth record, or `null` if unknown.
     */
    getAuth(discoveryKey: Uint8Array): CoreAuth | null;
  }

  // A class can't inherit an interface via `extends`/`implements` in this TS
  // setup, so the `ready-resource`/`EventEmitter` surface is merged in via a
  // same-name interface (declaration merge). This is what gives {@link Corestore}
  // the `on`/`once`/`off`/`emit`/… surface (and the rest of {@link Emitter}).
  export interface Corestore extends Emitter<CoreEvents> {}

  /**
   * The full set of exports, available as the default import so that
   * `import corestore from 'corestore'` type-checks without `esModuleInterop`.
   *
   * @note FOLLO-UP: this `default` exists only to support the CommonJS default
   *   import under NodeNext. If the project ever enables `esModuleInterop`,
   *   prefer the named import above.
   */
  const _default: typeof Corestore;
  export default _default;
}

/**
 * FOLLO-UP (best-guess / not fully recoverable from the source) — read before
 * relying on the following.
 *
 *  - `Corestore`'s lifecycle (`ready`/`close`/`opened`/`closed`/`opening`/
 *    `closing`) comes from `ready-resource`, which ships no types and is a
 *    transitive dependency (not resolvable from the project root). Modelled
 *    directly on the class above. If/when `ready-resource` is typed, replace
 *    with `extends import('ready-resource').ReadyResource`.
 *
 *  - {@link Corestore.replicate}'s {@link ReplicateOptions} mirror
 *    `@hyperswarm/secret-stream`'s (untyped) protocol-stream options; only the
 *    fields corestore touches (`stream`, `keepAlive`) are modelled. The return
 *    {@link Duplex} is reused from `hypercore.d.ts` (itself a best-guess of
 *    `@hyperswarm/secret-stream` / `streamx`).
 *
 *  - The storage-layer results {@link CoreAuth} (from `getAuth`) and
 *    {@link Stream} (from `list` / `GroupNotifyHandle.updates`) are produced
 *    by `hypercore-storage` / `streamx`, both untyped and transitive.
 *    Best-guesses; refine against those packages' source.
 *
 *  - {@link CoreAuditResult} (the `audit` field of {@link CoreAuditRecord}) is
 *    the return of a `hypercore` internal `Core.audit()` not modelled by
 *    `hypercore.d.ts`; best-guess of its observable shape.
 *
 *  - {@link GetOptions} inherits from `Partial<HypercoreOptions>`; a few
 *    `HypercoreOptions` fields (`compat`, `eagerUpgrade`, `preopen`, `core`,
 *    `sessions`, `ongc`, `parent`) are set internally by corestore and are not
 *    meaningfully exposed to a `get()` caller, so they are intentionally left
 *    to the base type rather than duplicated.
 */
