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

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
  Cloud as ServiceIcon,
  Computer as SystemIcon,
  DataObject as DataIcon,
  ExpandMore as ExpandMoreIcon,
  Factory as InfrastructureIcon,
  Functions as FunctionIcon,
  Info as InfoIcon,
  Inventory2 as PhysicalIcon,
  Loop as ProcessIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
  Storage as DataStoreIcon,
  SwapHoriz as DataFlowIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";

import type {
  DFDConnection,
  DFDElement,
  DFDElementType,
} from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import type { AssetToAssetRelation } from "../../models/asset-relation-types";
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
import { AssetToAssetSelector } from "./asset-to-asset-selector";
import { AssetGroup, AnyAssetRelationType } from "shared";

// ==================== TYPES ====================

interface AssetDescriptionFormProps {
  asset: DFDAsset;
  onChange: (changes: Partial<DFDAsset>) => void;
  /** All assets available as A2A relation targets */
  allAssets?: DFDAsset[];
  elements?: DFDElement[];
  connections?: DFDConnection[];
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
  /** Auto-focus name field on mount (e.g. after creating new asset) */
  autoFocusName?: boolean;
  /** Called after name field has been focused */
  onNameFocused?: () => void;
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
      .filter(
        (r) => !isIsAnRelation(r) && r.safety && r.safety.relevance !== "none",
      )
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
  allAssets = [],
  elements = [],
  connections = [],
  onAssetFeatureUpdate,
  autoFocusName = false,
  onNameFocused,
}) => {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name field when requested (e.g. after new asset creation)
  useEffect(() => {
    if (autoFocusName && nameInputRef.current) {
      nameInputRef.current.focus();
      onNameFocused?.();
    }
  }, [autoFocusName, onNameFocused]);

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
  const [localName, setLocalName] = React.useState(asset.name || "");
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
    // Only sync from outside if the field is not focused (avoid cursor jump)
    setLocalName((prev) =>
      document.activeElement?.id === "asset-name-input"
        ? prev
        : asset.name || "",
    );
  }, [asset.name]);
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

  const commitName = useCallback(
    (newName: string) => {
      const trimmed = newName.trim();
      if (trimmed === asset.name) return;
      onChange({ name: trimmed });
      onAssetFeatureUpdate?.(asset.id, { name: trimmed });
    },
    [asset.id, asset.name, onChange, onAssetFeatureUpdate],
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
            id="asset-name-input"
            fullWidth
            inputRef={nameInputRef}
            label={t("tabs.dfd.element_description.asset.name")}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => commitName(localName)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
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

      {/* Category — collapsed by default, expand only to change */}
      {(() => {
        const GROUP_ICONS: Record<string, React.ReactNode> = {
          data: <DataIcon fontSize="small" />,
          function: <FunctionIcon fontSize="small" />,
          system: <SystemIcon fontSize="small" />,
          infrastructure: <InfrastructureIcon fontSize="small" />,
          process: <ProcessIcon fontSize="small" />,
          physical: <PhysicalIcon fontSize="small" />,
          service: <ServiceIcon fontSize="small" />,
          human: <PersonIcon fontSize="small" />,
        };
        const GROUP_EXAMPLES: Record<string, string> = {
          data: "NC program, safety parameters, credentials",
          function: "Emergency stop, brake control, auth function",
          system: "CNC controller, Safety PLC, SCADA server",
          infrastructure: "Network switch, machine guarding, enclosure",
          process: "Firmware update, commissioning, SOP",
          physical: "Hydraulic actuator, tool, prototype",
          service: "OTA update service, cloud backend, LDAP",
          human: "Operator, maintenance engineer, admin",
        };
        const ALL_GROUPS = [
          "data",
          "function",
          "system",
          "infrastructure",
          "process",
          "physical",
          "service",
          "human",
        ] as const;
        const currentIcon = GROUP_ICONS[category];
        const currentExamples = category ? GROUP_EXAMPLES[category] : null;
        return (
          <Accordion
            defaultExpanded={false}
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                minHeight: 40,
                "& .MuiAccordionSummary-content": { my: 0.5 },
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ flexWrap: "wrap" }}
              >
                {currentIcon && (
                  <Box
                    sx={{
                      color: getAssetGroupColor(category as AssetGroup).color,
                      display: "flex",
                    }}
                  >
                    {currentIcon}
                  </Box>
                )}
                {category ? (
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {t(`assets.groups.${category}`, {
                        defaultValue: category,
                      })}
                    </Box>
                    {currentExamples && (
                      <Box
                        component="span"
                        sx={{ ml: 0.75, fontSize: 11, color: "text.secondary" }}
                      >
                        ({currentExamples})
                      </Box>
                    )}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t("tabs.dfd.element_description.asset.category")}
                  </Typography>
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1 }}>
              {referencingElements.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
                  <Typography variant="caption">
                    {t(
                      "tabs.dfd.element_description.asset.categoryChange.warning",
                      {
                        defaultValue:
                          "Changing the category will invalidate all existing element relations for this asset.",
                      },
                    )}
                  </Typography>
                </Alert>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1.5, display: "block" }}
              >
                {t("tabs.dfd.element_description.asset.categoryGuidance")}
              </Typography>
              <Box
                sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}
              >
                {ALL_GROUPS.map((cat) => {
                  const isSelected = category === cat;
                  const colors = getAssetGroupColor(cat);
                  return (
                    <Paper
                      key={cat}
                      variant="outlined"
                      onClick={() => handleCategoryChangeRequest(cat)}
                      sx={{
                        p: 1.25,
                        cursor: "pointer",
                        borderRadius: 1,
                        borderColor: isSelected ? colors.color : "divider",
                        bgcolor: isSelected ? colors.colorLight : undefined,
                        "&:hover": {
                          borderColor: colors.color,
                          bgcolor: colors.colorLight,
                        },
                        transition: "all 0.15s",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        <Box
                          sx={{ color: colors.color, mt: 0.25, flexShrink: 0 }}
                        >
                          {GROUP_ICONS[cat]}
                        </Box>
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={isSelected ? 600 : 400}
                            sx={{
                              color: isSelected ? colors.color : "text.primary",
                            }}
                          >
                            {t(`assets.groups.${cat}`, { defaultValue: cat })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {GROUP_EXAMPLES[cat]}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })()}

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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={
                        asset.properties?.containsSafetyRelevantData || false
                      }
                      onChange={(e) =>
                        handlePropertyChange(
                          "containsSafetyRelevantData",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.containsSafetyRelevantData",
                    {
                      defaultValue: "Contains safety-relevant data (EN 50742)",
                    },
                  )}
                />
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.safetyRelevant || false}
                      onChange={(e) =>
                        handlePropertyChange("safetyRelevant", e.target.checked)
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.safetyRelevant",
                    {
                      defaultValue:
                        "Safety-relevant system (direct involvement in safety-critical operations)",
                    },
                  )}
                />
              </Stack>
            )}

            {category === "infrastructure" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t(
                      "tabs.dfd.element_description.asset.physicalAccessControl",
                      {
                        defaultValue: "Physical Access Control",
                      },
                    )}
                  </InputLabel>
                  <Select
                    value={asset.properties?.physicalAccessControl || ""}
                    onChange={(e) =>
                      handlePropertyChange(
                        "physicalAccessControl",
                        e.target.value,
                      )
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.physicalAccessControl",
                      {
                        defaultValue: "Physical Access Control",
                      },
                    )}
                  >
                    <MenuItem value="none">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.none",
                        { defaultValue: "None — uncontrolled access" },
                      )}
                    </MenuItem>
                    <MenuItem value="lock">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.lock",
                        { defaultValue: "Lock" },
                      )}
                    </MenuItem>
                    <MenuItem value="biometric">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.biometric",
                        { defaultValue: "Biometric" },
                      )}
                    </MenuItem>
                    <MenuItem value="guard">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.guard",
                        { defaultValue: "Guard" },
                      )}
                    </MenuItem>
                    <MenuItem value="barrier">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.barrier",
                        { defaultValue: "Physical Barrier" },
                      )}
                    </MenuItem>
                    <MenuItem value="custom">
                      {t(
                        "tabs.dfd.element_description.asset.physicalAccessControlOptions.custom",
                        { defaultValue: "Custom" },
                      )}
                    </MenuItem>
                  </Select>
                </FormControl>
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
                <FormControl fullWidth>
                  <InputLabel>
                    {t(
                      "tabs.dfd.element_description.asset.environmentalHazard",
                      {
                        defaultValue: "Environmental Hazard",
                      },
                    )}
                  </InputLabel>
                  <Select
                    value={asset.properties?.environmentalHazard || ""}
                    onChange={(e) =>
                      handlePropertyChange(
                        "environmentalHazard",
                        e.target.value,
                      )
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.environmentalHazard",
                      {
                        defaultValue: "Environmental Hazard",
                      },
                    )}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="fire">Fire / Explosion hazard</MenuItem>
                    <MenuItem value="chemical">Chemical hazard</MenuItem>
                    <MenuItem value="mechanical">
                      Mechanical hazard (robot, press, CNC)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {category === "process" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.automationLevel", {
                      defaultValue: "Automation Level",
                    })}
                  </InputLabel>
                  <Select
                    value={asset.properties?.automationLevel || ""}
                    onChange={(e) =>
                      handlePropertyChange("automationLevel", e.target.value)
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.automationLevel",
                      {
                        defaultValue: "Automation Level",
                      },
                    )}
                  >
                    <MenuItem value="manual">
                      {t(
                        "tabs.dfd.element_description.asset.automationLevelOptions.manual",
                        { defaultValue: "Manual — human operated" },
                      )}
                    </MenuItem>
                    <MenuItem value="partly_automated">
                      {t(
                        "tabs.dfd.element_description.asset.automationLevelOptions.partly_automated",
                        {
                          defaultValue: "Partly Automated — human in the loop",
                        },
                      )}
                    </MenuItem>
                    <MenuItem value="fully_automated">
                      {t(
                        "tabs.dfd.element_description.asset.automationLevelOptions.fully_automated",
                        {
                          defaultValue:
                            "Fully Automated — no human intervention",
                        },
                      )}
                    </MenuItem>
                  </Select>
                </FormControl>
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
                <TextField
                  fullWidth
                  size="small"
                  label={t("tabs.dfd.element_description.asset.domain", {
                    defaultValue: "Domain / Regulatory context",
                  })}
                  value={asset.properties?.domain || ""}
                  onChange={(e) =>
                    handlePropertyChange("domain", e.target.value)
                  }
                  placeholder="e.g. OT-Manufacturing, Medical, Pharma, Automotive"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.isValidatedProcess || false}
                      onChange={(e) =>
                        handlePropertyChange(
                          "isValidatedProcess",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.isValidatedProcess",
                    {
                      defaultValue: "Formally validated / certified process",
                    },
                  )}
                />
                {asset.properties?.isValidatedProcess && (
                  <>
                    <TextField
                      fullWidth
                      size="small"
                      label={t(
                        "tabs.dfd.element_description.asset.regulatoryReference",
                        { defaultValue: "Regulatory Reference" },
                      )}
                      value={asset.properties?.regulatoryReference || ""}
                      onChange={(e) =>
                        handlePropertyChange(
                          "regulatoryReference",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. IEC 61508 SIL-2, ISO 13485 §7.5, GMP Annex 11"
                    />
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      required
                      label={t(
                        "tabs.dfd.element_description.asset.validationRationale",
                        {
                          defaultValue: "Validation rationale (required)",
                        },
                      )}
                      value={asset.properties?.validationRationale || ""}
                      onChange={(e) =>
                        handlePropertyChange(
                          "validationRationale",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. SIL-2 validation per IEC 61508, acceptance protocol on file"
                    />
                  </>
                )}
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.isProtectionTarget || false}
                      onChange={(e) =>
                        handlePropertyChange(
                          "isProtectionTarget",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.isProtectionTarget",
                    {
                      defaultValue:
                        "Protection target per ISO 12100 / EN 50742 (person at risk)",
                    },
                  )}
                />
              </Stack>
            )}

            {/* function — safety function + external safety ref */}
            {category === "function" && (
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.isSafetyFunction || false}
                      onChange={(e) =>
                        handlePropertyChange(
                          "isSafetyFunction",
                          e.target.checked,
                        )
                      }
                    />
                  }
                  label={t(
                    "tabs.dfd.element_description.asset.isSafetyFunction",
                    {
                      defaultValue: "Safety function (ISO 12100 / IEC 61508)",
                    },
                  )}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={t("tabs.dfd.element_description.asset.externalRef", {
                    defaultValue: "External safety ref (e.g. SF-001)",
                  })}
                  placeholder="SF-001"
                  value={asset.properties?.externalRefs?.[0]?.id || ""}
                  onChange={(e) =>
                    handlePropertyChange("externalRefs", [
                      { id: e.target.value, standard: "ISO 12100" },
                    ])
                  }
                  helperText={t(
                    "tabs.dfd.element_description.asset.externalRefHint",
                    {
                      defaultValue:
                        "ID from accompanying safety analysis document",
                    },
                  )}
                />
              </Stack>
            )}

            {/* physical — unique / portability */}
            {category === "physical" && (
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={asset.properties?.isUnique || false}
                      onChange={(e) =>
                        handlePropertyChange("isUnique", e.target.checked)
                      }
                    />
                  }
                  label={t("tabs.dfd.element_description.asset.isUnique", {
                    defaultValue:
                      "Unique / irreplaceable (artwork, prototype, one-of-a-kind)",
                  })}
                />
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.portability", {
                      defaultValue: "Portability",
                    })}
                  </InputLabel>
                  <Select
                    value={asset.properties?.portability || ""}
                    onChange={(e) =>
                      handlePropertyChange("portability", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.portability", {
                      defaultValue: "Portability",
                    })}
                  >
                    <MenuItem value="fixed">
                      Fixed (installed component)
                    </MenuItem>
                    <MenuItem value="portable">
                      Portable (tool, key, prototype)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

            {/* service — type + responsibility */}
            {category === "service" && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.serviceType", {
                      defaultValue: "Service type",
                    })}
                  </InputLabel>
                  <Select
                    value={asset.properties?.serviceType || ""}
                    onChange={(e) =>
                      handlePropertyChange("serviceType", e.target.value)
                    }
                    label={t("tabs.dfd.element_description.asset.serviceType", {
                      defaultValue: "Service type",
                    })}
                  >
                    <MenuItem value="internal">
                      Internal (own team, shared boundary)
                    </MenuItem>
                    <MenuItem value="external">
                      External (third-party operated)
                    </MenuItem>
                    <MenuItem value="cloud">
                      Cloud (SaaS / PaaS / IaaS)
                    </MenuItem>
                    <MenuItem value="managed">
                      Managed (no own API access)
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth required>
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.responsibility", {
                      defaultValue: "Responsibility model",
                    })}
                  </InputLabel>
                  <Select
                    value={asset.properties?.responsibility || ""}
                    onChange={(e) =>
                      handlePropertyChange("responsibility", e.target.value)
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.responsibility",
                      {
                        defaultValue: "Responsibility model",
                      },
                    )}
                  >
                    <MenuItem value="owner">
                      Owner — full technical control
                    </MenuItem>
                    <MenuItem value="shared">
                      Shared — e.g. own app-security, provider OS
                    </MenuItem>
                    <MenuItem value="third-party">
                      Third-party — fully external (CRA Art. 13)
                    </MenuItem>
                  </Select>
                </FormControl>
                {/* responsibilityScope — required for third-party, recommended for shared */}
                {(asset.properties?.responsibility === "shared" ||
                  asset.properties?.responsibility === "third-party") && (
                  <TextField
                    fullWidth
                    label={t(
                      "tabs.dfd.element_description.asset.responsibilityScope",
                      { defaultValue: "Responsibility Scope" },
                    )}
                    value={asset.properties?.responsibilityScope || ""}
                    onChange={(e) =>
                      handlePropertyChange(
                        "responsibilityScope",
                        e.target.value,
                      )
                    }
                    multiline
                    rows={2}
                    required={
                      asset.properties?.responsibility === "third-party"
                    }
                    helperText={
                      asset.properties?.responsibility === "third-party"
                        ? t(
                            "tabs.dfd.element_description.asset.responsibilityScopeRequired",
                            {
                              defaultValue:
                                "Required for third-party (CRA Art. 13 supply chain)",
                            },
                          )
                        : t(
                            "tabs.dfd.element_description.asset.responsibilityScopeHint",
                            {
                              defaultValue:
                                "Which security controls are in own vs. provider scope?",
                            },
                          )
                    }
                    placeholder="e.g. Own: app-security, data encryption. Provider: OS hardening, physical security"
                  />
                )}
                <TextField
                  fullWidth
                  label={t("tabs.dfd.element_description.asset.providerName", {
                    defaultValue: "Provider Name",
                  })}
                  value={asset.properties?.providerName || ""}
                  onChange={(e) =>
                    handlePropertyChange("providerName", e.target.value)
                  }
                  placeholder="e.g. AWS, Siemens MindSphere, SAP"
                />
                <TextField
                  fullWidth
                  label={t("tabs.dfd.element_description.asset.slaReference", {
                    defaultValue: "SLA / Contract Reference",
                  })}
                  value={asset.properties?.slaReference || ""}
                  onChange={(e) =>
                    handlePropertyChange("slaReference", e.target.value)
                  }
                  placeholder="e.g. Contract #2024-OT-042, SLA v2.1"
                />
              </Stack>
            )}

            {/* shared safety impact — all groups except data */}
            {category && category !== "data" && (
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>
                    {t("tabs.dfd.element_description.asset.safetyImpact", {
                      defaultValue: "Safety Impact (ISO 12100)",
                    })}
                  </InputLabel>
                  <Select
                    value={asset.properties?.safetyImpact || ""}
                    onChange={(e) =>
                      handlePropertyChange("safetyImpact", e.target.value)
                    }
                    label={t(
                      "tabs.dfd.element_description.asset.safetyImpact",
                      {
                        defaultValue: "Safety Impact (ISO 12100)",
                      },
                    )}
                  >
                    <MenuItem value="">
                      <em>Not assessed</em>
                    </MenuItem>
                    <MenuItem value="none">
                      None — no personal injury possible
                    </MenuItem>
                    <MenuItem value="reversible_injury">
                      Reversible injury
                    </MenuItem>
                    <MenuItem value="irreversible_injury">
                      Irreversible injury / disability
                    </MenuItem>
                    <MenuItem value="fatality">Fatality</MenuItem>
                  </Select>
                </FormControl>
                {asset.properties?.safetyImpact &&
                  asset.properties.safetyImpact !== "none" && (
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      label={t(
                        "tabs.dfd.element_description.asset.safetyRationale",
                        {
                          defaultValue: "Safety Rationale",
                        },
                      )}
                      value={asset.properties?.safetyRationale || ""}
                      onChange={(e) =>
                        handlePropertyChange("safetyRationale", e.target.value)
                      }
                      placeholder={t(
                        "tabs.dfd.element_description.asset.safetyRationalePlaceholder",
                        {
                          defaultValue:
                            "e.g. Compromise allows uncontrolled machine motion leading to operator injury",
                        },
                      )}
                      helperText={t(
                        "tabs.dfd.element_description.asset.safetyRationaleHelper",
                        {
                          defaultValue:
                            "Used in EN 50742 / MVO 2027 audit documentation",
                        },
                      )}
                    />
                  )}
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

  // ==================== TAB 2: RELATIONS (Asset-to-Asset) ====================

  const a2aRelations: AssetToAssetRelation[] =
    (asset as any).assetRelations ?? [];

  const handleA2AChange = useCallback(
    (relations: AssetToAssetRelation[]) => {
      onChange({ ...asset, assetRelations: relations } as any);
    },
    [asset, onChange],
  );

  const renderRelationsTab = () => (
    <Box sx={{ pt: 1 }}>
      <AssetToAssetSelector
        asset={asset}
        allAssets={allAssets}
        onChange={handleA2AChange}
      />
    </Box>
  );

  // ==================== TAB 3: USED IN ====================

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
                                      ref.assetGroup as AssetGroup,
                                      t,
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
                {t("tabs.dfd.element_description.asset.tabs.relations", {
                  defaultValue: "Relations",
                })}
              </span>
              {a2aRelations.length > 0 && (
                <Chip
                  label={a2aRelations.length}
                  size="small"
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
        {renderRelationsTab()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderUsedInTab()}
      </TabPanel>
    </Box>
  );
};

export default AssetDescriptionForm;