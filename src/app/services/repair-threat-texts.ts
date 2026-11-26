// src/app/services/repair-threat-texts.ts
//
// Loading repairs threat and risk text that is an unresolved i18n key
// ("general.D-009.threat"), i18next's "__MISSING__" or the placeholder the
// resolvers give since 0.20 (persisted-threat-text-fix.md, roadmap 3.1,
// patch 30). Threats are resolved again from the catalog
// (threat-text-repair.ts); a risk takes the repaired text of its threat —
// risk-sync copies it from there too. No schema bump: a no-op (same object)
// on clean files, so they and their component snapshot hash stay as they are.

import { isUnresolvedThreatText, repairThreatDataTexts } from "features/threats/services/threat-text-repair";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TEXT_FIELDS = ["threatDescription", "attackDescription", "causeDescription"] as const;

export function repairStoredThreatTexts<T extends { threats?: Any; risks?: Any }>(data: T): T {
  if (!data.threats) return data;
  const threats = repairThreatDataTexts(data.threats);

  const risks = data.risks?.risks;
  let nextRisks = risks;
  if (Array.isArray(risks) && risks.some((r: Any) => TEXT_FIELDS.some((f) => isUnresolvedThreatText(r?.[f])))) {
    const byId = new Map<string, Any>(
      [...(threats.perElementTables ?? []), ...(threats.perInteractionTables ?? [])].flatMap((t: Any) => t.threats ?? []).map((t: Any) => [t.id, t]),
    );
    nextRisks = risks.map((risk: Any) => {
      const threat = byId.get(risk.threatId);
      if (!threat) return risk;
      const fix: Record<string, string> = {};
      for (const f of TEXT_FIELDS) {
        if (isUnresolvedThreatText(risk[f]) && typeof threat[f] === "string" && threat[f] !== risk[f]) fix[f] = threat[f];
      }
      return Object.keys(fix).length > 0 ? { ...risk, ...fix } : risk;
    });
    if (nextRisks.every((r: Any, i: number) => r === risks[i])) nextRisks = risks;
  }

  if (threats === data.threats && nextRisks === risks) return data;
  return {
    ...data,
    threats,
    ...(nextRisks !== risks ? { risks: { ...data.risks, risks: nextRisks } } : {}),
  };
}
