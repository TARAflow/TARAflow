// src/shared/utils/same-value.ts
//
// Value equality in the canonical form (TCS — keys sorted, arrays in order):
// an object rebuilt with the same content but another key order is the same.
// JSON.stringify is order-sensitive — a mitigation draft re-created by the
// threat sync showed up as a modified threat in the audit diff although the
// file stayed identical (0.19); the mitigation merge and the rating copy had
// the same compare (0.20 item 15, review 2026-11-20). Values TCS rejects
// (NaN, functions) fall back to JSON.stringify.

import { canonicalStringify } from "./tcs-canonical";

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return a === b;
  try {
    return canonicalStringify(a) === canonicalStringify(b);
  } catch {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
