/**
 * Type definitions for `hypercore` (v11.37.2).
 *
 * The package ships only `index.js` plus `lib/*.js` (CommonJS, using
 * `require` / `module.exports = Hypercore`) with no `types`/`typings` field, so
 * TypeScript reports TS7016 for it. This file provides an ambient module
 * declaration so the library can be used in a TypeScript project.
 *
 * Source of truth: `node_modules/hypercore/index.js` and `lib/*.js`. The types
 * below were derived from that source (the actual runtime surface), NOT guessed
 * from docs. The public `Hypercore` class is `module.exports = Hypercore`,
 * which `extends` Node's `events` `EventEmitter`; its internals live in a
 * non-exported `lib/core.js` `Core` + `lib/replicator.js` `Replicator`.
 *
 * NOTE on buffers: `hypercore`'s dependencies (`b4a`, `hypercore-crypto`)
 * expose their public types as plain `Uint8Array` (there is no exported
 * "secure buffer" type), so this file uses `Uint8Array` for every byte buffer.
 * This is accurate, not a shortcut.
 *
 * NOTE on `compact-encoding`: it ships types and is resolvable from the project
 * root, but its `Encoder` interface is NOT exported (only `raw`/`State`/the
 * concrete encoders are). So the value-encoding type below is modelled with a
 * local {@link Schema} that mirrors `compact-encoding`'s `Encoder`/`State`
 * shape exactly, rather than importing it.
 *
 * NOTE on `streamx`: the read/write/byte streams `extend` `streamx`
 * `Readable`/`Writable`. `streamx` IS typed, but it is a transitive dependency
 * (not resolvable from the project root — see `hyperdht.d.ts`), so the stream
 * surface below is hand-written (best-guess) rather than
 * `import('streamx')`.
 *
 * Dependency notes (why some types are marked FOLLO-UP at the bottom):
 *  - `KeyPair` is reused from `hypercore-crypto` (the `{ publicKey: 32B,
 *    secretKey: 64B }` shape `hypercore` uses to sign), via an inline
 *    `import()` type query.
 *  - `hypercore-storage`'s `CoreStorage` (the constructor `storage` arg) and the
 *    internal `lib/core.js` `Core` ship no types and `hypercore-storage` is a
 *    transitive dep (not resolvable from the project root), so {@link
 *    CoreStorage} / {@link Core} are best-guesses.
 *  - {@link Peer}, the replication {@link Request}/{@link Response} and the
 *    {@link Proof} are non-exported `lib/replicator.js` / `lib/merkle-tree.js`
 *    internals; only the observable surface is modelled.
 *  - The replication stream returned by {@link Hypercore.replicate} is a
 *    `@hyperswarm/secret-stream` `NoiseSecretStream` / its raw outer stream
 *    (`@hyperswarm/secret-stream` ships no types; `streamx` is transitive), so
 *    {@link Duplex} is a best-guess.
 */

declare module "hypercore" {
  // ---------------------------------------------------------------------------
  // Reusable / low-level value types
  // ---------------------------------------------------------------------------

  /**
   * A signing key pair (Ed25519), reused from `hypercore-crypto`.
   *
   * `hypercore` signs its blocks with an `hypercore-crypto` `keyPair()`
   * result, structurally `{ publicKey: 32B, secretKey: 64B }`. Declared as an
   * inline `import()` type query (not a top-level `import`) so this file stays
   * an ambient module declaration and keeps *declaring* `hypercore` rather than
   * augmenting a non-existent module.
   */
  type KeyPair = import("hypercore-crypto").KeyPair;

  /** A core public key: a 32-byte buffer. */
  export type Key = Uint8Array;

  /** A core public key, or its hex-encoded `id` string. */
  export type KeyLike = Uint8Array | string;

  /**
   * A compact-encoding `State`, mirroring `compact-encoding`'s `State`
   * interface. Used by {@link Schema}.
   */
  interface EncodingState {
    /** The start offset within the current `buffer`. */
    start: number;
    /** The end offset within the current `buffer`. */
    end: number;
    /** The buffer being encoded into / decoded from (may be `null`). */
    buffer: Uint8Array | null;
  }

  /**
   * A compact-encoding schema, mirroring `compact-encoding`'s `Encoder`
   * interface (which is not exported from the package, so it cannot be
   * `import()`-ed). This is what {@link ValueEncoding} accepts.
   *
   * @typeParam I The encoded input type (e.g. a string or a structured object).
   * @typeParam O The decoded output type (defaults to the input).
   *
   * @note FOLLO-UP: `I`/`O` default to `unknown` because a value encoding is
   *       genuinely polymorphic — the block payload can be anything the schema
   *       describes. This is the honest type, not a shortcut; refine if a
   *       concrete encoding is known at a call site (prefer the `valueEncoding`
   *       string overloads in {@link GetOptions}).
   */
  export interface Schema<I = unknown, O = I> {
    /** Pre-compute the encoded length. */
    preencode(state: EncodingState, val: I): void;
    /** Encode `val` into `state`. */
    encode(state: EncodingState, val: I): void;
    /** Decode a value from `state`. */
    decode(state: EncodingState): O;
  }

  /**
   * A block value encoding, passed via {@link HypercoreOptions.valueEncoding}
   * (and per-{@link GetOptions}/{@link AppendOptions}). Accepts either a
   * string name (`'binary'`, `'json'`, `'ndjson'`, `'utf-8'`, … — the names
   * `compact-encoding`'s `from()` resolves) or a custom {@link Schema}.
   */
  export type ValueEncoding = string | Schema;
  // ---------------------------------------------------------------------------
  // Event-emitter base (Hypercore extends Node's `events` `EventEmitter`)
  // ---------------------------------------------------------------------------

  /**
   * A generic event-emitter surface.
   *
   * `Hypercore` extends Node's `events` `EventEmitter` (or `bare-events` under
   * the bare runtime). This mirrors the strongly-typed emitter shape the other
   * definitions in this project use, so `.on` / `.emit` are type-safe against an
   * event map. Only the events a given type declares are typed; everything else
   * falls through to the index signature on {@link EventMap}.
   */
  interface EventMap {
    [event: string | symbol]: unknown[];
  }

  /**
   * A listener for an event whose payload type is `A`.
   *
   * @typeParam A The event's argument tuple (e.g. `[peer: Peer]`).
   */
  interface EventHandler<A extends unknown[] = unknown[], R = unknown> {
    (...args: A): R;
  }

  /**
   * The event-emitter base shared by {@link Hypercore}.
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
  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  /**
   * A read timeout in ms (0 = none). Shared by many read methods.
   */
  interface TimeoutOptions {
    /** A read timeout in ms (0 = none). */
    timeout?: number;
    /**
     * Whether to wait (replicate) for a block that is not local. Defaults to
     * the session's `wait` (which defaults to `true`).
     */
    wait?: boolean;
    /** Called with `(index, core)` when a block is awaited from a peer. */
    onwait?(index: number, core: Hypercore): void;
    /**
     * A batch of in-flight requests to share; if it has been destroyed, the
     * request is cancelled.
     */
    activeRequests?: ReplicationRequest[];
    /** Force the request even if it would normally be skipped. */
    force?: boolean;
  }

  /**
   * Options for {@link Hypercore.get} (and, where a block is read, the
   * read-streams).
   */
  export interface GetOptions extends TimeoutOptions {
    /** Decode the block with this value encoding (instead of the session's). */
    valueEncoding?: ValueEncoding;
    /** Return the raw (encrypted) block bytes instead of decrypting/decoding. */
    raw?: boolean;
    /** Skip decryption even if the session has an encryption provider. */
    decrypt?: boolean;
  }

