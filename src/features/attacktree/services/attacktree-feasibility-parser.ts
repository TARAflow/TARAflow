// src/features/attacktree/services/attacktree-feasibility-parser.ts
//
// PHASE 2 — Parsing the attack-potential (audit mode) DSL syntax.
//
//   Quick mode (existing):  Extract Data;p=0.8,i=3
//   Audit mode (new):       Extract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard
//   With benefit:           ...,b=high
//
// Kept in its own module rather than inlined into parseEvaluation, which is
// already long and handles three legacy formats. This one has a single job.
//
// Design note: every factor is REQUIRED in audit mode. A partially rated path
// would produce an attack potential that is silently too low — and therefore a
// feasibility that is silently too high — which is the most dangerous direction
// to be wrong in. Better to refuse to parse.

import type { ValidationError } from "../models/attacktree-types";
import {
  type AttackPotentialFactors,
  type BenefitLevel,
  BENEFIT_ALIASES,
  ELAPSED_TIME_ALIASES,
  EQUIPMENT_ALIASES,
  EXPERTISE_ALIASES,
  KNOWLEDGE_ALIASES,
  WINDOW_ALIASES,
} from "../models/attacktree-feasibility-types";

export interface AttackPotentialParseResult {
  factors?: AttackPotentialFactors;
  benefit?: BenefitLevel;
  error?: ValidationError;
}

/** Does this evaluation string look like audit mode at all? */
export function looksLikeAttackPotential(evalStr: string): boolean {
  return /\b(et|se|kn|wo|eq)\s*=/i.test(evalStr);
}

/** Parse `b=high` from any evaluation string. Valid in both modes. */
export function parseBenefit(
  evalStr: string,
  lineNumber: number,
): { benefit?: BenefitLevel; error?: ValidationError } {
  const match = evalStr.match(/\bb\s*=\s*([a-z-]+)/i);
  if (!match) return {};

  const raw = match[1].toLowerCase();
  const benefit = BENEFIT_ALIASES[raw];

  if (!benefit) {
    return {
      error: {
        line: lineNumber,
        type: "syntax",
        severity: "error",
        message: `Unknown benefit "${raw}". Expected: negligible, low, medium, high.`,
        messageDE: `Unbekannter Benefit "${raw}". Erwartet: negligible, low, medium, high.`,
      },
    };
  }

  return { benefit };
}

/**
 * Parse the five attack-potential factors.
 * All five are mandatory — see the design note at the top of this file.
 */
export function parseAttackPotential(
  evalStr: string,
  lineNumber: number,
): AttackPotentialParseResult {
  const readFactor = <T>(
    key: string,
    aliases: Record<string, T>,
    humanName: string,
  ): { value?: T; error?: ValidationError } => {
    const match = evalStr.match(
      new RegExp(`\\b${key}\\s*=\\s*([a-z0-9>.-]+)`, "i"),
    );

    if (!match) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Missing attack-potential factor "${key}" (${humanName}). All five factors are required in audit mode.`,
          messageDE: `Attack-Potential-Faktor "${key}" (${humanName}) fehlt. Im Audit-Modus sind alle fünf Faktoren erforderlich.`,
        },
      };
    }

    const raw = match[1].toLowerCase();
    const value = aliases[raw];

    if (value === undefined) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Unknown value "${raw}" for ${key} (${humanName}). Expected one of: ${Object.keys(aliases).join(", ")}.`,
          messageDE: `Unbekannter Wert "${raw}" für ${key} (${humanName}). Erwartet: ${Object.keys(aliases).join(", ")}.`,
        },
      };
    }

    return { value };
  };

  const et = readFactor("et", ELAPSED_TIME_ALIASES, "elapsed time");
  if (et.error) return { error: et.error };

  const se = readFactor("se", EXPERTISE_ALIASES, "specialist expertise");
  if (se.error) return { error: se.error };

  const kn = readFactor("kn", KNOWLEDGE_ALIASES, "knowledge of the item");
  if (kn.error) return { error: kn.error };

  const wo = readFactor("wo", WINDOW_ALIASES, "window of opportunity");
  if (wo.error) return { error: wo.error };

  const eq = readFactor("eq", EQUIPMENT_ALIASES, "equipment");
  if (eq.error) return { error: eq.error };

  const benefitResult = parseBenefit(evalStr, lineNumber);
  if (benefitResult.error) return { error: benefitResult.error };

  return {
    factors: {
      elapsedTime: et.value!,
      specialistExpertise: se.value!,
      knowledgeOfItem: kn.value!,
      windowOfOpportunity: wo.value!,
      equipment: eq.value!,
    },
    benefit: benefitResult.benefit,
  };
}
