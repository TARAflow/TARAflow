// ==================== AuditVerifyPanel ====================
// Self-contained "Verify audit trail" panel. Runs the full Audit Verification
// Engine (via the audit:verify IPC) and renders the findings. Drop it into the
// Audit tab:
//
//   <AuditVerifyPanel
//     repoRoot={repoRootValue}
//     anchor={protection.anchor}
//     branch={currentBranch}
//   />
//
// The anchor is the DERIVED one from useAuditProtection today (see
// docs/decisions/audit-anchor-source.md); a pinned anchor can replace it later
// without touching this component.
//
// Lives at: src/features/audit/components/audit-verify-panel.tsx

import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useAuditVerify } from "../hooks/useAuditVerify";
import type {
  Finding,
  Severity,
} from "../services/verify/findings";

interface AuditVerifyPanelProps {
  repoRoot: string | undefined;
  anchor: string | null;
  branch: string;
}

const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];
const CHIP_COLOR: Record<Severity, "error" | "warning" | "info"> = {
  error: "error",
  warning: "warning",
  info: "info",
};

function FindingRow({ f }: { f: Finding }) {
  return (
    <ListItem disableGutters alignItems="flex-start" sx={{ py: 0.5 }}>
      <Chip
        size="small"
        color={CHIP_COLOR[f.severity]}
        label={f.severity}
        sx={{ mr: 1, mt: 0.25, textTransform: "uppercase" }}
      />
      <ListItemText
        primary={
          <Box component="span" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Typography
              component="span"
              sx={{ fontFamily: "monospace", fontWeight: 600 }}
            >
              {f.id}
            </Typography>
            {f.commit && (
              <Typography
                component="span"
                sx={{ fontFamily: "monospace", color: "text.secondary" }}
              >
                @{f.commit.slice(0, 10)}
              </Typography>
            )}
          </Box>
        }
        secondary={f.message}
      />
    </ListItem>
  );
}

export const AuditVerifyPanel: React.FC<AuditVerifyPanelProps> = ({
  repoRoot,
  anchor,
  branch,
}) => {
  const { t } = useTranslation();
  const { result, loading, error, strict, setStrict, canRun, run, reset } =
    useAuditVerify(repoRoot, anchor, branch);

  // Drop a stale result when the repo or anchor changes underneath us.
  useEffect(() => {
    reset();
  }, [repoRoot, anchor, reset]);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("audit.verify.title", "Audit trail verification")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t(
          "audit.verify.subtitle",
          "Reconstructs the signing authority from the committed history and reports any commit that isn't authorized by the manifest as it stood before it.",
        )}
      </Typography>

      {!canRun ? (
        <Alert severity="info">
          {t(
            "audit.verify.noAnchor",
            "No audit anchor yet — add a signer manifest (Signers tab) first.",
          )}
        </Alert>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ mb: 2 }}
            flexWrap="wrap"
          >
            <Button
              variant="contained"
              onClick={run}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : undefined
              }
            >
              {loading
                ? t("audit.verify.running", "Verifying…")
                : t("audit.verify.run", "Verify audit trail")}
            </Button>
            <FormControlLabel
              control={
                <Checkbox
                  checked={strict}
                  onChange={(e) => setStrict(e.target.checked)}
                  disabled={loading}
                />
              }
              label={t("audit.verify.strict", "Strict (treat warnings as errors)")}
            />
            <Typography variant="caption" color="text.secondary">
              {t("audit.verify.ref", "ref")}: <code>{branch}</code> ·{" "}
              {t("audit.verify.anchor", "anchor")}:{" "}
              <code>{anchor?.slice(0, 10)}</code>
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>
                {t("audit.verify.engineError", "Could not run verification")}
              </AlertTitle>
              {error}
            </Alert>
          )}

          {result && (
            <>
              <Alert
                severity={result.result === "pass" ? "success" : "error"}
                sx={{ mb: 2 }}
              >
                <AlertTitle>
                  {result.result === "pass"
                    ? t("audit.verify.pass", "PASS")
                    : t("audit.verify.fail", "FAIL")}
                </AlertTitle>
                {t("audit.verify.summary", "{{error}} errors, {{warning}} warnings, {{info}} info", {
                  error: result.summary.error,
                  warning: result.summary.warning,
                  info: result.summary.info,
                })}
                {result.strict ? ` · ${t("audit.verify.strictOn", "strict")}` : ""}
                {` · AVE v${result.aveVersion}`}
              </Alert>

              {result.findings.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("audit.verify.clean", "No findings.")}
                </Typography>
              ) : (
                SEVERITY_ORDER.map((sev) => {
                  const group = result.findings.filter((f) => f.severity === sev);
                  if (group.length === 0) return null;
                  return (
                    <Box key={sev} sx={{ mb: 1.5 }}>
                      <Divider textAlign="left" sx={{ mb: 0.5 }}>
                        <Chip
                          size="small"
                          color={CHIP_COLOR[sev]}
                          label={`${sev.toUpperCase()} · ${group.length}`}
                        />
                      </Divider>
                      <List dense disablePadding>
                        {group.map((f, i) => (
                          <FindingRow key={`${f.id}-${f.commit ?? ""}-${i}`} f={f} />
                        ))}
                      </List>
                    </Box>
                  );
                })
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};
