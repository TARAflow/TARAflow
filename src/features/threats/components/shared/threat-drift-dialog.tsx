// ==================== THREAT DRIFT DIALOG ====================
// Explicit resolution of generation drift: for every stored threat the current
// rules no longer produce, the analyst decides to KEEP it (as a manual threat —
// same id, risk stays linked, survives regeneration) or REMOVE it.
// Default is KEEP for every row: nothing is dropped unless the analyst says so.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { ObsoleteThreat } from "../../services/threat-generation-drift";
import type { ThreatRiskAttachment } from "../../models/threat-types";

type Decision = "keep" | "remove";

export interface ThreatDriftDialogProps {
  open: boolean;
  obsolete: ObsoleteThreat[];
  riskAttachments?: Record<string, ThreatRiskAttachment>;
  onApply: (keepIds: Set<string>, removeIds: Set<string>) => void;
  onClose: () => void;
}

export const ThreatDriftDialog: React.FC<ThreatDriftDialogProps> = ({
  open,
  obsolete,
  riskAttachments,
  onApply,
  onClose,
}) => {
  const { t } = useTranslation();

  const initial = useMemo(
    () =>
      Object.fromEntries(
        obsolete.map((o) => [o.threatId, "keep" as Decision]),
      ) as Record<string, Decision>,
    [obsolete],
  );
  const [decisions, setDecisions] = useState(initial);
  useEffect(() => setDecisions(initial), [initial, open]);

  const setAll = (pick: (o: ObsoleteThreat) => Decision) =>
    setDecisions(
      Object.fromEntries(obsolete.map((o) => [o.threatId, pick(o)])),
    );

  const apply = () => {
    const keep = new Set<string>();
    const remove = new Set<string>();
    for (const o of obsolete) {
      (decisions[o.threatId] === "remove" ? remove : keep).add(o.threatId);
    }
    onApply(keep, remove);
  };

  const riskLabel = (id: string): string => {
    const r = riskAttachments?.[id];
    if (!r) return "–";
    return r.mitigationCount > 0
      ? t("tabs.threats.drift.dialog.riskWithMitigations", {
          count: r.mitigationCount,
          defaultValue: "Risk · {{count}} mitigations",
        })
      : t("tabs.threats.drift.dialog.risk", { defaultValue: "Risk" });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("tabs.threats.drift.dialog.title", {
          defaultValue: "Threats no longer generated",
        })}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("tabs.threats.drift.dialog.intro", {
            defaultValue:
              "The current generation rules or security goals no longer produce these threats. Keep turns a threat into a manual threat: it keeps its ID and risk and survives every regeneration. Remove deletes it; a linked risk is removed on the next risk sync.",
          })}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button size="small" onClick={() => setAll(() => "keep")}>
            {t("tabs.threats.drift.dialog.keepAll", {
              defaultValue: "Keep all",
            })}
          </Button>
          <Button
            size="small"
            onClick={() =>
              setAll((o) => (riskAttachments?.[o.threatId] ? "keep" : "remove"))
            }
          >
            {t("tabs.threats.drift.dialog.removeWithoutRisk", {
              defaultValue: "Remove all without risk",
            })}
          </Button>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.threats.drift.dialog.colThreat", { defaultValue: "Threat" })}</TableCell>
              <TableCell>{t("tabs.threats.element", { defaultValue: "Element" })}</TableCell>
              <TableCell>STRIDE</TableCell>
              <TableCell>{t("tabs.threats.drift.dialog.colRisk", { defaultValue: "Risk" })}</TableCell>
              <TableCell align="right">
                {t("tabs.threats.drift.dialog.colDecision", { defaultValue: "Decision" })}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {obsolete.map((o) => (
              <TableRow key={o.threatId}>
                <TableCell>{o.displayId}</TableCell>
                <TableCell>{o.elementName || "–"}</TableCell>
                <TableCell>{o.strideCategory}</TableCell>
                <TableCell>{riskLabel(o.threatId)}</TableCell>
                <TableCell align="right">
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={decisions[o.threatId] ?? "keep"}
                    onChange={(_e, v: Decision | null) =>
                      v && setDecisions((d) => ({ ...d, [o.threatId]: v }))
                    }
                  >
                    <ToggleButton value="keep">
                      {t("tabs.threats.drift.dialog.keep", { defaultValue: "Keep" })}
                    </ToggleButton>
                    <ToggleButton value="remove">
                      {t("tabs.threats.drift.dialog.remove", { defaultValue: "Remove" })}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button variant="contained" onClick={apply}>
          {t("tabs.threats.drift.dialog.apply", { defaultValue: "Apply" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
