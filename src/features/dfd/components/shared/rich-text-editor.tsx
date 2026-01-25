// ==================== RICH TEXT EDITOR (SHARED) ====================
// Reusable rich-text editor component

import React, { useState } from "react";
import {
  Paper,
  TextField,
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

type TextFormat = "bold" | "italic" | "underline" | "bulletList" | "numberedList";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  helperText?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  required = false,
  helperText,
}) => {
  const [formats, setFormats] = useState<TextFormat[]>([]);

  const handleFormatChange = (
    _event: React.MouseEvent<HTMLElement>,
    newFormats: TextFormat[]
  ) => {
    setFormats(newFormats);
  };

  const applyFormat = (format: TextFormat) => {
    const textarea = document.querySelector(
      `textarea[aria-label="${label}"]`
    ) as HTMLTextAreaElement;
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

    const newValue =
      value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);

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
          <ToggleButton
            value="numberedList"
            onClick={() => applyFormat("numberedList")}
          >
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
        helperText={helperText}
        inputProps={{
          "aria-label": label,
          style: { minHeight: 120 },
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