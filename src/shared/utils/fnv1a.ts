// ==================== FNV-1a HASH ====================
// Plain-TS FNV-1a, shared so features can hash without importing each other.
// Origin: attack path identity (features/attacktree/services/
// attacktree-path-identity.ts), whose persisted pathKeys / node ids depend on
// the exact output — do not change the algorithm, offsets or truncation.
//
// Not node:crypto / SubtleCrypto: it runs in the renderer AND in the Node CLI
// with byte-identical output, and stays synchronous. Collision resistance for
// identity / change detection, not a security hash.

export const FNV_OFFSET_A = 0x811c9dc5;
export const FNV_OFFSET_B = 0x01000193;
const FNV_PRIME = 0x01000193;

/** 32-bit FNV-1a over the UTF-16 code units of `input`, seeded with `offset`. */
export function fnv1a32(input: string, offset: number): number {
  let hash = offset >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= FNV_PRIME, in 32-bit space, without overflowing to float
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 64-bit FNV-1a rendered as 16 lowercase hex chars, truncated to 12.
 * Two independently-seeded 32-bit lanes give a wider key than a single lane
 * without pulling in a hashing dependency.
 */
export function fnv1aHex12(input: string): string {
  const a = fnv1a32(input, FNV_OFFSET_A);
  const b = fnv1a32(input, FNV_OFFSET_B);
  const hex = a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  return hex.slice(0, 12);
}
