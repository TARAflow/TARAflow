import { useTranslation } from "react-i18next";
import { Paper, Typography } from "@mui/material";
import type { Srsl, AttackPotentialBand } from "../../models/en50742-approach-a-core";

// §2.2 Output Model C: ascending severity, same coloring convention as the
// 4-level RISK_SCALES (Low/Medium/High/Critical) — SRSL0..3 maps 1:1 onto
// that palette so the badge reads consistently with the rest of the app,
// even though SRSL is its own categorical vocabulary, not a risk-scale value.
export const SRSL_COLORS: Record<Srsl, string> = {
  SRSL0: "#22c55e",
  SRSL1: "#eab308",
  SRSL2: "#f97316",
  SRSL3: "#ef4444",
};

export interface SrslBadgeProps {
  /**
   * §2.2 Output Model C — SRSL is the primary, authoritative EN 50742
   * output when the risk's anchor carries an Exposure Level (§11.2 gate).
   *
   * `undefined` — not an en-50742-a project; the badge renders nothing.
   * `null`      — en-50742-a project, not yet determined: no EL anchor
   *               (gate inactive), EL/AC aren't both rated yet, or
   *               (separately) severity couldn't be resolved. Never the
   *               same as a genuine SRSL0 (§3.9) — shown as "pending", not
   *               as a result. `apBand` distinguishes WHICH kind of
   *               "pending" this is (see below).
   * `Srsl`      — gate active and fully determined.
   */
  srsl: Srsl | null | undefined;
  /**
   * Underlying AP band — used only to distinguish the two "pending" reasons
   * below. The AP score/band/formula themselves are shown in their own box
   * next to WoO/EL/AC/Severity in risk-dialog.tsx, not duplicated here.
   */
  apBand?: AttackPotentialBand | null;
}

/**
 * SRSL is deliberately NOT part of RiskScorePanel: it's a categorical
 * Table B.6 lookup (band × severity), not a numeric risk-scale value, and it
 * has no mitigated counterpart (§3.8 — SRSL is a target level, satisfied by
 * controls, never "mitigated down"). Shown only on the Before side, below
 * the WoO/EL/AC/Severity/AP boxes (§2.2 — "SRSL first, then R×L", i.e.
 * ahead of the standard-method score, but as the outcome of those inputs).
 */
export const SrslBadge = ({ srsl, apBand }: SrslBadgeProps) => {
  const { t } = useTranslation();

  if (srsl === undefined) return null;

  if (srsl === null) {
    // AP itself IS resolvable (EL/AC/WoO all rated) but severity is missing,
    // vs. nothing resolvable yet at all — different messages, same null.
    const apResolved = apBand != null;
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          textAlign: "center",
          bgcolor: "background.paper",
          height: "100%",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t("tabs.risks.dialog.srslLabel", {
            defaultValue: "SRSL (EN 50742, primary)",
          })}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
          {apResolved
            ? t("tabs.risks.dialog.srslNoSeverity", {
                defaultValue:
                  "No severity — link a safety-function asset with a physical impact",
              })
            : t("tabs.risks.dialog.srslNotDetermined", {
                defaultValue:
                  "Not yet determined — rate Exposure Level and Attacker Capability",
              })}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        textAlign: "center",
        bgcolor: SRSL_COLORS[srsl],
        color: "white",
        borderColor: SRSL_COLORS[srsl],
        height: "100%",
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        {t("tabs.risks.dialog.srslLabel", {
          defaultValue: "SRSL (EN 50742, primary)",
        })}
      </Typography>
      <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>
        {srsl}
      </Typography>
    </Paper>
  );
};