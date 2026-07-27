// src/features/attacktree/components/attacktree-path-dialog.tsx
//
// Per-path assessment dialog (relevance + mitigation + verification), moved out
// of the table row. Its STRUCTURE echoes ThreatEvalDialog (sidebar list with
// progress, scrolling content pane, Prev/Next footer) but the body is
// path-specific: one section per STRIDE category the path attacks, each with its
// own relevance control and STRIDE-filtered mitigation/verification pickers, and
// ONE shared note per path at the bottom.
//
// Fully controlled / immediate-save: every relevance toggle and every catalogue
// add/remove routes through the hook's savePath -> onAssessmentsChange straight
// away — there is no local draft or dirty state, and "Next"/"Back" are pure
// navigation. The note is the single field committed on blur (per-keystroke disk
// autosave would be wasteful) but writes the same way.
//
// Catalogue data arrives as a plain CatalogItem[] — this component NEVER imports
// from features/threats. The one boundary-crossing catalogue fetch is contained
// in the app layer (see attacktree-path-dialog-design.md).

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as PrevIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
  Close as RemoveIcon,
  CheckCircle as CheckIcon,
  Search as SearchIcon,
  ShieldOutlined as MitigationIcon,
  FactCheckOutlined as VerificationIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { StrideCategory, ThreatRelevanceRef } from "shared";
import { RELEVANCE_COLORS } from "shared";
import type { AttackPath, AttackPathAssessment } from "../models/attacktree-types";
import { strideCategoriesForPath } from "../services/attacktree-threat-generator";
import { isPathAssessmentComplete } from "../services/attacktree-threat-sync";
import type { AttackPathDialog, PerStrideDecision } from "../hooks/use-attack-path-dialog";

const RELEVANCE_OPTIONS: ThreatRelevanceRef[] = [
  "relevant",
  "not_relevant",
  "uncertain",
];

/**
 * A plain catalogue row — assembled ONCE at the app layer (the single contained
 * features/threats boundary crossing) and passed down. STRIDE-filtered by the
 * dialog per section.
 */
export interface CatalogItem {
  id: string;
  strideCategory: StrideCategory;
  text: string;
}

/** Human-readable path label: the leaf node name, falling back to the display id. */
function pathLabel(p: AttackPath): string {
  return p.path[p.path.length - 1] || p.id;
}

// ==================== CATALOGUE PICKER ====================
// Adapted from create-threat-dialog.tsx's CatalogList, but keyed on `id`
// (not display text) and with an add/remove affordance: click a row to add,
// selected rows show struck-through + a check, chips above remove on delete.

