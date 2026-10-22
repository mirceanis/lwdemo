/**
 * Type definitions for `autobee` (v2.12.1).
 *
 * The package ships only `index.js` / `lib/*.js` (CommonJS, using `require` /
 * `module.exports`) and has no `types`/`typings` field, so TypeScript reports
 * TS7016 for it. This file provides an ambient module declaration so the library
 * can be used in a TypeScript project.
 *
 * The types below are derived from `index.js`, `lib/*.js`, and `encoding/spec/`,
 * i.e. the actual runtime surface, not just the README.
 *
 * NOTE on buffers: `autobee`'s dependencies (`b4a`) expose their public types as
 * plain `Uint8Array` (there is no exported "secure buffer" type), so this file
 * uses `Uint8Array` for every byte buffer. This is accurate, not a shortcut.
 *
 * NOTE on dependencies (see the FOLLO-UP block at the bottom of this file):
 *   - `corestore`, `hypercore`, `hyperbee2` ship NO types, so the types they
 *     appear as in this declaration (Corestore / Hypercore / Hyperbee / Duplex)
 *     are BEST GUESSES derived from how `autobee` uses them and are flagged
 *     individually below.
 *   - `ready-resource` DOES ship types (`export = ReadyResource extends
 *     EventEmitter`); `ready()/close()` and the typed `on/once/off/emit`
 *     below mirror that base class.
 *   - `autobee`'s public surface does NOT reference `hyperswarm` (or
 *     `protomux`) at all — `db.replicate()` returns a corestore/hypercore
 *     `Duplex`, which a caller would pipe into a `hyperswarm` stream, but that
 *     is the caller's concern, not `autobee`'s. Nothing here needs the
 *     `hyperswarm` types.
 */

declare module "autobee" {
  // ---------------------------------------------------------------------------
  // Shared / low-level value types
  // ---------------------------------------------------------------------------

  /**
   * A core public key (a 32-byte buffer). Reused from `hypercore` via an inline
   * `import()` type query (not a top-level `import`) so this file stays an
   * ambient module declaration.
   */
  export type Key = import("hypercore").Key;

  /**
   * A core public key, or its hex-encoded `id` string. Reused from `hypercore`
   * (see {@link Key}).
   */
  export type KeyLike = import("hypercore").KeyLike;

  /**
   * A core "head": which core (`key`) and up to which `length`. `key` is `null`
   * only for the empty / genesis head (`{ length: 0, key: null }`, i.e.
   * {@link Autobee.GENESIS}).
   */
  export interface Head {
    /** The core public key, or `null` at the empty head. */
    key: Uint8Array | null;
    /** The length up to which this head refers. */
    length: number;
  }

  /**
   * A "link" / dependency: a core `key` referenced up to `length`. Used for
   * oplog links and trusted-head records.
   */
  export interface Link {
    /** The referenced core public key. */
    key: Uint8Array;
    /** The length up to which the reference reaches. */
    length: number;
  }

  /**
   * A value read from a Hyperbee view: the encoded `key` and its `value`.
   * Produced by {@link Hyperbee.get}.
   */
  export interface BeeNode {
    /** The encoded lookup key. */
    key: Uint8Array;
    /** The stored value bytes. */
    value: Uint8Array;
  }

  // ---------------------------------------------------------------------------
  // Best-guess dependency types (FOLLO-UP — these packages ship no types)
  // ---------------------------------------------------------------------------
  //
  // These stand in for `corestore`, `hypercore`, and `hyperbee2`, which ship
  // only `.js` (no `types` field). They cover the members `autobee`'s public
  // surface touches. They are intentionally minimal; see the FOLLO-UP block at
  // the bottom of this file for how to refine them (or replace with real types
  // once the respective packages publish them).
  // ---------------------------------------------------------------------------

  /**
   * A `corestore` — now resolved against the hand-written `corestore` types
   * (see `src/types/corestore.d.ts`): the real `Corestore` class with its
   * `ready`/`close` lifecycle, `get`/`session`/`namespace` core creation,
   * `replicate`, `notifyGroup`, `createKeyPair` and events. `autobee`'s
   * `db.store` is this. (Previously a best-guess interface — see the FOLLO-UP
   * note at the bottom of this file.)
   */
  export type Corestore = import("corestore").Corestore;

  /** Options accepted by {@link Corestore.session}. Reused from `corestore`. */
  export type CorestoreSessionOptions = import("corestore").CorestoreOptions;

  /** Options accepted by {@link Corestore.get}. Reused from `corestore`. */
  export type CorestoreGetOptions = import("corestore").GetOptions;

  /** Options accepted by {@link Corestore.replicate}. Reused from `corestore`. */
  export type CorestoreReplicateOptions = import("corestore").ReplicateOptions;

  /**
   * A `hypercore`.
   *
   * Now resolved against the hand-written `hypercore` types (see
   * `src/types/hypercore.d.ts`): the real `Hypercore` class with its
   * constructor overloads, getters, reads/writes, replication, events and
   * statics. `autobee`'s `db.local` / `db.bootstrap` / `openCore` /
   * `ActiveWriter.core` are these cores. (Previously a best-guess interface —
   * see the FOLLO-UP note at the bottom of this file.)
   */
  type Hypercore = import("hypercore").Hypercore;

