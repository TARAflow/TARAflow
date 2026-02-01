// ==================== ASSET DESCRIPTION FORM (DFD) ====================
// Clean UI with tooltips, all category-specific fields included
// Used in DFD phase for describing assets placed in diagram

import React, { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Typography,
  Divider,
  Stack,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  DataObject as DataIcon,
  Computer as SystemIcon,
  Factory as InfrastructureIcon,
  Loop as ProcessIcon,
  Person as PersonIcon,
  Storage as DataStoreIcon,
  SwapHoriz as DataFlowIcon,
  Cable as InterfaceIcon,
} from "@mui/icons-material";

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
  DFDElementType,
  AssetRelationType,
} from "../../models/dfd-types";
import { getAssetRelationTypeText } from "../../models/dfd-types";
import { RichTextEditor } from "../shared/rich-text-editor";

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
  relationTypes: AssetRelationType[];
}

// ==================== HELPER FUNCTIONS ====================

const getElementTypeIcon = (type: DFDElementType | "DataFlow") => {
  const iconMap: Record<string, React.ReactNode> = {
    Process: <ProcessIcon fontSize="small" />,
    Multiprocess: <ProcessIcon fontSize="small" />,
    DataStore: <DataStoreIcon fontSize="small" />,
    ExternalEntity: <PersonIcon fontSize="small" />,
    Interface: <InterfaceIcon fontSize="small" />,
    DataFlow: <DataFlowIcon fontSize="small" />,
  };
  return iconMap[type] || <DataIcon fontSize="small" />;
};

const getRelationTypeColor = (relationType: AssetRelationType) => {
  const colorMap: Record<AssetRelationType, any> = {
    stores: "success",
    read: "info",
    modify: "warning",
    creates: "secondary",
    deletes: "primary",
    transports: "primary",
  };
  return colorMap[relationType] || "default";
};

const getElementsReferencingAsset = (
  assetId: string,
  elements: DFDElement[] = [],
  connections: DFDConnection[] = [],
): ElementReference[] => {
  const references: ElementReference[] = [];

  elements.forEach((element) => {
    const relation = element.assetRelations?.find((r) => r.assetId === assetId);
    if (relation && relation.relationTypes.length > 0) {
      references.push({
        elementId: element.id,
        elementName: element.name,
        elementDisplayId: element.displayId || element.id,
        elementType: element.type,
        relationTypes: relation.relationTypes,
      });
    }
  });

  connections.forEach((connection) => {
    const relation = connection.assetRelations?.find(
      (r) => r.assetId === assetId,
    );
    if (relation && relation.relationTypes.length > 0) {
      references.push({
        elementId: connection.id,
        elementName:
          connection.label || `${connection.from} → ${connection.to}`,
        elementDisplayId: connection.displayId || connection.id,
        elementType: "DataFlow",
        relationTypes: relation.relationTypes,
      });
    }
  });

  return references;
};

// ==================== COMPONENT ====================

