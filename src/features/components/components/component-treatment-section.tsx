// ==================== COMPONENT TREATMENT SECTION ====================
// Multi-project TARA, phase 3a (design §7.4): in the risk dialog of an
// imported risk, how the component treated it — read-only. Its measures
// with their status (implemented / verified count; any other status depends
// on a component release), or, for a risk it handed over (share / transfer)
// or accepted, the claims that say why it arrives untreated here. The
// machine's own treatment and measures stay below as for any risk.

import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";

const NS = "components";

export interface ComponentTreatmentView {
  instanceLabel: string;
  treatment: string;
  justification?: string;
  measures: { id?: string; text: string; status: string; state: "implemented" | "pending" | "rejected" }[];
  claims: { displayId: string; kind: string; statement: string; responsibleParty?: string }[];
  handedOver: boolean;
  /** Handed over: has the machine set its own treatment yet? */
  decided?: boolean;
}

const STATE_COLOR = { implemented: "success", pending: "warning", rejected: "default" } as const;

export const ComponentTreatmentSection: React.FC<{ view: ComponentTreatmentView }> = ({ view }) => {
  const { t } = useTranslation(NS);
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "grey.50" }} data-testid="component-treatment">
      <Typography variant="subtitle2">
        {t("components.treatment.title", {
          component: view.instanceLabel,
          treatment: t(`components.treatment.kinds.${view.treatment}`, { defaultValue: view.treatment }),
          defaultValue: "Treatment in the component ({{component}}): {{treatment}}",
        })}
      </Typography>
      {view.justification && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {view.justification}
        </Typography>
      )}

      {view.handedOver ? (
        <>
          <Alert severity={view.decided ? "success" : "warning"} sx={{ mt: 1 }} data-testid="component-treatment-handover">
            {view.decided
              ? t("components.treatment.handoverDecided", {
                  defaultValue: "The component handed this risk over; this machine has set its own treatment.",
                })
              : t("components.treatment.handoverOpen", {
                  defaultValue:
                    "The component handed this risk over or accepted it — it arrives untreated. Set this machine's treatment: an own measure, or accept / transfer with a justification.",
                })}
          </Alert>
          {view.claims.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {view.claims.map((c) => (
                <Typography key={c.displayId} variant="body2" data-testid={`component-treatment-claim-${c.displayId}`}>
                  <strong>{c.displayId}</strong> ({c.kind}
                  {c.responsibleParty ? ` → ${c.responsibleParty}` : ""}): {c.statement}
                </Typography>
              ))}
            </Stack>
          )}
        </>
      ) : view.measures.length > 0 ? (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {view.measures.map((m, i) => (
            <Stack key={`${m.id ?? ""}-${i}`} direction="row" spacing={1} alignItems="center" data-testid={`component-treatment-measure-${m.id ?? i}`}>
              <Chip
                size="small"
                color={STATE_COLOR[m.state]}
                variant={m.state === "implemented" ? "filled" : "outlined"}
                label={t(`components.treatment.status.${m.status}`, { defaultValue: m.status })}
              />
              <Typography variant="body2">
                {m.id ? <code style={{ marginRight: 6 }}>{m.id}</code> : null}
                {m.text}
              </Typography>
            </Stack>
          ))}
          {view.measures.some((m) => m.state === "pending") && (
            <Typography variant="caption" color="warning.main" data-testid="component-treatment-pending">
              {t("components.treatment.pending", {
                defaultValue: "Measures not implemented yet depend on a component release.",
              })}
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("components.treatment.noMeasures", { defaultValue: "The component chose no measures." })}
        </Typography>
      )}
    </Box>
  );
};
