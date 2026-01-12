// ==================== ELEMENT DESCRIPTION FORM ====================
// Single Responsibility: Rich-text form for describing DFD elements and connections

import React, { useState, useCallback } from "react";
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
  Paper,
  Typography,
  IconButton,
  Toolbar,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from "@mui/material";
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatListBulleted,
  FormatListNumbered,
} from "@mui/icons-material";

import type { DFDElement, DFDConnection, SecurityLevel, TrustLevel } from "../models/dfd-types";

// ==================== TYPES ====================

interface ElementDescriptionFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

interface ConnectionDescriptionFormProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;
}

type TextFormat = "bold" | "italic" | "underline" | "bulletList" | "numberedList";

// ==================== RICH TEXT EDITOR ====================

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  required = false,
}) => {
  const [formats, setFormats] = useState<TextFormat[]>([]);

  const handleFormatChange = (
    _event: React.MouseEvent<HTMLElement>,
    newFormats: TextFormat[]
  ) => {
    setFormats(newFormats);
  };

  const applyFormat = (format: TextFormat) => {
    const textarea = document.querySelector(`textarea[aria-label="${label}"]`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (!selectedText) return;

    let formattedText = selectedText;
    
    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        break;
      case "underline":
        formattedText = `__${selectedText}__`;
        break;
      case "bulletList":
        formattedText = selectedText
          .split("\n")
          .map((line) => (line.trim() ? `• ${line}` : line))
          .join("\n");
        break;
      case "numberedList":
        formattedText = selectedText
          .split("\n")
          .map((line, idx) => (line.trim() ? `${idx + 1}. ${line}` : line))
          .join("\n");
        break;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedText.length);
    }, 0);
  };

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Toolbar variant="dense" sx={{ minHeight: 40, gap: 0.5, bgcolor: "grey.50" }}>
        <ToggleButtonGroup
          value={formats}
          onChange={handleFormatChange}
          size="small"
          aria-label="text formatting"
        >
          <ToggleButton value="bold" onClick={() => applyFormat("bold")}>
            <FormatBold fontSize="small" />
          </ToggleButton>
          <ToggleButton value="italic" onClick={() => applyFormat("italic")}>
            <FormatItalic fontSize="small" />
          </ToggleButton>
          <ToggleButton value="underline" onClick={() => applyFormat("underline")}>
            <FormatUnderlined fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        
        <ToggleButtonGroup size="small">
          <ToggleButton value="bulletList" onClick={() => applyFormat("bulletList")}>
            <FormatListBulleted fontSize="small" />
          </ToggleButton>
          <ToggleButton value="numberedList" onClick={() => applyFormat("numberedList")}>
            <FormatListNumbered fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Toolbar>
      
      <TextField
        fullWidth
        multiline
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}...`}
        required={required}
        inputProps={{
          "aria-label": label,
          style: { minHeight: 120 }
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            "& fieldset": { border: "none" },
          },
        }}
      />
    </Paper>
  );
};

// ==================== ELEMENT FORM ====================

export const ElementDescriptionForm: React.FC<ElementDescriptionFormProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (field: keyof DFDElement, value: any) => {
      onChange({ [field]: value });
    },
    [onChange]
  );

  const handlePropertyChange = useCallback(
    <K extends keyof DFDElement["properties"]>(
      field: K,
      value: DFDElement["properties"][K]
    ) => {
      onChange({
        properties: {
          ...element.properties,
          [field]: value,
        },
      });
    },
    [onChange, element.properties]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.required", {
          defaultValue: "Required Fields",
        })}
      </Typography>

      {/* Description - Required */}
      <RichTextEditor
        value={element.description || ""}
        onChange={(value) => handleChange("description", value)}
        label={t("tabs.dfd.element_description.description", {
          defaultValue: "Description",
        })}
        required
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.optional", {
          defaultValue: "Threat Modeling Fields (Optional)",
        })}
      </Typography>

      {/* Security Level */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          {t("tabs.dfd.element_description.securityLevel", {
            defaultValue: "Security Level",
          })}
        </InputLabel>
        <Select
          value={element.properties.securityLevel || ""}
          onChange={(e) =>
            handlePropertyChange(
              "securityLevel",
              e.target.value as SecurityLevel
            )
          }
          label="Security Level"
        >
          <MenuItem value="">
            <em>{t("common.none", { defaultValue: "None" })}</em>
          </MenuItem>
          <MenuItem value="public">Public</MenuItem>
          <MenuItem value="internal">Internal</MenuItem>
          <MenuItem value="confidential">Confidential</MenuItem>
          <MenuItem value="secret">Secret</MenuItem>
        </Select>
      </FormControl>

      {/* Data Classification */}
      <TextField
        fullWidth
        label={t("tabs.dfd.element_description.dataClassification", {
          defaultValue: "Data Classification",
        })}
        value={element.properties.dataClassification || ""}
        onChange={(e) =>
          handlePropertyChange("dataClassification", e.target.value)
        }
        placeholder="e.g., PII, Financial, Health Data"
        sx={{ mb: 2 }}
      />

      {/* Trust Level */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          {t("tabs.dfd.element_description.trustLevel", {
            defaultValue: "Trust Level",
          })}
        </InputLabel>
        <Select
          value={element.properties.trustLevel || ""}
          onChange={(e) =>
            handlePropertyChange("trustLevel", e.target.value as TrustLevel)
          }
          label="Trust Level"
        >
          <MenuItem value="">
            <em>{t("common.none", { defaultValue: "None" })}</em>
          </MenuItem>
          <MenuItem value="trusted">Trusted</MenuItem>
          <MenuItem value="untrusted">Untrusted</MenuItem>
          <MenuItem value="unknown">Unknown</MenuItem>
        </Select>
      </FormControl>

      {/* Checkboxes */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={element.properties.authenticationRequired || false}
              onChange={(e) =>
                handlePropertyChange("authenticationRequired", e.target.checked)
              }
            />
          }
          label={t("tabs.dfd.element_description.authRequired", {
            defaultValue: "Authentication Required",
          })}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={element.properties.encryptionRequired || false}
              onChange={(e) =>
                handlePropertyChange("encryptionRequired", e.target.checked)
              }
            />
          }
          label={t("tabs.dfd.element_description.encryptionRequired", {
            defaultValue: "Encryption Required",
          })}
        />
      </Stack>

      {/* Security Notes */}
      <RichTextEditor
        value={element.properties.securityNotes || ""}
        onChange={(value) => handlePropertyChange("securityNotes", value)}
        label={t("tabs.dfd.element_description.securityNotes", {
          defaultValue: "Security Notes",
        })}
      />
    </Box>
  );
};

// ==================== CONNECTION FORM ====================

export const ConnectionDescriptionForm: React.FC<
  ConnectionDescriptionFormProps
> = ({ connection, onChange }) => {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (field: keyof DFDConnection, value: any) => {
      onChange({ [field]: value });
    },
    [onChange]
  );

  const handlePropertyChange = useCallback(
    <K extends keyof NonNullable<DFDConnection["properties"]>>(
      field: K,
      value: NonNullable<DFDConnection["properties"]>[K]
    ) => {
      onChange({
        properties: {
          ...(connection.properties ?? {}),
          [field]: value,
        },
      });
    },
    [onChange, connection.properties]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.required", {
          defaultValue: "Required Fields",
        })}
      </Typography>

      {/* Description - Required */}
      <RichTextEditor
        value={connection.properties?.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label={t("tabs.dfd.element_description.description", {
          defaultValue: "Description",
        })}
        required
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.optional", {
          defaultValue: "Threat Modeling Fields (Optional)",
        })}
      </Typography>

      {/* Security Level */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          {t("tabs.dfd.element_description.securityLevel", {
            defaultValue: "Security Level",
          })}
        </InputLabel>
        <Select
          value={connection.properties?.securityLevel || ""}
          onChange={(e) =>
            handlePropertyChange(
              "securityLevel",
              e.target.value as SecurityLevel
            )
          }
          label="Security Level"
        >
          <MenuItem value="">
            <em>{t("common.none", { defaultValue: "None" })}</em>
          </MenuItem>
          <MenuItem value="public">Public</MenuItem>
          <MenuItem value="internal">Internal</MenuItem>
          <MenuItem value="confidential">Confidential</MenuItem>
          <MenuItem value="secret">Secret</MenuItem>
        </Select>
      </FormControl>

      {/* Checkboxes */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={connection.properties?.authenticationRequired || false}
              onChange={(e) =>
                handlePropertyChange("authenticationRequired", e.target.checked)
              }
            />
          }
          label={t("tabs.dfd.element_description.authRequired", {
            defaultValue: "Authentication Required",
          })}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={connection.properties?.encryptionRequired || false}
              onChange={(e) =>
                handlePropertyChange("encryptionRequired", e.target.checked)
              }
            />
          }
          label={t("tabs.dfd.element_description.encryptionRequired", {
            defaultValue: "Encryption Required",
          })}
        />
      </Stack>

      {/* Security Notes */}
      <RichTextEditor
        value={connection.properties?.securityNotes || ""}
        onChange={(value) => handlePropertyChange("securityNotes", value)}
        label={t("tabs.dfd.element_description.securityNotes", {
          defaultValue: "Security Notes",
        })}
      />
    </Box>
  );
};