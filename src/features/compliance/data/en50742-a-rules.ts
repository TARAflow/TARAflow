// ==================== EVIDENCE RULES: EN 50742 APPROACH A ====================
// How TARAflow shows a row of the sub-tab `en-50742-a`
// (en-50742-rq-coverage.md §9.1 / §9.2). Evidence kinds:
//
//   M  model     property checks, as the IEC 62443-4-2 rules — the same
//                security properties, never 62443 statements (K-6, E-4)
//   R  risk      `external: { kind: "risk" }` — the risks with their SRSL and
//                the mandated controls `en50742-<clause>`
//   P  project   `external: { kind: "project" }` — a named check over hazards,
//                risks, safety-function assets, WoO and system definition
//   S  statement type C, or the checklist of a type B row
//
// R and P are read from the En50742View (CM-12, evaluate-en50742.ts). Type
// A / B / C as for IEC 62443 (D-11).

import type { EvidenceRule, En50742RequirementId } from "../models/compliance-types";

/** Elements that log interventions: a process recording them, or an audit log store. */
const LOGGING = [
  { elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "nonRepudiation", in: ["audit_log", "digital_signature", "hardware_backed"] }] },
  { elementTypes: ["DataStore"], satisfiedIf: [{ property: "storedDataTypes", in: ["audit_logs"] }] },
] as const;

/** A 7.4.3 clause: every risk it is mandated for has the mandated control done. */
const mandated = (id: En50742RequirementId, clause: string) =>
  ({ id, type: "A", targets: [], external: { kind: "risk", check: "mandated", clause } }) as const;

const RULES = [
  // ── Threat assessment (4.3, 7.1, 7.2.1, 7.4.2) ─────────────────────────
  { id: "en-4.3-217", type: "A", targets: [], external: { kind: "project", check: "hazards-linked" } },
  {
    id: "en-4.3-220",
    type: "B",
    targets: [],
    external: { kind: "project", check: "system-definition" },
    checklist: [
      "intended use described",
      "reasonably foreseeable misuse described",
      "user groups described",
      "connections of the machine described",
    ],
  },
  { id: "en-4.3-238", type: "C", targets: [] },
  { id: "en-7.1-260", type: "A", targets: [], external: { kind: "project", check: "interfaces-assessed" } },
  { id: "en-7.4.2-334", type: "A", targets: [], external: { kind: "project", check: "srsl-complete" } },
  { id: "en-7.4.2-344", type: "A", targets: [], external: { kind: "project", check: "srsl-consistent" } },

  // ── Information collection (7.3) ───────────────────────────────────────
  { id: "en-7.3.1-281", type: "C", targets: [] },
  {
    id: "en-7.3.2-295",
    type: "B",
    quantifier: "any",
    targets: LOGGING,
    checklist: ["each record holds the minimum content (what, when, by whom)"],
  },
  {
    id: "en-7.3.3-304",
    type: "B",
    quantifier: "any",
    targets: LOGGING,
    checklist: ["the evidence can be read", "the access to it is documented", "it is collected automatically"],
  },
  { id: "en-7.3.4-317", type: "C", targets: [] },
  {
    id: "en-7.3.5-321",
    type: "B",
    targets: [
      {
        elementTypes: ["DataStore"],
        appliesIf: [{ property: "storedDataTypes", in: ["audit_logs"] }],
        satisfiedIf: [{ property: "integrityProtection", notIn: ["none"] }],
      },
    ],
    checklist: ["records can be deleted only by an authorised procedure"],
  },

  // ── Identification of software versions and configuration (7.5) ────────
  { id: "en-7.5-444", type: "C", targets: [] },

  // ── Protection measures against corruption (7.4.3) ─────────────────────
  { id: "en-7.4.3.1-347", type: "A", targets: [], external: { kind: "risk", check: "all-mandated" } },
  mandated("en-7.4.3.2.1-356", "7.4.3.2.1"),
  mandated("en-7.4.3.3.1-370", "7.4.3.3.1"),
  mandated("en-7.4.3.4.1-380", "7.4.3.4.1"),
  mandated("en-7.4.3.4.2-392", "7.4.3.4.2"),
  mandated("en-7.4.3.4.3-402", "7.4.3.4.3"),
  mandated("en-7.4.3.4.4-412", "7.4.3.4.4"),
  mandated("en-7.4.3.4.5-426", "7.4.3.4.5"),
  {
    // E-4: no STRIDE row mandates the clause (coverage O10); the model shows
    // it with the properties the IEC 62443-4-2 rules read for CR 3.4 RE(1) /
    // CR 3.10 RE(1). Applies from SRSL 2, which the risks give.
    id: "en-7.4.3.5.1-438",
    type: "B",
    minSrsl: 2,
    targets: [
      {
        elementTypes: ["Process", "Multiprocess"],
        appliesIf: [{ property: "updateMechanism", notIn: ["none"] }],
        satisfiedIf: [
          { property: "updateMechanism", in: ["signed_local", "signed_ota"] },
          { property: "malwareProtection", in: ["code_signing"] },
        ],
      },
      {
        elementTypes: ["DataStore"],
        appliesIf: [{ property: "storedDataTypes", in: ["firmware", "safety_params"] }],
        satisfiedIf: [{ property: "integrityProtection", in: ["signature"] }],
      },
    ],
    checklist: ["the authenticity is verified when the software or configuration is installed"],
  },

  // ── Information for use (9) ────────────────────────────────────────────
  { id: "en-9-491", type: "C", targets: [] },
  {
    id: "en-4.3-229",
    type: "B",
    targets: [],
    external: { kind: "risk", check: "remaining" },
    checklist: ["every remaining requirement is named in the information for use"],
  },
] as const satisfies readonly EvidenceRule<En50742RequirementId>[];

/** The rule literals — checked against the element property types like the 62443 rules (D-18). */
export type En50742RuleLiterals = typeof RULES;

export const EN50742_A_RULES: readonly EvidenceRule<En50742RequirementId>[] = RULES;