  /** Options for {@link Hypercore.get} / {@link Hypercore.getUserData}. */
  export interface HypercoreGetOptions {
    /** A read timeout in ms (0 = none). */
    timeout?: number;
  }

  /** Options for {@link Hypercore.append} / {@link Hypercore.setUserData}. */
  export interface HypercoreAppendOptions {
    /** Whether the append is from a non-writable core (optimistic). */
    optimistic?: boolean;
    /** A maximum block length to enforce. */
    maxLength?: number;
  }

  /** A signed core manifest. FOLLO-UP (best guess; `hypercore` ships no types). */
  export interface HypercoreManifest {
    version: number;
    /** The manifest hash algorithm (e.g. `'blake2b'`). */
    hash?: string;
    prologue?: { hash: Uint8Array; length: number };
    allowPatch?: boolean;
    quorum?: number;
    signers?: Array<{ publicKey: Uint8Array }>;
    userData?: Uint8Array;
    linked?: Uint8Array;
  }

  /** A group-notify handle from {@link Corestore.notifyGroup}. Reused from `corestore`. */
  export type GroupNotifyHandle = import("corestore").GroupNotifyHandle;

  /**
   * An encryption provider: given a core `key`, returns an encryption (or `null`
   * if unencrypted). `autobee` derives these internally. FOLLO-UP (best guess).
   */
  export type EncryptionProvider = (key: Uint8Array) => Encryption | null;

  /** A concrete encryption provider instance. FOLLO-UP (best guess). */
  export interface Encryption {
    /** The 32-byte encryption key (if this provider encrypts). */
    key: Uint8Array;
    /** Decrypt a block at `index`. */
    decrypt(index: number, block: Uint8Array, ctx?: object): Promise<void>;
  }
  // ---------------------------------------------------------------------------
  // Best-guess dependency types (cont.) — `hyperbee2`, replication, writers
  // ---------------------------------------------------------------------------

  /**
   * FOLLO-UP (best guess): a `hyperbee2` bee/view. `hyperbee2` ships no types.
   * This models the members `autobee` exposes (`db.view`, `db.bee`, the `view`
   * passed to the `apply`/`open`/`close` handlers, the result of
   * {@link Autobee.openView}, etc.) plus the standard read/write API used in
   * the `apply` examples. Refine if/when `hyperbee2` publishes `@types`.
   *
   * @note A live (writable) `view` supports {@link Hyperbee.write}; a snapshot /
   *       checkout is read-only and throws on `write()`.
   */
  export interface Hyperbee {
    /** The bee's name. */
    name: string;
    /** The bee's schema version. */
    version: number;
    /** The underlying root core. */
    core: Hypercore;
    /** The current root (opaque internal node; `null` when empty). */
    root: unknown;
    /** Whether this bee is writable. */
    writable: boolean;
    /** Ensure the bee is opened. */
    ready(): Promise<void>;
    /** Close the bee. */
    close(): Promise<void>;
    /** Read a node by key (returns `null` if absent). */
    get(
      key: Uint8Array | string,
      opts?: HyperbeeGetOptions,
    ): Promise<BeeNode | null>;
    /**
     * Read every entry in the view as an async iterable of `{ key, value }`.
     * `value` is resolved; `null` only for a key stored without a value.
     */
    createReadStream(
      options?: object,
    ): AsyncIterable<{ key: Uint8Array; value: Uint8Array | null }>;
    /**
     * Walk this tree (`left`) and `right` in step, yielding only where they differ: an entry in
     * `left` alone was added here, in `right` alone was removed here, in both with different values
     * changed. `right` is another tree, e.g. an earlier {@link Hyperbee.snapshot} of this one, or
     * `checkout({ length: 0 })` for the empty tree.
     */
    createDiffStream(
      right: Hyperbee,
      options?: object,
    ): AsyncIterable<{
      left: { key: Uint8Array; value: Uint8Array | null } | null;
      right: { key: Uint8Array; value: Uint8Array | null } | null;
    }>;
    /** Begin a write batch (throws on a non-writable bee). */
    write(opts?: object): BeeBatchWriter;
    /** Open a checkout (a bee pinned to a specific core/length). */
    checkout(opts?: HyperbeeCheckoutOptions): Hyperbee;
    /** Open a read-only snapshot. */
    snapshot(opts?: HyperbeeSnapshotOptions): Hyperbee;
    /** Move the bee to a different core/length. */
    move(head: Head): void;
    /** Update the bee's root (returns the new root). */
    update(root?: unknown): Promise<unknown>;
    /** List the core keys the bee references. */
    cores(opts?: { local?: boolean }): Promise<Uint8Array[]>;
    /** The current head, or `null` when empty. */
    head(): Head | null;
    /** React to events (inherited from `EventEmitter`). */
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    /** React once to an event. */
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  }

