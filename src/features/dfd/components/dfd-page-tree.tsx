// ==================== DFD PAGE TREE ====================
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12 "Page
// tree"): root page and child pages in tree order, the page shown in
// draw.io highlighted, finding counts per page. A click opens the page.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { PageOutline } from "../services/leveled";

export interface DFDPageTreeProps {
  outline: PageOutline;
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
}

export const DFDPageTree: React.FC<DFDPageTreeProps> = ({
  outline,
  currentPageId,
  onSelectPage,
}) => {
  const { t } = useTranslation();
  return (
    <Box
      data-testid="dfd-page-tree"
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        overflow: "auto",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="overline" sx={{ px: 1.5, display: "block" }}>
        {t("tabs.dfd.pageTree.title", { defaultValue: "Pages" })}
      </Typography>
      <List dense disablePadding>
        {outline.nodes.map((node) => {
          const placed = node.depth !== undefined;
          return (
            <ListItemButton
              key={node.pageId}
              selected={node.pageId === currentPageId}
              onClick={() => onSelectPage(node.pageId)}
              data-testid={`page-tree-${node.pageId}`}
              sx={{ pl: 1.5 + 2 * (node.depth ?? 0) }}
            >
              <ListItemText
                primary={node.name || node.pageId}
                primaryTypographyProps={{ noWrap: true, fontWeight: node.depth === 0 ? 600 : 400 }}
                secondary={
                  node.decomposes ? (
                    <>
                      {node.decomposes.label}
                      {node.pendingDecomposition && (
                        <Typography component="span" variant="caption" display="block" color="text.secondary">
                          {t("tabs.dfd.pageTree.pendingDecomposition", {
                            defaultValue: "no part of its own yet — the multiprocess is analysed as a whole",
                          })}
                        </Typography>
                      )}
                    </>
                  ) : !placed ? (
                    t("tabs.dfd.pageTree.notPlaced", { defaultValue: "not in the page tree" })
                  ) : undefined
                }
                secondaryTypographyProps={{ component: "div", variant: "caption" }}
              />
              <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                {node.errors > 0 && (
                  <Tooltip title={t("tabs.dfd.pageTree.errors", { defaultValue: "Errors on this page" })}>
                    <Chip size="small" color="error" label={node.errors} data-testid={`page-tree-errors-${node.pageId}`} />
                  </Tooltip>
                )}
                {node.warnings > 0 && (
                  <Tooltip title={t("tabs.dfd.pageTree.warnings", { defaultValue: "Warnings on this page" })}>
                    <Chip size="small" color="warning" label={node.warnings} data-testid={`page-tree-warnings-${node.pageId}`} />
                  </Tooltip>
                )}
              </Stack>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default DFDPageTree;
