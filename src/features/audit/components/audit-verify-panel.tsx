// ==================== AuditVerifyPanel ====================
// Self-contained "Verify audit trail" panel. Runs the full Audit Verification
// Engine (via the audit:verify IPC) and renders the findings in plain language.
//
//   <AuditVerifyPanel repoRoot={…} anchor={protection.anchor} branch={…} />
//
// UX: lead with a one-line purpose + a Verify button; the engine's technical
// description lives behind an info tooltip, and the advanced knobs (Strict, ref,
// anchor, engine version) live in a collapsed "Details" section. After a run,
// a big plain-language verdict is shown, and each finding is rendered as a
// human title + an actionable hint (the stable rule code is kept, but secondary,
// for auditors and the CLI). Plain-language text comes from finding-explanations.
//
// Lives at: src/features/audit/components/audit-verify-panel.tsx

import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutline as PassIcon,
  ErrorOutline as FailIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import { useAuditVerify } from "../hooks/useAuditVerify";
import type { Finding, Severity } from "../services/verify/findings";
import { explainFinding } from "../services/verify/finding-explanations";

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
  const { t } = useTranslation();
  const { title, hint } = explainFinding(f.id, (k, d) => t(k, d));

  return (
    <ListItem disableGutters alignItems="flex-start" sx={{ py: 0.75 }}>
      <Chip
        size="small"
        color={CHIP_COLOR[f.severity]}
        label={f.severity}
        sx={{ mr: 1, mt: 0.25, textTransform: "uppercase" }}
      />
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
        }
        secondary={
          <>
            {hint && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                {hint}
              </Typography>
            )}
            <Typography
              component="span"
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", fontFamily: "monospace", mt: 0.25 }}
            >
              {f.id}
              {f.commit ? ` · ${f.commit.slice(0, 10)}` : ""}
            </Typography>
          </>
        }
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
      {/* Header: plain title + an info tooltip carrying the technical detail. */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="h6">
          {t("audit.verify.title", "Audit trail verification")}
        </Typography>
        <Tooltip
          title={t(
            "audit.verify.subtitle",
            "Reconstructs the signing authority from the committed history and reports any commit that isn't authorized by the manifest as it stood before it.",
          )}
        >
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t(
          "audit.verify.lead",
          "Check that every change in the trail is signed and in order.",
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
                loading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {loading
                ? t("audit.verify.running", "Verifying…")
                : t("audit.verify.run", "Verify audit trail")}
            </Button>
            {!result && !loading && (
              <Typography variant="body2" color="text.secondary">
                {t("audit.verify.notRun", "Not verified yet.")}
              </Typography>
            )}
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
              {/* Big, plain-language verdict. */}
              <Alert
                icon={result.result === "pass" ? <PassIcon /> : <FailIcon />}
                severity={result.result === "pass" ? "success" : "error"}
                sx={{ mb: 2 }}
              >
                <AlertTitle>
                  {result.result === "pass"
                    ? t("audit.verify.passTitle", "Trail verified")
                    : t("audit.verify.failTitle", "Problems found")}
                </AlertTitle>
                {result.result === "pass"
                  ? t(
                      "audit.verify.passBody",
                      "Every change is signed and in order.",
                    )
                  : t(
                      "audit.verify.failBody",
                      "Some checks didn't pass — see the details below.",
                    )}
              </Alert>

              {result.findings.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("audit.verify.clean", "No findings.")}
                </Typography>
              ) : (
                SEVERITY_ORDER.map((sev) => {
                  const group = result.findings.filter(
                    (f) => f.severity === sev,
                  );
                  if (group.length === 0) return null;
                  return (
                    <Box key={sev} sx={{ mb: 1.5 }}>
                      <Chip
                        size="small"
                        color={CHIP_COLOR[sev]}
                        label={`${sev.toUpperCase()} · ${group.length}`}
                        sx={{ mb: 0.5 }}
                      />
                      <List dense disablePadding>
                        {group.map((f, i) => (
                          <FindingRow
                            key={`${f.id}-${f.commit ?? ""}-${i}`}
                            f={f}
                          />
                        ))}
                      </List>
                    </Box>
                  );
                })
              )}
            </>
          )}

          {/* Advanced knobs + provenance, collapsed by default. */}
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 1,
              bgcolor: "transparent",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: 0, minHeight: 0 }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("audit.verify.details", "Details")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={strict}
                    onChange={(e) => setStrict(e.target.checked)}
                    disabled={loading}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {t(
                      "audit.verify.strict",
                      "Strict (treat warnings as errors)",
                    )}
                  </Typography>
                }
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}
              >
                {t("audit.verify.ref", "ref")}: <code>{branch}</code>
                {" · "}
                {t("audit.verify.anchor", "anchor")}:{" "}
                <code>{anchor?.slice(0, 10)}</code>
                {result ? ` · AVE v${result.aveVersion}` : ""}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </Box>
  );
};