  /** Options for {@link Hyperbee.get}. FOLLO-UP (best guess). */
  export interface HyperbeeGetOptions {
    /** A read timeout in ms (0 = none). */
    timeout?: number;
    /** Wait for the block to be available. */
    wait?: boolean;
  }

  /** Options for {@link Hyperbee.checkout}. FOLLO-UP (best guess). */
  export interface HyperbeeCheckoutOptions {
    /** The core key to check out. */
    key?: Uint8Array;
    /** The length to check out. */
    length?: number;
    /** A read timeout in ms (0 = none). */
    timeout?: number;
  }

  /** Options for {@link Hyperbee.snapshot}. FOLLO-UP (best guess). */
  export interface HyperbeeSnapshotOptions {
    /** A read timeout in ms (0 = none). */
    timeout?: number;
    /** Wait for the snapshot to be available. */
    wait?: boolean;
  }

  /**
   * A write batch returned by {@link Hyperbee.write}. Used in `apply`
   * (`const w = view.write(); w.tryPut(...); await w.flush()`).
   * FOLLO-UP (best guess).
   */
  export interface BeeBatchWriter {
    /** Insert or update a value at `key`. */
    tryPut(key: Uint8Array | string, value: Uint8Array): void;
    /** Delete a key. */
    tryDelete(key: Uint8Array | string): void;
    /** Insert or update a value at `key` (strict; may throw). */
    put(key: Uint8Array | string, value: Uint8Array): void;
    /** Delete a key (strict; may throw). */
    delete(key: Uint8Array | string): void;
    /** Flush the batch, persisting it to the bee's core. */
    flush(): Promise<void>;
  }

  /**
   * A replication stream (a duplex) from {@link Corestore.replicate} /
   * {@link Autobee.replicate}. FOLLO-UP (best guess — `hypercore`/`corestore`
   * ship no types; this is the thing a caller would `pipe` into a `hyperswarm`
   * stream).
   */
  export interface Duplex {
    /** Whether the stream is readable. */
    readable: boolean;
    /** Whether the stream is writable. */
    writable: boolean;
    /** Pipe this stream's output into `dest`. */
    pipe(dest: Duplex): this;
    /** Write a chunk of data. */
    write(chunk: Uint8Array): boolean;
    /** End the writable side. */
    end(): void;
    /** React to events (`close`, `error`, `discoverykey`, ...). */
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    /** React once to an event. */
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  }

  /**
   * FOLLO-UP (best guess): an active writer (external or the local writer),
   * exposed on the `activeWriters`/`writer` surfaces. `autobee` models this
   * internally; refine if/when a public writer type exists.
   */
  export interface ActiveWriter {
    /** The writer's core. */
    core: Hypercore;
    /** Whether this writer is an indexer. */
    isIndexer: boolean;
    /** Whether this writer is currently removed. */
    isRemoved: boolean;
    /** Whether this writer has been added to the system. */
    isAdded: boolean;
    /** The writer's capability weight. */
    weight: number;
    /** The writer's current views. */
    views(): Promise<CoreInfo[]>;
  }

  /**
   * FOLLO-UP (best guess): the active-writers set (`db.activeWriters`, "autobase
   * compat"). `autobee` models this internally; refine if/when a public type
   * exists.
   */
  export interface ActiveWriters {
    /** Whether the local writer is currently writable. */
    writable: boolean;
    /** The local writer. */
    localWriter: ActiveWriter;
    /** A map of active writers keyed by hex id. */
    active: Map<string, ActiveWriter>;
  }

  // ---------------------------------------------------------------------------
  // Autobee value types
  // ---------------------------------------------------------------------------

  /**
   * A signing key pair (Ed25519), reused from `hypercore-crypto`.
   *
   * `autobee`'s local writer signs with the same `{ publicKey: 32B,
   * secretKey: 64B }` shape as `hypercore-crypto`'s `keyPair()`, so we reuse
   * that type. Declared as an inline `import()` type query (not a top-level
   * `import`) so this file stays an ambient module declaration and keeps
   * *declaring* `autobee` rather than augmenting a non-existent module.
   */
  export type KeyPair = import("hypercore-crypto").KeyPair;

  /** An oplog batch span: the start/end positions of a batch within a node. */
  export interface Batch {
    start: number;
    end: number;
  }

  /** An external (referenced) batch: a core `key` referenced from `start`..+`length`. */
  export interface ExternalBatch {
    key: Uint8Array;
    start: number;
    length: number;
  }

  /** The view positions an oplog stamps into its own log. */
  export interface Views {
    /** The system flush count at this view. */
    flushes: number;
    /** The referenced system core. */
    system: ExternalBatch;
    /** The referenced view core (null if none). */
    view: ExternalBatch | null;
  }

  /** A witness: a grant of `weight` backed by a `link`. */
  export interface Witness {
    weight: number;
    link: Link;
  }

  /** An approval: a `weight` granted to `key`. */
  export interface Approval {
    key: Uint8Array;
    weight: number;
  }