  /**
   * Options for {@link Hypercore.append}.
   */
  export interface AppendOptions {
    /** The key pair to sign with (defaults to the session's `keyPair`). */
    keyPair?: KeyPair;
    /** A pre-computed signature (instead of signing with a key pair). */
    signature?: Uint8Array | null;
    /** Max block length to enforce (blocks larger throw). */
    maxLength?: number;
    /** Called after the append, with the encoded blocks, before they commit. */
    postappend?(blocks: Uint8Array[]): Promise<void> | void;
    /** Force a writable append even if the session is not otherwise writable. */
    writable?: boolean;
  }

  /**
   * Options for {@link Hypercore.truncate}.
   */
  export interface TruncateOptions {
    /** The fork to set (defaults to `fork + 1`). */
    fork?: number;
    /** The key pair to sign the truncate with (defaults to the session's). */
    keyPair?: KeyPair;
    /** A pre-computed signature (instead of signing with a key pair). */
    signature?: Uint8Array | null;
  }

  /**
   * A custom encryption provider (the object form of the `encryption` option).
   *
   * `hypercore` calls `padding`, `encrypt` and `decrypt` on it; see
   * {@link isEncryptionProvider} in `index.js` for the exact method set. The
   * `core` argument is the internal {@link Core} (best-guess, FOLLO-UP).
   */
  export interface EncryptionProvider {
    /** The (32-byte) encryption key. */
    key: Uint8Array;
    /** Padding (in bytes) this provider adds to each block. */
    padding(core: Core, index: number): number;
    /** Encrypt `block` in place at `index` (for `fork`). */
    encrypt(index: number, block: Uint8Array, fork: number, core: Core): void;
    /** Decrypt `block` in place at `index`. */
    decrypt(index: number, block: Uint8Array, core: Core): void;
  }

  /**
   * An encryption key + flags (the plain-object form of the `encryption`
   * option; a bare buffer is also accepted).
   */
  export interface EncryptionKeyInput {
    /** The (32-byte) encryption key. */
    key: Uint8Array;
    /** Use the key as a per-block key (instead of deriving one). */
    block?: boolean;
  }

  /**
   * The constructor options for {@link Hypercore}. Because the constructor is
   * `isOptions`-based at runtime, these fields may also be spread across the
   * positional `storage`/`key` arguments; see the constructor overloads.
   */
  export interface HypercoreOptions {
    /** A storage directory (path) or a `hypercore-storage` {@link CoreStorage}. */
    storage?: string | CoreStorage | null;
    /** An existing core key (buffer or hex id) to open, else a new core. */
    key?: KeyLike | null;
    /** A signing key pair for the core. */
    keyPair?: KeyPair;
    /** Whether the session is "weak" (does not keep the core alive). */
    weak?: boolean;
    /** Whether this is a read-only snapshot. */
    snapshot?: boolean;
    /** Called with `(index, core)` when a block is awaited from a peer. */
    onseq?(index: number, core: Hypercore): void;
    /** Called with `(index, core)` when a block is awaited from a peer. */
    onwait?(index: number, core: Hypercore): void;
    /** Whether to wait (replicate) for missing blocks. Default `true`. */
    wait?: boolean;
    /** A read timeout in ms (0 = none). */
    timeout?: number;
    /** Force the session read-only even with a key pair. */
    writable?: boolean;
    /** Whether the session should be active (replicating). Default `true`. */
    active?: boolean;
    /** The value encoding for blocks. */
    valueEncoding?: ValueEncoding;
    /** A custom block-batch encoder (returns the encoded blocks array). */
    encodeBatch?(blocks: unknown[]): Uint8Array[];
    /** An encryption key, provider, or `null` (no encryption). */
    encryption?: Uint8Array | EncryptionProvider | EncryptionKeyInput | null;
    /** (Legacy) an encryption key buffer. */
    encryptionKey?: Uint8Array;
    /** (Legacy) whether the encryption key is a per-block key. */
    isBlockKey?: boolean;
    /** A discovery group the core belongs to. */
    group?: Uint8Array | null;
    /** A discovery key (32 bytes) to open a core by. */
    discoveryKey?: Uint8Array;
    /** Overwrite existing cores if a key conflict is found. */
    overwrite?: boolean;
    /** A manifest to sign with (object or encoded buffer). */
    manifest?: ManifestInput | Uint8Array | null;
    /** Whether to use the compat (pre-multisig) header. */
    compat?: boolean;
    /** Force the header (overwrite an existing one). */
    force?: boolean;
    /** Treat the core as a legacy (pre-header) core. */
    legacy?: boolean;

    // --- Advanced / internal (no semver guarantees) ---
    /** Reuse an existing `Core` (internal). */
    core?: Core;
    /** Reuse a sessions array (internal). */
    sessions?: Hypercore[];
    /** Called when a session is garbage-collected (internal). */
    ongc?(core: Hypercore): void;
    /** A parent session this one is derived from. */
    parent?: Hypercore;
    /** A preload promise whose result is merged into the options. */
    preload?: Promise<Partial<HypercoreOptions>> | null;
    /** Whether to pre-open the core. */
    preopen?: boolean;
    /** Upgrade eagerly (default `true`). */
    eagerUpgrade?: boolean;
    /** How long a not-downloading request lingers. */
    notDownloadingLinger?: number;
    /** Allow forking (default `true`). */
    allowFork?: boolean;
    /** Allow pushing (default `false`). */
    allowPush?: boolean;
    /** Push-only replication (default `false`). */
    pushOnly?: boolean;
    /** Always request the latest block (default `false`). */
    allowLatestBlock?: boolean;
    /** The inflight range `[min, max]` for replication. */
    inflightRange?: [number, number];
    /** A global cache (advanced). */
    globalCache?: unknown | null;
  }
  /**
   * Options for {@link Hypercore.session} (and {@link Hypercore.snapshot}). A
   * superset of {@link HypercoreOptions}'s most common fields plus session-only
   * ones.
   */
  export interface SessionOptions {
    /** A name for a named session. */
    name?: string;
    /** An atom id for an atomized session. */
    atom?: string | number;
    /** A checkout length to pin the session to (requires `name`/`atom`). */
    checkout?: number;
    /** Overwrite an existing named session. */
    overwrite?: boolean;
    /** Whether the session is writable (default: the parent's writability). */
    writable?: boolean;
    /** Whether the session is a read-only snapshot. */
    snapshot?: boolean;
    /** Whether the session is "weak" (does not keep the core alive). */
    weak?: boolean;
    /** Whether the session is active (replicating). */
    active?: boolean;
    /** Whether to wait for missing blocks. */
    wait?: boolean;
    /** A read timeout in ms. */
    timeout?: number;
    /** Called when a block is awaited from a peer. */
    onwait?(index: number, core: Hypercore): void;
    /** Called when a block sequence is awaited. */
    onseq?(index: number, core: Hypercore): void;
    /** The value encoding for this session. */
    valueEncoding?: ValueEncoding;
    /** A custom block-batch encoder. */
    encodeBatch?(blocks: unknown[]): Uint8Array[];
    /** Push-only replication for this session. */
    pushOnly?: boolean;
    /** Hold the exclusive write lock. */
    exclusive?: boolean;
    /** A discovery group the session belongs to. */
    group?: Uint8Array | null;
    /** A manifest to set on the core. */
    manifest?: ManifestInput | Uint8Array | null;
    /** A signing key pair for this session. */
    keyPair?: KeyPair;
    /** An encryption key / provider for this session. */
    encryption?: Uint8Array | EncryptionProvider | EncryptionKeyInput | null;
    /** User data (name → value) to set on the session's core. */
    userData?: Record<string, Uint8Array>;
    /** A custom session class to instantiate. */
    class?: typeof Hypercore;
    /** A parent session this one is derived from. */
    parent?: Hypercore;
  }

