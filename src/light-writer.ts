import * as b4a from "b4a";
import type { Corestore } from "corestore";
import type { Hypercore } from "hypercore";
import Autobee from "autobee";

function asBuffer(value: Uint8Array | string): Uint8Array {
  if (typeof value === "string") return b4a.from(value);
  if (Buffer.isBuffer(value)) return value;
  return b4a.from(value);
}

export class LightWriter {
  readonly store: Corestore;
  private core: Hypercore;

  constructor(store: Corestore, opts: LightWriterOptions = {}) {
    this.store = store;

    // todo: figure out better default name creation. maybe a random hex string, or a hash of the public key
    this.core = store.get({
      name: opts.name || "light-writer",
    });
  }

  async ready() {
    await this.core.ready();
  }

  // the writer key - share this out-of-band (the "pairing") so a consumer can wake up on this core
  get key() {
    return this.core.key;
  }

  get length() {
    return this.core.length;
  }

  async append(value: Uint8Array | string): Promise<number> {
    const block = Autobee.encodeValue(asBuffer(value), { optimistic: true });
    await this.core.append(block);
    return this.core.length;
  }
}

/** Options for the {@link LightWriter} constructor. */
export interface LightWriterOptions {
  /** The core name (defaults to `'light-writer'`). */
  name?: string;
}