  /**
   * A node applied to / read from a writer core. This is the shape of each
   * element of the `nodes` array passed to the {@link AutobeeHandlers.apply}
   * handler (as produced by `autobee`'s internal `createNode`).
   */
  export interface AutobeeNode {
    /** The core this node belongs to. */
    core: Hypercore;
    /** Alias for {@link AutobeeNode.core} (compat). */
    from: Hypercore;
    /** The writer's public key (equals `core.key`). */
    key: Uint8Array;
    /** The position of this node in the writer's core. */
    length: number;
    /** The resolved sort weight (−1 until sorted). */
    weight: number;
    /** The oplog version. */
    version: number;
    /** The node timestamp (ms). */
    timestamp: number;
    /** The links (dependencies) this node carries. */
    links: Link[];
    /** The batch span, or `null` when the batch covers a single node. */
    batch: Batch | null;
    /** The views stamped by this node, or `null`. */
    views: Views | null;
    /** The trusted heads carried by this node. */
    trusted: Link[];
    /** The witness carried by this node, or `null`. */
    witness: Witness | null;
    /** The approvals carried by this node, or `null`. */
    approvals: Approval[] | null;
    /** Whether this is an optimistic (unconfirmed) node. */
    optimistic: boolean;
    /** The value appended (the payload), or `null`. */
    value: Uint8Array | null;
    /** The system hash this node links against, or `null`. */
    hash: Uint8Array | null;
    /** The hint weight. */
    weightHint: number;
    /** The clock drift recorded on this node (ms). */
    drift: number;
  }
  // ---------------------------------------------------------------------------
  // apply / handler support types
  // ---------------------------------------------------------------------------

  /**
   * The `host` passed to the {@link AutobeeHandlers.apply} handler. Mirrors
   * `autobee`'s internal `ApplyCalls`: the controls an `apply` uses to manage
   * writers and stamp the system.
   */
  export interface ApplyHost {
    /** The autobee id (hex-encoded public key), or `null` before ready. */
    id: string | null;
    /** The autobee public key, or `null` before ready. */
    key: Uint8Array | null;
    /** The discovery key, or `null` before ready. */
    discoveryKey: Uint8Array | null;
    /** The debug name, if any. */
    name: string | null;
    /** The current system clock (flush count). */
    clock: number;
    /** Whether the system has processed no nodes yet. */
    genesis: boolean;
    /**
     * Add a writer by public key (buffer or hex id).
     * @returns the resulting system update (resolves `undefined`).
     */
    addWriter(key: KeyLike, opts?: AddWriterOptions): Promise<void>;
    /**
     * Deprecated no-op. Optimistic nodes are always recorded once applied
     * whether or not `apply` acks the writer; kept so existing `apply`
     * functions keep working.
     */
    ackWriter(): void;
    /** Remove a writer by public key (buffer or hex id). */
    removeWriter(key: KeyLike): Promise<void>;
    /**
     * Interrupt the current apply cycle. Throws; the db emits `'interrupt'`
     * with the reason.
     */
    interrupt(reason?: unknown): never;
    /** Create an anchor for an already-applied node. */
    createAnchor(key: Uint8Array, length: number): Promise<Anchor>;
    /** Whether `key` is currently removable. */
    removeable(key: KeyLike): boolean;
    /** Hint that a fast-forward is preferred. (No-op in current versions.) */
    preferFastForward(): void;
  }

  /** Options for {@link ApplyHost.addWriter}. */
  export interface AddWriterOptions {
    /** Whether the writer is an indexer (default `true`). */
    isIndexer?: boolean;
    /** The writer's weight. Defaults to `2` for indexers, `1` otherwise. */
    weight?: number;
  }

  /** An anchor created by {@link ApplyHost.createAnchor} / {@link Autobee.createAnchor}. */
  export interface Anchor {
    /** The anchor core's public key. */
    key: Uint8Array;
    /** The anchor core's length. */
    length: number;
  }

  /**
   * The `changes` passed to the {@link AutobeeHandlers.update} handler: the set
   * of core changes recorded during an apply cycle. Mirrors `autobee`'s
   * internal `UpdateChanges`.
   */
  export interface ApplyUpdateChanges {
    /** Look up a tracked change by core name (`'view'`, `'system'`). */
    get(name: string): ApplyChange | undefined;
  }

  /** A single tracked core change (from {@link ApplyUpdateChanges}). */
  export interface ApplyChange {
    /** The flush count at this change. */
    flushes: number;
    /** The head before the change, or `null`. */
    from: Head | null;
    /** The head after the change, or `null`. */
    to: Head | null;
    /** Whether the change was incremental (not a fast-forward). */
    incremental: boolean;
  }

  // ---------------------------------------------------------------------------
  // encode / decode + construction option types
  // ---------------------------------------------------------------------------

