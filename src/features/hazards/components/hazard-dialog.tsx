// features/hazards/components/hazard-dialog.tsx
//
// Bowtie editor for a single Hazard Item. Center = the hazard; left = causes
// (contributes_to); right = protection targets (endangers). Edges are added via
// Autocomplete over eligibleAssets(); severity from resolveSeverityScale().
//
// Inline asset creation (quick-capture, doc §4.2) is now LOCAL: the dialog mints
// a CreatedAsset via the shared createAsset() primitive, attaches the edge to the
// new id immediately, and collects the created assets. On save they are handed up
// (onSave's second argument) so the tab/app can fold them into dfd.assets. No
// callback injection, no hook chain.
//
// The dialog edits a DRAFT HazardData; the parent's data is untouched until onSave.
// Connector routing is kept to directional arrows here — full SVG path routing is
// reserved for the Tripartite Flow (D3) step.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Grid,
  Paper,
  Stack,
  Chip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Alert,
  Divider,
  createFilterOptions,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  TrendingFlat as ArrowIcon,
  Warning as HazardIcon,
} from "@mui/icons-material";

import type {
  AssetReference,
  ContributesToRelation,
  CreatedAsset,
  EndangersRelation,
  HazardCategory,
  HazardImpact,
  HazardItemId,
  HazardTargetKind,
  PhysicalHazardPotential,
  SafetyRelevance,
} from "shared";
import {
  isContributesTo,
  isEndangers,
  createAsset as createAssetSeed,
} from "shared";

import type { HazardData } from "../models/hazard-data-types";
import { hazardService } from "../services/hazard-service";
import { hazardRelationService } from "../services/hazard-relation-service";
import {
  eligibleAssets,
  targetKindForAssetGroup,
  HAZARD_CONTRIBUTOR_GROUPS,
  HAZARD_TARGET_GROUPS,
} from "../services/eligible-assets-service";
import { resolveSeverityScale } from "../services/severity-scale-service";

// ==================== CONSTANTS ====================

const HAZARD_CATEGORIES: HazardCategory[] = [
  "mechanical",
  "electrical",
  "thermal",
  "noise",
  "vibration",
  "radiation",
  "material_substance",
  "ergonomic",
  "environment",
  "combined",
  "other",
];

const PHYSICAL_HAZARD_POTENTIALS: PhysicalHazardPotential[] = [
  "low",
  "medium",
  "high",
];
const CONTRIBUTOR_RELEVANCE: Exclude<SafetyRelevance, "none">[] = ["indirect", "direct"];

// ==================== HELPERS ====================

function humanize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function makeImpact(kind: HazardTargetKind, severity: string): HazardImpact {
  return { target: kind, severity } as HazardImpact;
}

function seedToRef(a: CreatedAsset): AssetReference {
  return {
    id: a.id,
    name: a.name,
    assetGroup: a.assetGroup,
    hasSafetyAnnotation: false,
  };
}

const FieldCol: React.FC<{
  label: string;
  grow?: boolean;
  children: React.ReactNode;
}> = ({ label, grow, children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      ...(grow ? { flex: 1, minWidth: 0 } : {}),
    }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    {children}
  </Box>
);

// ==================== ASSET PICKER (select existing or create new) ====================

type CreateOption = { create: true; name: string };
type PickerOption = AssetReference | CreateOption;

const assetFilter = createFilterOptions<PickerOption>({
  stringify: (o) => ("create" in o ? o.name : `${o.id} ${o.name}`),
});

