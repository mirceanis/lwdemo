/**
 * Type definitions for `hypercore-crypto` (v3.7.0).
 *
 * The package ships only `index.js` (CommonJS, using `require` / `exports`) and
 * has no `types`/`typings` field, so TypeScript reports TS7016 for it. This file
 * provides an ambient module declaration so the library can be used in a
 * TypeScript project.
 *
 * NOTE on `sodium-universal` and `b4a`: both are CommonJS deps of
 * `hypercore-crypto`. `b4a`'s public types use plain `Uint8Array` (there is no
 * exported "secure buffer" type), so the one place where we genuinely cannot
 * recover a precise type (`free()`'s argument) is annotated as a follow-up.
 */

declare module "hypercore-crypto" {
  /**
   * A signing key pair (Ed25519) as produced by {@link keyPair}.
   * `publicKey` is 32 bytes; `secretKey` is 64 bytes.
   *
   * @note This is structurally identical to {@link EncryptionKeyPair}. The two
   *       only differ cryptographically, not in shape, so the type system
   *       cannot prevent mixing them up. See the follow-up note near the bottom
   *       of this file about enforcing the distinction.
   */
  export interface KeyPair {
    /** 32-byte Ed25519 public key. */
    publicKey: Uint8Array;
    /** 64-byte Ed25519 secret key. */
    secretKey: Uint8Array;
  }

  /**
   * An encryption (crypto_box / sealed-box) key pair as produced by
   * {@link encryptionKeyPair}. `publicKey` is 32 bytes; `secretKey` is 32 bytes.
   *
   * @note `decrypt()` / `encrypt()` operate on these, NOT on a {@link KeyPair}
   *       from `keyPair()`. The shapes are identical, so this is only a
   *       documentation-level distinction (see the follow-up note).
   */
  export interface EncryptionKeyPair {
    /** 32-byte box public key. */
    publicKey: Uint8Array;
    /** 32-byte box secret key. */
    secretKey: Uint8Array;
  }

  /**
   * A node of the Merkle tree used by {@link parent} and {@link tree}.
   * `hash` is a 32-byte content/branch hash.
   */
  export interface TreeNode {
    /** 32-byte hash of this node. */
    hash: Uint8Array;
    /** Index of the node in the tree. */
    index: number;
    /** Size (in bytes) of the data this node covers. */
    size: number;
  }

  /**
   * A secure buffer (e.g. one allocated with `b4a.allocUnsafeSlow` / the slab
   * pool) that {@link free} can release.
   *
   * @note FOLLO-UP: this is a minimal stand-in. `b4a`'s secure buffers are not
   *       exposed by `b4a`'s own public types (its `.d.ts` only exports
   *       `Uint8Array`), so the precise type cannot be imported here without a
   *       third-party `@types/b4a`. If a proper secure-buffer type becomes
   *       available, replace this interface with it.
   */
  export interface SecureBuffer {
    /** True when the buffer was allocated from the secure slab and can be freed. */
    secure: boolean;
  }

  /**
   * Generate an Ed25519 signing key pair.
   *
   * @param seed Optional 32-byte seed. When provided the pair is derived
   *   deterministically from it; otherwise a random pair is generated.
   * @returns The `{ publicKey (32B), secretKey (64B) }` pair.
   */
  export function keyPair(seed?: Uint8Array): KeyPair;

  /**
   * Verify that a key pair is internally consistent, i.e. that its `secretKey`
   * derives the given `publicKey`.
   *
   * @returns `true` if the pair is valid.
   */
  export function validateKeyPair(keyPair: KeyPair): boolean;

  /**
   * Sign a message with a secret key (Ed25519 detached signature).
   *
   * @param message    The bytes to sign.
   * @param secretKey  A 64-byte Ed25519 secret key (from {@link keyPair}).
   * @returns A 64-byte signature.
   */
  export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array;

  /**
   * Verify a detached signature over a message.
   *
   * @param message    The signed bytes.
   * @param signature  A 64-byte signature (from {@link sign}).
   * @param publicKey  A 32-byte Ed25519 public key.
   * @returns `true` if the signature is valid. Returns `false` (rather than
   *   throwing) when the signature or public key have the wrong length.
   */
  export function verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;

  /**
   * Sealed-box encrypt a message to a recipient's public key.
   *
   * @param message    The bytes to encrypt.
   * @param publicKey  The recipient's box public key (from {@link encryptionKeyPair}).
   * @returns The ciphertext, whose length is `message.length + crypto_box_SEALBYTES`.
   *
   * @note Pair this with {@link decrypt} using the same {@link EncryptionKeyPair}.
   */
  export function encrypt(
    message: Uint8Array,
    publicKey: Uint8Array,
  ): Uint8Array;

  /**
   * Sealed-box decrypt a ciphertext.
   *
   * @param ciphertext The ciphertext produced by {@link encrypt}.
   * @param keyPair    The recipient's {@link EncryptionKeyPair} (from
   *   {@link encryptionKeyPair}), NOT a {@link KeyPair} from `keyPair()`.
   * @returns The plaintext, or `null` if the ciphertext is too short or fails to
   *   decrypt.
   */
  export function decrypt(
    ciphertext: Uint8Array,
    keyPair: EncryptionKeyPair,
  ): Uint8Array | null;

