// ==================== ASSET DESCRIPTION FORM ====================
// Asset ≠ DFD Element (schützenswert, kontextübergreifend)
// Phase 3C: Shows reverse relations (which elements reference this asset)

import React, { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  RadioGroup,
  Radio,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Dashboard as ProcessIcon,
  Layers as MultiProcessIcon,
  Person as ExternalEntityIcon,
  Storage as DataStoreIcon,
  SwapHoriz as DataFlowIcon,
  Cable as InterfaceIcon,
  Link as LinkIcon,
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

interface AssetFormProps {
  asset: DFDAsset;
  onChange: (updates: Partial<DFDAsset>) => void;
  // Phase 3C: Optional reverse relations
  elements?: DFDElement[];
  connections?: DFDConnection[];
}

interface ElementReference {
  elementId: string;
  elementName: string;
  elementDisplayId: string;
  elementType: DFDElementType | "DataFlow";
  relationTypes: AssetRelationType[];
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get icon for element type
 */
const getElementTypeIcon = (type: DFDElementType | "DataFlow") => {
  const iconProps = { fontSize: "small" as const };

  switch (type) {
    case "Process":
      return <ProcessIcon {...iconProps} />;
    case "Multiprocess":
      return <MultiProcessIcon {...iconProps} />;
    case "ExternalEntity":
      return <ExternalEntityIcon {...iconProps} />;
    case "DataStore":
      return <DataStoreIcon {...iconProps} />;
    case "Interface":
      return <InterfaceIcon {...iconProps} />;
    case "DataFlow":
      return <DataFlowIcon {...iconProps} />;
    default:
      return <LinkIcon {...iconProps} />;
  }
};

/**
 * Get color for relation type chip
 */
const getRelationTypeColor = (
  relationType: AssetRelationType,
): "primary" | "secondary" | "success" | "warning" => {
  switch (relationType) {
    case "processes":
      return "primary";
    case "creates":
      return "success";
    case "stores":
      return "warning";
    case "transports":
      return "secondary";
    default:
      return "primary";
  }
};

/**
 * Find all elements/connections that reference this asset
 */
const getElementsReferencingAsset = (
  assetId: string,
  elements: DFDElement[] = [],
  connections: DFDConnection[] = []
): ElementReference[] => {
  const references: ElementReference[] = [];

  // Check elements
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

  // Check connections
  connections.forEach((connection) => {
    const relation = connection.assetRelations?.find(
      (r) => r.assetId === assetId
    );
    if (relation && relation.relationTypes.length > 0) {
      const label = connection.label || `${connection.from} → ${connection.to}`;
      references.push({
        elementId: connection.id,
        elementName: label,
        elementDisplayId: connection.displayId || connection.id,
        elementType: "DataFlow",
        relationTypes: relation.relationTypes,
      });
    }
  });

  return references;
};

// ==================== COMPONENT ====================

export const AssetDescriptionForm: React.FC<AssetFormProps> = ({
  asset,
  onChange,
  elements = [],
  connections = [],
}) => {
  const { t } = useTranslation();

  const [category, setCategory] = useState(asset.properties?.category || "");

  // Calculate reverse relations
  const referencingElements = useMemo(
    () => getElementsReferencingAsset(asset.id, elements, connections),
    [asset.id, elements, connections],
  );

  const handlePropertyChange = useCallback(
    (field: string, value: any) => {
      onChange({
        properties: {
          ...(asset.properties ?? {}),
          [field]: value,
        },
      });
    },
    [onChange, asset.properties],
  );

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    handlePropertyChange("category", newCategory);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Info */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Assets are valuable resources that need protection - they're separate
          from DFD elements.
        </Typography>
      </Alert>

      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Required Fields
      </Typography>

      <TextField
        fullWidth
        label="Asset Name"
        value={asset.name || ""}
        onChange={(e) => onChange({ name: e.target.value })}
        required
        sx={{ mb: 2 }}
      />

      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>
          Category *
        </Typography>
        <RadioGroup
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <FormControlLabel
            value="data"
            control={<Radio />}
            label="📄 Daten (Sensordaten, Produktionsdaten, Konfigurationen)"
          />
          <FormControlLabel
            value="system"
            control={<Radio />}
            label="💻 Systeme (Server, APIs, SCADA, Cloud-Services)"
          />
          <FormControlLabel
            value="infrastructure"
            control={<Radio />}
            label="🏭 Infrastruktur (Maschinen, Netzwerkgeräte)"
          />
          <FormControlLabel
            value="process"
            control={<Radio />}
            label="🔄 Prozesse (Firmware-Updates, Handbücher, SOPs)"
          />
          <FormControlLabel
            value="human"
            control={<Radio />}
            label="👤 Menschen (Operatoren, Administratoren, Verantwortliche)"
          />
        </RadioGroup>
      </FormControl>

      <RichTextEditor
        value={asset.properties?.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label="Description"
        required
        helperText="What is this asset and why is it valuable?"
      />

      <Divider sx={{ my: 3 }} />

      {/* Protection Level - PFLICHTFELD! */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Protection Requirements
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }} required>
        <InputLabel>Schutzbedarf (Protection Need) *</InputLabel>
        <Select
          value={asset.properties?.protectionNeed || ""}
          onChange={(e) =>
            handlePropertyChange("protectionNeed", e.target.value)
          }
          label="Schutzbedarf (Protection Need) *"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="low">Niedrig - Loss is inconvenient</MenuItem>
          <MenuItem value="medium">Mittel - Loss impacts operations</MenuItem>
          <MenuItem value="high">Hoch - Loss causes serious damage</MenuItem>
          <MenuItem value="critical">
            Kritisch - Loss threatens business/safety
          </MenuItem>
        </Select>
      </FormControl>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="caption">
          💡 "Wie schlimm wäre ein Verlust / Missbrauch dieses Assets?"
        </Typography>
      </Alert>

      {/* Phase 3C: Reverse Relations Display */}
      {referencingElements.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            🔗 Referenced by Elements
          </Typography>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                This asset is referenced by {referencingElements.length}{" "}
                element(s) in the DFD:
              </Typography>

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
                              color={getRelationTypeColor(relationType)}
                              variant="outlined"
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

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption">
              💡 These relations are defined in the respective element forms.
              Changes must be made there.
            </Typography>
          </Alert>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Category-Specific Fields (Dynamic!) */}
      {category && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {category.charAt(0).toUpperCase() + category.slice(1)}-Specific
            Details
          </Typography>

          {category === "data" && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Datentyp</InputLabel>
                <Select
                  multiple
                  value={asset.properties?.dataType || []}
                  onChange={(e) =>
                    handlePropertyChange("dataType", e.target.value)
                  }
                  label="Datentyp"
                  renderValue={(selected) => (selected as string[]).join(", ")}
                >
                  <MenuItem value="pii">PII (Personal Data)</MenuItem>
                  <MenuItem value="trade_secret">Betriebsgeheimnis</MenuItem>
                  <MenuItem value="configuration">Konfiguration</MenuItem>
                  <MenuItem value="telemetry">Telemetrie</MenuItem>
                  <MenuItem value="credentials">Credentials / Secrets</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Lebenszyklus</InputLabel>
                <Select
                  value={asset.properties?.lifecycle || ""}
                  onChange={(e) =>
                    handlePropertyChange("lifecycle", e.target.value)
                  }
                  label="Lebenszyklus"
                >
                  <MenuItem value="transient">Transient (In-Memory)</MenuItem>
                  <MenuItem value="stored">Gespeichert (Persistent)</MenuItem>
                  <MenuItem value="archived">Archiviert (Long-term)</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}

          {category === "system" && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Kritikalität für Betrieb</InputLabel>
                <Select
                  value={asset.properties?.criticality || ""}
                  onChange={(e) =>
                    handlePropertyChange("criticality", e.target.value)
                  }
                  label="Kritikalität für Betrieb"
                >
                  <MenuItem value="supporting">Unterstützend</MenuItem>
                  <MenuItem value="essential">Wesentlich</MenuItem>
                  <MenuItem value="safety_critical">
                    Sicherheitskritisch
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Exponiert</InputLabel>
                <Select
                  value={asset.properties?.exposure || ""}
                  onChange={(e) =>
                    handlePropertyChange("exposure", e.target.value)
                  }
                  label="Exponiert"
                >
                  <MenuItem value="internal">Intern</MenuItem>
                  <MenuItem value="dmz">DMZ</MenuItem>
                  <MenuItem value="internet">Internet</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}

          {category === "infrastructure" && (
            <Stack spacing={2} sx={{ mb: 2 }}>
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
                label="Physischer Zugriff möglich"
              />

              <FormControl fullWidth>
                <InputLabel>Standort</InputLabel>
                <Select
                  value={asset.properties?.location || ""}
                  onChange={(e) =>
                    handlePropertyChange("location", e.target.value)
                  }
                  label="Standort"
                >
                  <MenuItem value="factory">Werk</MenuItem>
                  <MenuItem value="datacenter">Rechenzentrum</MenuItem>
                  <MenuItem value="field">Feld / Remote</MenuItem>
                  <MenuItem value="cloud">Cloud</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}

          {category === "process" && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={asset.properties?.automated || false}
                    onChange={(e) =>
                      handlePropertyChange("automated", e.target.checked)
                    }
                  />
                }
                label="Automatisiert"
              />

              <FormControl fullWidth>
                <InputLabel>Änderungsfrequenz</InputLabel>
                <Select
                  value={asset.properties?.changeFrequency || ""}
                  onChange={(e) =>
                    handlePropertyChange("changeFrequency", e.target.value)
                  }
                  label="Änderungsfrequenz"
                >
                  <MenuItem value="rarely">Selten</MenuItem>
                  <MenuItem value="regular">Regelmäßig</MenuItem>
                  <MenuItem value="frequent">Häufig</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}

          {category === "human" && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Rolle</InputLabel>
                <Select
                  value={asset.properties?.role || ""}
                  onChange={(e) => handlePropertyChange("role", e.target.value)}
                  label="Rolle"
                >
                  <MenuItem value="operator">Operator</MenuItem>
                  <MenuItem value="admin">Administrator</MenuItem>
                  <MenuItem value="developer">Entwickler</MenuItem>
                  <MenuItem value="external">Extern (Contractor)</MenuItem>
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
                label="Sicherheitsrelevant (hat Zugriff auf kritische Systeme)"
              />
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Advanced / Optional Section */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            Advanced / Optional
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Owner / Responsible"
              value={asset.properties?.owner || ""}
              onChange={(e) => handlePropertyChange("owner", e.target.value)}
              placeholder="Team or person responsible for this asset"
            />

            <RichTextEditor
              value={asset.properties?.notes || ""}
              onChange={(value) => handlePropertyChange("notes", value)}
              label="Additional Notes"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};