  // ---------------------------------------------------------------------------
  // Manifests (from `lib/verifier.js`)
  // ---------------------------------------------------------------------------

  /** A single manifest signer. */
  export interface ManifestSigner {
    /** Always `'ed25519'` (the only supported signature). */
    signature: "ed25519";
    /** The signer's namespace (32 bytes). */
    namespace: Uint8Array;
    /** The signer's 32-byte public key. */
    publicKey: Uint8Array;
  }

  /** A manifest signer as accepted as input (fields optional, defaulted). */
  export interface ManifestSignerInput {
    /** Always `'ed25519'` (the only supported signature). */
    signature?: "ed25519";
    /** The signer's namespace (32 bytes; defaults to `hypercore`'s). */
    namespace?: Uint8Array;
    /** The signer's 32-byte public key (required). */
    publicKey: Uint8Array;
  }

  /** The prologue (an initial unsigned prefix) of a manifest. */
  export interface Prologue {
    /** A 32-byte prologue hash. */
    hash: Uint8Array;
    /** The prologue length (block count). */
    length: number;
  }

  /**
   * A signed core manifest (the normalized form returned by {@link
   * Hypercore.getManifest} / stored on the core header).
   */
  export interface Manifest {
    /** The manifest version (0 = compat, 1 = current, 2 = with `linked`/`userData`). */
    version: number;
    /** The hash algorithm (only `'blake2b'` is supported). */
    hash: "blake2b";
    /** Whether patches (fast-forward of an untrusted writer) are allowed. */
    allowPatch: boolean;
    /** The quorum: number of signatures required (0 = none, 1 = single). */
    quorum: number;
    /** The manifest signers. */
    signers: ManifestSigner[];
    /** The prologue (an unsigned prefix), or `null`. */
    prologue: Prologue | null;
    /** Linked cores (version 2+), or `null`. */
    linked: Uint8Array[] | null;
    /** Opaque manifest user data (version 2+), or `null`. */
    userData: Uint8Array | null;
  }

  /**
   * A manifest as accepted as input (to {@link HypercoreOptions.manifest} /
   * {@link Hypercore.setManifest} / the static `key()`/`parseManifest()`).
   */
  export interface ManifestInput {
    /** The manifest version. */
    version?: number;
    /** The hash algorithm (only `'blake2b'`). */
    hash?: "blake2b";
    /** Whether patches are allowed. */
    allowPatch?: boolean;
    /** The quorum. */
    quorum?: number;
    /** The signers. */
    signers?: ManifestSignerInput[];
    /** The prologue, or `null`. */
    prologue?: Prologue | null;
    /** Linked cores. */
    linked?: Uint8Array[] | null;
    /** Opaque user data (version 2+). */
    userData?: Uint8Array | null;
  }

  /**
   * Options for {@link Hypercore.getManifest}.
   */
  export interface GetManifestOptions {
    /** Return the raw (encoded) manifest buffer instead of the object. */
    raw?: boolean;
  }

  // ---------------------------------------------------------------------------
  // Encryption (from `lib/default-encryption.js`)
  // ---------------------------------------------------------------------------

  /**
   * The default encryption provider (from `lib/default-encryption.js`). Created
   * internally by `hypercore` from an `encryptionKey`/`EncryptionKeyInput`;
   * exposed as `Hypercore.DefaultEncryption`.
   */
  export class DefaultEncryption implements EncryptionProvider {
    /** The default padding (in bytes) added to each block. */
    static readonly PADDING: number;
    /** The encryption key. */
    key: Uint8Array;
    /** Whether this is a compat (legacy) provider. */
    compat: boolean;

    /**
     * @param encryptionKey The 32-byte encryption key.
     * @param hypercoreKey The 32-byte core key.
     * @param opts `{ block, compat }`.
     */
    constructor(
      encryptionKey: Uint8Array,
      hypercoreKey: Uint8Array,
      opts?: { block?: boolean; compat?: boolean },
    );

    /** Derive the block + blinding keys for the given keys. */
    static deriveKeys(
      encryptionKey: Uint8Array,
      hypercoreKey: Uint8Array,
      opts?: { block?: boolean; compat?: boolean },
    ): { block: Uint8Array; blinding: Uint8Array };

    /** Derive a per-block encryption key from the core + encryption keys. */
    static blockEncryptionKey(
      hypercoreKey: Uint8Array,
      encryptionKey: Uint8Array,
    ): Uint8Array;

    /** Encrypt `block` in place at `index` (for `fork`). */
    encrypt(index: number, block: Uint8Array, fork: number, core: Core): void;
    /** Decrypt `block` in place at `index`. */
    decrypt(index: number, block: Uint8Array, core: Core): void;
    /** The padding (in bytes) this provider adds. */
    padding(): number;
  }
  // ---------------------------------------------------------------------------
  // Info (from `lib/info.js`)
  // ---------------------------------------------------------------------------

  /**
   * Storage usage (in bytes) for a core's backing files, as reported by
   * {@link Info.storage}.
   */
  export interface StorageUsage {
    /** Bytes used by the oplog. */
    oplog: number;
    /** Bytes used by the merkle tree. */
    tree: number;
    /** Bytes used by the blocks. */
    blocks: number;
    /** Bytes used by the bitfield. */
    bitfield: number;
  }

  /**
   * A core's info, as returned by {@link Hypercore.info}.
   */
  export interface Info {
    /** The 32-byte public key, or `null` before ready. */
    key: Key | null;
    /** The 32-byte discovery key, or `null` before ready. */
    discoveryKey: Uint8Array | null;
    /** The current length (block count). */
    length: number;
    /** The contiguous (locally-verified) length. */
    contiguousLength: number;
    /** The total byte length (excludes padding). */
    byteLength: number;
    /** The current fork. */
    fork: number;
    /** The per-block padding (in bytes), or 0 if unencrypted. */
    padding: number;
    /** Storage usage, if `{ storage: true }` was passed (else `null`). */
    storage: StorageUsage | null;
  }

  /**
   * Options for {@link Hypercore.info}.
   */
  export interface InfoOptions {
    /** Include the storage usage (adds an async disk stat). */
    storage?: boolean;
  }

  // ---------------------------------------------------------------------------
  // Replication peer + request/response (best-guess of `lib/replicator.js`)
  // ---------------------------------------------------------------------------

  /**
   * A replication peer.
   *
   * FOLLO-UP: this is `hypercore`'s internal `lib/replicator.js` `Peer` (not
   * exported). Only the observable surface is modelled; the internal
   * implementation has more (private) state, which is omitted. The fields a
   * consumer reads are those surfaced by the `inspect` output and the
   * `peer-add`/`peer-remove` events.
   */
  export interface Peer {
    /** The remote peer's 32-byte public key (once the handshake completes). */
    remotePublicKey: Uint8Array | null;
    /** The remote peer's known length. */
    remoteLength: number;
    /** The remote peer's known fork. */
    remoteFork: number;
    /** Whether the remote peer can upgrade us. */
    remoteCanUpgrade: boolean;
    /** The remote peer's contiguous (verified) length. */
    remoteContiguousLength: number;
    /** Whether the remote peer is uploading to us. */
    remoteUploading: boolean;
    /** Whether the remote peer is downloading from us. */
    remoteDownloading: boolean;
    /** Whether the remote peer's bitfield has been synced. */
    remoteSynced: boolean;
    /** Whether the remote peer has sent a manifest. */
    remoteHasManifest: boolean;
    /** Whether the remote peer allows pushes. */
    remoteAllowPush: boolean;
    /** Whether this peer is paused. */
    paused: boolean;
    /** Whether this peer has been removed. */
    removed: boolean;
    /** Per-peer wire statistics. */
    readonly stats: PeerStats;
  }

