// ==================== ATTACK VECTOR ====================
// Mitigation catalog design (doc/InProgress/Threat/mitigation-catalog-attack-
// vector.md, D1/D2): the four attack vectors of ISO/SAE 21434 Annex G.9 —
// how an attack path reaches its target. Stated on attack-tree nodes
// (`av=` in the DSL) and on catalog controls (`attackVectors`), used only to
// pick controls that fit a path. It never enters the attack potential or the
// feasibility (G.2 rates the path).
//
// In shared because both the attack-tree feature (parser, paths) and the
// threat catalog (controls) use it.

export type AttackVector = "network" | "adjacent" | "local" | "physical";

export const ATTACK_VECTORS: readonly AttackVector[] = [
  "network",
  "adjacent",
  "local",
  "physical",
];

/** DSL spellings → vector (case-insensitive; the full names and short forms). */
export const ATTACK_VECTOR_ALIASES: Readonly<Record<string, AttackVector>> = {
  network: "network",
  net: "network",
  adjacent: "adjacent",
  adj: "adjacent",
  local: "local",
  loc: "local",
  physical: "physical",
  phys: "physical",
};

/** The vector a DSL value names, or undefined for an unknown value. */
export function parseAttackVector(raw: string): AttackVector | undefined {
  return ATTACK_VECTOR_ALIASES[raw.trim().toLowerCase()];
}