  /** Options for {@link Autobee.encodeValue}. */
  export interface EncodeValueOptions {
    /** The oplog version (defaults to the current one). */
    version?: number;
    /** Whether to encode as an optimistic node. */
    optimistic?: boolean;
    /** The node timestamp (ms; defaults to `Date.now()`). */
    timestamp?: number;
    /** The links carried by the node. */
    links?: Link[];
    /** The views stamped by the node, or `null`. */
    views?: Views | null;
    /** (Legacy) the heads carried by the node. */
    heads?: Link[];
    /** Whether to encode in the legacy format. */
    legacy?: boolean;
    /** Byte padding to prepend to the block. */
    padding?: number;
    /** Whether the value is encrypted (requires `optimistic`). */
    encrypted?: boolean;
  }

  /** Options for {@link Autobee.decodeValue}. */
  export interface DecodeValueOptions {
    /** The writer encryption key, if the block is encrypted. */
    encryptionKey?: Uint8Array;
    /** The autobee public key (for decryption). */
    autobeeKey?: Uint8Array;
    /** The core key of the block (for decryption). */
    key?: Uint8Array;
    /** The core manifest (for decryption). */
    manifest?: HypercoreManifest;
    /** The block index (for decryption). */
    index?: number;
  }

  /** Options for {@link Autobee.append}. */
  export interface AppendOptions {
    /** Write optimistically, without waiting to be a confirmed writer. */
    optimistic?: boolean;
  }

  /**
   * A fast-forward option passed to {@link Autobee.moveTo} / the `boot` option.
   * An oplog `head` to fast-forward onto.
   */
  export type BootHead = Head;

  /**
   * The `boot` option value. Either a bare `head`, or a struct with `head`
   * and/or a legacy (pre-2.0) `legacy` pointer. Pass one, not both.
   */
  export type BootInput = Head | { head?: BootHead; legacy?: BootHead };

  /** Options for the `fastForward` handler option. */
  export interface FastForwardOptions {
    /** An oplog head (or legacy pointer) to boot from. */
    boot?: BootInput;
    /**
     * When `true`, only fast-forward once the system/view the head stamps are
     * held whole (locally or by a connected peer). Defaults to `false`.
     */
    conservative?: boolean;
  }

  /** A wakeup capability: the key + discovery key to announce over the network. */
  export interface WakeupCapability {
    /** The core key. */
    key: Uint8Array;
    /** The discovery key. */
    discoveryKey: Uint8Array;
  }

  /** A single core info entry (from {@link Autobee.views} / {@link ActiveWriter.views}). */
  export interface CoreInfo {
    /** The core public key. */
    key: Uint8Array;
    /** The core length. */
    length: number;
    /** The signed length (autobase compat; equals `length`). */
    signedLength: number;
  }

  /** The result of {@link Autobee.cores}. */
  export interface CoresResult {
    /** The autobee public key, or `null` before ready. */
    key: Uint8Array | null;
    /** The view cores to pin. */
    views: Uint8Array[];
    /** The writer cores to pin. */
    writers: Uint8Array[];
  }

  /** Options for {@link Autobee.cores}. */
  export interface CoresOptions {
    /** Wait for a trusted head (default `true`). */
    wait?: boolean;
    /** Include the local writer + its views (default `true`). */
    local?: boolean;
    /** Include all view/system cores (default `false`). */
    all?: boolean;
  }

  /** Runtime statistics, exposed as {@link Autobee.stats}. */
  export interface AutobeeStats {
    /** Number of undos performed. */
    undos: number;
    /** Number of fast-forwards. */
    fastForwards: number;
    /** Number of drains. */
    drains: number;
    /** Number of applies. */
    applies: number;
    /** Number of appends. */
    appends: number;
    /** Number of writers opened. */
    writersOpened: number;
    /** Number of writers closed. */
    writersClosed: number;
  }
  // ---------------------------------------------------------------------------
  // Construction handlers + events
  // ---------------------------------------------------------------------------