  /** Per-peer wire statistics (a subset of the internal `Peer.stats`). */
  export interface PeerStats {
    /** Counters for the various wire message channels. */
    wireSync: WireStat;
    wireRequest: WireStat;
    wireCancel: WireStat;
    wireData: WireStat;
    wireWant: WireStat;
    wireUnwant: WireStat;
    wireBitfield: WireStat;
    wireRange: WireStat;
    wireExtension: WireStat;
    /** Number of hotswaps. */
    hotswaps: number;
    /** Number of invalid-data events. */
    invalidData: number;
    /** Number of invalid-request events. */
    invalidRequests: number;
    /** Number of backoffs. */
    backoffs: number;
    /** Number of "not available" backoffs. */
    notAvailableBackoffs: number;
  }

  /** A single wire-stat channel's counters. */
  export interface WireStat {
    /** Bytes transmitted. */
    tx: number;
    /** Bytes received. */
    rx: number;
  }

  /**
   * A replication request (a block/range/upgrade/seek/… request).
   *
   * FOLLO-UP: this is `hypercore`'s internal `lib/replicator.js` request
   * (a `BaseRequest`/`Attachable` subclass, not exported). Best-guess of the
   * observable fields, used as the `req`/`res` args of the `download` /
   * `upload` / `verification-error` / `invalid-request` events.
   */
  export interface ReplicationRequest {
    /** The block index (for a block request), or `-1`. */
    index: number;
    /** A promise that resolves with the response (or the awaited value). */
    promise: Promise<Uint8Array | null | boolean>;
    /** Whether the request was snapshot-scoped. */
    snapshot: boolean;
    /** The context (peer/replicator) this request is attached to. */
    context: unknown;
  }

  /**
   * A replication response (passed to the `verification-error` event).
   *
   * FOLLO-UP: internal `lib/replicator.js`/`lib/messages.js` response object;
   * best-guess.
   */
  export interface ReplicationResponse {
    /** The response command id. */
    command: number;
    /** The response data, if any. */
    data: Uint8Array | null;
  }

  /**
   * A merkle-tree proof (passed to the `conflict` / `repaired` / `repairing`
   * events, and returned by {@link Hypercore.proof}).
   *
   * FOLLO-UP: this is `lib/merkle-tree.js`'s `Proof` (not exported). Best-guess
   * of the observable fields. The `upgrade`/`nodes` internals are omitted.
   */
  export interface Proof {
    /** The block this proof covers (value + block bytes), or `null`. */
    block: { index: number; value: Uint8Array | null } | null;
    /** The block hash this proof covers, or `null`. */
    hash: Uint8Array | null;
    /** The seek target this proof covers, or `null`. */
    seek: { bytes: number } | null;
    /** The upgrade this proof covers (start/length/fork). */
    upgrade: { start: number; length: number; fork: number };
    /** The manifest this proof was verified against, or `null`. */
    manifest: Manifest | null;
    /** Settle the proof (resolve the awaited block bytes, if any). */
    settle(): Promise<SettledProof>;
  }

  /** A settled {@link Proof}. */
  export interface SettledProof {
    /** The block, if the proof included one. */
    block: { index: number; value: Uint8Array | null } | null;
    /** The block hash, if the proof included one. */
    hash: Uint8Array | null;
    /** The upgrade this proof covers. */
    upgrade: { start: number; length: number; fork: number };
  }

  // ---------------------------------------------------------------------------
  // Storage + internal Core (best-guess of `hypercore-storage` / `lib/core.js`)
  // ---------------------------------------------------------------------------

  /**
   * A core storage backend (from `hypercore-storage`).
   *
   * FOLLO-UP: `hypercore-storage` ships no types and is a transitive
   * dependency (not resolvable from the project root), so this is a best-guess
   * of the surface `hypercore` touches. `Hypercore.defaultStorage` accepts
   * either a directory string or a `CoreStorage`; when a directory string is
   * passed, `hypercore` wraps it in a `CoreStorage`. Replace with the real
   * type if/when `hypercore-storage` publishes one.
   */
  export interface CoreStorage {
    /** Ensure the storage is open. */
    ready(): Promise<void>;
    /** Close the storage. */
    close(): Promise<void>;
    /** Whether the storage is opened. */
    opened: boolean;
    /** Whether the storage auto-closes. */
    autoClose: boolean;
    /** A read transaction over the storage. */
    read(): unknown;
    /** A write transaction over the storage. */
    write(): unknown;
    /** Stat the backing files (best-guess). */
    stat?(cb: (err: Error | null, st: { blocks: number }) => void): void;
  }

  /**
   * The internal `lib/core.js` `Core` a {@link Hypercore} session is backed by
   * (a single core can host many sessions).
   *
   * FOLLO-UP: `Core` is a non-exported internal of `hypercore`; best-guess of
   * the surface a few statics (`createCore`) and the encryption provider touch.
   * Only the fields those paths read are modelled.
   */
  export interface Core {
    /** The 32-byte public key. */
    key: Key | null;
    /** Whether this is a compat (legacy) core. */
    compat: boolean;
    /** Whether the core is opened. */
    opened: boolean;
    /** Whether the core auto-closes when its last session closes. */
    autoClose: boolean;
    /** Ensure the core is ready. */
    ready(): Promise<void>;
    /** Close the core. */
    close(): Promise<void>;
  }
  // ---------------------------------------------------------------------------
  // Streams (from `lib/streams.js`) — best-guess of `streamx` `Readable`/`Writable`
  // ---------------------------------------------------------------------------

  /**
   * A read/byte stream base, mirroring `streamx`'s `Readable`.
   *
   * FOLLO-UP: `streamx` IS typed but is a transitive dependency (not resolvable
   * from the project root — see `hyperdht.d.ts`), so the stream surface below
   * is hand-written from the `lib/streams.js` source rather than
   * `import('streamx').Readable`. Replace with the real `streamx` types if/when
   * `streamx` becomes resolvable from the project root.
   */
  interface ReadableStream<M extends EventMap = EventMap> extends Emitter<M> {
    /** Whether the readable side is active. */
    readonly readable: boolean;
    /** Whether the stream has been destroyed. */
    readonly destroyed: boolean;
    /** Push a chunk (or `null` to signal end) into the readable. */
    push(chunk: Uint8Array | null): boolean;
    /** Resume reading. */
    resume(): this;
    /** Pause reading. */
    pause(): this;
    /** Pipe this stream (as a source) into `dest`. */
    pipe(dest: ReadableStream): this;
    /** Async-iterate the pushed chunks. */
    [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
  }

  /**
   * A writable stream base, mirroring `streamx`'s `Writable`.
   */
  interface WritableStream<M extends EventMap = EventMap> extends Emitter<M> {
    /** Whether the writable side is active. */
    readonly writable: boolean;
    /** Whether the stream has been destroyed. */
    readonly destroyed: boolean;
    /** Write a chunk (or array of chunks). */
    write(chunk: Uint8Array | Uint8Array[]): boolean;
    /** End the writable side. */
    end(chunk?: Uint8Array | Uint8Array[]): this;
    /** Pipe this stream into a destination (as a source, if readable). */
    pipe(dest: ReadableStream): this;
  }

  /**
   * A read stream over a core (from `lib/streams.js` `ReadStream`).
   * Iterating (or piped) yields the decoded blocks of a range.
   *
   * @typeParam V The decoded value type (from the core's value encoding).
   */
  export interface ReadStream<V = Uint8Array> extends ReadableStream {
    /** The core this stream reads from. */
    core: Hypercore;
    /** The start index (inclusive). */
    start: number;
    /** The end index (exclusive), or `-1` for open-ended. */
    end: number;
    /** Whether this is a snapshot (frozen at the current length). */
    snapshot: boolean;
    /** Whether this is a live (grows with the core) read. */
    live: boolean;
    /** Whether to wait for missing blocks. */
    wait: boolean;
    /** A read timeout in ms. */
    timeout: number;
  }

