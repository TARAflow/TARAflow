// features/assets/components/asset-link-chips.tsx
//
// Read-only chips for an asset's asset-to-asset links ("Asset Links"). Each
// chip reads from the listed asset: the stored type where it is the source
// ("required_by FU-001", filled), the inverse name where it is the target
// ("requires DA-002", outlined). The tooltip states the stored edge as a
// sentence plus its type key.

import React from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { assetLinkEnds, assetLinkLabel, type AssetLink } from "../utils/asset-links";

interface AssetLinkChipsProps {
  links: readonly AssetLink[];
}

export const AssetLinkChips: React.FC<AssetLinkChipsProps> = ({ links }) => {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
      {links.map((l) => {
        const ends = assetLinkEnds(l);
        return (
          <Tooltip
            key={`${l.direction}-${l.otherId}-${l.relationType}`}
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" display="block">
                  {t(`assets.relations.a2a.sentence.${l.relationType}`, {
                    defaultValue: "{{source}} " + l.relationType + " {{target}}",
                    source: ends.source,
                    target: ends.target,
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.7)"
                  sx={{ fontFamily: "monospace", mt: 0.25 }}
                >
                  {l.relationType}
                </Typography>
              </Box>
            }
          >
            <Chip
              label={assetLinkLabel(l)}
              size="small"
              variant={l.direction === "out" ? "filled" : "outlined"}
              data-direction={l.direction}
              sx={{
                fontSize: "0.65rem",
                height: "auto",
                py: 0.25,
                fontFamily: "monospace",
                "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.3 },
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
};
