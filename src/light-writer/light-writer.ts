import type { Corestore } from "corestore";
import type { Hypercore } from "hypercore";
import Autobee from "autobee";

export interface LightWriterOptions {
  /**
   * Names the writer's core in its own store (default `'light-writer'`). The writer's key comes from
   * this name and that store; nobody else, least of all a room that ingests it, chooses it.
   */
  name?: string;
}

/**
 * A light writer: a core that any autobee can take as an input without the writer knowing about
 * it. Every block it appends is an autobee oplog node that is optimistic and has no links, so it
 * is self-contained and the same bytes work in any number of rooms.
 *
 * That is the whole writer. What the bytes mean is up to whoever reads them (./rpc is one way to
 * give them meaning), and how a room trusts and reads them is the room's business.
 */
export class LightWriter {
  private core: Hypercore;

  constructor(store: Corestore, opts: LightWriterOptions = {}) {
    this.core = store.get({ name: opts.name ?? "light-writer" });
  }

  async ready() {
    await this.core.ready();
  }

  /** The writer's public key: all a room needs to know to take it as an input. */
  get key() {
    return this.core.key;
  }

  get length() {
    return this.core.length;
  }

  /** Append one block carrying `value`. Resolves to the new length. */
  async append(value: Uint8Array): Promise<number> {
    await this.core.ready();
    await this.core.append(Autobee.encodeValue(value, { optimistic: true }));
    return this.core.length;
  }
}