  /** Options for {@link ReadStream}. */
  export interface ReadStreamOptions {
    /** The start index (inclusive). Default `0`. */
    start?: number;
    /** The end index (exclusive); omit / `-1` for open-ended. */
    end?: number;
    /** A live read that grows as the core appends. */
    live?: boolean;
    /** A snapshot read (frozen at the current length). */
    snapshot?: boolean;
    /** Whether to wait for missing blocks. */
    wait?: boolean;
    /** A read timeout in ms. */
    timeout?: number;
  }

  /**
   * A write stream to a core (from `lib/streams.js` `WriteStream`). Piping
   * data into it appends blocks to the core.
   */
  export interface WriteStream extends WritableStream {
    /** The core this stream appends to. */
    core: Hypercore;
  }

  /**
   * A byte stream over a core (from `lib/streams.js` `ByteStream`). Yields the
   * raw bytes of a byte range (spanning block boundaries).
   */
  export interface ByteStream extends ReadableStream {
    /** The byte offset to start at. */
    byteOffset: number;
    /** The byte length to read, or `-1` for open-ended. */
    byteLength: number;
    /** How many blocks ahead to prefetch. */
    prefetch: number;
  }

  /** Options for {@link ByteStream}. */
  export interface ByteStreamOptions {
    /** The byte offset to start at. Default `0`. */
    byteOffset?: number;
    /** The byte length to read; omit / `-1` for open-ended. */
    byteLength?: number;
    /** How many blocks ahead to prefetch. Default `32`. */
    prefetch?: number;
  }

  // ---------------------------------------------------------------------------
  // Download (from `lib/download.js`)
  // ---------------------------------------------------------------------------

  /**
   * A range to download (from {@link Hypercore.download}).
   */
  export interface DownloadRange {
    /** The start index (inclusive). */
    start?: number;
    /** The end index (exclusive). */
    end?: number;
    /** A linear (sequential) download (avoids randomization). */
    linear?: boolean;
    /** A batch of in-flight requests to share. */
    activeRequests?: ReplicationRequest[];
  }

  /**
   * A download of a range of blocks (from `lib/download.js` `Download`).
   */
  export class Download {
    /** The session this download belongs to. */
    session: Hypercore;
    /** The range this download covers. */
    range: DownloadRange;
    /** Whether this download is open. */
    opened: boolean;
    /** A promise for the download to open. */
    opening: Promise<void>;

    /**
     * @param session The core to download from.
     * @param range The range to download.
     */
    constructor(session: Hypercore, range: DownloadRange);

    /** Wait for the download to open. */
    ready(): Promise<void>;
    /** Wait for the download to complete. */
    done(): Promise<void>;
    /** (Deprecated) alias for {@link Download.done}. */
    downloaded(): Promise<void>;
    /** Destroy the download (stop requesting the range). */
    destroy(): void;
  }

  // ---------------------------------------------------------------------------
  // Replication stream (best-guess of `@hyperswarm/secret-stream` / `streamx`)
  // ---------------------------------------------------------------------------

  /**
   * A replication duplex stream, as returned by {@link Hypercore.replicate}.
   *
   * FOLLO-UP: at runtime this is the outer stream wrapping a
   * `@hyperswarm/secret-stream` `NoiseSecretStream` (a `streamx` `Duplex`
   * subclass); both `@hyperswarm/secret-stream` (untyped) and `streamx`
   * (typed but transitive/unresolvable) are not usable from the project root,
   * so this is a best-guess of the pipe/teardown surface a caller uses. It is
   * the thing a caller `pipe`s between peers. Replace with the real
   * `@hyperswarm/secret-stream` / `import('hyperdht').Connection` type if/when
   * resolvable.
   */
  export interface Duplex extends Emitter<EventMap> {
    /** Whether the readable side is active. */
    readonly readable: boolean;
    /** Whether the writable side is active. */
    readonly writable: boolean;
    /** Whether the stream has been destroyed. */
    readonly destroyed: boolean;
    /** The noise/secret stream this duplex is built on, if any. */
    noiseStream: unknown;
    /** Pipe this stream into `dest`. */
    pipe(dest: Duplex, cb?: (err: Error | null) => void): this;
    /** Write data into the stream. */
    write(data: Uint8Array): boolean;
    /** End the writable side. */
    end(): void;
    /** Destroy the stream (optionally with an error). */
    destroy(err?: Error | null): void;
  }
  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * The event map for a {@link Hypercore} session.
   *
   * `Hypercore` extends `EventEmitter`; these are the events it emits (from
   * `index.js`, `lib/core.js`, `lib/replicator.js` and `lib/session-state.js`).
   */
  export interface CoreEvents extends EventMap {
    /** Emitted once the core is opened/ready. */
    ready: [];
    /** Emitted once the core is closed. */
    close: [];
    /** Emitted when the core is moved/migrated to a different core, with the key. */
    migrate: [key: Uint8Array];
    /** Emitted when blocks are appended (by this or a remote writer). */
    append: [];
    /** Emitted when the core is truncated, with the new length and fork. */
    truncate: [to: number, fork: number];
    /** Emitted when a manifest is set on the core. */
    manifest: [];
    /** Emitted when the contiguous (verified) length changes. */
    "remote-contiguous-length": [length: number];
    /** Emitted when a (replication) peer is added. */
    "peer-add": [peer: Peer];
    /** Emitted when a (replication) peer is removed. */
    "peer-remove": [peer: Peer];
    /**
     * Emitted when a block is downloaded from a peer.
     * @param index The block index.
     * @param byteLength The (unpadded) byte length.
     * @param from The peer it came from.
     * @param req The request.
     */
    download: [
      index: number,
      byteLength: number,
      from: Peer,
      req: ReplicationRequest,
    ];
    /**
     * Emitted when a block is uploaded to a peer.
     * @param index The block index.
     * @param byteLength The (unpadded) byte length.
     * @param from The peer it was uploaded to.
     */
    upload: [index: number, byteLength: number, from: Peer];
    /**
     * Emitted when a block fails to verify.
     * @param err The error.
     * @param req The request.
     * @param res The response.
     * @param from The peer.
     */
    "verification-error": [
      err: Error,
      req: ReplicationRequest,
      res: ReplicationResponse,
      from: Peer,
    ];
    /**
     * Emitted when a request is invalid.
     * @param err The error.
     * @param req The request.
     * @param from The peer.
     */
    "invalid-request": [err: Error, req: ReplicationRequest, from: Peer];
    /** Emitted when the core conflicts (two signatures for a length), with a proof. */
    conflict: [length: number, fork: number, proof: Proof];
    /** Emitted when a repair is attempted, with the proof. */
    repairing: [proof: Proof];
    /** Emitted when a repair succeeds, with the proof. */
    repaired: [proof: Proof];
    /** Emitted when a repair fails. */
    "repair-failed": [];
  }
  // ---------------------------------------------------------------------------
  // The Hypercore class
  // ---------------------------------------------------------------------------

  /**
   * A Hypercore: a secure, distributed append-only log.
   *
   * Extends `EventEmitter` (so it emits {@link CoreEvents}). A single
   * {@link Hypercore} is a *session*; the underlying `Core` may host several
   * sessions (via {@link Hypercore.session}). Construct one with options
   * (`new Hypercore(opts)`, `new Hypercore(key, opts)`, or
   * `new Hypercore(storage, key, opts)` — the constructor is `isOptions`-based
   * at runtime), then `await core.ready()` before reading/writing.
   *
   * At runtime this `extends` Node's `events` `EventEmitter`; the {@link Emitter}
   * surface — merged in via a same-name {@link Hypercore} interface (see the
   * note after the class) — models that against the typed {@link CoreEvents} map.
   * (A class can't inherit an interface via `extends`/`implements` in this TS
   * setup, so the merge, not direct declaration, is how it gets the methods.)
   */
  export class Hypercore {
    // -- constructor ---------------------------------------------------------

