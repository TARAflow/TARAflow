// ==================== RECORD DESCRIPTION FIELD ====================
// The description of a DFD element or data flow — the field the DFD's
// completeness counts ("described") and the report's element overview
// shows. Plain text, saved when the field is left (as the asset form's
// description). Above every element and data-flow form.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, TextField } from "@mui/material";

export interface RecordDescriptionFieldProps {
  /** id of the element or flow — a new record resets the field. */
  recordId: string;
  value: string | undefined;
  /** The new description; undefined when emptied. */
  onCommit: (description: string | undefined) => void;
}

export const RecordDescriptionField: React.FC<RecordDescriptionFieldProps> = ({
  recordId,
  value,
  onCommit,
}) => {
  const { t } = useTranslation();
  const [text, setText] = React.useState(value ?? "");
  // Another record, or the description changed elsewhere (undo, import).
  React.useEffect(() => setText(value ?? ""), [recordId, value]);

  return (
    <Box sx={{ px: 2, pt: 2 }}>
      <TextField
        fullWidth
        multiline
        minRows={2}
        size="small"
        label={t("tabs.dfd.recordDescription.label", { defaultValue: "Description" })}
        helperText={t("tabs.dfd.recordDescription.helper", {
          defaultValue: "What the element or flow does. Required for a complete DFD.",
        })}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = text.trim();
          if (next !== (value ?? "").trim()) onCommit(next || undefined);
        }}
        inputProps={{ "data-testid": "record-description" }}
      />
    </Box>
  );
};

export default RecordDescriptionField;
