/**
 * emoji-routing.js
 *
 * Emoji-based 8-block device addressing for the Hydrogen Host network.
 *
 * Instead of phone numbers, each device is identified by a unique
 * sequence of 8 emoji characters. This module converts between
 * emoji strings and numeric identifiers, generates new device
 * addresses, and handles simple P2P routing lookups.
 */

/** Pool of emoji used to generate addresses */
const EMOJI_POOL = [
  "🧱", "⭐", "🧬", "📡", "💲", "🌐", "⚡", "🔭",
  "🛸", "🌌", "🔬", "🌊", "🔥", "🌙", "💫", "🎯",
  "🧲", "📻", "🎵", "🌀", "⚛️", "🔮", "🌠", "🏔️",
  "🦋", "🐚", "🌺", "🍀", "🌈", "❄️", "🌋", "🎆",
];

const BLOCK_COUNT = 8;

/**
 * Converts an emoji string into a dash-separated numeric device ID.
 * Each emoji is mapped to its Unicode code point(s).
 *
 * @param {string} emojiString - a string of emoji characters
 * @returns {string} dash-separated code points, e.g. "129529-11088-…"
 *
 * @example
 * emojiToId("🧱⭐") // "129521-11088"
 */
function emojiToId(emojiString) {
  if (!emojiString || typeof emojiString !== "string") return "";
  return [...emojiString]
    .map((e) => e.codePointAt(0))
    .join("-");
}

/**
 * Converts a dash-separated numeric ID back to an emoji string.
 *
 * @param {string} id - dash-separated code points
 * @returns {string} emoji string
 *
 * @example
 * idToEmoji("129521-11088") // "🧱⭐"
 */
function idToEmoji(id) {
  if (!id || typeof id !== "string") return "";
  return id
    .split("-")
    .map((cp) => String.fromCodePoint(Number(cp)))
    .join("");
}

/**
 * Generates a random 8-emoji device address from the EMOJI_POOL.
 *
 * @returns {string} 8-emoji address string
 *
 * @example
 * generateDeviceAddress() // "🧱⭐🧬📡💲🌐⚡🔭"
 */
function generateDeviceAddress() {
  const pool = [...EMOJI_POOL];
  const result = [];
  for (let i = 0; i < BLOCK_COUNT; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result.join("");
}

/**
 * Validates that a string is a well-formed 8-emoji device address.
 *
 * @param {string} address - candidate address
 * @returns {boolean}
 */
function isValidAddress(address) {
  if (!address || typeof address !== "string") return false;
  const blocks = [...address];
  return blocks.length === BLOCK_COUNT;
}

/**
 * Simple in-memory routing table.
 * Maps device addresses to connection metadata (stream URLs, peer IDs, etc.)
 */
class RoutingTable {
  constructor() {
    this._table = new Map();
  }

  /**
   * Register a device address with connection metadata.
   * @param {string} address - 8-emoji address
   * @param {object} metadata - arbitrary connection info
   */
  register(address, metadata = {}) {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid device address: ${address}`);
    }
    this._table.set(address, {
      ...metadata,
      id: emojiToId(address),
      registeredAt: Date.now(),
    });
  }

  /**
   * Look up a registered device.
   * @param {string} address - 8-emoji address
   * @returns {object|null}
   */
  lookup(address) {
    return this._table.get(address) ?? null;
  }

  /**
   * List all registered addresses.
   * @returns {string[]}
   */
  list() {
    return Array.from(this._table.keys());
  }

  /**
   * Remove a device from the table.
   * @param {string} address
   */
  deregister(address) {
    this._table.delete(address);
  }
}

export {
  emojiToId,
  idToEmoji,
  generateDeviceAddress,
  isValidAddress,
  RoutingTable,
  EMOJI_POOL,
  BLOCK_COUNT,
};