    /**
     * Open or create a Hypercore session.
     *
     * @param opts Construction options (may include `storage`/`key`).
     */
    constructor(opts?: HypercoreOptions);
    /**
     * Open a Hypercore by an existing key.
     *
     * @param key The core key (buffer or hex id).
     * @param opts Construction options.
     */
    constructor(key: KeyLike, opts?: HypercoreOptions);
    /**
     * Open a Hypercore from a storage backend.
     *
     * @param storage A storage directory (path) or a {@link CoreStorage}.
     * @param opts Construction options.
     */
    constructor(storage: string | CoreStorage, opts?: HypercoreOptions);
    /**
     * Open a Hypercore from a storage backend and key.
     *
     * @param storage A storage directory (path) or a {@link CoreStorage}.
     * @param key The core key (buffer or hex id).
     * @param opts Construction options.
     */
    constructor(
      storage: string | CoreStorage,
      key: KeyLike,
      opts?: HypercoreOptions,
    );

    // -- state -------------------------------------------------------------

    /** The internal `Core` this session is backed by, or `null` before ready. */
    core: Core | null;
    /** The signing key pair, or `null`. */
    keyPair: KeyPair | null;
    /** Whether the readable side is active. */
    readable: boolean;
    /** Whether this session is writable. */
    writable: boolean;
    /** Whether this session holds the exclusive write lock. */
    exclusive: boolean;
    /** Whether the session is opened/ready. */
    opened: boolean;
    /** Whether the session is closed. */
    closed: boolean;
    /** Whether this is a "weak" session (does not keep the core alive). */
    weak: boolean;
    /** Whether this is a read-only snapshot. */
    snapshotted: boolean;
    /** Called with `(index, core)` when a block is awaited. */
    onseq: ((index: number, core: Hypercore) => void) | null;
    /** Called with `(index, core)` when a block is awaited. */
    onwait: ((index: number, core: Hypercore) => void) | null;
    /** Whether to wait (replicate) for missing blocks. */
    wait: boolean;
    /** A read timeout in ms (0 = none). */
    timeout: number;
    /** The value encoding for blocks, or `null`. */
    valueEncoding: Schema | null;
    /** A custom block-batch encoder, or `null`. */
    encodeBatch: ((blocks: unknown[]) => Uint8Array[]) | null;
    /** In-flight replication requests. */
    activeRequests: ReplicationRequest[];
    /** An encryption provider, or `null` (no encryption). */
    encryption: EncryptionProvider | null;
    /** A promise for the (first) open to complete. */
    opening: Promise<void>;
    /** A promise for the close to complete, or `null` while open. */
    closing: Promise<void> | null;

    // -- getters -----------------------------------------------------------

    /** The public key as a hex `id` string, or `null` before ready. */
    get id(): string | null;
    /** The 32-byte public key, or `null` before ready. */
    get key(): Key | null;
    /** The 32-byte discovery key, or `null` before ready. */
    get discoveryKey(): Uint8Array | null;
    /** The signed manifest, or `null` before it is known. */
    get manifest(): Manifest | null;
    /** The current length (block count), or 0 before ready. */
    get length(): number;
    /** The signed length. */
    get signedLength(): number;
    /**
     * The total byte length (excludes padding).
     * @deprecated Use `const { byteLength } = await core.info()`.
     */
    get byteLength(): number;
    /** The remote contiguous (verified) length. */
    get remoteContiguousLength(): number;
    /** The contiguous (verified) length. */
    get contiguousLength(): number;
    /** The contiguous byte length (always `0`; reserved). */
    get contiguousByteLength(): number;
    /** The current fork. */
    get fork(): number;
    /** The per-block padding (in bytes), or 0 if unencrypted. */
    get padding(): number;
    /** The current replication peers. */
    get peers(): Peer[];
    /** The global cache, or `null`. */
    get globalCache(): unknown | null;
    /** The recovery count. */
    get recovering(): number;
    /** The internal replicator, or `null`. */
    get replicator(): unknown;

    // -- statics ----------------------------------------------------------

    /** The maximum suggested block size (15 MiB). */
    static readonly MAX_SUGGESTED_BLOCK_SIZE: number;
    /** The default encryption provider class. */
    static readonly DefaultEncryption: typeof DefaultEncryption;
    /** The `SMALL_WANTS` feature flag. */
    static readonly SMALL_WANTS: number;
    /** Enable (or disable) a feature flag. */
    static enable(flag: number): void;
    /** Set the recovery peers (advanced). */
    static setRecoveryPeers(peers: unknown): void;
    /**
     * Derive the core key for a manifest (or buffer/compat key).
     * @param manifest A manifest, a 32-byte key, or an encoded manifest buffer.
     * @param opts `{ compat, version, namespace }`.
     */
    static key(
      manifest: ManifestInput | Uint8Array,
      opts?: { compat?: boolean; version?: number; namespace?: Uint8Array },
    ): Uint8Array;
    /** Parse (validate) a manifest, optionally checking it hashes to `key`. */
    static parseManifest(
      manifest: ManifestInput | Uint8Array,
      key?: Uint8Array,
    ): Manifest | null;
    /** Derive a discovery key from a core key. */
    static discoveryKey(key: Uint8Array): Uint8Array;
    /** Derive a block encryption key from a core + encryption key. */
    static blockEncryptionKey(
      key: Uint8Array,
      encryptionKey: Uint8Array,
    ): Uint8Array;
    /** Get the protocol muxer attached to a stream's noise stream. */
    static getProtocolMuxer(stream: unknown): unknown;
    /** Create an internal `Core` (advanced; returns the non-exported `Core`). */
    static createCore(
      storage: string | CoreStorage | null,
      opts?: HypercoreOptions,
    ): Core;
    /**
     * Create a protocol (replication) stream for a core.
     * @param isInitiator The initiating side (a stream, a protomux, or `true`).
     * @param opts `{ stream, keepAlive, ondiscoverykey }`.
     */
    static createProtocolStream(
      isInitiator: boolean | unknown,
      opts?: {
        stream?: unknown;
        keepAlive?: boolean;
        ondiscoverykey?: (id: Uint8Array) => unknown;
      },
    ): unknown;
    /** Wrap a storage backend (directory/`CoreStorage`) in a `CoreStorage`. */
    static defaultStorage(
      storage: string | CoreStorage,
      opts?: Record<string, unknown>,
    ): CoreStorage;
    /** Clear the in-flight requests of a session. */
    static clearRequests(session: Hypercore, err: Error | null): void;
    /** Destroy the in-flight requests of a session. */
    static destroyRequests(session: Hypercore, err: Error | null): void;
    /** Compute a tree hash from storage. */
    static treeHashFromStorage(
      session: Hypercore,
      length?: number,
    ): Promise<Uint8Array>;
    // -- sessions ---------------------------------------------------------

