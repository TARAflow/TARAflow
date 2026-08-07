// ==================== AuditProtectionPanel ====================
// One presentational component for the protected-branch checklist, in two
// shapes:
//   - "full"   → the whole checklist (config dialog): local check summary +
//                host guidance (rendered markdown) + controls.
//   - "banner" → a compact warning shown at commit time when the local check
//                fails; expandable to the full checklist.
//
// It renders the markdown the pure generator already produced — single source
// of truth. No git here; the caller supplies the AuditProtection object.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { AuditProtection } from "../hooks/useAuditProtection";

interface AuditProtectionPanelProps {
  protection: AuditProtection;
  variant?: "full" | "banner";
}

/** Markdown rendered with GitHub-flavoured extensions (task lists, tables). */
const Markdown: React.FC<{ children: string }> = ({ children }) => (
  <Box
    sx={{
      "& h1": { fontSize: "1.1rem", mt: 1, mb: 0.5 },
      "& h2": { fontSize: "0.95rem", mt: 1.5, mb: 0.5 },
      "& ul": { pl: 3, my: 0.5 },
      "& code": {
        px: 0.5,
        borderRadius: 0.5,
        bgcolor: "action.hover",
        fontSize: "0.8rem",
      },
      "& a": { wordBreak: "break-all" },
    }}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </Box>
);

export const AuditProtectionPanel: React.FC<AuditProtectionPanelProps> = ({
  protection,
  variant = "full",
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { result, markdown, loading } = protection;

  const copy = () => {
    if (markdown) void navigator.clipboard?.writeText(markdown);
  };

  // Nothing to show until a manifest exists (anchor found).
  if (!result) {
    if (variant === "banner") return null;
    return (
      <Alert severity="info">
        {t("audit.protection.noTrail", {
          defaultValue:
            "No audit trail yet — the checklist appears once the signer manifest is committed.",
        })}
      </Alert>
    );
  }

  const issueCount =
    (result.allSigned.ok ? 0 : 1) +
    (result.linearHistory.ok ? 0 : 1) +
    (result.anchorTag === "ok" ? 0 : 1);

  // ── Banner (commit dialog): only when there is a real violation ──
  if (variant === "banner") {
    if (result.localOk || protection.dismissed) return null;
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? t("audit.protection.hide", { defaultValue: "Hide" })
              : t("audit.protection.details", { defaultValue: "Details" })}
          </Button>
        }
        sx={{ mb: 2 }}
      >
        <AlertTitle>
          {t("audit.protection.bannerTitle", {
            defaultValue: "Audit trail protection: {{count}} issue(s)",
            count: issueCount,
          })}
        </AlertTitle>
        {!result.allSigned.ok &&
          t("audit.protection.unsignedShort", {
            defaultValue: "{{n}} commit(s) not signed/authorized. ",
            n: result.allSigned.unsigned.length,
          })}
        {!result.linearHistory.ok &&
          t("audit.protection.mergesShort", {
            defaultValue: "{{n}} merge commit(s) break linear history. ",
            n: result.linearHistory.merges.length,
          })}
        {result.anchorTag !== "ok" &&
          t("audit.protection.anchorShort", {
            defaultValue: "Anchor tag {{state}}. ",
            state: result.anchorTag,
          })}
        <Collapse in={expanded} unmountOnExit>
          <Box sx={{ mt: 1 }}>
            <Markdown>{markdown}</Markdown>
          </Box>
        </Collapse>
      </Alert>
    );
  }

  // ── Full (config dialog) ──
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void protection.refresh()}
          disabled={loading}
        >
          {t("audit.protection.recheck", { defaultValue: "Re-check" })}
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<ContentCopyIcon />}
          onClick={copy}
        >
          {t("audit.protection.copy", { defaultValue: "Copy as Markdown" })}
        </Button>
      </Box>

      {result.localOk ? (
        <Alert severity="success">
          {t("audit.protection.allGood", {
            defaultValue:
              "All locally verifiable checks pass. Complete the host settings below to prevent history rewrites.",
          })}
        </Alert>
      ) : (
        <Alert severity="warning">
          {t("audit.protection.someFail", {
            defaultValue:
              "Some locally verifiable checks failed — see below.",
          })}
        </Alert>
      )}

      <Markdown>{markdown}</Markdown>

      <FormControlLabel
        control={
          <Checkbox
            checked={protection.dismissed}
            onChange={(e) => protection.setDismissed(e.target.checked)}
          />
        }
        label={t("audit.protection.dontAutoShow", {
          defaultValue: "Don't warn me at commit time for this repository",
        })}
      />

      <Typography variant="caption" color="text.secondary">
        {t("audit.protection.hostNote", {
          defaultValue:
            "Host settings can't be verified locally — this is guidance, not a live status check.",
        })}
      </Typography>
    </Box>
  );
};

export default AuditProtectionPanel;