const AssetPicker: React.FC<{
  label: string;
  options: AssetReference[];
  onSelectExisting: (a: AssetReference) => void;
  onCreate: (name: string) => void;
}> = ({ label, options, onSelectExisting, onCreate }) => (
  <Autocomplete<PickerOption, false, false, true>
    size="small"
    freeSolo
    selectOnFocus
    clearOnBlur
    handleHomeEndKeys
    value={null}
    options={options as PickerOption[]}
    filterOptions={(opts, params) => {
      const filtered = assetFilter(opts, params);
      const input = params.inputValue.trim();
      const exists = options.some(
        (o) => o.name.toLowerCase() === input.toLowerCase(),
      );
      if (input !== "" && !exists) {
        filtered.push({ create: true, name: input });
      }
      return filtered;
    }}
    getOptionLabel={(o) =>
      typeof o === "string" ? o : "create" in o ? o.name : `${o.id} · ${o.name}`
    }
    isOptionEqualToValue={(o, v) =>
      typeof o !== "string" &&
      typeof v !== "string" &&
      !("create" in o) &&
      !("create" in v) &&
      o.id === v.id
    }
    renderOption={(props, o) => (
      <li {...props} key={"create" in o ? `__create_${o.name}` : o.id}>
        {"create" in o ? <em>＋ {o.name}</em> : `${o.id} · ${o.name}`}
      </li>
    )}
    onChange={(_e, val) => {
      if (!val) return;
      if (typeof val === "string") {
        onCreate(val);
      } else if ("create" in val) {
        onCreate(val.name);
      } else {
        onSelectExisting(val);
      }
    }}
    renderInput={(params) => <TextField {...params} label={label} />}
  />
);

// ==================== TYPES ====================

