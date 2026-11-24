// features/threats/components/shared/element-info-button.tsx
//
// ⓘ next to an element or data flow in the Threats tab: opens a panel with what
// the DFD knows about it — description, filled-in properties, boundaries,
// connected flows, linked assets — so the analyst can rate a threat without
// switching to the DFD tab (manual test 2026-11-24). Stays open until closed;
// a tooltip would vanish on the way to the rating buttons.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Collapse, Divider, IconButton, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { ExpandMore as ExpandIcon, InfoOutlined as InfoIcon } from "@mui/icons-material";
import {
  elementInfo,
  flowInfo,
  propertyFormKey,
  type ElementInfo,
  type InfoEndpoint,
  type InfoValue,
} from "../../services/element-info";
import { useElementInfoGraph } from "./element-info-context";

export type ElementInfoTarget =
  | { elementId: string | undefined }
  | { connectionId?: string | undefined; flowDisplayId?: string | undefined };

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const ElementInfoButton: React.FC<{ target: ElementInfoTarget }> = ({ target }) => {
  const { t } = useTranslation();
  const graph = useElementInfoGraph();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const elementId = "elementId" in target ? target.elementId : undefined;
  const connectionId = "elementId" in target ? undefined : target.connectionId;
  const flowDisplayId = "elementId" in target ? undefined : target.flowDisplayId;
  const isElement = "elementId" in target;
  const info = useMemo(
    () =>
      isElement
        ? elementInfo(graph, elementId)
        : flowInfo(graph, {
            ...(connectionId ? { connectionId } : {}),
            ...(flowDisplayId ? { displayId: flowDisplayId } : {}),
          }),
    [graph, isElement, elementId, connectionId, flowDisplayId],
  );
  if (!info) return null;
  const label = t("tabs.threats.elementInfo.button", { id: info.displayId, defaultValue: "Show DFD info of {{id}}" });
  return (
    <>
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          sx={{ p: 0.25 }}
          onClick={(e) => {
            e.stopPropagation(); // inside an accordion header: do not toggle it
            setAnchor(e.currentTarget);
          }}
          onFocus={stop}
        >
          <InfoIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        // React events bubble out of the portal into the accordion header.
        onClick={stop}
        slotProps={{ paper: { sx: { width: 440, maxHeight: "60vh", p: 1.5 } } }}
      >
        <ElementInfoPanel info={info} />
      </Popover>
    </>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mt: 1 }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold", textTransform: "uppercase" }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const K = "tabs.threats.elementInfo";

/** The filled-in properties, labelled like the DFD form; fields the form does not show stay hidden. */
const PropertyRows: React.FC<{ info: ElementInfo }> = ({ info }) => {
  const { t, i18n } = useTranslation();
  const form = `tabs.dfd.element_description.${propertyFormKey(info.type)}.fields`;

  const formatValue = (key: string, value: InfoValue): string => {
    const one = (v: string | number | boolean): string => {
      if (typeof v === "boolean") return t(v ? "common.yes" : "common.no");
      const optionKey = `${form}.${key}.options.${v}`;
      return i18n.exists(optionKey) ? t(optionKey) : String(v);
    };
    return Array.isArray(value) ? value.map(one).join(", ") : one(value as string | number | boolean);
  };
  const rows = info.properties
    .filter((p) => i18n.exists(`${form}.${p.key}.label`))
    .map((p) => ({ key: p.key, label: t(`${form}.${p.key}.label`), value: formatValue(p.key, p.value) }));
  if (rows.length === 0)
    return (
      <Typography variant="body2" color="text.secondary">
        {t(`${K}.noProperties`, { defaultValue: "No properties filled in." })}
      </Typography>
    );
  return (
    <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 1.5, rowGap: 0.25, m: 0 }}>
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {r.label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
            {r.value}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
};

/** Source or target of a flow; expands to the element's description and properties. */
const EndpointRow: React.FC<{ endpoint: InfoEndpoint }> = ({ endpoint: e }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const roleLabel = t(`${K}.${e.role}`, { defaultValue: e.role });
  const details = e.element;
  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {roleLabel}: {e.displayId} {e.name}{" "}
          <Typography component="span" variant="caption" color="text.secondary">
            ({e.type})
          </Typography>
        </Typography>
        {details && (
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            aria-expanded={open}
            aria-label={t(`${K}.endpointDetails`, { id: e.displayId, defaultValue: "Details of {{id}}" })}
            onClick={() => setOpen((v) => !v)}
          >
            <ExpandIcon sx={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </IconButton>
        )}
      </Stack>
      {details && (
        <Collapse in={open} unmountOnExit>
          <Box sx={{ pl: 1.5, ml: 0.5, my: 0.5, borderLeft: 2, borderColor: "divider" }} data-testid={`endpoint-details-${e.role}`}>
            {details.boundaries.length > 0 && (
              <Typography variant="caption" color="text.secondary" component="div">
                {t(`${K}.boundaries`, { defaultValue: "Inside" })}: {details.boundaries.join(", ")}
              </Typography>
            )}
            {details.description && (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 0.5 }}>
                {details.description}
              </Typography>
            )}
            <PropertyRows info={details} />
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export const ElementInfoPanel: React.FC<{ info: ElementInfo }> = ({ info }) => {
  const { t } = useTranslation();

  return (
    <Box data-testid="element-info-panel">
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label={info.displayId} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {info.name}
        </Typography>
        <Chip label={info.type} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
      </Stack>
      {info.boundaries.length > 0 && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          {t(`${K}.boundaries`, { defaultValue: "Inside" })}: {info.boundaries.join(", ")}
        </Typography>
      )}
      {info.endpoints.length > 0 && (
        <Section title={t(`${K}.endpoints`, { defaultValue: "Source → target" })}>
          {info.endpoints.map((e) => (
            <EndpointRow key={e.role} endpoint={e} />
          ))}
        </Section>
      )}
      {info.description && (
        <Section title={t(`${K}.description`, { defaultValue: "Description" })}>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {info.description}
          </Typography>
        </Section>
      )}
      <Divider sx={{ mt: 1 }} />
      <Section title={t(`${K}.properties`, { defaultValue: "Properties" })}>
        <PropertyRows info={info} />
      </Section>
      {info.flows.length > 0 && (
        <Section title={t(`${K}.flows`, { defaultValue: "Data flows" })}>
          {info.flows.map((f) => (
            <Typography key={`${f.direction}-${f.displayId}`} variant="body2">
              {f.direction === "in" ? "←" : "→"} {f.displayId}
              {f.name ? ` ${f.name}` : ""}{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                {t(`${K}.${f.direction === "in" ? "from" : "to"}`, {
                  defaultValue: f.direction === "in" ? "from" : "to",
                })}{" "}
                {f.partnerDisplayId} {f.partnerName}
              </Typography>
            </Typography>
          ))}
        </Section>
      )}
      {info.assets.length > 0 && (
        <Section title={t(`${K}.assets`, { defaultValue: "Assets" })}>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
            {info.assets.map((a) => (
              <Chip key={a} label={a} size="small" />
            ))}
          </Stack>
        </Section>
      )}
    </Box>
  );
};
