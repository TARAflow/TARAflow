// ==================== MITIGATION SCOPE SELECTOR ====================
// Shown inside the Risk Dialog for per-interaction threats.
// Lets analyst select which interaction roles a mitigation should address.
//
// Only rendered when:
//   - Risk.sourceStrideMethod === "per-interaction"
//   - Mitigation is selected (checkbox checked)
//   - Catalog entry has multiple roles in affectsProperties
//
// Location: src/features/risks/components/mitigation-scope-selector.tsx

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import type { SelectedMitigation } from "../models/risk-types";
import type { MitigationPropertyRole } from "shared";
import type { MitigationEntry } from "../../threats/models/threat-types";

// ==================== ROLE CONFIG ====================

const ROLE_CONFIG: Record<
  MitigationPropertyRole,
  { label: string; icon: React.ReactNode; tooltip: string }
> = {
  source: {
    label: "Sender",
    icon: <CallMadeIcon sx={{ fontSize: 14 }} />,
    tooltip: "Applies to the sending element (source process or external entity)",
  },
  target: {
    label: "Receiver",
    icon: <CallReceivedIcon sx={{ fontSize: 14 }} />,
    tooltip: "Applies to the receiving element (target process or external entity)",
  },
  channel: {
    label: "Channel",
    icon: <SwapHorizIcon sx={{ fontSize: 14 }} />,
    tooltip: "Applies to the data flow channel itself",
  },
};

// ==================== PROPS ====================

interface MitigationScopeSelectorProps {
  mitigationId: string;
  selectedMitigation: SelectedMitigation;
  catalog: MitigationEntry[];
  onChange: (roles: MitigationPropertyRole[] | undefined) => void;
}

// ==================== COMPONENT ====================

export const MitigationScopeSelector: React.FC<MitigationScopeSelectorProps> = ({
  mitigationId,
  selectedMitigation,
  catalog,
  onChange,
}) => {
  const { t } = useTranslation();

  // Collect unique roles from catalog affectsProperties
  const availableRoles = useMemo((): MitigationPropertyRole[] => {
    const entry = catalog.find((m) => m.id === mitigationId);
    if (!entry?.affectsProperties?.length) return [];

    const roles = new Set<MitigationPropertyRole>();
    for (const effect of entry.affectsProperties) {
      if (effect.role) roles.add(effect.role);
    }
    return Array.from(roles);
  }, [catalog, mitigationId]);

  // Only render if there are multiple roles to choose from
  if (availableRoles.length <= 1) return null;

  // Active roles: scopeOverride if set, else all available
  const activeRoles = selectedMitigation.scopeOverride ?? availableRoles;

  const handleToggle = (role: MitigationPropertyRole) => {
    const current = activeRoles;
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];

    // If all roles selected → remove override (use catalog defaults)
    if (next.length === availableRoles.length) {
      onChange(undefined);
    } else {
      onChange(next.length > 0 ? next : availableRoles); // never allow empty selection
    }
  };

  const isOverrideActive = selectedMitigation.scopeOverride !== undefined;

  return (
    <Box
      sx={{
        mt: 0.5,
        ml: 4,
        pl: 1,
        borderLeft: "2px solid",
        borderColor: isOverrideActive ? "warning.main" : "divider",
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.disabled", display: "block", mb: 0.5 }}
      >
        {t("tabs.risks.dialog.scope.label", {
          defaultValue: "Applies to:",
        })}
        {isOverrideActive && (
          <Typography
            component="span"
            variant="caption"
            sx={{ color: "warning.main", ml: 0.5 }}
          >
            {t("tabs.risks.dialog.scope.overridden", {
              defaultValue: "(overridden)",
            })}
          </Typography>
        )}
      </Typography>

      <Stack direction="row" spacing={1}>
        {availableRoles.map((role) => {
          const config = ROLE_CONFIG[role];
          const checked = activeRoles.includes(role);

          return (
            <Tooltip key={role} title={config.tooltip} placement="top">
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={checked}
                    onChange={() => handleToggle(role)}
                    sx={{ py: 0.25 }}
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {config.icon}
                    <Typography variant="caption">{config.label}</Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
};

export default MitigationScopeSelector;