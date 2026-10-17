// ==================== IDENTITY SECTION ====================
// Leveled-DFD Phase 5g (leveled-dfd-multi-diagram-design.md §5.2, §12):
// identity of the selected cell in the details panel — definition or
// context copy, its occurrences, and the identity actions ("Go to
// definition", "Make this the definition", "Promote to definition", "Make
// this a context copy of …"). The actions only change dfd.pages.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { CellRef, IdentityInfo } from "../services/leveled";

export interface IdentitySectionProps {
  info: IdentityInfo;
  onGoTo: (cell: CellRef) => void;
  /** Resolve to an error code, or null on success. */
  onMakeDefinition: () => Promise<string | null>;
  onPromote: () => Promise<string | null>;
  onLinkAsContextCopy: (tfId: string) => Promise<string | null>;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  info,
  onGoTo,
  onMakeDefinition,
  onPromote,
  onLinkAsContextCopy,
}) => {
  const { t } = useTranslation();
  const [target, setTarget] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setTarget("");
    setError(null);
  }, [info.tfId, info.occurrences]);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(await action());
    setBusy(false);
  };

  const isCopy = info.role === "ref";
  return (
    <Box sx={{ px: 2, pt: 1.5 }} data-testid="identity-section">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Chip
          size="small"
          color={isCopy ? "default" : "primary"}
          variant={isCopy ? "outlined" : "filled"}
          label={
            isCopy
              ? t("tabs.dfd.identity.copy", { defaultValue: "Context copy" })
              : t("tabs.dfd.identity.definition", { defaultValue: "Definition" })
          }
          data-testid="identity-role"
        />
        {info.dangling && (
          <Chip
            size="small"
            color="error"
            label={t("tabs.dfd.identity.dangling", { defaultValue: "definition missing" })}
          />
        )}
      </Stack>

      {isCopy && info.definition && (
        <Typography variant="body2">
          {t("tabs.dfd.identity.definedOn", {
            defaultValue: 'Defined on page "{{page}}".',
            page: info.definition.pageName,
          })}{" "}
          <Link
            component="button"
            variant="body2"
            onClick={() => onGoTo(info.definition!)}
            data-testid="identity-goto-definition"
          >
            {t("tabs.dfd.identity.goToDefinition", { defaultValue: "Go to definition" })}
          </Link>
        </Typography>
      )}
      {info.dangling && (
        <Alert severity="error" variant="outlined" sx={{ py: 0, my: 0.5 }}>
          {t("tabs.dfd.identity.danglingHint", {
            defaultValue: "The definition was deleted — promote one copy, or delete the element.",
          })}
        </Alert>
      )}

      {info.occurrences.length > 1 && (
        <Box sx={{ mt: 0.5 }} data-testid="identity-occurrences">
          <Typography variant="caption" color="text.secondary">
            {t("tabs.dfd.identity.occurrences", { defaultValue: "Shown on" })}:{" "}
          </Typography>
          {info.occurrences.map((o, i) => (
            <React.Fragment key={`${o.pageId}/${o.cellId}`}>
              {i > 0 && ", "}
              <Link component="button" variant="caption" onClick={() => onGoTo(o)}>
                {o.pageName}
                {o.role === "definition" ? " ★" : ""}
              </Link>
            </React.Fragment>
          ))}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {info.canMakeDefinition && (
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => void run(onMakeDefinition)}
            data-testid="identity-make-definition"
          >
            {t("tabs.dfd.identity.makeDefinition", { defaultValue: "Make this the definition" })}
          </Button>
        )}
        {info.canPromote && (
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={busy}
            onClick={() => void run(onPromote)}
            data-testid="identity-promote"
          >
            {t("tabs.dfd.identity.promote", { defaultValue: "Promote to definition" })}
          </Button>
        )}
      </Stack>

      {info.contextCopyCandidates.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {t("tabs.dfd.identity.makeCopyOf", { defaultValue: "Make this a context copy of" })}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              displayEmpty
              value={target}
              onChange={(e) => setTarget(String(e.target.value))}
              sx={{ minWidth: 180, flexGrow: 1 }}
              inputProps={{ "data-testid": "identity-copy-target" }}
            >
              <MenuItem value="">
                <em>{t("tabs.dfd.identity.chooseElement", { defaultValue: "choose…" })}</em>
              </MenuItem>
              {info.contextCopyCandidates.map((c) => (
                <MenuItem key={c.tfId} value={c.tfId}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
            <Button
              size="small"
              variant="outlined"
              disabled={busy || target === ""}
              onClick={() => void run(() => onLinkAsContextCopy(target))}
              data-testid="identity-make-copy"
            >
              {t("tabs.dfd.identity.apply", { defaultValue: "Apply" })}
            </Button>
          </Stack>
          {target !== "" && (
            <Typography variant="caption" color="warning.main" display="block">
              {t("tabs.dfd.identity.makeCopyWarning", {
                defaultValue:
                  "This cell then shows the chosen element; its own record (properties, asset relations) is no longer used and its threats become orphans.",
              })}
            </Typography>
          )}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1 }} data-testid="identity-error">
          {t("tabs.dfd.identity.error", {
            defaultValue: "Not possible ({{code}}).",
            code: error,
          })}
        </Alert>
      )}
    </Box>
  );
};

export default IdentitySection;