  /**
   * Generate a box (crypto_box) encryption key pair.
   *
   * @param seed Optional seed; when provided the pair is derived deterministically
   *   from it, otherwise a random pair is generated.
   * @returns The `{ publicKey (32B), secretKey (32B) }` pair, to be used with
   *   {@link encrypt} / {@link decrypt}.
   */
  export function encryptionKeyPair(seed?: Uint8Array): EncryptionKeyPair;

  /**
   * Hash the "leaf"/data component of a Merkle tree node.
   *
   * @param data The node data. Only its `byteLength` is read here, but pass the
   *   full data buffer to match how callers use the result.
   * @returns A 32-byte hash.
   */
  export function data(data: Uint8Array): Uint8Array;

  /**
   * Hash the parent of two sibling Merkle tree nodes. The two nodes are ordered
   * by index internally, so the order of the arguments does not matter.
   *
   * @param a First child node.
   * @param b Second child node.
   * @returns A 32-byte branch hash.
   */
  export function parent(a: TreeNode, b: TreeNode): Uint8Array;

  /**
   * Hash a set of Merkle tree roots.
   *
   * @param roots The roots to hash together.
   * @param out   Optional pre-allocated 32-byte output buffer to write into
   *   (allocated internally when omitted).
   * @returns The 32-byte root hash (the same buffer that was passed / allocated).
   */
  export function tree(
    roots: readonly TreeNode[],
    out?: Uint8Array,
  ): Uint8Array;

  /**
   * Generic hash (BLAKE2) of one or more buffers.
   *
   * @param data A single buffer, or an array of buffers to hash together.
   * @param out  Optional pre-allocated 32-byte output buffer (allocated internally
   *   when omitted).
   * @returns The 32-byte hash.
   */
  export function hash(
    data: Uint8Array | readonly Uint8Array[],
    out?: Uint8Array,
  ): Uint8Array;

  /**
   * Generate `n` cryptographically random bytes.
   *
   * @param n The number of bytes to generate.
   * @returns A buffer of length `n`.
   */
  export function randomBytes(n: number): Uint8Array;

  /**
   * Derive a 32-byte discovery key from a 32-byte key (a hypercore public key).
   *
   * @param key A 32-byte key. Throws if it is not exactly 32 bytes.
   * @returns A 32-byte discovery key.
   */
  export function discoveryKey(key: Uint8Array): Uint8Array;

  /**
   * Free a secure buffer, returning it to the secure slab.
   *
   * @param secureBuf A secure buffer (e.g. one from `b4a.allocUnsafeSlow`).
   *
   * @note In builds where the underlying `sodium` has no `sodium_free`, this
   *   export is a no-op. In builds where it does exist, calling it with no
   *   argument throws, so always pass a buffer.
   *
   * @note FOLLO-UP: the argument type is the minimal {@link SecureBuffer} stand-in
   *       (see its definition); refine it if/when a real `b4a` secure-buffer type
   *       is available.
   */
  export function free(secureBuf: SecureBuffer): void;

  /**
   * Derive one or more namespace ids from a name.
   *
   * @param name  The namespace name, as a string or bytes.
   * @param count Either the number of namespaces to derive (ids `0..count-1`
   *   are generated), or an explicit array of numeric ids to use.
   * @returns An array of 32-byte namespace buffers, one per id, in id order.
   */
  export function namespace(
    name: string | Uint8Array,
    count: number | number[],
  ): Uint8Array[];

  /**
   * The full set of exports, available as the default import so that
   * `import hc from 'hypercore-crypto'` type-checks without `esModuleInterop`.
   *
   * @note FOLLO-UP: this `default` exists only to support the CommonJS default
   *   import under NodeNext. If the project ever enables `esModuleInterop`,
   *   prefer the named imports above.
   */
  const _default: {
    keyPair: typeof keyPair;
    validateKeyPair: typeof validateKeyPair;
    sign: typeof sign;
    verify: typeof verify;
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    encryptionKeyPair: typeof encryptionKeyPair;
    data: typeof data;
    parent: typeof parent;
    tree: typeof tree;
    hash: typeof hash;
    randomBytes: typeof randomBytes;
    discoveryKey: typeof discoveryKey;
    free: typeof free;
    namespace: typeof namespace;
  };
  export default _default;
}

/**
 * FOLLO-UP (best-guess / not fully enforced):
 *
 * `KeyPair` (from `keyPair()`, Ed25519 signing) and `EncryptionKeyPair`
 * (from `encryptionKeyPair()`, sealed box) have IDENTICAL shapes, so the type
 * system will not stop you from passing a signing `KeyPair` into `decrypt()`
 * (or a box `EncryptionKeyPair` into `sign()`/`verify()`). At runtime that
 * mis-usage fails rather than produces a wrong answer, but it is silent at
 * compile time.
 *
 * To make the distinction enforceable, give the two interfaces a brand
 * (e.g. a unique symbol property) so they become nominal, and derive the
 * concrete return types from those branded types. This is left as a follow-up
 * because the runtime objects have no such property, so a branded type would
 * also reject real objects unless the generators' return types are branded too
 * (which they are here, so it would be safe to do).
 */