    /**
     * Open a new session over this core (shares the same `Core`/replicator).
     * @param opts Session options (see {@link SessionOptions}).
     */
    session(opts?: SessionOptions): Hypercore;
    /**
     * Open a read-only snapshot session.
     * @param opts Snapshot options (see {@link SessionOptions}).
     */
    snapshot(opts?: SessionOptions): Hypercore;
    /**
     * Set the encryption provider (an object implementing
     * {@link EncryptionProvider}), or `null` to disable encryption.
     * @param encryption The provider (or `null`).
     */
    setEncryption(encryption: EncryptionProvider | null): Promise<void>;
    /**
     * Set an encryption key (derives a {@link DefaultEncryption} provider).
     * @param key The (32-byte) encryption key.
     * @param opts `{ block }`.
     */
    setEncryptionKey(
      key: Uint8Array,
      opts?: { block?: boolean },
    ): Promise<void>;
    /**
     * Assign a discovery group (wakeup capability) to the core.
     * @param topic The 32-byte topic.
     */
    setGroup(topic: Uint8Array): Promise<void>;
    /** Set the signing key pair. */
    setKeyPair(keyPair: KeyPair): void;
    /** Attach/detach the session for replication. */
    setActive(bool: boolean): void;
    /** Enable/disable always-latest-block replication. */
    setAlwaysLatestBlock(bool: boolean): Promise<void>;
    /**
     * Compact the core (internal `Core.compact`).
     */
    compact(): Promise<void>;
    /**
     * Transfer this session to a different core (internal migration).
     * @param core The core to move to.
     */
    transferSession(core: Core): void;

    // -- reads / writes ---------------------------------------------------

    /**
     * Read a block at `index`.
     * @param index The block index.
     * @param opts `{ valueEncoding, raw, decrypt, wait, timeout, … }`.
     * @returns The block (decoded with the value encoding, or the raw
     *   `Uint8Array` by default), or `null` if not available / not present.
     */
    get(index: number, opts?: GetOptions): Promise<Uint8Array | null>;
    /**
     * Append one or more blocks.
     * @param blocks A single block, or an array of blocks (strings are encoded
     *   via the value encoding).
     * @param opts `{ keyPair, signature, maxLength, postappend, writable }`.
     */
    append(
      blocks: Uint8Array | string | (Uint8Array | string)[],
      opts?: AppendOptions,
    ): Promise<void>;
    /**
     * Truncate the core to `newLength`.
     * @param newLength The new length (default 0).
     * @param opts `{ fork, keyPair, signature }`, or a legacy `fork` number.
     */
    truncate(
      newLength?: number,
      opts?: TruncateOptions | number,
    ): Promise<void>;
    /**
     * Seek to a byte offset, returning the block index + byte offset within it.
     * @param bytes The byte offset to seek to.
     * @param opts `{ wait, timeout, … }`.
     * @returns `{ index, byteOffset }`, or `null` if not resolvable.
     */
    seek(bytes: number, opts?: TimeoutOptions): Promise<SeekResult | null>;
    /**
     * Wait for the core to upgrade (replicate new blocks) if a remote can.
     * @param opts `{ force, activeRequests }`.
     * @returns `true` if the core upgraded, `false` otherwise.
     */
    update(opts?: {
      force?: boolean;
      activeRequests?: ReplicationRequest[];
    }): Promise<boolean>;
    /**
     * Whether a range of blocks is (likely) available locally.
     * @param start The start index.
     * @param end The end index (exclusive, default `start + 1`).
     */
    has(start: number, end?: number): Promise<boolean>;
    /**
     * Clear (delete) a range of blocks.
     * @param start The start index.
     * @param end The end index (exclusive, default `start + 1`).
     * @param opts `{ diff }` (returns a `{ blocks }` diff when set).
     */
    clear(
      start: number,
      end?: number,
      opts?: { diff?: boolean },
    ): Promise<{ blocks: number } | null>;
    /** Purge the core entirely (close sessions and clear storage). */
    purge(): Promise<void>;

    // -- user data --------------------------------------------------------

    /**
     * Set (or clear, with `null`) named user data on the core.
     * @param key The user-data name.
     * @param value The value bytes, or `null` to clear.
     */
    setUserData(key: string, value: Uint8Array | null): Promise<void>;
    /**
     * Read named user data.
     * @param key The user-data name.
     * @returns The value bytes, or `null` if absent.
     */
    getUserData(key: string): Promise<Uint8Array | null>;

    // -- proofs / signatures -----------------------------------------------

    /**
     * Produce a signable message for `length`/`fork`.
     */
    signable(length?: number, fork?: number): Promise<Uint8Array>;
    /**
     * Compute the merkle-tree hash up to `length`.
     */
    treeHash(length?: number): Promise<Uint8Array>;
    /**
     * Produce a proof for a block/hash/seek/upgrade.
     * @param opts `{ block, hash, seek, upgrade }`.
     * @returns A {@link Proof} (call `.settle()` for the block bytes).
     */
    proof(opts: ProofOptions): Promise<Proof>;
    /**
     * Apply a proof (verify it and upgrade the local tree).
     * @param proof The proof to apply.
     * @param from The peer the proof came from (optional).
     */
    applyProof(proof: Proof, from?: Peer): Promise<unknown>;
    /**
     * Verify a fully-remote proof (upgrade the tree without a peer).
     * @param proof The proof.
     */
    verifyFullyRemote(proof: Proof): Promise<unknown>;
    /** Generate a remote proof for a tree node. */
    generateRemoteProofForTreeNode(treeNodeIndex: number): Proof;
    /** Recover tree nodes from a remote proof. */
    recoverFromRemoteProof(remoteProof: Proof): Promise<boolean>;
    /** Recover tree nodes from peers (repair mode). */
    recoverTreeNodeFromPeers(): void;

    // -- marks / gc -------------------------------------------------------

    /** Mark a range of blocks (for GC via {@link sweep}). */
    markBlock(start: number, end?: number): Promise<void>;
    /** Clear all markings. */
    clearMarkings(): Promise<void>;
    /** Start marking mode (throw if already gc'ing). */
    startMarking(): Promise<void>;
    /**
     * Sweep (gc) unmarked blocks.
     * @param opts `{ batchSize }`.
     */
    sweep(opts?: { batchSize?: number }): Promise<void>;

    // -- streams / download -----------------------------------------------

    /** Create a read stream over the core. */
    createReadStream<V = Uint8Array>(opts?: ReadStreamOptions): ReadStream<V>;
    /** Create a write stream to the core. */
    createWriteStream(): WriteStream;
    /** Create a byte stream over the core. */
    createByteStream(opts?: ByteStreamOptions): ByteStream;
    /**
     * Download a range of blocks.
     * @param range The range to download.
     */
    download(range: DownloadRange): Download;
    /** (Deprecated) stop downloading a range. */
    undownload(range: Download): void;
    /** (Deprecated) cancel a request (no-op). */
    cancel(request: ReplicationRequest): void;

    // -- extensions -------------------------------------------------------

    /**
     * Register an extension (a custom message channel) with the core.
     * @param name The extension name.
     * @param handlers `{ encoding, onmessage }`.
     * @returns The registered extension.
     */
    registerExtension(
      name: string,
      handlers?: {
        encoding?: ValueEncoding;
        onmessage?(msg: unknown, peer: Peer): void;
      },
    ): Extension;

    // -- replication ------------------------------------------------------

    /**
     * Create a replication stream (a duplex) for this core. Pipe it to a peer's
     * stream.
     * @param isInitiator `true` for the initiating side, `false` otherwise.
     * @param opts `{ stream, keepAlive, ondiscoverykey }`.
     * @returns A {@link Duplex} (the outer stream wrapping the secret stream).
     */
    replicate(
      isInitiator: boolean | unknown,
      opts?: {
        stream?: unknown;
        keepAlive?: boolean;
        ondiscoverykey?: (id: Uint8Array) => unknown;
      },
    ): Duplex;
    /**
     * A hint that a new (writer) core is available at `key`/`length`.
     */
    findingPeers(): () => void;

    // -- lifecycle --------------------------------------------------------