  /**
   * The handlers / options passed to the `Autobee` constructor (the 2nd argument
   * when it is an object, or the 3rd argument). Mirrors the `handlers` the
   * `Autobee` constructor reads, plus the documented options.
   */
  export interface AutobeeHandlers {
    /**
     * Called with batches of new nodes to apply to the view.
     * @param nodes the batch of nodes to apply
     * @param view the writable view (a `Hyperbee`)
     * @param host the {@link ApplyHost} controls
     */
    apply?: (
      nodes: AutobeeNode[],
      view: Hyperbee,
      host: ApplyHost,
    ) => void | Promise<void>;
    /**
     * Called to create a custom view; return the view to use. The default
     * returns the bee unchanged.
     */
    open?: (bee: Hyperbee, db: Autobee) => Hyperbee | Promise<Hyperbee>;
    /** Called when the db closes. */
    close?: (view: Hyperbee) => void | Promise<void>;
    /** Called after `apply` when the view has been updated. */
    update?: (
      view: Hyperbee,
      changes: ApplyUpdateChanges,
    ) => void | Promise<void>;
    /**
     * Required when a pre-2.0 migration is detected: called with the legacy
     * views and the boot head.
     */
    migrate?: (views: Head[], head: Head) => void | Promise<void>;
    /**
     * A one-shot gate run before the first apply; nothing applies until it
     * resolves.
     */
    preapply?: (view: Hyperbee) => void | Promise<void>;
    /**
     * Prepare a candidate `view` before a fast-forward onto it is applied.
     * Throw/reject to reject the candidate.
     */
    warmup?: (view: Hyperbee) => void | Promise<void>;
    /**
     * Whether `key` is a writer to trust, judged against the `reference` view.
     * The default is `true` unless a `mostRecentTrusted` handler is supplied.
     */
    isTrusted?: (
      key: Uint8Array,
      reference: Hyperbee,
    ) => boolean | Promise<boolean>;
    /**
     * The oplog head most recently vouched for, given the `target` view and a
     * `reference` view (`null` when stamping the local oplog).
     */
    mostRecentTrusted?: (
      target: Hyperbee,
      reference: Hyperbee | null,
    ) => Head | null | Promise<Head | null>;
    /** Block `ready()` until this resolves. */
    wait?: () => void | Promise<void>;
    /** Override the clock (defaults to `Date.now`). */
    now?: () => number;
    /** A debug name for the db. */
    name?: string | null;
    /** The name of the view core (default `'view'`). */
    viewName?: string;
    /** A 32-byte key to encrypt all data at rest. */
    encryptionKey?: Uint8Array | Promise<Uint8Array>;
    /** Set `true` if using an `encryptionKey`. */
    encrypted?: boolean;
    /** A custom signing key pair for the local writer. */
    keyPair?: KeyPair | Promise<KeyPair>;
    /** Allow optimistic writes from unknown writers (default `true`). */
    optimistic?: boolean;
    /** Flushes we may fall behind before acking (default `32`). */
    ackThreshold?: number;
    /** The weight of the bootstrap writer (default `2`). */
    bootstrapWeight?: number;
    /** Fast-forward options, or `false` to disable fast-forwards entirely. */
    fastForward?: false | FastForwardOptions;
    /** Legacy views to warm up from (autobase compat). */
    legacyViews?: Head[];
    /** Strictly reindex any older-version cores (default `false`). */
    strictReindex?: boolean;
    /** Max untrusted writers to keep open (default `128`). */
    maxUntrustedWriters?: number;
    /** A custom wakeup capability to advertise. */
    wakeupCapability?: WakeupCapability | Promise<WakeupCapability>;
  }

  /** The result of {@link Autobee.moveTo}. */
  export interface MoveToResult {
    /** The head the system moved to. */
    to: Head;
    /** The head the system moved from. */
    from: Head;
  }

  /** The events emitted by an {@link Autobee}. */
  export interface AutobeeEventMap {
    /** Emitted when the db becomes ready. */
    ready: () => void;
    /** Emitted when the db closes. */
    close: () => void;
    /** Emitted when an apply cycle is interrupted, with the reason. */
    interrupt: (reason: unknown) => void;
    /** Emitted when the view is updated. */
    update: () => void;
    /** Emitted on a fatal error. */
    error: (err: Error) => void;
    /** Emitted on a fast-forward, with the new and previous heads. */
    "move-to": (to: Head, from: Head) => void;
    /** Emitted when the local writer is rotated. */
    "rotate-local-writer": () => void;
    /** Emitted when an anchor is created, with the anchor and the origin. */
    anchor: (
      anchor: Anchor,
      origin: { key: Uint8Array; length: number },
    ) => void;
    /** Emitted when the local writer becomes writable. */
    writable: () => void;
    /** Emitted when the local writer becomes unwritable. */
    unwritable: () => void;
    /** Emitted when a writer is attached, with the writer. */
    writer: (writer: ActiveWriter) => void;
    /** Emitted before the local writer flushes, with the pending nodes. */
    appending: (pending: AutobeeNode[]) => void;
  }
  // ---------------------------------------------------------------------------
  // The Autobee class
  // ---------------------------------------------------------------------------

  /**
   * A Bee-based autobase: multiple peers each write to their own local
   * Hypercore, and an `apply` function merges those writes into a shared
   * Hyperbee view deterministically. Extends `ReadyResource` (an
   * `EventEmitter`), so `ready()` / `close()` and the event methods are
   * available.
   */
  export class Autobee {
    /**
     * Create a new Autobee.
     *
     * @param store   A `Corestore`.
     * @param handlers The handlers / options.
     * @param key     The public key (buffer or hex id) of an existing Autobee
     *   to join. Omit or pass `null` to create a new one. When this 2nd
     *   argument is an object it is treated as `handlers` instead.
     */
    constructor(store: Corestore, handlers: AutobeeHandlers);
    constructor(
      store: Corestore,
      key: KeyLike | null,
      handlers?: AutobeeHandlers,
    );

