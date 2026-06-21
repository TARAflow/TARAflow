// ==================== SecurityControlOwnershipDisplay ====================
// Reusable read-only component for all element forms.
// Shows the audit trail of intentionally applied security controls.
// Place in a new file: src/features/dfd/components/forms/security-control-ownership-display.tsx

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  Tooltip,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import type { SecurityControlRecord } from "../../models/element-shared-types";

interface SecurityControlOwnershipDisplayProps {
  records: SecurityControlRecord[];
}

export const SecurityControlOwnershipDisplay: React.FC<
  SecurityControlOwnershipDisplayProps
> = ({ records }) => {
  const { t } = useTranslation();

  if (!records || records.length === 0) return null;

  return (
    <Box>
      <Box sx={{ pt: 1 }}>
        <Typography
          variant="overline"
          sx={{ color: "text.disabled", fontSize: "0.65rem", letterSpacing: 1.5 }}
        >
          {t("tabs.dfd.element_description.securityControls.ownership.title", {
            defaultValue: "Applied Security Controls",
          })}
        </Typography>
        <Divider sx={{ mt: 0.5, mb: 1.5 }} />
      </Box>

      <Stack spacing={0.75}>
        {records.map((record, idx) => (
          <Box
            key={`${record.property}-${idx}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 0.75,
              bgcolor: "success.50",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "success.200",
            }}
          >
            <CheckCircleOutlineIcon
              sx={{ fontSize: 14, color: "success.dark", flexShrink: 0 }}
            />

            {/* Property = value */}
            <Typography
              variant="caption"
              sx={{ fontFamily: "monospace", color: "text.primary", flexShrink: 0 }}
            >
              {record.property}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0 }}>
              =
            </Typography>
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ color: "success.dark", flexShrink: 0 }}
            >
              {String(record.value)}
            </Typography>

            {/* Source badge */}
            <Tooltip
              title={
                record.setBy === "apply_suggestion"
                  ? `${t("tabs.dfd.element_description.securityControls.ownership.appliedVia", { defaultValue: "Applied via mitigation" })} ${record.mitigationId ?? ""}`
                  : t("tabs.dfd.element_description.securityControls.ownership.setManually", { defaultValue: "Set manually by analyst" })
              }
              placement="top"
            >
              <Chip
                icon={
                  record.setBy === "apply_suggestion"
                    ? <AutoFixHighIcon sx={{ fontSize: "0.65rem !important" }} />
                    : <PersonOutlineIcon sx={{ fontSize: "0.65rem !important" }} />
                }
                label={
                  record.setBy === "apply_suggestion"
                    ? t("tabs.dfd.element_description.securityControls.ownership.suggested", { defaultValue: "Suggested" })
                    : t("tabs.dfd.element_description.securityControls.ownership.manual", { defaultValue: "Manual" })
                }
                size="small"
                color={record.setBy === "apply_suggestion" ? "success" : "default"}
                variant="outlined"
                sx={{ height: 16, fontSize: "0.55rem", flexShrink: 0, cursor: "help" }}
              />
            </Tooltip>

            {/* Timestamp */}
            <Typography
              variant="caption"
              sx={{ color: "text.disabled", fontStyle: "italic", flexGrow: 1, textAlign: "right" }}
            >
              {new Date(record.setAt).toLocaleDateString()}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default SecurityControlOwnershipDisplay;