const CatalogPicker: React.FC<{
  label: string;
  icon: React.ReactNode;
  suggestions: CatalogItem[]; // already STRIDE-filtered
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ label, icon, suggestions, selectedIds, onAdd, onRemove }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const selected = useMemo(
    () =>
      selectedIds.map(
        (id) =>
          suggestions.find((s) => s.id === id) ?? {
            id,
            strideCategory: "" as StrideCategory,
            text: id,
          },
      ),
    [selectedIds, suggestions],
  );

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return suggestions;
    return suggestions.filter(
      (s) =>
        s.text.toLowerCase().includes(f) || s.id.toLowerCase().includes(f),
    );
  }, [suggestions, filter]);

  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight="medium">
          {label}
        </Typography>
      </Stack>

      {selected.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
          {selected.map((s) => (
            <Chip
              key={s.id}
              size="small"
              label={s.text}
              onDelete={() => onRemove(s.id)}
              deleteIcon={<RemoveIcon />}
            />
          ))}
        </Stack>
      )}

      {suggestions.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {t("attacktree:tabs.attacktree.pathDialog.noCatalog", {
            defaultValue: "No catalogue entries for this category.",
          })}
        </Typography>
      ) : (
        <>
          {suggestions.length > 8 && (
            <TextField
              size="small"
              fullWidth
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("attacktree:tabs.attacktree.pathDialog.filter", {
                defaultValue: "filter…",
              })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 0.5 }}
            />
          )}
          <List
            dense
            disablePadding
            sx={{
              bgcolor: "grey.50",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              maxHeight: 140,
              overflow: "auto",
            }}
          >
            {shown.map((s) => {
              const added = selectedIds.includes(s.id);
              return (
                <ListItemButton
                  key={s.id}
                  dense
                  disabled={added}
                  onClick={() => onAdd(s.id)}
                  sx={{ py: 0.5, px: 1, opacity: added ? 0.5 : 1 }}
                >
                  {added ? (
                    <CheckIcon
                      sx={{ fontSize: 14, color: "success.main", mr: 0.5, flexShrink: 0 }}
                    />
                  ) : (
                    <AddIcon
                      sx={{ fontSize: 14, color: "primary.main", mr: 0.5, flexShrink: 0 }}
                    />
                  )}
                  <ListItemText
                    primary={s.text}
                    primaryTypographyProps={{
                      variant: "caption",
                      sx: {
                        lineHeight: 1.4,
                        textDecoration: added ? "line-through" : "none",
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </>
      )}
    </Box>
  );
};

// ==================== DIALOG ====================

export interface AttackPathDialogProps {
  dialog: AttackPathDialog;
  paths: readonly AttackPath[];
  assessments: readonly AttackPathAssessment[];
  mitigationCatalog: readonly CatalogItem[];
  verificationCatalog: readonly CatalogItem[];
  /** Header context — the tree's display title. */
  title: string;
}

export const AttackPathAssessmentDialog: React.FC<AttackPathDialogProps> = ({
  dialog,
  paths,
  assessments,
  mitigationCatalog,
  verificationCatalog,
  title,
}) => {
  const { t, i18n } = useTranslation();
  const {
    openPathKey,
    openIndex,
    hasPrev,
    hasNext,
    progress,
    open,
    close,
    goPrev,
    goNext,
    savePath,
  } = dialog;

  const relevanceLabel: Record<ThreatRelevanceRef, string> = useMemo(
    () => ({
      unrated: t("attacktree:tabs.attacktree.threatTable.unrated"),
      relevant: t("attacktree:tabs.attacktree.threatTable.confirmed"),
      not_relevant: t("attacktree:tabs.attacktree.threatTable.dismissed"),
      uncertain: t("attacktree:tabs.attacktree.threatTable.uncertain"),
    }),
    [i18n.language, t],
  );

  const path = useMemo(
    () =>
      openPathKey == null
        ? undefined
        : paths.find((p) => p.pathKey === openPathKey),
    [paths, openPathKey],
  );

  const strides = useMemo(
    () => (path ? strideCategoriesForPath(path) : []),
    [path],
  );

  // Source of truth for the open path's current values = the assessments prop.
  const byStride = useMemo(() => {
    const m = new Map<StrideCategory, AttackPathAssessment>();
    if (openPathKey != null) {
      for (const a of assessments) {
        if (a.pathKey === openPathKey) m.set(a.strideCategory, a);
      }
    }
    return m;
  }, [assessments, openPathKey]);

  const storedNote = useMemo(() => {
    for (const a of byStride.values()) if (a.evalNote) return a.evalNote;
    return "";
  }, [byStride]);

  // The one non-immediate field: edited locally, committed on blur / navigate.
  const [noteDraft, setNoteDraft] = useState("");
  // Reseed only when the open path changes — NOT when storedNote changes from
  // our own save, which would fight the user's typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setNoteDraft(storedNote), [openPathKey]);

  if (path == null) return null;
  const currentPath = path;

  const decisionFor = (stride: StrideCategory): PerStrideDecision => {
    const a = byStride.get(stride);
    return {
      relevance: a?.relevance ?? "unrated",
      mitigationIds: a?.mitigationIds ?? [],
      verificationIds: a?.verificationIds ?? [],
    };
  };

  // Immediate write of one stride, carrying the (possibly still-unsaved) note so
  // a pending note edit is never lost when toggling relevance or editing chips.
  const writeStride = (
    stride: StrideCategory,
    patch: Partial<PerStrideDecision>,
  ) => {
    const next = { ...decisionFor(stride), ...patch };
    savePath(currentPath.pathKey, { [stride]: next }, noteDraft || undefined);
  };

  const commitNote = () => {
    if (noteDraft === storedNote) return;
    const map: Partial<Record<StrideCategory, PerStrideDecision>> = {};
    for (const s of strides) map[s] = decisionFor(s);
    savePath(currentPath.pathKey, map, noteDraft || undefined);
  };

  const setRelevance = (stride: StrideCategory, next: ThreatRelevanceRef | null) =>
    writeStride(stride, { relevance: next ?? "unrated" });

  const addMit = (stride: StrideCategory, id: string) => {
    const cur = decisionFor(stride).mitigationIds;
    if (!cur.includes(id)) writeStride(stride, { mitigationIds: [...cur, id] });
  };
  const removeMit = (stride: StrideCategory, id: string) =>
    writeStride(stride, {
      mitigationIds: decisionFor(stride).mitigationIds.filter((x) => x !== id),
    });

  const addVer = (stride: StrideCategory, id: string) => {
    const cur = decisionFor(stride).verificationIds;
    if (!cur.includes(id)) writeStride(stride, { verificationIds: [...cur, id] });
  };
  const removeVer = (stride: StrideCategory, id: string) =>
    writeStride(stride, {
      verificationIds: decisionFor(stride).verificationIds.filter((x) => x !== id),
    });

  return (
    <Dialog
      open={openPathKey != null}
      onClose={close}
      maxWidth={false}
      PaperProps={{
        sx: { width: 1000, height: 700, maxWidth: "95vw", maxHeight: "90vh" },
      }}
    >
      <DialogTitle sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight={500} noWrap>
            {title}
          </Typography>
          <Chip
            size="small"
            label={pathLabel(currentPath)}
            sx={{ maxWidth: 240 }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── sidebar: every path + progress ──────────────────────────────── */}
        <Box
          sx={{
            width: 200,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}
          >
            {t("attacktree:tabs.attacktree.pathDialog.progress", {
              complete: progress.complete,
              total: progress.total,
              defaultValue: `${progress.complete} / ${progress.total} complete`,
            })}
          </Typography>
          <List dense sx={{ overflow: "auto", flex: 1 }}>
            {paths.map((p) => {
              const ss = strideCategoriesForPath(p);
              const done =
                ss.length > 0 &&
                ss.every((s) => {
                  const a = assessments.find(
                    (x) => x.pathKey === p.pathKey && x.strideCategory === s,
                  );
                  return a ? isPathAssessmentComplete(a) : false;
                });
              return (
                <ListItemButton
                  key={p.pathKey}
                  selected={p.pathKey === openPathKey}
                  onClick={() => open(p.pathKey)}
                >
                  {done ? (
                    <CheckIcon
                      sx={{ fontSize: 16, color: "success.main", mr: 1 }}
                    />
                  ) : (
                    <Box sx={{ width: 16, mr: 1 }} />
                  )}
                  <ListItemText
                    primary={pathLabel(p)}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* ── content: per-STRIDE sections + note, scrolls ────────────────── */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            p: 2,
            overflowY: "auto",
          }}
        >
          <Stack spacing={1.5}>
            {/* path context — chain + feasibility so the analyst sees what they're rating */}
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                bgcolor: "grey.50",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t("attacktree:tabs.attacktree.pathDialog.attackPath", {
                  defaultValue: "Attack path",
                })}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  my: 0.5,
                  wordBreak: "break-word",
                }}
              >
                {currentPath.path.join("  ›  ")}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {currentPath.feasibilityLevel && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(
                      `attacktree:tabs.attacktree.feasibility.level.${currentPath.feasibilityLevel}`,
                    )}
                  />
                )}
                {currentPath.riskScore != null && currentPath.riskScore > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {t("attacktree:tabs.attacktree.tableview.riskScore", {
                      defaultValue: "Risk score",
                    })}
                    : {currentPath.riskScore.toFixed(1)}
                  </Typography>
                )}
              </Stack>
            </Box>

            {strides.map((stride) => {
              const d = decisionFor(stride);
              const collapsed = d.relevance === "not_relevant";
              return (
                <Box
                  key={stride}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {t(`common:stride.${stride}.name`, {
                      defaultValue: stride,
                    })}{" "}
                    ({stride})
                  </Typography>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={d.relevance}
                    sx={{
                      "& .Mui-selected": {
                        color: "#fff !important",
                        bgcolor: `${RELEVANCE_COLORS[d.relevance]} !important`,
                      },
                    }}
                    onChange={(_e, next) =>
                      setRelevance(stride, next as ThreatRelevanceRef | null)
                    }
                  >
                    {RELEVANCE_OPTIONS.map((opt) => (
                      <ToggleButton
                        key={opt}
                        value={opt}
                        aria-label={relevanceLabel[opt]}
                        sx={{ py: 0, px: 1, fontSize: "0.7rem" }}
                      >
                        {relevanceLabel[opt]}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  {collapsed ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 1 }}
                    >
                      {t(
                        "attacktree:tabs.attacktree.pathDialog.noMeasureNeeded",
                        {
                          defaultValue: "Not relevant — no measure required.",
                        },
                      )}
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 1.5,
                        mt: 1.5,
                      }}
                    >
                      <CatalogPicker
                        label={t(
                          "attacktree:tabs.attacktree.pathDialog.mitigation",
                          {
                            defaultValue: "Mitigation",
                          },
                        )}
                        icon={
                          <MitigationIcon
                            sx={{ fontSize: 14, color: "text.secondary" }}
                          />
                        }
                        suggestions={mitigationCatalog.filter(
                          (m) => m.strideCategory === stride,
                        )}
                        selectedIds={d.mitigationIds}
                        onAdd={(id) => addMit(stride, id)}
                        onRemove={(id) => removeMit(stride, id)}
                      />
                      <CatalogPicker
                        label={t(
                          "attacktree:tabs.attacktree.pathDialog.verification",
                          {
                            defaultValue: "Verification",
                          },
                        )}
                        icon={
                          <VerificationIcon
                            sx={{ fontSize: 14, color: "text.secondary" }}
                          />
                        }
                        suggestions={verificationCatalog.filter(
                          (v) => v.strideCategory === stride,
                        )}
                        selectedIds={d.verificationIds}
                        onAdd={(id) => addVer(stride, id)}
                        onRemove={(id) => removeVer(stride, id)}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* note — bottom, shared per path */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("attacktree:tabs.attacktree.pathDialog.note", {
                  defaultValue: "Note (whole path)",
                })}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={commitNote}
              />
            </Box>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{ borderTop: 1, borderColor: "divider", px: 2, py: 1 }}
      >
        <Button
          size="small"
          startIcon={<PrevIcon />}
          disabled={!hasPrev}
          onClick={goPrev}
        >
          {t("attacktree:tabs.attacktree.pathDialog.prev", {
            defaultValue: "Back",
          })}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {t("attacktree:tabs.attacktree.pathDialog.position", {
            current: openIndex + 1,
            total: paths.length,
            defaultValue: `Path ${openIndex + 1} of ${paths.length}`,
          })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          endIcon={<NextIcon />}
          disabled={!hasNext}
          onClick={goNext}
        >
          {t("attacktree:tabs.attacktree.pathDialog.next", {
            defaultValue: "Next",
          })}
        </Button>
        <Button size="small" variant="contained" onClick={close}>
          {t("common.ok", { defaultValue: "OK" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