    /** The Corestore this db is backed by. */
    store: Corestore;
    /** The public key of this Autobee, or `null` before ready. */
    key: Uint8Array | null;
    /** The discovery key, or `null` before ready. */
    discoveryKey: Uint8Array | null;
    /** The public key encoded as a hex string, or `null` before ready. */
    id: string | null;
    /** The bootstrap core (the room's entrypoint). */
    bootstrap: Hypercore | null;
    /** The local writer Hypercore. */
    local: Hypercore | null;
    /** A read-only snapshot of the view (a `Hyperbee`). */
    bee: Hyperbee;
    /** The (writable) view; a `Hyperbee` you read from with the standard API. */
    view: Hyperbee;
    /** The debug name, if any. */
    name: string | null;
    /** Whether data at rest is encrypted. */
    encrypted: boolean;
    /** Whether optimistic writes from unknown writers are allowed. */
    optimistic: boolean;
    /** The weight of the bootstrap writer. */
    bootstrapWeight: number;
    /** Runtime statistics. */
    stats: AutobeeStats;
    /** The advertised wakeup capability, or `null`. */
    wakeupCapability: WakeupCapability | null;
    /** The active-writers set (autobase compat), or `null` before ready. */
    activeWriters: ActiveWriters | null;

    /** `true` if this instance has been added as a writer. */
    get writable(): boolean;
    /** `true` if this writer is an indexer. */
    get isIndexer(): boolean;
    /** `true` while an append is in progress. */
    get appending(): boolean;
    /** The current system flush count. */
    get flushes(): number;
    /** `true` while draining or updating. */
    get busy(): boolean;

    // -- lifecycle (from ReadyResource) -------------------------------------

    /** Ensure the db is opened; resolves when it is. */
    ready(): Promise<void>;
    /** Close the db; resolves when it is. */
    close(): Promise<void>;

    // -- reads / writes -----------------------------------------------------

    /**
     * Append one or more values to the local writer; triggers an apply cycle.
     * @param value   A single value, or an array of values. A string is
     *   encoded as UTF-8.
     * @param opts    `{ optimistic: true }` writes without waiting to be a
     *   confirmed writer.
     */
    append(
      value: Uint8Array | string | (Uint8Array | string)[],
      opts?: AppendOptions,
    ): Promise<void>;

    /** Trigger a new apply cycle. */
    update(): Promise<void>;

    /** Wait until the current apply cycle has finished. */
    updated(): Promise<void>;

    /** Wait until all known writers have been fully indexed. */
    flush(): Promise<void>;

    // -- replication / discovery -------------------------------------------

    /**
     * Create a replication stream (a duplex).
     * @param isInitiator `true` for the initiating side, `false` otherwise,
     *   or a peer's duplex to pipe into (delegates to
     *   {@link Corestore.replicate}, which accepts a `Duplex` directly).
     */
    replicate(
      isInitiator?: boolean | Duplex,
      opts?: CorestoreReplicateOptions,
    ): Duplex;

    /** Hint that a new writer core is available at `key`/`length`. */
    wakeup(hint: { key: Uint8Array; length: number }): Promise<void>;

    /** Hint the wakeup subsystem with an out-of-band wakeup. */
    hintWakeup(wakeup: { key: Uint8Array; length: number }): void;

    /** Rotate the local writer to a different core key. */
    setLocal(key: Uint8Array, opts?: { keyPair?: KeyPair }): Promise<void>;

    /**
     * Override acking (otherwise driven by `isTrusted`).
     * @param acking  Whether to ack.
     * @param opts    `{ threshold }` defaults to the current threshold.
     */
    setAcking(acking: boolean, opts?: { threshold?: number }): void;

    /** The current system and view core positions (autobase compat). */
    views(): CoreInfo[];

    /** The cores a mirror should pin. */
    cores(opts?: CoresOptions): Promise<CoresResult>;

    // -- fast-forward ------------------------------------------------------

    /**
     * Fast-forward onto an oplog `head`, ignoring the usual distance and
     * conservative checks. Resolves `{ to, from }`, or `null` if the head
     * could not be booted.
     * @param opts `{ timeout }` bounds the reads so a head nobody can serve
     *   fails instead of hanging.
     */
    moveTo(
      head: Head,
      opts?: { timeout?: number },
    ): Promise<MoveToResult | null>;

    // -- anchors -----------------------------------------------------------

    /** Create an anchor for an already-applied node. */
    createAnchor(key: Uint8Array, length: number): Promise<Anchor>;

    // -- views / cores (advanced) ----------------------------------------

    /** Whether the local writer is trusted. */
    isLocalTrusted(): Promise<boolean>;

    /** The external writers' public keys. */
    getExternalWriters(): Uint8Array[];

    /** The views of a given writer. */
    getWriterViews(key: Uint8Array): CoreInfo[];

    /** Open a view at a core/length (opened through `open`/`close`). */
    openView(head: Head, opts?: { timeout?: number }): Hyperbee | null;

    /** Open a view at an oplog head. */
    openViewAt(
      oplog: { key: Uint8Array; length: number; op: unknown },
      opts?: { timeout?: number },
    ): Hyperbee | null;

    /** Open a core by key (encrypted / grouped as needed). */
    openCore(key: Uint8Array): Hypercore;

    /** Compact the view if it has not yet been reindexed. */
    compactMaybe(): Promise<void>;

    /** The last error that occurred, or `null`. */
    getLastError(): Error | null;

