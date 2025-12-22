// ==================== DFD VALIDATION PANEL ====================
// Single Responsibility: Display validation errors and warnings

import React from 'react';
import { useTranslation } from "react-i18next";
import { Paper, Stack, Alert } from "@mui/material";
import { ValidationResult } from "../services/dfd-validator";

interface DFDValidationPanelProps {
  validation: ValidationResult;
}

/**
 * Parse and translate validation messages
 * 
 * Message formats from DFDValidator:
 * - Simple: "dfdValidation.noElements"
 * - With name: "dfdValidation.emptyTrustBoundary:TB Name"
 * - With type and name: "dfdValidation.unconnectedElement:Process:MyProcess"
 */
function useValidationTranslation() {
  const { t } = useTranslation();

  const translateMessage = (message: string): string => {
    // Split by colon to extract key and parameters
    const parts = message.split(':');
    const key = parts[0];

    // Simple message without parameters
    if (parts.length === 1) {
      return t(key);
    }

    // Message with name only (e.g., emptyTrustBoundary:TB Name)
    if (parts.length === 2) {
      const name = parts[1];
      return t(key, { name });
    }

    // Message with type and name (e.g., unconnectedElement:Process:MyProcess)
    if (parts.length === 3) {
      const elementType = parts[1];
      const name = parts[2];
      // Translate the element type using the elementTypes sub-object
      const translatedType = t(`dfdValidation.elementTypes.${elementType}`, elementType);
      return t(key, { type: translatedType, name });
    }

    // Fallback: return original message if format is unexpected
    return message;
  };

  return { translateMessage };
}

export const DFDValidationPanel: React.FC<DFDValidationPanelProps> = ({
  validation,
}) => {
  const { translateMessage } = useValidationTranslation();
  
  const hasContent =
    validation.errors.length > 0 || validation.warnings.length > 0;

  if (!hasContent) return null;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 1.5,
        borderRadius: 0,
        maxHeight: 120,
        overflow: "auto",
      }}
    >
      <Stack spacing={0.5}>
        {validation.errors.map((error, index) => (
          <Alert
            key={`error-${index}`}
            severity="error"
            sx={{ py: 0.25, "& .MuiAlert-message": { py: 0.5 } }}
          >
            {translateMessage(error)}
          </Alert>
        ))}
        {validation.warnings.map((warning, index) => (
          <Alert
            key={`warning-${index}`}
            severity="warning"
            sx={{ py: 0.25, "& .MuiAlert-message": { py: 0.5 } }}
          >
            {translateMessage(warning)}
          </Alert>
        ))}
      </Stack>
    </Paper>
  );
};

export default DFDValidationPanel;