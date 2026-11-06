// ==================== NEW ASSET (DESCRIPTION VIEW) ====================
// "+" in the Assets accordion of the description view (user 2026-11-06): a
// new asset by name and category, not tied to an element yet — linked later
// from an element form, the Asset tab or the asset graph. Uses the same
// creation as the element forms (onCreateAsset of the DFD tab).

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { ASSET_GROUP_CONFIG, type AssetGroup } from "shared";

export interface NewAssetInlineProps {
  onCreate: (name: string, group: AssetGroup) => void;
  onCancel: () => void;
}

const GROUPS = Object.keys(ASSET_GROUP_CONFIG) as AssetGroup[];

export const NewAssetInline: React.FC<NewAssetInlineProps> = ({ onCreate, onCancel }) => {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<AssetGroup>("data");
  const create = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), group);
    setName("");
  };
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5 }} data-testid="new-asset-inline">
      <TextField
        size="small"
        autoFocus
        label={t("tabs.dfd.element_description.newAsset.name", { defaultValue: "Name" })}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
          if (e.key === "Escape") onCancel();
        }}
        inputProps={{ "data-testid": "new-asset-name" }}
        sx={{ flex: 1 }}
      />
      <TextField
        select
        size="small"
        label={t("tabs.dfd.element_description.newAsset.group", { defaultValue: "Category" })}
        value={group}
        onChange={(e) => setGroup(e.target.value as AssetGroup)}
        inputProps={{ "data-testid": "new-asset-group" }}
        sx={{ minWidth: 160 }}
      >
        {GROUPS.map((g) => (
          <MenuItem key={g} value={g}>
            {i18n.language === "de" ? ASSET_GROUP_CONFIG[g].labelDE : ASSET_GROUP_CONFIG[g].label}
          </MenuItem>
        ))}
      </TextField>
      <Button size="small" variant="contained" disabled={!name.trim()} onClick={create} data-testid="new-asset-create">
        {t("tabs.dfd.element_description.newAsset.create", { defaultValue: "Create" })}
      </Button>
      <Button size="small" onClick={onCancel}>
        {t("common.cancel", { defaultValue: "Cancel" })}
      </Button>
    </Stack>
  );
};