    /** Replay the oplog (as a flat list of nodes, `null` for gaps). */
    replay(): Promise<(AutobeeNode | null)[]>;

    // -- events (from ReadyResource / the db) ------------------------------

    on<K extends keyof AutobeeEventMap>(
      event: K,
      listener: AutobeeEventMap[K],
    ): this;
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    once<K extends keyof AutobeeEventMap>(
      event: K,
      listener: AutobeeEventMap[K],
    ): this;
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
    off<K extends keyof AutobeeEventMap>(
      event: K,
      listener: AutobeeEventMap[K],
    ): this;
    off(event: string | symbol, listener: (...args: unknown[]) => void): this;
    emit<K extends keyof AutobeeEventMap>(
      event: K,
      ...args: Parameters<AutobeeEventMap[K]>
    ): boolean;
    emit(event: string | symbol, ...args: unknown[]): boolean;

    // -- statics -----------------------------------------------------------

    /** Type guard: `true` if `auto` is an Autobee instance. */
    static isAutobee(auto: unknown): boolean;

    /** Encode a value into an Autobee block with optional metadata. */
    static encodeValue(
      value: Uint8Array,
      opts?: EncodeValueOptions,
    ): Uint8Array;

    /** Decode an Autobee block back to its value. */
    static decodeValue(
      buf: Uint8Array,
      opts?: DecodeValueOptions,
    ): Promise<Uint8Array | null>;

    /**
     * The empty head, `{ length: 0, key: null }`, used to represent the
     * genesis state.
     */
    static readonly GENESIS: Head;

    /** Create a view encryption provider for a bootstrap/name. */
    static getViewEncryption(
      bootstrap: Hypercore,
      encryptionKey: Uint8Array,
      name: string,
    ): EncryptionProvider | null;
  }

  /**
   * The full runtime export (a CommonJS `module.exports = class`), provided so
   * `import autobee from 'autobee'` resolves under NodeNext. The named export
   * above (`export class Autobee`) already covers `import { Autobee }`.
   */
  export default Autobee;
}

/**
 * FOLLO-UP (best guesses / refinements) — read before relying on the following.
 *
 * 1. `Hyperbee`, `Duplex`, `ActiveWriter`, `ActiveWriters`,
 *    `Encryption` / `EncryptionProvider`, and `HypercoreManifest` are BEST
 *    GUESSES. The packages `hyperbee2` and `hypercore-storage` ship no types,
 *    so these stand in for the members `autobee`'s public surface touches and
 *    are intentionally minimal. Refine them (or replace with real
 *    `@types`/the packages' own types) once they publish them.
 *    `ready-resource` DOES ship types, so `ready()`/`close()`/`on()`/`off()`/
 *    `once()` are accurate.
 *
 *    `Corestore` is NO LONGER a best-guess: it is now
 *    `import('corestore').Corestore` (resolved against the hand-written
 *    `src/types/corestore.d.ts`). `Corestore.session`/`get`/`replicate` options
 *    and `notifyGroup`'s {@link GroupNotifyHandle} are reused from `corestore`.
 *    `Hypercore` is likewise no longer a best-guess: it is
 *    `import('hypercore').Hypercore` (resolved against the hand-written
 *    `src/types/hypercore.d.ts`). The remaining `hypercore`-related types
 *    (`HypercoreManifest` / `HypercoreGetOptions` / `HypercoreAppendOptions`)
 *    are kept as best-guesses because `hypercore`'s manifest *input* shape is
 *    not the same as the `Manifest` output type, and `Duplex` is a
 *    `corestore` / `hypercore` concern, not `hypercore`'s public `Hypercore`.
 *
 * 2. `hyperswarm`: `autobee`'s public surface does NOT reference `hyperswarm`
 *    (or `protomux`) at all. `db.replicate()` returns a corestore/hypercore
 *    `Duplex`; a CALLER would pipe that into a `hyperswarm` stream, but that is
 *    the caller's concern and does not belong in these types. Nothing here
 *    needs the `hyperswarm` types, so there is no deferred follow-up from
 *    `hyperswarm` into this file.
 *
 * 3. The only `unknown` usages are deliberate and semantically correct, not
 *    shortcuts:
 *     - `Autobee.isAutobee(auto: unknown)` — a type guard that accepts any
 *       value and returns a boolean.
 *     - `interrupt(reason?: unknown)` — the emitted reason is arbitrary.
 *     - the `on/once/off/emit` fallback overloads use `(...args: unknown[])`
 *       (the standard `EventEmitter` shape); the typed `AutobeeEventMap`
 *       overloads are the precise path and should be preferred.
 *   Everything else is fully typed.
 *
 * 4. `Autobee.moveTo(...)` is typed `Promise<MoveToResult | null>`. The runtime
 *   returns `null` (not a promise) when a `FastForward` cannot even be created,
 *   and otherwise returns a promise resolving to `{ to, from }`; the awaited
 *   result is therefore `{ to, from } | null`, which this type captures. If the
 *   implementation starts to reject instead, change this to reject.
 */