export const AssetDescriptionForm: React.FC<AssetDescriptionFormProps> = ({
  asset,
  onChange,
  elements = [],
  connections = [],
  onAssetFeatureUpdate,
}) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(asset.properties?.category || "");

  // Local state for RichTextEditor
  const [localDescription, setLocalDescription] = React.useState(
    asset.properties?.description || "",
  );
  const [localNotes, setLocalNotes] = React.useState(
    asset.properties?.notes || "",
  );
  const [localOwner, setLocalOwner] = React.useState(
    asset.properties?.owner || "",
  );

  // Sync when asset changes
  React.useEffect(() => {
    setLocalDescription(asset.properties?.description || "");
  }, [asset.properties?.description]);

  React.useEffect(() => {
    setLocalNotes(asset.properties?.notes || "");
  }, [asset.properties?.notes]);

  React.useEffect(() => {
    setLocalOwner(asset.properties?.owner || "");
  }, [asset.properties?.owner]);

  const referencingElements = useMemo(
    () => getElementsReferencingAsset(asset.id, elements, connections),
    [asset.id, elements, connections],
  );

  // ==================== HANDLERS ====================
  const handleNameChange = useCallback(
    (newName: string) => {
      // Update DFDAsset
      onChange({ name: newName });

      // ✅ CRITICAL: Also update Asset in Assets feature
      if (onAssetFeatureUpdate) {
        onAssetFeatureUpdate(asset.id, { name: newName });
      }
    },
    [asset.id, onChange, onAssetFeatureUpdate],
  );

  const handlePropertyChange = useCallback(
    (key: string, value: any) => {
      const updatedProperties = {
        ...asset.properties,
        [key]: value,
      };

      // Update DFDAsset
      onChange({
        properties: updatedProperties,
      });

      // ✅ CRITICAL: Also update Asset in Assets feature
      if (onAssetFeatureUpdate) {
        onAssetFeatureUpdate(asset.id, { properties: updatedProperties });
      }
    },
    [asset.id, asset.properties, onChange, onAssetFeatureUpdate],
  );

  const handleCategoryChange = useCallback(
    (newCategory: string) => {
      setCategory(newCategory);
      handlePropertyChange("category", newCategory);
    },
    [handlePropertyChange],
  );

  // ==================== RENDER ====================

  return (
    <Box sx={{ p: 2 }}>
      {/* === ASSET NAME === */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
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

      <Divider sx={{ my: 3 }} />

      {/* === CATEGORY === */}
      <Box sx={{ mb: 3 }}>
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
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <Box sx={{ display: "flex", gap: 4, maxWidth: 800 }}>
            {/* Left Column - 3 items */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <FormControlLabel
                value="data"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <DataIcon fontSize="small" />
                    <Typography variant="body2">
                      {t("tabs.dfd.element_description.asset.categoryData")}
                      {" — "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        {t(
                          "tabs.dfd.element_description.asset.categoryDataDesc",
                        )}
                      </Typography>
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="system"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SystemIcon fontSize="small" />
                    <Typography variant="body2">
                      {t("tabs.dfd.element_description.asset.categorySystem")}
                      {" — "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        {t(
                          "tabs.dfd.element_description.asset.categorySystemDesc",
                        )}
                      </Typography>
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="infrastructure"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <InfrastructureIcon fontSize="small" />
                    <Typography variant="body2">
                      {t(
                        "tabs.dfd.element_description.asset.categoryInfrastructure",
                      )}
                      {" — "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        {t(
                          "tabs.dfd.element_description.asset.categoryInfrastructureDesc",
                        )}
                      </Typography>
                    </Typography>
                  </Box>
                }
              />
            </Box>

            {/* Right Column - 2 items */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <FormControlLabel
                value="process"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ProcessIcon fontSize="small" />
                    <Typography variant="body2">
                      {t("tabs.dfd.element_description.asset.categoryProcess")}
                      {" — "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        {t(
                          "tabs.dfd.element_description.asset.categoryProcessDesc",
                        )}
                      </Typography>
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="human"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon fontSize="small" />
                    <Typography variant="body2">
                      {t("tabs.dfd.element_description.asset.categoryHuman")}
                      {" — "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        {t(
                          "tabs.dfd.element_description.asset.categoryHumanDesc",
                        )}
                      </Typography>
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        </RadioGroup>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* === PROTECTION NEED === */}
      <Box sx={{ mb: 3 }}>
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
              {t("tabs.dfd.element_description.asset.protectionLow")}
            </MenuItem>
            <MenuItem value="medium">
              {t("tabs.dfd.element_description.asset.protectionMedium")}
            </MenuItem>
            <MenuItem value="high">
              {t("tabs.dfd.element_description.asset.protectionHigh")}
            </MenuItem>
            <MenuItem value="critical">
              {t("tabs.dfd.element_description.asset.protectionCritical")}
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* === REFERENCING ELEMENTS === */}
      {referencingElements.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />

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
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getElementTypeIcon(ref.elementType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          <strong>[{ref.elementDisplayId}]</strong>{" "}
                          {ref.elementName}
                        </Typography>
                      }
                      secondary={
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          {ref.relationTypes.map((relationType) => (
                            <Chip
                              key={relationType}
                              label={getAssetRelationTypeText(relationType)}
                              size="small"
                              variant="outlined"
                              color={getRelationTypeColor(relationType)}
                            />
                          ))}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </>
      )}

      {/* === CATEGORY-SPECIFIC DETAILS === */}
      {category && (
        <>
          <Divider sx={{ my: 3 }} />

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

          {/* === DATA === */}
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
                  renderValue={(selected) => (selected as string[]).join(", ")}
                >
                  <MenuItem value="pii">PII (Personal Data)</MenuItem>
                  <MenuItem value="trade_secret">Trade Secret</MenuItem>
                  <MenuItem value="configuration">Configuration</MenuItem>
                  <MenuItem value="telemetry">Telemetry</MenuItem>
                  <MenuItem value="credentials">Credentials / Secrets</MenuItem>
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

          {/* === SYSTEM === */}
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

          {/* === INFRASTRUCTURE === */}
          {category === "infrastructure" && (
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={asset.properties?.physicalAccessPossible || false}
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

          {/* === PROCESS === */}
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

          {/* === HUMAN === */}
          {category === "human" && (
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>
                  {t("tabs.dfd.element_description.asset.role")}
                </InputLabel>
                <Select
                  value={asset.properties?.role || ""}
                  onChange={(e) => handlePropertyChange("role", e.target.value)}
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
                      handlePropertyChange("securityRelevant", e.target.checked)
                    }
                  />
                }
                label={t("tabs.dfd.element_description.asset.securityRelevant")}
              />
            </Stack>
          )}
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* === DESCRIPTION === */}
      <Box sx={{ mb: 3 }}>
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
            if (localDescription !== asset.properties?.description) {
              handlePropertyChange("description", localDescription);
            }
          }}
          label=""
          helperText={t("tabs.dfd.element_description.asset.descriptionHelper")}
        />
      </Box>

      {/* === ADVANCED === */}
      <Divider sx={{ my: 3 }} />

      <Accordion>
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
                if (localOwner !== asset.properties?.owner) {
                  handlePropertyChange("owner", localOwner);
                }
              }}
              placeholder={t(
                "tabs.dfd.element_description.asset.ownerPlaceholder",
              )}
            />

            <RichTextEditor
              value={localNotes}
              onChange={setLocalNotes}
              onBlur={() => {
                if (localNotes !== asset.properties?.notes) {
                  handlePropertyChange("notes", localNotes);
                }
              }}
              label={t("tabs.dfd.element_description.asset.notes")}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};;;;;

export default AssetDescriptionForm;