// features/threats/components/shared/catalog-entry-picker.tsx
//
// "Add from catalog" for an analyst-authored threat (custom mitigation
// catalog design CM-1): the entries of the threat's STRIDE category that are
// not on the list yet. The pick is stored as { id } — the closed loop keys on
// catalog ids.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete, Button, TextField } from "@mui/material";
import type { StrideCategory } from "shared";
import {
  getAllMitigations,
  getAllVerifications,
  getLocalizedMitigation,
  getLocalizedVerification,
} from "../../services/threat-catalog-service";
import { catalogMatchFor } from "../../services/catalog-draft-ops";
import { isProjectMitigationId } from "../../services/project-mitigations";
import { useMitigationCatalogVersion } from "shared/hooks/use-mitigation-catalog-version";

interface CatalogEntryPickerProps {
  kind: "mitigation" | "verification";
  strideCategory: StrideCategory;
  /** Catalog ids already on the threat. */
  presentIds: readonly (string | undefined)[];
  onPick: (id: string) => void;
  /** "project": only project mitigations M-C-nnn (generated threats, CM-3). */
  scope?: "all" | "project";
}

export const CatalogEntryPicker: React.FC<CatalogEntryPickerProps> = ({
  kind,
  strideCategory,
  presentIds,
  onPick,
  scope = "all",
}) => {
  const { t } = useTranslation();
  // Remount after a pick so the field clears.
  const [round, setRound] = useState(0);
  const catalogVersion = useMitigationCatalogVersion();
  const options = useMemo(() => {
    const present = new Set(presentIds.filter(Boolean));
    const entries = kind === "mitigation" ? getAllMitigations() : getAllVerifications();
    const localize = kind === "mitigation" ? getLocalizedMitigation : getLocalizedVerification;
    return entries
      .filter((e) => e.strideCategory === strideCategory && !present.has(e.id))
      .filter((e) => scope === "all" || isProjectMitigationId(e.id))
      .map((e) => ({ id: e.id, label: `${e.id} — ${localize(e.id)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, strideCategory, presentIds, catalogVersion, scope]);

  if (options.length === 0) return null;
  return (
    <Autocomplete
      key={round}
      size="small"
      options={options}
      getOptionLabel={(o) => o.label}
      onChange={(_, o) => {
        if (!o) return;
        onPick(o.id);
        setRound((r) => r + 1);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={
            kind === "mitigation"
              ? t("tabs.threats.dialog.addMitigationFromCatalog", { defaultValue: "Add mitigation from catalog" })
              : t("tabs.threats.dialog.addVerificationFromCatalog", { defaultValue: "Add verification from catalog" })
          }
          inputProps={{ ...params.inputProps, "data-testid": `catalog-picker-${kind}` }}
        />
      )}
      sx={{ mb: 1 }}
    />
  );
};

/**
 * "Link to M-S-001" on a free-text entry whose text equals a catalog entry
 * (design §3.3: offered, never applied automatically).
 */
export const LinkToCatalogButton: React.FC<{
  kind: "mitigation" | "verification";
  text: string | undefined;
  onLink: (id: string) => void;
}> = ({ kind, text, onLink }) => {
  const { t } = useTranslation();
  const catalogVersion = useMitigationCatalogVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const id = useMemo(() => catalogMatchFor(kind, text), [kind, text, catalogVersion]);
  if (!id) return null;
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() => onLink(id)}
      sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
      data-testid={`link-catalog-${id}`}
    >
      {t("tabs.threats.dialog.linkToCatalog", { defaultValue: "Link to {{id}}", id })}
    </Button>
  );
};
