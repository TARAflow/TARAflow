// tests/unit/shared/utils/hash-helpers-move.test.ts
//
// ISO/SAE 21434 conformance plan 0c, prerequisite commit (c): canonicalStringify
// + TCS_VERSION and FNV-1a moved to src/shared/utils so features can hash
// (calculation stamps). Persisted identities must not change.

import { describe, it, expect } from "vitest";

import { fnv1aHex12 } from "shared/utils/fnv1a";
import {
  canonicalStringify as sharedCanonical,
  TCS_VERSION as SHARED_TCS_VERSION,
} from "shared/utils/tcs-canonical";
import { canonicalStringify, TCS_VERSION } from "app/services/tcs-serialize";
import {
  computeNodeId,
  computePathKey,
} from "features/attacktree/services/attacktree-path-identity";

describe("FNV-1a moved to shared — persisted keys unchanged", () => {
  // Expected values computed with the implementation before the move
  // (attacktree-path-identity.ts at 2d2353cc). pathKeys and node ids are
  // persisted in project files: a change here orphans analyst decisions.
  it("pathKey", () => {
    expect(computePathKey(["ROOT", "Gain access", "Exploit CAN"])).toBe("98574937e555");
    expect(computePathKey(["Wurzel", "Zugriff über  OBD", "Ä"])).toBe("cdce644d32ac");
  });

  it("node id", () => {
    expect(computeNodeId(["ROOT", "A b"])).toBe("node-084c835f82de");
    expect(computeNodeId(["ROOT", "Ä"], 2)).toBe("node-1f068b9ef9db-3");
  });

  it("fnv1aHex12 is 12 lowercase hex chars", () => {
    expect(fnv1aHex12("")).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("TCS serializer moved to shared — one definition", () => {
  it("app/services/tcs-serialize re-exports the shared serializer", () => {
    expect(canonicalStringify).toBe(sharedCanonical);
    expect(TCS_VERSION).toBe(SHARED_TCS_VERSION);
  });

  it("output unchanged: sorted keys, 2-space indent, one trailing newline", () => {
    expect(canonicalStringify({ b: 1, a: [true, null], c: { y: "x", x: -0 } })).toBe(
      '{\n  "a": [\n    true,\n    null\n  ],\n  "b": 1,\n  "c": {\n    "x": 0,\n    "y": "x"\n  }\n}\n',
    );
  });
});