interface HazardDialogProps {
  open: boolean;
  data: HazardData;
  /** null = create a new hazard. */
  hazardId: HazardItemId | null;
  /** Existing assets (project ∪ assets already created but not yet synced). */
  assets: AssetReference[];
  onSave: (data: HazardData, createdAssets: CreatedAsset[]) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const HazardDialog: React.FC<HazardDialogProps> = ({
  open,
  data,
  hazardId,
  assets,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<HazardData>(data);
  const [editingId, setEditingId] = useState<HazardItemId | null>(null);
  // Assets created during THIS dialog session (handed up on save).
  const [sessionAssets, setSessionAssets] = useState<CreatedAsset[]>([]);

  // Group applied to newly created assets (quick-capture; refine in the Asset tab).
  const [newCauseGroup, setNewCauseGroup] = useState<string>("system");
  const [newTargetGroup, setNewTargetGroup] = useState<string>("human");

  // Seed the draft when the dialog opens or the target hazard changes.
  useEffect(() => {
    if (!open) return;
    setSessionAssets([]);
    if (hazardId) {
      setEditingId(hazardId);
      setDraft(data);
    } else {
      const item = hazardService.createHazardItem(data, {
        combinationType: data.configuration?.defaultCombinationType,
      });
      setDraft(hazardService.addHazard(data, item));
      setEditingId(item.id);
    }
    // Seeding intentionally ignores live `data` edits while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hazardId]);

  // All assets visible to this dialog = passed-in ∪ session-created.
  const allAssets = useMemo<AssetReference[]>(
    () => [...assets, ...sessionAssets.map(seedToRef)],
    [assets, sessionAssets],
  );
  const existingIds = useMemo(() => allAssets.map((a) => a.id), [allAssets]);

  const item = useMemo(
    () => draft.hazards.find((h) => h.id === editingId) ?? null,
    [draft.hazards, editingId],
  );

  const contributes = useMemo<ContributesToRelation[]>(
    () =>
      draft.relations.filter(isContributesTo).filter((r) => r.to === editingId),
    [draft.relations, editingId],
  );

  const endangers = useMemo<EndangersRelation[]>(
    () =>
      draft.relations.filter(isEndangers).filter((r) => r.from === editingId),
    [draft.relations, editingId],
  );

  const contributorOptions = useMemo(
    () =>
      eligibleAssets(allAssets, "contributor").filter(
        (a) => !contributes.some((c) => c.from === a.id),
      ),
    [allAssets, contributes],
  );

  const targetOptions = useMemo(
    () =>
      eligibleAssets(allAssets, "target").filter(
        (a) => !endangers.some((e) => e.to === a.id),
      ),
    [allAssets, endangers],
  );

  const assetName = (id: string): string =>
    allAssets.find((a) => a.id === id)?.name ?? id;

  // ── Field handlers ───────────────────────────────────────────────────────

  const patchItem = (patch: Partial<NonNullable<typeof item>>) => {
    if (!editingId) return;
    setDraft((d) => {
      const current = d.hazards.find((h) => h.id === editingId);
      if (!current) return d;
      return hazardService.updateHazard(d, { ...current, ...patch });
    });
  };

  // ── Cause (contributes_to) handlers ───────────────────────────────────────

  const addCause = (assetId: string) => {
    if (!editingId) return;
    setDraft((d) =>
      hazardRelationService.addContributesTo(d, {
        assetId,
        hazardId: editingId,
        relevance: "indirect",
        hazardDistance: 1,
      }),
    );
  };

  const createCause = (name: string) => {
    const seed = createAssetSeed(existingIds, name, newCauseGroup);
    setSessionAssets((s) => [...s, seed]);
    addCause(seed.id);
  };

  const patchCause = (
    assetId: string,
    patch: { relevance?: SafetyRelevance; hazardDistance?: number },
  ) => {
    if (!editingId) return;
    setDraft((d) =>
      hazardRelationService.updateContributesTo(d, assetId, editingId, patch),
    );
  };

  const removeCause = (assetId: string) => {
    if (!editingId) return;
    setDraft((d) =>
      hazardRelationService.removeContributesTo(d, assetId, editingId),
    );
  };

  // ── Target (endangers) handlers ───────────────────────────────────────────

  const addTarget = (asset: AssetReference) => {
    if (!editingId) return;
    const kind = targetKindForAssetGroup(asset.assetGroup);
    if (!kind) return;
    const severity = resolveSeverityScale(kind)[0];
    setDraft((d) =>
      hazardRelationService.addEndangers(d, {
        hazardId: editingId,
        targetAssetId: asset.id,
        impact: makeImpact(kind, severity),
      }),
    );
  };

  const createTarget = (name: string) => {
    const seed = createAssetSeed(existingIds, name, newTargetGroup);
    setSessionAssets((s) => [...s, seed]);
    addTarget(seedToRef(seed));
  };

  const patchTargetSeverity = (rel: EndangersRelation, severity: string) => {
    if (!editingId) return;
    setDraft((d) =>
      hazardRelationService.updateEndangers(d, editingId, rel.to, {
        impact: makeImpact(rel.impact.target, severity),
      }),
    );
  };

  const removeTarget = (targetAssetId: string) => {
    if (!editingId) return;
    setDraft((d) =>
      hazardRelationService.removeEndangers(d, editingId, targetAssetId),
    );
  };

  // ── Save gate ──────────────────────────────────────────────────────────────

  const requireType = data.configuration?.requireHazardType ?? false;
  const saveDisabled =
    !item?.label.trim() || (requireType && !item?.hazardType);

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <HazardIcon sx={{ color: "#dc2626" }} />
        {hazardId
          ? t("tabs.hazards.dialog.editTitle", { defaultValue: "Edit Hazard" })
          : t("tabs.hazards.dialog.newTitle", { defaultValue: "New Hazard" })}
        {item && (
          <Chip
            label={item.id}
            size="small"
            variant="outlined"
            sx={{ fontFamily: "monospace", ml: 1 }}
          />
        )}
      </DialogTitle>

      <DialogContent dividers>
        {!item ? null : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* ── Hazard fields ─────────────────────────────────────────── */}
            <TextField
              label={t("tabs.hazards.dialog.label", {
                defaultValue: "Hazard label",
              })}
              value={item.label}
              onChange={(e) => patchItem({ label: e.target.value })}
              required
              fullWidth
              size="small"
              autoFocus
            />

            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <FieldCol
                grow
                label={t("tabs.hazards.dialog.type", {
                  defaultValue: "ISO 12100 type",
                })}
              >
                <Select
                  size="small"
                  displayEmpty
                  fullWidth
                  value={item.hazardType ?? ""}
                  onChange={(e) =>
                    patchItem({
                      hazardType: (e.target.value || undefined) as
                        | HazardCategory
                        | undefined,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>{t("common.none", { defaultValue: "None" })}</em>
                  </MenuItem>
                  {HAZARD_CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {t(`tabs.hazards.category.${c}`, {
                        defaultValue: humanize(c),
                      })}
                    </MenuItem>
                  ))}
                </Select>
              </FieldCol>

              <FieldCol
                grow
                label={t("tabs.hazards.dialog.php", {
                  defaultValue: "Physical hazard potential",
                })}
              >
                <Select
                  size="small"
                  displayEmpty
                  fullWidth
                  value={item.physicalHazardPotential ?? ""}
                  onChange={(e) =>
                    patchItem({
                      physicalHazardPotential: (e.target.value || undefined) as
                        | PhysicalHazardPotential
                        | undefined,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>{t("common.none", { defaultValue: "None" })}</em>
                  </MenuItem>
                  {PHYSICAL_HAZARD_POTENTIALS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {humanize(p)}
                    </MenuItem>
                  ))}
                </Select>
              </FieldCol>

              <FieldCol
                label={t("tabs.hazards.dialog.combination", {
                  defaultValue: "Combination",
                })}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={item.combinationType}
                  onChange={(_e, v) => v && patchItem({ combinationType: v })}
                >
                  <ToggleButton value="ANY" sx={{ px: 2 }}>
                    ANY
                  </ToggleButton>
                  <ToggleButton value="ALL" sx={{ px: 2 }}>
                    ALL
                  </ToggleButton>
                </ToggleButtonGroup>
              </FieldCol>
            </Box>

            <TextField
              label={t("tabs.hazards.dialog.rationale", {
                defaultValue: "Rationale",
              })}
              value={item.rationale ?? ""}
              onChange={(e) =>
                patchItem({ rationale: e.target.value || undefined })
              }
              fullWidth
              size="small"
              multiline
              minRows={2}
            />

            <Divider />

            {/* ── Bowtie ─────────────────────────────────────────────────── */}
            <Grid container spacing={2} alignItems="stretch">
              {/* Left — causes */}
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" sx={{ mb: 1, height: 20 }}>
                  {t("tabs.hazards.dialog.causes", {
                    defaultValue: "Causes — contributes_to",
                  })}
                </Typography>

                <Stack spacing={1}>
                  {contributes.map((c) => (
                    <Paper key={c.from} variant="outlined" sx={{ p: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ fontWeight: 500 }}
                          >
                            {assetName(c.from)}
                          </Typography>
                          <Chip
                            label={c.from}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.65rem",
                              height: 18,
                            }}
                          />
                        </Box>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                          <Select
                            value={
                              c.relevance === "none" ? "indirect" : c.relevance
                            }
                            onChange={(e) =>
                              patchCause(c.from, {
                                relevance: e.target.value as SafetyRelevance,
                              })
                            }
                          >
                            {CONTRIBUTOR_RELEVANCE.map((r) => (
                              <MenuItem key={r} value={r}>
                                {humanize(r)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label={t("tabs.hazards.dialog.distance", {
                            defaultValue: "Dist.",
                          })}
                          type="number"
                          size="small"
                          value={c.hazardDistance}
                          onChange={(e) =>
                            patchCause(c.from, {
                              hazardDistance: Math.max(
                                0,
                                Number(e.target.value),
                              ),
                            })
                          }
                          inputProps={{ min: 0 }}
                          sx={{ width: 80 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeCause(c.from)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Paper>
                  ))}

                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <Select
                        value={newCauseGroup}
                        onChange={(e) => setNewCauseGroup(e.target.value)}
                      >
                        {HAZARD_CONTRIBUTOR_GROUPS.map((g) => (
                          <MenuItem key={g} value={g}>
                            {humanize(g)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ flexGrow: 1 }}>
                      <AssetPicker
                        label={t("tabs.hazards.dialog.addCause", {
                          defaultValue: "Add / create cause…",
                        })}
                        options={contributorOptions}
                        onSelectExisting={(a) => addCause(a.id)}
                        onCreate={createCause}
                      />
                    </Box>
                  </Stack>

                  {contributes.length === 0 && (
                    <Alert severity="warning" sx={{ py: 0.25 }}>
                      {t("tabs.hazards.dialog.noCauses", {
                        defaultValue:
                          "At least one contributing asset is required.",
                      })}
                    </Alert>
                  )}
                </Stack>
              </Grid>

              {/* Center — hazard node */}
              <Grid item xs={12} md={2}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  {/* Arrow sits in the title band, level with the Causes/Targets headers */}
                  <Box
                    sx={{
                      height: 20,
                      mb: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowIcon sx={{ color: "text.disabled" }} />
                  </Box>
                  {/* Box top aligns with the first edge entry; grows as either side grows */}
                  <Paper
                    elevation={3}
                    sx={{
                      flexGrow: 1,
                      p: 1.5,
                      textAlign: "center",
                      borderLeft: "4px solid #dc2626",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                    }}
                  >
                    <HazardIcon sx={{ color: "#dc2626" }} />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, wordBreak: "break-word" }}
                    >
                      {item.label ||
                        t("tabs.hazards.unnamed", {
                          defaultValue: "(unnamed)",
                        })}
                    </Typography>
                    <Chip
                      label={item.combinationType}
                      size="small"
                      color={
                        item.combinationType === "ALL" ? "secondary" : "default"
                      }
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.65rem",
                        height: 18,
                      }}
                    />
                  </Paper>
                </Box>
              </Grid>

              {/* Right — targets */}
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" sx={{ mb: 1, height: 20 }}>
                  {t("tabs.hazards.dialog.targets", {
                    defaultValue: "Protection targets — endangers",
                  })}
                </Typography>

                <Stack spacing={1}>
                  {endangers.map((e) => {
                    const scale = resolveSeverityScale(e.impact.target);
                    return (
                      <Paper key={e.to} variant="outlined" sx={{ p: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ fontWeight: 500 }}
                            >
                              {assetName(e.to)}
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                              <Chip
                                label={e.to}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.65rem",
                                  height: 18,
                                }}
                              />
                              <Chip
                                label={e.impact.target}
                                size="small"
                                sx={{ fontSize: "0.6rem", height: 18 }}
                              />
                            </Stack>
                          </Box>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select
                              value={e.impact.severity}
                              onChange={(ev) =>
                                patchTargetSeverity(e, ev.target.value)
                              }
                            >
                              {scale.map((s) => (
                                <MenuItem key={s} value={s}>
                                  {t(`tabs.hazards.severity.${s}`, {
                                    defaultValue: humanize(s),
                                  })}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <IconButton
                            size="small"
                            onClick={() => removeTarget(e.to)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Paper>
                    );
                  })}

                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={newTargetGroup}
                        onChange={(e) => setNewTargetGroup(e.target.value)}
                      >
                        {HAZARD_TARGET_GROUPS.map((g) => (
                          <MenuItem key={g} value={g}>
                            {humanize(g)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ flexGrow: 1 }}>
                      <AssetPicker
                        label={t("tabs.hazards.dialog.addTarget", {
                          defaultValue: "Add / create target…",
                        })}
                        options={targetOptions}
                        onSelectExisting={(a) => addTarget(a)}
                        onCreate={createTarget}
                      />
                    </Box>
                  </Stack>

                  {endangers.length === 0 && (
                    <Alert severity="warning" sx={{ py: 0.25 }}>
                      {t("tabs.hazards.dialog.noTargets", {
                        defaultValue:
                          "At least one protection target is required.",
                      })}
                    </Alert>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={() => onSave(draft, sessionAssets)}
          variant="contained"
          disabled={saveDisabled}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HazardDialog;