    /** A promise for the core to be ready. */
    ready(): Promise<void>;
    /**
     * Close the session (and the core, if the last session).
     * @param opts `{ error }` (an error to emit on close).
     */
    close(opts?: { error?: Error }): Promise<void>;
    /** Wait for recovery (repair mode). */
    recover(): Promise<unknown>;
    /**
     * Get core info.
     * @param opts `{ storage }`.
     */
    info(opts?: InfoOptions): Promise<Info>;
    /**
     * Commit a session's changes (internal).
     * @param session The session to commit.
     * @param opts `{ keyPair, … }`.
     */
    commit(session: Hypercore, opts?: { keyPair?: KeyPair }): Promise<unknown>;
    /**
     * Return the manifest (or its encoded form), or `null`.
     * @param opts `{ raw }`.
     * @returns The {@link Manifest}, the encoded buffer (if `raw`), or `null`.
     */
    getManifest(opts?: GetManifestOptions): Manifest | Uint8Array | null;
  }

  // A class can't inherit an interface via `extends`/`implements` in this TS
  // setup, so the `EventEmitter` base is merged in via a same-name interface
  // (declaration merge) — this is what gives {@link Hypercore} the
  // `on`/`once`/`off`/`emit`/… surface (and the rest of {@link Emitter}).
  export interface Hypercore extends Emitter<CoreEvents> {}

  /**
   * A seek result: the block index + byte offset within it.
   */
  export interface SeekResult {
    /** The block index the byte offset falls in. */
    index: number;
    /** The byte offset within that block. */
    byteOffset: number;
  }

  /** Options for {@link Hypercore.proof}. */
  export interface ProofOptions {
    /** The block to prove. */
    block?: { index: number };
    /** A block hash to prove. */
    hash?: Uint8Array;
    /** A seek to prove. */
    seek?: { bytes: number };
    /** An upgrade to prove (start/length). */
    upgrade?: { start: number; length: number };
  }

  /**
   * A registered extension (from {@link Hypercore.registerExtension}).
   *
   * FOLLO-UP: this is `hypercore`'s internal extension object (not exported);
   * best-guess of the observable surface a consumer uses.
   */
  export interface Extension {
    /** The extension name. */
    name: string;
    /** The extension handlers. */
    handlers: {
      encoding?: ValueEncoding;
      onmessage?(msg: unknown, peer: Peer): void;
    };
    /** The value encoding for the extension. */
    encoding: Schema;
    /** The session this extension belongs to. */
    session: Hypercore;
    /** Send a message to a specific peer. */
    send(message: unknown, peer: Peer): void;
    /** Broadcast a message to all peers. */
    broadcast(message: unknown): void;
    /** Destroy the extension (remove it from all peers). */
    destroy(): void;
  }

  /**
   * The full runtime export (`module.exports = Hypercore`), provided so
   * `import hypercore from 'hypercore'` resolves under NodeNext. The named
   * export above (`export class Hypercore`) already covers
   * `import { Hypercore }`.
   */
  export default Hypercore;
}
/**
 * FOLLO-UP (best-guess / not fully recoverable from the source):
 *
 * The types above are derived from `hypercore`'s actual source
 * (`index.js` + `lib/*.js`), not guessed from docs. The only genuinely
 * best-guess / non-exact parts are the ones whose leaf dependency ships no
 * types and is a transitive (non-root-resolvable) dependency, or which are
 * non-exported internals. Refine if/when the corresponding package adds types
 * or becomes resolvable from the project root:
 *
 *  1. {@link CoreStorage} is `hypercore-storage`'s `CoreStorage` (the
 *     constructor `storage` arg). `hypercore-storage` ships no types and is a
 *     transitive dependency (not resolvable from the project root). Best-guess
 *     of the surface `Hypercore.defaultStorage` / `Core` touch.
 *
 *  2. {@link Core} is `hypercore`'s internal `lib/core.js` `Core` (not
 *     exported). Best-guess of the surface a few statics
 *     (`createCore`/`treeHashFromStorage`) and the {@link EncryptionProvider}
 *     (`core` arg) touch. Only the fields those paths read are modelled.
 *
 *  3. {@link Peer}, {@link ReplicationRequest}, {@link ReplicationResponse}
 *     and {@link Proof} are non-exported `lib/replicator.js` /
 *     `lib/merkle-tree.js` internals. Only the observable surface (the fields
 *     surfaced by the `inspect` output and emitted on the `peer-add` /
 *     `peer-remove` / `download` / `upload` / `verification-error` /
 *     `invalid-request` / `conflict` / `repaired` / `repairing` events) is
 *     modelled; the internal implementation has more (private) state, which is
 *     omitted.
 *
 *  4. {@link Duplex} (the {@link Hypercore.replicate} return) is the outer
 *     stream wrapping a `@hyperswarm/secret-stream` `NoiseSecretStream`
 *     (a `streamx` `Duplex`). `@hyperswarm/secret-stream` ships no types and
 *     `streamx` is a transitive dep (not resolvable from the project root — see
 *     `hyperdht.d.ts`), so {@link Duplex} is a best-guess. Structurally it is
 *     close to `import('hyperdht').Connection`; replace with the real
 *     `@hyperswarm/secret-stream` / `streamx` types if/when resolvable.
 *
 *  5. The read/write/byte streams ({@link ReadStream}, {@link WriteStream},
 *     {@link ByteStream} and their {@link ReadableStream} /
 *     {@link WritableStream} bases) `extend` `streamx` `Readable`/`Writable`.
 *     `streamx` IS typed but is a transitive dependency (not resolvable from
 *     the project root), so the stream surface is hand-written rather than
 *     `import('streamx')`. Replace with the real `streamx` types if/when
 *     resolvable.
 *
 *  6. {@link Schema} / {@link ValueEncoding}: `valueEncoding` is passed to
 *     `compact-encoding`'s `from()`. `compact-encoding` ships types and is
 *     resolvable from the project root, but its `Encoder` interface is not
 *     exported (only `raw`/`State`/the concrete encoders are), so {@link
 *     Schema} is a local mirror of `compact-encoding`'s `Encoder`/`State`
 *     shape. The `I`/`O` type params default to `unknown` because a value
 *     encoding is genuinely polymorphic — this is the honest type, not a
 *     shortcut.
 *
 *  7. The `unknown` usages below are deliberate and semantically correct, not
 *     shortcuts:
 *       - {@link Hypercore.getProtocolMuxer} / {@link Hypercore.createProtocolStream}
 *         accept/return the raw stream / muxer (opaque at this layer).
 *       - {@link Hypercore.globalCache} is an internal cache (opaque).
 *       - {@link Hypercore.replicator} is the internal `lib/replicator.js`
 *         `Replicator` (not modelled; a consumer reading it is using internals).
 *       - {@link Hypercore.commit} / {@link Hypercore.applyProof} /
 *         {@link Hypercore.verifyFullyRemote} return internal batch/upgrade
 *         objects (best-guess; the public API does not expose their shape).
 *       - {@link Extension} handlers / messages use `unknown` because an
 *         extension's message type is arbitrary (per extension).
 *       - the {@link Emitter} / {@link EventMap} base mirrors the standard
 *         `EventEmitter` shape; the typed {@link CoreEvents} map is the
 *         precise path and should be preferred.
 *   Everything else is fully typed.
 *
 *  8. {@link Hypercore.get} returns `Promise<Uint8Array | null>` by default
 *     (the raw/decoded block). When a `valueEncoding` is supplied the block is
 *     decoded to that schema's output type; this is documented at
 *     {@link GetOptions.valueEncoding} rather than encoded as a generic
 *     overload (the encoding's output type is not recoverable from the option
 *     at the call site without a generic).
 *
 *  9. {@link Hypercore} gets the {@link Emitter} base via declaration merge
 *     (a same-name {@link Hypercore} interface `extends`
 *     {@link Emitter<CoreEvents>}, because a class can't inherit an interface
 *     via `extends`/`implements` in this TS setup); the {@link CoreEvents} map
 *     covers every event the source emits (verified against `index.js`,
 *     `lib/core.js`, `lib/replicator.js`, `lib/session-state.js`).
 */
