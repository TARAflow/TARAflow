// ==================== ASSET DIALOG ====================
// Modal dialog for creating/editing an asset
//
// Two-tab layout:
//   Tab 0 — General & Rating: ID, Name, Description, DFD Links, Impact Ratings
//   Tab 1 — Security Goals:   CIANAAA Accordion with formal descriptions
//
// DFD Link chips: "P-1: creates; reads" — same format as asset-table.tsx
//
// Fix 2025-03: Security goal normalization
//   - All 7 CIANAAA types always initialized
//   - useEffect re-syncs when asset prop changes

import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  Chip,
  Stack,
  Grid,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tabs,
  Tab,
  Paper,
  SelectChangeEvent,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
} from "@mui/icons-material";

import { Asset, AssetConfiguration } from "../models/asset-types";
import {
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
} from "../models/asset-impact-types";
import {
  SecurityGoal,
  SecurityGoalType,
  SECURITY_GOALS,
} from "../models/asset-security-goals-types";
import { calculateOverallImpact } from "../services/asset-impact-calculator";
import { ASSET_GROUP_CONFIG, type AssetGroup } from "shared";

// ==================== TYPES ====================

interface AssetDialogProps {
  open: boolean;
  asset: Asset;
  configuration: AssetConfiguration;
  onSave: (asset: Asset) => void;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// ==================== HELPERS ====================

function normalizeSecurityGoals(goals: SecurityGoal[]): SecurityGoal[] {
  return SECURITY_GOALS.map((def) => {
    const existing = goals.find((g) => g.type === def.type);
    if (existing) return existing;
    return {
      type: def.type,
      enabled: false,
      formalDescription: "",
      source: undefined,
      rationale: undefined,
    };
  });
}

// ==================== COMPONENT ====================

export const AssetDialog: React.FC<AssetDialogProps> = ({
  open,
  asset,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const scale = IMPACT_SCALES[configuration.impactScale];
  const isNew = asset.name === "";

  // ==================== STATE ====================

  const [tabValue, setTabValue] = useState(0);

  const [editedAsset, setEditedAsset] = useState<Asset>(() => ({
    ...asset,
    securityGoals: normalizeSecurityGoals(asset.securityGoals ?? []),
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Re-sync when asset prop changes
  useEffect(() => {
    setEditedAsset({
      ...asset,
      securityGoals: normalizeSecurityGoals(asset.securityGoals ?? []),
    });
    setErrors({});
    setTabValue(0);
  }, [asset]);

  // ==================== VALIDATION ====================

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedAsset.name.trim()) {
      newErrors.name = t("validation.required", { defaultValue: "Required" });
    }

    const hasSecurityGoal = editedAsset.securityGoals.some((sg) => sg.enabled);
    if (!hasSecurityGoal) {
      newErrors.securityGoals = t("validation.atLeastOneSecurityGoal", {
        defaultValue: "At least one security goal required",
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==================== HANDLERS ====================

  const handleSave = () => {
    if (!validate()) return;

    const overallImpact = calculateOverallImpact(
      editedAsset.impactRatings,
      configuration.calculationMethod,
    );

    onSave({
      ...editedAsset,
      overallImpact,
      lastModified: new Date().toISOString(),
    });
  };

  const handleImpactChange = (
    criterionId: string,
    event: SelectChangeEvent<number>,
  ) => {
    const value = event.target.value as number;
    setEditedAsset((prev) => ({
      ...prev,
      impactRatings: prev.impactRatings.map((r) =>
        r.criterionId === criterionId ? { ...r, value } : r,
      ),
    }));
  };

  const handleSecurityGoalToggle = (type: SecurityGoalType) => {
    setEditedAsset((prev) => {
      const exists = prev.securityGoals.some((sg) => sg.type === type);

      const updated: SecurityGoal[] = exists
        ? prev.securityGoals.map((sg) =>
            sg.type === type
              ? { ...sg, enabled: !sg.enabled, source: "manual" as const }
              : sg,
          )
        : [
            ...prev.securityGoals,
            {
              type,
              enabled: true,
              formalDescription: "",
              source: "manual" as const,
            },
          ];

      return { ...prev, securityGoals: updated };
    });

    if (errors.securityGoals) {
      setErrors((prev) => ({ ...prev, securityGoals: "" }));
    }
  };

  const handleSecurityGoalDescription = (
    type: SecurityGoalType,
    description: string,
  ) => {
    setEditedAsset((prev) => ({
      ...prev,
      securityGoals: prev.securityGoals.map((sg) =>
        sg.type === type ? { ...sg, formalDescription: description } : sg,
      ),
    }));
  };

  const handleUseTemplate = (type: SecurityGoalType) => {
    const goalDef = SECURITY_GOALS.find((g) => g.type === type);
    if (goalDef) {
      const template = isGerman ? goalDef.templateDE : goalDef.templateEN;
      handleSecurityGoalDescription(type, template);
    }
  };

  // ==================== COMPUTED ====================

  const currentOverallImpact = useMemo(
    () =>
      calculateOverallImpact(
        editedAsset.impactRatings,
        configuration.calculationMethod,
      ),
    [editedAsset.impactRatings, configuration.calculationMethod],
  );

  const getImpactColor = (value: number): string => {
    const colors: Record<number, string[]> = {
      3: ["#22c55e", "#eab308", "#ef4444"],
      4: ["#22c55e", "#eab308", "#f97316", "#ef4444"],
      5: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"],
    };
    const palette = colors[scale.levels.length] ?? colors[4];
    return palette[Math.min(value - 1, palette.length - 1)] ?? "#6b7280";
  };

  // Group DFD links by elementId — same logic as asset-table.tsx
  const groupedDFDLinks = useMemo(() => {
    const grouped = new Map<
      string,
      {
        displayId: string;
        elementName: string;
        elementType: string;
        assetGroup?: AssetGroup;
        relations: string[];
      }
    >();

    for (const link of editedAsset.linkedDFDElements ?? []) {
      if (!link?.elementId) continue;
      const existing = grouped.get(link.elementId);
      if (existing) {
        if (
          link.relationType &&
          !existing.relations.includes(link.relationType)
        ) {
          existing.relations.push(link.relationType);
        }
      } else {
        grouped.set(link.elementId, {
          displayId: link.displayId ?? link.elementId.slice(0, 8),
          elementName: link.elementName ?? "",
          elementType: link.elementType ?? "",
          relations: link.relationType ? [link.relationType] : [],
        });
      }
    }

    return Array.from(grouped.values());
  }, [editedAsset.linkedDFDElements]);

  const hasSecurityGoalError = !!errors.securityGoals;
  const enabledGoalCount = editedAsset.securityGoals.filter(
    (sg) => sg.enabled,
  ).length;

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: 780, maxHeight: "92vh" } }}
    >
      <DialogTitle>
        {isNew
          ? t("tabs.assets.dialog.createTitle", {
              defaultValue: "Create Asset",
            })
          : t("tabs.assets.dialog.editTitle", {
              id: editedAsset.id,
              defaultValue: `Edit Asset ${editedAsset.id}`,
            })}
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          display: "flex",
          flexDirection: "column",
          p: 0,
          overflow: "hidden",
        }}
      >
        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2, flexShrink: 0 }}
        >
          <Tab
            label={t("tabs.assets.dialog.tabGeneral", {
              defaultValue: "General & Rating",
            })}
          />
          <Tab
            label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <span>
                  {t("tabs.assets.dialog.tabSecurityGoals", {
                    defaultValue: "Security Goals",
                  })}
                </span>
                {enabledGoalCount > 0 && (
                  <Chip
                    label={enabledGoalCount}
                    size="small"
                    color={hasSecurityGoalError ? "error" : "primary"}
                    sx={{
                      height: 16,
                      fontSize: 10,
                      "& .MuiChip-label": { px: 0.75 },
                    }}
                  />
                )}
                {hasSecurityGoalError && enabledGoalCount === 0 && (
                  <Chip
                    label="!"
                    size="small"
                    color="error"
                    sx={{
                      height: 16,
                      fontSize: 10,
                      "& .MuiChip-label": { px: 0.75 },
                    }}
                  />
                )}
              </Stack>
            }
          />
        </Tabs>

        {/* Scrollable content area */}
        <Box sx={{ flexGrow: 1, overflow: "auto", px: 3 }}>
          {/* ── Tab 0: General & Rating ─────────────────────────────────── */}
          <TabPanel value={tabValue} index={0}>
            {/* Basic Info */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("tabs.assets.dialog.basicInfo", {
                  defaultValue: "Basic Information",
                })}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <TextField
                    label={t("tabs.assets.columns.id", { defaultValue: "ID" })}
                    value={editedAsset.id}
                    disabled
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={9}>
                  <TextField
                    label={t("tabs.assets.columns.name", {
                      defaultValue: "Name",
                    })}
                    value={editedAsset.name}
                    onChange={(e) =>
                      setEditedAsset({ ...editedAsset, name: e.target.value })
                    }
                    error={!!errors.name}
                    helperText={errors.name}
                    fullWidth
                    size="small"
                    required
                    autoFocus
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={t("tabs.assets.columns.description", {
                      defaultValue: "Description",
                    })}
                    value={editedAsset.properties?.description ?? ""}
                    onChange={(e) =>
                      setEditedAsset({
                        ...editedAsset,
                        properties: {
                          ...editedAsset.properties,
                          description: e.target.value,
                        },
                      })
                    }
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* DFD Links — same chip format as asset-table: "P-1: creates; reads" */}
            {groupedDFDLinks.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.assets.dialog.linkedElements", {
                    defaultValue: "Linked DFD Elements",
                  })}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {groupedDFDLinks.map((link) => {
                    const relStr =
                      link.relations.length > 0
                        ? link.relations.join("; ")
                        : "–";
                    const chipLabel = `${link.displayId}: ${relStr}`;
                    return (
                      <Tooltip
                        key={link.displayId}
                        arrow
                        placement="top"
                        title={
                          <Box sx={{ p: 0.5 }}>
                            <Typography
                              variant="caption"
                              fontWeight="bold"
                              display="block"
                            >
                              {link.displayId}
                            </Typography>
                            <Typography
                              variant="caption"
                              display="block"
                              color="rgba(255,255,255,0.8)"
                            >
                              {link.elementName}
                              {link.elementType ? ` [${link.elementType}]` : ""}
                            </Typography>
                          </Box>
                        }
                      >
                        <Chip
                          label={chipLabel}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: "0.65rem",
                            height: "auto",
                            py: 0.25,
                            fontFamily: "monospace",
                            "& .MuiChip-label": {
                              whiteSpace: "normal",
                              lineHeight: 1.3,
                            },
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Impact Ratings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("tabs.assets.dialog.impactRatings", {
                  defaultValue: "Impact Ratings",
                })}
              </Typography>

              <Grid container spacing={2}>
                {editedAsset.impactRatings.map((rating) => {
                  const criterion = PREDEFINED_IMPACT_CRITERIA.find(
                    (c) => c.id === rating.criterionId,
                  );
                  const name = isGerman ? criterion?.nameDE : criterion?.name;
                  const description = isGerman
                    ? criterion?.descriptionDE
                    : criterion?.description;

                  return (
                    <Grid item xs={12} sm={6} md={4} key={rating.criterionId}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mb: 1 }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{ flexGrow: 1 }}
                          >
                            {name}
                          </Typography>
                          <Tooltip title={description ?? ""} placement="top">
                            <InfoIcon fontSize="small" color="action" />
                          </Tooltip>
                        </Stack>
                        <Select
                          value={rating.value}
                          onChange={(e) =>
                            handleImpactChange(
                              rating.criterionId,
                              e as SelectChangeEvent<number>,
                            )
                          }
                          size="small"
                          fullWidth
                        >
                          <MenuItem value={0}>
                            <em>
                              {t("tabs.assets.dialog.notRated", {
                                defaultValue: "Not rated",
                              })}
                            </em>
                          </MenuItem>
                          {scale.levels.map((level) => (
                            <MenuItem key={level.value} value={level.value}>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    backgroundColor: getImpactColor(
                                      level.value,
                                    ),
                                    flexShrink: 0,
                                  }}
                                />
                                <span>
                                  {level.value} -{" "}
                                  {isGerman ? level.labelDE : level.label}
                                </span>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>

              {/* Overall Impact — colored Paper like risk-dialog */}
              <Paper
                sx={{
                  p: 2,
                  mt: 3,
                  backgroundColor:
                    currentOverallImpact > 0
                      ? getImpactColor(Math.round(currentOverallImpact))
                      : "grey.300",
                  color: currentOverallImpact > 0 ? "white" : "text.secondary",
                }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">
                    {t("tabs.assets.dialog.overall", {
                      defaultValue: "Overall",
                    })}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {currentOverallImpact > 0
                      ? currentOverallImpact.toFixed(1)
                      : "-"}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {currentOverallImpact > 0
                    ? (scale.levels.find(
                        (l) => l.value === Math.round(currentOverallImpact),
                      )?.[isGerman ? "labelDE" : "label"] ?? "")
                    : t("tabs.assets.dialog.notRated", {
                        defaultValue: "Not rated",
                      })}
                </Typography>
              </Paper>
            </Box>
          </TabPanel>

          {/* ── Tab 1: Security Goals ───────────────────────────────────── */}
          <TabPanel value={tabValue} index={1}>
            {errors.securityGoals && (
              <Alert severity="error">{errors.securityGoals}</Alert>
            )}

            {SECURITY_GOALS.map((goalDef) => {
              const goal = editedAsset.securityGoals.find(
                (sg) => sg.type === goalDef.type,
              );
              const isEnabled = goal?.enabled ?? false;
              const isSuggested = goal?.source === "suggested";

              return (
                <Accordion
                  key={goalDef.type}
                  defaultExpanded={isEnabled}
                  sx={{
                    mb: 1,
                    ...(isEnabled && {
                      borderLeft: 3,
                      borderColor: isSuggested
                        ? "secondary.main"
                        : "primary.main",
                    }),
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                      },
                    }}
                  >
                    <Checkbox
                      checked={isEnabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSecurityGoalToggle(goalDef.type);
                      }}
                      sx={{ mr: 1 }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight="medium">
                          {goalDef.type} –{" "}
                          {isGerman ? goalDef.nameDE : goalDef.name}
                        </Typography>
                        {isEnabled && goal?.source && (
                          <Chip
                            label={
                              isSuggested
                                ? t("tabs.assets.tooltips.cianaaa.suggested", {
                                    defaultValue: "Graph suggestion",
                                  })
                                : t("tabs.assets.tooltips.cianaaa.manual", {
                                    defaultValue: "Manually set",
                                  })
                            }
                            size="small"
                            variant={isSuggested ? "outlined" : "filled"}
                            color={isSuggested ? "secondary" : "primary"}
                            sx={{ fontSize: "0.6rem", height: 18 }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {isGerman ? goalDef.descriptionDE : goalDef.description}
                      </Typography>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "start" }}>
                      <TextField
                        label={t("tabs.assets.dialog.formalDescription", {
                          defaultValue: "Formal Security Requirement",
                        })}
                        value={goal?.formalDescription ?? ""}
                        onChange={(e) =>
                          handleSecurityGoalDescription(
                            goalDef.type,
                            e.target.value,
                          )
                        }
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                        placeholder={
                          isGerman ? goalDef.templateDE : goalDef.templateEN
                        }
                      />
                      <Tooltip
                        title={t("tabs.assets.dialog.useTemplate", {
                          defaultValue: "Use template",
                        })}
                      >
                        <IconButton
                          onClick={() => handleUseTemplate(goalDef.type)}
                          size="small"
                        >
                          <LightbulbIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {goal?.source === "manual" && (
                      <TextField
                        label={
                          isGerman
                            ? "Begründung (Abweichung)"
                            : "Rationale (deviation)"
                        }
                        value={goal?.rationale ?? ""}
                        onChange={(e) =>
                          setEditedAsset((prev) => ({
                            ...prev,
                            securityGoals: prev.securityGoals.map((sg) =>
                              sg.type === goalDef.type
                                ? { ...sg, rationale: e.target.value }
                                : sg,
                            ),
                          }))
                        }
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        placeholder={
                          isGerman
                            ? "Warum wurde dieses Schutzziel manuell gesetzt?"
                            : "Why was this security goal set manually?"
                        }
                      />
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};;;

export default AssetDialog;