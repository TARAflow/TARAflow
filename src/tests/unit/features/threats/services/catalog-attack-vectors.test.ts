// tests/unit/features/threats/services/catalog-attack-vectors.test.ts
//
// Mitigation catalog design, step 2 (doc/InProgress/Threat/mitigation-
// catalog-attack-vector.md, D2 / D5 / §3): every control states valid attack
// vectors or none, has its verifications defined and en/de text for both;
// the vector mapping of the existing controls and the new controls are
// pinned. catalog-integrity.test.ts covers only controls referenced by
// templates — the new ones are referenced by nothing yet.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  getAllMitigations,
  getAllVerifications,
} from "features/threats/services/threat-catalog-service";
import { ATTACK_VECTORS } from "shared/models/attack-vector";

const texts = (lang: string, kind: "mitigations" | "verifications") => {
  const dir = join(process.cwd(), "src/i18n/locales", lang, kind);
  return Object.assign(
    {},
    ...readdirSync(dir).map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8"))),
  ) as Record<string, Record<string, string>>;
};

const mitigations = getAllMitigations();
const verificationIds = new Set(getAllVerifications().map((v) => v.id));
const byId = new Map(mitigations.map((m) => [m.id, m]));

describe("catalog — attack vectors and completeness", () => {
  it("attackVectors are absent or a non-empty list of known vectors", () => {
    for (const m of mitigations) {
      if (m.attackVectors === undefined) continue;
      expect(m.attackVectors.length, m.id).toBeGreaterThan(0);
      for (const v of m.attackVectors) expect(ATTACK_VECTORS, m.id).toContain(v);
    }
  });

  it("every control's verifications exist", () => {
    for (const m of mitigations) {
      for (const v of m.verifications ?? []) expect(verificationIds.has(v), `${m.id} → ${v}`).toBe(true);
    }
  });

  it("every control and verification has en and de text", () => {
    for (const lang of ["en", "de"]) {
      const mt = texts(lang, "mitigations");
      const vt = texts(lang, "verifications");
      for (const m of mitigations) {
        expect(mt[m.id]?.mitigation, `${lang} ${m.id}`).toBeTruthy();
        for (const v of m.verifications ?? []) expect(vt[v]?.verification, `${lang} ${v}`).toBeTruthy();
      }
    }
  });

  it("ids are unique", () => {
    expect(byId.size).toBe(mitigations.length);
  });
});

describe("catalog — vector mapping of the existing controls (D5)", () => {
  const vectors = (id: string) => byId.get(id)?.attackVectors;

  it("physical boundary, chip boundary, interface tamper and cable protection: physical", () => {
    for (const m of mitigations.filter((x) => /^M-(PB|CB|IF-T)-/.test(x.id))) {
      expect(m.attackVectors, m.id).toEqual(["physical"]);
    }
    for (const id of ["M-IF-D-001", "M-IF-I-002", "M-T-008", "M-T-009", "M-T-015", "M-D-007"]) {
      expect(vectors(id), id).toEqual(["physical"]);
    }
  });

  it("debug and factory interfaces: physical and local", () => {
    for (const m of mitigations.filter((x) => /^M-IF-(DBG|E|POLICY)-/.test(x.id))) {
      expect(m.attackVectors, m.id).toEqual(["physical", "local"]);
    }
    expect(vectors("M-E-006")).toEqual(["physical", "local"]);
  });

  it("network controls: network and adjacent; link-layer pairing: adjacent", () => {
    for (const id of ["M-D-001", "M-D-002", "M-D-003", "M-D-004", "M-D-005", "M-D-012", "M-S-005", "M-S-007", "M-I-002", "M-T-005"]) {
      expect(vectors(id), id).toEqual(["network", "adjacent"]);
    }
    expect(vectors("M-IF-S-002")).toEqual(["adjacent"]);
  });

  it("generic controls stay vector-free", () => {
    for (const id of ["M-T-002", "M-T-006", "M-E-001", "M-R-001", "M-S-004", "M-I-001"]) {
      expect(vectors(id), id).toBeUndefined();
    }
  });
});

describe("catalog — new controls (§3)", () => {
  const NEW = [
    "M-NET-001", "M-NET-002", "M-NET-003", "M-NET-004",
    "M-AC-001", "M-AC-002", "M-AC-003",
    "M-OS-001", "M-OS-002", "M-OS-003", "M-OS-004", "M-OS-005", "M-OS-006",
    "M-VEH-001", "M-VEH-002", "M-VEH-003", "M-VEH-004", "M-VEH-005",
    "M-OPS-001", "M-OPS-002",
  ];

  it("all 20 exist, each with its own verification", () => {
    for (const id of NEW) {
      expect(byId.get(id)?.verifications, id).toEqual([`V${id.slice(1)}`]);
    }
  });

  it("only the in-vehicle controls are limited to the Automotive domain", () => {
    for (const id of NEW) {
      expect(byId.get(id)!.context, id).toEqual(id.startsWith("M-VEH-") ? { domain: ["Automotive"] } : {});
    }
  });
});
