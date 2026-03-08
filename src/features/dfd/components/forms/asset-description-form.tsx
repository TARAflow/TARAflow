// ==================== ASSET DESCRIPTION FORM (DFD) ====================
// Two tabs:
//   Tab 1 — General:  Name, Category (RadioGroup + category-specific fields),
//                     Protection Need, Description, Advanced (Owner / Notes)
//   Tab 2 — Used in:  Referencing elements list + Safety annotation summary
//                     (all safety annotations on this asset across all elements)
//
// Kategorie-Wechsel-Warnung:
//   Wenn referencingElements > 0 und die Kategorie geändert wird, erscheint
//   ein ConfirmDialog, da alle bestehenden Relationen in anderen Elementen
//   ungültig werden (falsche assetGroup).

import React, { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Cable as InterfaceIcon,
  Computer as SystemIcon,
  DataObject as DataIcon,
  ExpandMore as ExpandMoreIcon,
  Factory as InfrastructureIcon,
  Info as InfoIcon,
  Loop as ProcessIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
  Storage as DataStoreIcon,
  SwapHoriz as DataFlowIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";

import type {
  AssetGroup,
  DFDAsset,
  DFDConnection,
  DFDElement,
  DFDElementType,
} from "../../models/dfd-types";
import type { AnyAssetRelationType } from "../../models/asset-relation-types";
import {
  hasQualifier,
  isIsAnRelation,
} from "../../models/asset-relation-types";
import {
  getAssetGroupColor,
  getRelationTypeText,
} from "../../models/dfd-formatters";
import { RichTextEditor } from "../shared/rich-text-editor";
import { ConfirmDialog } from "../shared/confirm-dialog";

// ==================== TYPES ====================

interface AssetDescriptionFormProps {
  asset: DFDAsset;
  onChange: (changes: Partial<DFDAsset>) => void;
  elements?: DFDElement[];
  connections?: DFDConnection[];
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
}

interface ElementReference {
  elementId: string;
  elementName: string;
  elementDisplayId: string;
  elementType: DFDElementType | "DataFlow";
  relationTypes?: AnyAssetRelationType[];
  assetGroup?: AssetGroup;
  // All safety-annotated relations from this element to this asset
  safetyRelations?: Array<{
    relationType: AnyAssetRelationType;
    qualifier?: string;
    relevance: string;
    impact?: string;
    rationale?: string;
  }>;
}

// ==================== TAB PANEL ====================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ==================== HELPERS ====================

const getElementTypeIcon = (type: DFDElementType | "DataFlow") => {
  const iconMap: Record<string, React.ReactNode> = {
    Process: <ProcessIcon fontSize="small" />,
    Multiprocess: <ProcessIcon fontSize="small" />,
    DataStore: <DataStoreIcon fontSize="small" />,
    ExternalEntity: <PersonIcon fontSize="small" />,
    Interface: <InterfaceIcon fontSize="small" />,
    DataFlow: <DataFlowIcon fontSize="small" />,
  };
  return iconMap[type] ?? <DataIcon fontSize="small" />;
};

const getElementsReferencingAsset = (
  assetId: string,
  elements: DFDElement[] = [],
  connections: DFDConnection[] = [],
): ElementReference[] => {
  const refs: ElementReference[] = [];

  elements.forEach((element) => {
    const rels =
      element.assetRelations?.filter((r) => r.assetId === assetId) ?? [];
    if (rels.length === 0) return;

    // ✅ Collect ALL relation types (not just primary)
    const relationTypes = rels.map((r) => r.relationType);
    const assetGroup = rels[0]?.assetGroup; // All should have same group

    // Safety-annotated relations
    const safetyRels = rels
      .filter(
        (r) => !isIsAnRelation(r) && r.safety && r.safety?.relevance !== "none",
      )
      .map((r) => ({
        relationType: r.relationType,
        qualifier: hasQualifier(r) ? r.qualifier : undefined,
        relevance: r.safety!.relevance,
        impact: r.safety?.impact,
        rationale: r.safety?.rationale,
      }));

    refs.push({
      elementId: element.id,
      elementName: element.name,
      elementDisplayId: element.displayId || element.id,
      elementType: element.type,
      relationTypes, // ✅ All relations
      assetGroup,
      safetyRelations: safetyRels.length > 0 ? safetyRels : undefined,
    });
  });

  connections.forEach((connection) => {
    const rels =
      connection.assetRelations?.filter((r) => r.assetId === assetId) ?? [];
    if (rels.length === 0) return;

    const relationTypes = rels.map((r) => r.relationType);
    const primary = rels[0];
    const safetyRels = rels
      .filter((r) => r.safety?.relevance !== "none")
      .map((r) => ({
        relationType: r.relationType,
        qualifier: hasQualifier(r) ? r.qualifier : undefined,
        relevance: r.safety!.relevance,
        impact: r.safety?.impact,
        rationale: r.safety?.rationale,
      }));

    refs.push({
      elementId: connection.id,
      elementName: connection.name || `${connection.from} → ${connection.to}`,
      elementDisplayId: connection.displayId || connection.id,
      elementType: "DataFlow",
      relationTypes,
      assetGroup: primary?.assetGroup,
      safetyRelations: safetyRels.length > 0 ? safetyRels : undefined,
    });
  });

  return refs;
};

// ==================== SAFETY SUMMARY ====================
// Shows all safety annotations for this asset across all referencing elements.

interface SafetySummaryProps {
  refs: ElementReference[];
}

const SafetySummary: React.FC<SafetySummaryProps> = ({ refs }) => {
  const { t } = useTranslation();

  const annotatedRefs = refs.filter(
    (r) => r.safetyRelations && r.safetyRelations.length > 0,
  );

  if (annotatedRefs.length === 0) return null;

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="subtitle2" color="text.secondary">
          {t("tabs.dfd.element_description.asset.safetyAnnotations", {
            defaultValue: "Safety Annotations",
          })}
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {annotatedRefs.map((ref) => {
          const hasDirect = ref.safetyRelations!.some(
            (s) => s.relevance === "direct",
          );
          const hasFatality = ref.safetyRelations!.some(
            (s) => s.impact === "fatality",
          );
          const hasIrreversible = ref.safetyRelations!.some(
            (s) => s.impact === "irreversible_injury",
          );
          const showBadge = hasDirect || hasFatality || hasIrreversible;

          return (
            <Paper key={ref.elementId} variant="outlined" sx={{ p: 1.25 }}>
              {/* Element name + severity badge */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.75 }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ color: "text.secondary", display: "flex" }}>
                    {getElementTypeIcon(ref.elementType)}
                  </Box>
                  <Typography variant="body2" fontWeight={600}>
                    {ref.elementDisplayId}&nbsp;·&nbsp;{ref.elementName}
                  </Typography>
                </Stack>
                {showBadge && (
                  <Chip
                    label={
                      hasDirect
                        ? "DIRECT"
                        : hasFatality
                          ? "FATALITY"
                          : "IRREVERSIBLE"
                    }
                    size="small"
                    color="error"
                    sx={{ fontWeight: 700, fontSize: 10 }}
                  />
                )}
              </Stack>

              {/* One line per safety-annotated relation */}
              <Stack spacing={0.4}>
                {ref.safetyRelations!.map((s) => {
                  const qualifier = s.qualifier ? `[${s.qualifier}]` : "";
                  const impactLabel =
                    s.impact && s.impact !== "none"
                      ? s.impact.replace(/_/g, " ")
                      : undefined;

                  return (
                    <Stack
                      key={s.relationType}
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          color: "text.primary",
                          minWidth: 130,
                        }}
                      >
                        {s.relationType}
                        {qualifier}:
                      </Typography>
                      <Typography
                        variant="caption"
                        color={
                          s.relevance === "direct"
                            ? "error.main"
                            : "warning.main"
                        }
                      >
                        {s.relevance}
                        {impactLabel && `, ${impactLabel}`}
                      </Typography>
                      {s.rationale && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                          title={s.rationale}
                        >
                          — {s.rationale}
                        </Typography>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

// ==================== MAIN COMPONENT ====================

export const AssetDescriptionForm: React.FC<AssetDescriptionFormProps> = ({
  asset,
  onChange,
  elements = [],
  connections = [],
  onAssetFeatureUpdate,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(0);
  const [category, setCategory] = useState(asset.assetGroup || "");

  // Pending category change (warn if referencingElements > 0)
  const [pendingCategory, setPendingCategory] = useState<AssetGroup | null>(
    null,
  );

  // Local state for debounced fields
  const [localDescription, setLocalDescription] = React.useState(
    asset.description || "",
  );
  const [localNotes, setLocalNotes] = React.useState(
    asset.properties?.notes || "",
  );
  const [localOwner, setLocalOwner] = React.useState(
    asset.properties?.owner || "",
  );

  React.useEffect(() => {
    setLocalDescription(asset.description || "");
  }, [asset.description]);
  React.useEffect(() => {
    setLocalNotes(asset.properties?.notes || "");
  }, [asset.properties?.notes]);
  React.useEffect(() => {
    setLocalOwner(asset.properties?.owner || "");
  }, [asset.properties?.owner]);
  React.useEffect(() => {
    setCategory(asset.assetGroup || "");
  }, [asset.assetGroup]);

  const referencingElements = useMemo(
    () => getElementsReferencingAsset(asset.id, elements, connections),
    [asset.id, elements, connections],
  );

  const hasSafetyAnnotations = referencingElements.some(
    (r) => r.safetyRelations && r.safetyRelations.length > 0,
  );

  // ==================== HANDLERS ====================

  const handleNameChange = useCallback(
    (newName: string) => {
      onChange({ name: newName });
      onAssetFeatureUpdate?.(asset.id, { name: newName });
    },
    [asset.id, onChange, onAssetFeatureUpdate],
  );

  const handlePropertyChange = useCallback(
    (key: string, value: any) => {
      const updatedProperties = { ...asset.properties, [key]: value };
      onChange({ properties: updatedProperties });
      onAssetFeatureUpdate?.(asset.id, { properties: updatedProperties });
    },
    [asset.id, asset.properties, onChange, onAssetFeatureUpdate],
  );

  // Category change: warn if referencing elements exist
  const handleCategoryChangeRequest = useCallback(
    (newCategory: AssetGroup) => {
      if (newCategory === category) return;
      if (referencingElements.length > 0) {
        setPendingCategory(newCategory);
      } else {
        setCategory(newCategory);
        // ✅ Schreibe BEIDE Werte
        onChange({
          assetGroup: newCategory as AssetGroup,
          properties: {
            ...asset.properties,
            category: newCategory as AssetGroup,
          },
        });
      }
    },
    [category, referencingElements.length, asset.properties, onChange],
  );

  const handleCategoryChangeConfirm = useCallback(() => {
    if (!pendingCategory) return;
    setCategory(pendingCategory);

    // ✅ Schreibe BEIDE: assetGroup (kanonisch) + properties.category (Spiegelung)
    onChange({
      assetGroup: pendingCategory as AssetGroup,
      properties: {
        ...asset.properties,
        category: pendingCategory as AssetGroup,
      },
    });

    setPendingCategory(null);
  }, [pendingCategory, asset.properties, onChange]);

  // ==================== TAB 1: GENERAL ====================

  const renderGeneralTab = () => (
    <Stack spacing={3}>
      {/* Name */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            fullWidth
            label={t("tabs.dfd.element_description.asset.name")}
            value={asset.name || ""}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            helperText={t("tabs.dfd.element_description.asset.nameHelper")}
          />
          <Tooltip title={t("tabs.dfd.element_description.asset.nameTooltip")}>
            <IconButton size="small">
              <InfoIcon fontSize="small" color="action" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Category */}
      <Box>
        <Typography variant="body2" gutterBottom>
          {t("tabs.dfd.element_description.asset.category")} *
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 1, display: "block" }}
        >
          {t("tabs.dfd.element_description.asset.categoryGuidance")}
        </Typography>

        <RadioGroup
          value={category}
          onChange={(e) =>
            handleCategoryChangeRequest(e.target.value as AssetGroup)
          }
        >
          <Box sx={{ display: "flex", gap: 4, maxWidth: 800 }}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {(["data", "system", "infrastructure"] as const).map((cat) => (
                <FormControlLabel
                  key={cat}
                  value={cat}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {cat === "data" && <DataIcon fontSize="small" />}
                      {cat === "system" && <SystemIcon fontSize="small" />}
                      {cat === "infrastructure" && (
                        <InfrastructureIcon fontSize="small" />
                      )}
                      <Typography variant="body2">
                        {t(
                          `tabs.dfd.element_description.asset.category${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                        )}
                        {" — "}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                        >
                          {t(
                            `tabs.dfd.element_description.asset.category${cat.charAt(0).toUpperCase() + cat.slice(1)}Desc`,
                          )}
                        </Typography>
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {(["process", "human"] as const).map((cat) => (
                <FormControlLabel
                  key={cat}
                  value={cat}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {cat === "process" && <ProcessIcon fontSize="small" />}
                      {cat === "human" && <PersonIcon fontSize="small" />}
                      <Typography variant="body2">
                        {t(
                          `tabs.dfd.element_description.asset.category${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                        )}
                        {" — "}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                        >
                          {t(
                            `tabs.dfd.element_description.asset.category${cat.charAt(0).toUpperCase() + cat.slice(1)}Desc`,
                          )}
                        </Typography>
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          </Box>
        </RadioGroup>
      </Box>

      <Divider />

      {/* Protection Need */}
      <Box>
        <Typography variant="body2" gutterBottom>
          {t("tabs.dfd.element_description.asset.protectionNeed")}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 2, display: "block" }}
        >
          {t("tabs.dfd.element_description.asset.protectionNeedGuidance")}
        </Typography>
        <FormControl fullWidth required>
          <InputLabel>
            {t("tabs.dfd.element_description.asset.protectionNeed")}
          </InputLabel>
          <Select
            value={asset.properties?.protectionNeed || ""}
            onChange={(e) =>
              handlePropertyChange("protectionNeed", e.target.value)
            }
            label={t("tabs.dfd.element_description.asset.protectionNeed")}
          >
            <MenuItem value="">
              <em>Not specified</em>
            </MenuItem>
            <MenuItem value="low">
              {" "}
              {t("tabs.dfd.element_description.asset.protectionLow")}
            </MenuItem>
            <MenuItem value="medium">
              {" "}
              {t("tabs.dfd.element_description.asset.protectionMedium")}
            </MenuItem>
            <MenuItem value="high">
              {" "}
              {t("tabs.dfd.element_description.asset.protectionHigh")}
            </MenuItem>
            <MenuItem value="critical">
              {t("tabs.dfd.element_description.asset.protectionCritical")}
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Category-specific fields */}
      {category && (
        <>
          <Divider />
          <Box>
            <Typography variant="body2" gutterBottom>
              {t("tabs.dfd.element_description.asset.categoryDetails", {
                category: category.charAt(0).toUpperCase() + category.slice(1),
              })}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 2, display: "block" }}
            >
              {t("tabs.dfd.element_description.asset.categoryDetailsGuidance")}
            </Typography>

            {category === "data" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.dataType")}
                  </InputLabel>
                  <Select
                    multiple
                    value={asset.properties?.dataType || []}
                    onChange={(e) =>
                      handlePropertyChange("dataType", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.dataType")}
                    renderValue={(selected) =>
                      (selected as string[]).join(", ")
                    }
                  >
                    <MenuItem value="pii">PII (Personal Data)</MenuItem>
                    <MenuItem value="trade_secret">Trade Secret</MenuItem>
                    <MenuItem value="configuration">Configuration</MenuItem>
                    <MenuItem value="telemetry">Telemetry</MenuItem>
                    <MenuItem value="credentials">
                      Credentials / Secrets
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.lifecycle")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.lifecycle || ""}
                    onChange={(e) =>
                      handlePropertyChange("lifecycle", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.lifecycle")}
                  >
                    <MenuItem value="transient">Transient (In-Memory)</MenuItem>
                    <MenuItem value="stored">Stored (Persistent)</MenuItem>
                    <MenuItem value="archived">Archived (Long-term)</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {category === "system" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.criticality")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.criticality || ""}
                    onChange={(e) =>
                      handlePropertyChange("criticality", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.criticality")}
                  >
                    <MenuItem value="supporting">Supporting</MenuItem>
                    <MenuItem value="essential">Essential</MenuItem>
                    <MenuItem value="safety_critical">Safety Critical</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.exposure")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.exposure || ""}
                    onChange={(e) =>
                      handlePropertyChange("exposure", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.exposure")}
                  >
                    <MenuItem value="internal">Internal</MenuItem>
                    <MenuItem value="dmz">DMZ</MenuItem>
                    <MenuItem value="internet">Internet</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {category === "infrastructure" && (
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={
                        asset.properties?.physicalAccessPossible || false
                      }
                      onChange={(e) =>
                        handlePropertyChange(
                          "physicalAccessPossible",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t("tabs.dfd.element_description.asset.physicalAccess")}
                />
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.location")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.location || ""}
                    onChange={(e) =>
                      handlePropertyChange("location", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.location")}
                  >
                    <MenuItem value="factory">Factory</MenuItem>
                    <MenuItem value="datacenter">Data Center</MenuItem>
                    <MenuItem value="field">Field / Remote</MenuItem>
                    <MenuItem value="cloud">Cloud</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {category === "process" && (
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.automated || false}
                      onChange={(e) =>
                        handlePropertyChange("automated", e.target.checked)
                      }
                    />
                  }
                  label={t("tabs.dfd.element_description.asset.automated")}
                />
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.changeFrequency")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.changeFrequency || ""}
                    onChange={(e) =>
                      handlePropertyChange("changeFrequency", e.target.value)
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.changeFrequency",
                    )}
                  >
                    <MenuItem value="rarely">Rarely</MenuItem>
                    <MenuItem value="regular">Regular</MenuItem>
                    <MenuItem value="frequent">Frequent</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {category === "human" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.role")}
                  </InputLabel>
                  <Select
                    value={asset.properties?.role || ""}
                    onChange={(e) =>
                      handlePropertyChange("role", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.role")}
                  >
                    <MenuItem value="operator">Operator</MenuItem>
                    <MenuItem value="admin">Administrator</MenuItem>
                    <MenuItem value="developer">Developer</MenuItem>
                    <MenuItem value="external">External (Contractor)</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.securityRelevant || false}
                      onChange={(e) =>
                        handlePropertyChange(
                          "securityRelevant",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.securityRelevant",
                  )}
                />
              </Stack>
            )}
          </Box>
        </>
      )}

      <Divider />

      {/* Description */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {t("tabs.dfd.element_description.asset.description")}
          </Typography>
          <Tooltip
            title={t("tabs.dfd.element_description.asset.descriptionTooltip")}
          >
            <IconButton size="small">
              <InfoIcon fontSize="small" color="action" />
            </IconButton>
          </Tooltip>
        </Box>
        <RichTextEditor
          value={localDescription}
          onChange={setLocalDescription}
          onBlur={() => {
            if (localDescription !== asset.description)
              handlePropertyChange("description", localDescription);
          }}
          label=""
          helperText={t("tabs.dfd.element_description.asset.descriptionHelper")}
        />
      </Box>

      {/* Advanced */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" color="text.secondary">
            {t("tabs.dfd.element_description.asset.advanced")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 2, display: "block" }}
          >
            {t("tabs.dfd.element_description.asset.advancedGuidance")}
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label={t("tabs.dfd.element_description.asset.owner")}
              value={localOwner}
              onChange={(e) => setLocalOwner(e.target.value)}
              onBlur={() => {
                if (localOwner !== asset.properties?.owner)
                  handlePropertyChange("owner", localOwner);
              }}
              placeholder={t(
                "tabs.dfd.element_description.asset.ownerPlaceholder",
              )}
            />
            <RichTextEditor
              value={localNotes}
              onChange={setLocalNotes}
              onBlur={() => {
                if (localNotes !== asset.properties?.notes)
                  handlePropertyChange("notes", localNotes);
              }}
              label={t("tabs.dfd.element_description.asset.notes")}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );

  // ==================== TAB 2: USED IN ====================

  const renderUsedInTab = () => (
    <Stack spacing={3}>
      {referencingElements.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontStyle: "italic" }}
        >
          {t("tabs.dfd.element_description.asset.notReferenced", {
            defaultValue:
              "This asset is not yet referenced by any DFD element.",
          })}
        </Typography>
      ) : (
        <>
          <Box>
            <Typography variant="body2" gutterBottom>
              {t("tabs.dfd.element_description.asset.referencedIn")}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 2, display: "block" }}
            >
              {t("tabs.dfd.element_description.asset.referencedInGuidance")}
            </Typography>

            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <List dense disablePadding>
                  {referencingElements.map((ref) => (
                    <ListItem
                      key={ref.elementId}
                      sx={{
                        pl: 0,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        "&:first-of-type": { borderTop: "none" },
                        alignItems: "flex-start",
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Typography variant="body2">
                              <strong>
                                [{ref.elementDisplayId}] {ref.elementName}{" "}
                              </strong>
                            </Typography>
                            {ref.safetyRelations &&
                              ref.safetyRelations.length > 0 && (
                                <WarningAmberIcon
                                  sx={{
                                    fontSize: 14,
                                    color: ref.safetyRelations.some(
                                      (s) => s.relevance === "direct",
                                    )
                                      ? "error.main"
                                      : "warning.main",
                                  }}
                                />
                              )}
                          </Stack>
                        }
                        secondary={
                          ref.relationTypes ? (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}
                            >
                              {ref.relationTypes.map((relType) => {
                                const colors = ref.assetGroup
                                  ? getAssetGroupColor(
                                      ref.assetGroup as AssetGroup,
                                    )
                                  : { color: "#666", colorLight: "#f5f5f5" }; // Default fallback

                                return (
                                  <Chip
                                    key={relType}
                                    label={getRelationTypeText(
                                      relType,
                                      ref.assetGroup as any,
                                      "en",
                                    ).toLowerCase()}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: "0.75rem",
                                      borderColor: colors.color,
                                      color: colors.color,
                                      backgroundColor: colors.colorLight,
                                    }}
                                  />
                                );
                              })}
                            </Stack>
                          ) : undefined
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>

          {/* Safety summary */}
          <SafetySummary refs={referencingElements} />
        </>
      )}
    </Stack>
  );

  // ==================== RENDER ====================

  return (
    <Box sx={{ p: 1 }}>
      {/* Category-change confirmation */}
      <ConfirmDialog
        open={pendingCategory !== null}
        title={t("tabs.dfd.element_description.asset.categoryChange.title", {
          defaultValue: "Change Asset Category?",
        })}
        message={t(
          "tabs.dfd.element_description.asset.categoryChange.warning",
          {
            defaultValue:
              "This asset is referenced by DFD elements. Changing the category will invalidate all existing relation types in those elements, as relation types are category-specific.",
          },
        )}
        confirmLabel={t(
          "tabs.dfd.element_description.asset.categoryChange.confirm",
          { defaultValue: "Change category" },
        )}
        confirmColor="warning"
        onConfirm={handleCategoryChangeConfirm}
        onCancel={() => setPendingCategory(null)}
      />

      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label={t("tabs.dfd.element_description.asset.tabs.general", {
            defaultValue: "General",
          })}
        />
        <Tab
          label={
            <Stack direction="row" spacing={0.75} alignItems="center">
              <span>
                {t("tabs.dfd.element_description.asset.tabs.usedIn", {
                  defaultValue: "Used in",
                })}
              </span>
              {referencingElements.length > 0 && (
                <Chip
                  label={referencingElements.length}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: 10,
                    "& .MuiChip-label": { px: 0.75 },
                    bgcolor: hasSafetyAnnotations
                      ? "error.light"
                      : "action.selected",
                    color: hasSafetyAnnotations
                      ? "error.contrastText"
                      : "text.primary",
                  }}
                />
              )}
            </Stack>
          }
        />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {renderGeneralTab()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderUsedInTab()}
      </TabPanel>
    </Box>
  );
};;;;;;;;;;;;

export default AssetDescriptionForm;