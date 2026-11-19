// ==================== TICKET LINK DIALOG ====================
// Link an existing ticket to one mitigation (adapters design IT-13, user
// 2026-11-10):
//   - search (key or text) and a status filter, "open" by default; done
//     tickets stay reachable to link a mitigation afterwards
//   - "Suggested": tickets linked to the same mitigation on other risks,
//     from the project's own data — one click covers the next risk
//   - tickets linked already are marked ("linked with M-T-001 · P1-T-1"),
//     listed after the free ones; hiding them is a choice, off by default
//   - a row is chosen first, "Link" links it — a stray click changes nothing
//   - nothing found → a way to create a new ticket
// The tracker is asked only while the dialog is open.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import type { TicketPort, TicketScope, TicketStatus, TicketSummary } from "shared/models/ticket-types";
import { linkedWith, suggestedTickets, type TicketLink } from "../services/ticket-links";

/** The status filter; "open" and "in progress" are both "not done" for the tracker. */
export type TicketStatusFilter = "open" | "in_progress" | "done" | "all";

const SCOPE: Record<TicketStatusFilter, TicketScope> = { open: "active", in_progress: "active", done: "done", all: "all" };
const SHOWN: Record<TicketStatusFilter, ((s: TicketStatus) => boolean) | null> = {
  open: (s) => s === "OPEN" || s === "UNKNOWN",
  in_progress: (s) => s === "IN_PROGRESS" || s === "REVIEW",
  done: null,
  all: null,
};

/** The ticket the dialog hands back: what linking needs, and the summary for the card. */
export type PickedTicket = Pick<TicketSummary, "key" | "url"> & Partial<TicketSummary>;

export interface TicketLinkDialogProps {
  open: boolean;
  /** The mitigation as shown in the title. */
  label: string;
  mitigationId?: string;
  riskId: string;
  port: TicketPort;
  projectKey: string;
  issueTypes: Array<{ id: string; name: string; iconUrl?: string }>;
  links: readonly TicketLink[];
  onLink: (ticket: PickedTicket) => Promise<void> | void;
  onCreateInstead: () => void;
  onClose: () => void;
}

const statusColor = (s?: TicketStatus) =>
  s === "IN_PROGRESS" ? { bg: "#dbeafe", fg: "#1d4ed8" } : s === "REVIEW" ? { bg: "#ede9fe", fg: "#7c3aed" } : s === "CLOSED" ? { bg: "#dcfce7", fg: "#16a34a" } : { bg: "#f3f4f6", fg: "#374151" };

export const TicketLinkDialog: React.FC<TicketLinkDialogProps> = ({
  open,
  label,
  mitigationId,
  riskId,
  port,
  projectKey,
  issueTypes,
  links,
  onLink,
  onCreateInstead,
  onClose,
}) => {
  const { t } = useTranslation();
  const [issueType, setIssueType] = useState("__all__");
  const [status, setStatus] = useState<TicketStatusFilter>("open");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [hideLinked, setHideLinked] = useState(false);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<PickedTicket | null>(null);
  const [linking, setLinking] = useState(false);

  // Fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setStatus("open");
    setText("");
    setQuery("");
    setChosen(null);
  }, [open]);

  // Search as one types, not on every key.
  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    setFailed(false);
    port
      .fetchTickets(projectKey, issueType, { scope: SCOPE[status], ...(query ? { text: query } : {}) })
      .then((result) => live && setTickets(result))
      .catch(() => live && (setTickets([]), setFailed(true)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, port, projectKey, issueType, status, query]);

  const suggested = useMemo(() => suggestedTickets(links, mitigationId, riskId), [links, mitigationId, riskId]);
  const listed = useMemo(() => {
    const shown = SHOWN[status];
    const rest = tickets.filter((x) => !suggested.some((s) => s.key === x.key) && (!shown || shown(x.ticketStatus)));
    const linked = (x: TicketSummary) => links.some((l) => l.key === x.key);
    const free = rest.filter((x) => !linked(x));
    return hideLinked ? free : [...free, ...rest.filter(linked)];
  }, [tickets, suggested, status, links, hideLinked]);

  const handleLink = async () => {
    if (!chosen) return;
    setLinking(true);
    try {
      await onLink(chosen);
    } finally {
      setLinking(false);
    }
  };

  const row = (ticket: PickedTicket, testId: string) => {
    const linked = linkedWith(links, ticket.key);
    const selected = chosen?.key === ticket.key;
    const color = statusColor(ticket.ticketStatus);
    return (
      <Box
        key={ticket.key}
        onClick={() => setChosen(ticket)}
        onDoubleClick={() => {
          setChosen(ticket);
          void onLink(ticket);
        }}
        data-testid={testId}
        aria-selected={selected}
        sx={{
          px: 1.5,
          py: 1,
          cursor: "pointer",
          bgcolor: selected ? "action.selected" : undefined,
          "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {ticket.issueTypeIconUrl ? (
            <Box component="img" src={ticket.issueTypeIconUrl} alt={ticket.issueType} sx={{ width: 14, height: 14, flexShrink: 0 }} />
          ) : null}
          <Typography variant="caption" color="primary" fontWeight={700} sx={{ fontSize: 11, flexShrink: 0 }}>
            {ticket.key}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexGrow: 1 }}>
            {ticket.summary ?? ""}
          </Typography>
          {(ticket.status || ticket.ticketStatus) && (
            <Chip label={ticket.status || ticket.ticketStatus} size="small" sx={{ height: 16, fontSize: 10, bgcolor: color.bg, color: color.fg }} />
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          {ticket.assignee !== undefined || ticket.sprint !== undefined ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              {ticket.assignee ?? t("tabs.risks.ticketLink.unassigned", { defaultValue: "Unassigned" })}
              {ticket.sprint ? ` · ${ticket.sprint}` : ""}
            </Typography>
          ) : null}
          {linked && (
            <Tooltip title={links.filter((l) => l.key === ticket.key).map((l) => `${l.mitigationLabel} · ${l.riskDisplayId}`).join("\n")}>
              <Typography variant="caption" color="warning.main" sx={{ fontSize: 10 }} data-testid={`linked-${ticket.key}`}>
                {linked.more > 0
                  ? t("tabs.risks.ticketLink.linkedWithMore", { defaultValue: "linked with {{first}} (+{{more}})", first: linked.first, more: linked.more })
                  : t("tabs.risks.ticketLink.linkedWith", { defaultValue: "linked with {{first}}", first: linked.first })}
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="ticket-link-dialog">
      <DialogTitle sx={{ pb: 1 }}>
        {t("tabs.risks.mitigationStatusDialog.linkTicketTitle", { defaultValue: "Link a ticket to {{mitigation}}", mitigation: label })}
      </DialogTitle>
      <DialogContent dividers>
        {/* Filters: search, status, type */}
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("tabs.risks.ticketLink.search", { defaultValue: "Key or text" })}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            inputProps={{ "data-testid": "ticket-link-search" }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t("tabs.risks.ticketLink.status", { defaultValue: "Status" })}</InputLabel>
            <Select
              value={status}
              label={t("tabs.risks.ticketLink.status", { defaultValue: "Status" })}
              onChange={(e) => setStatus(e.target.value as TicketStatusFilter)}
              inputProps={{ "data-testid": "ticket-link-status" }}
            >
              <MenuItem value="open">{t("tabs.risks.ticketLink.statusOpen", { defaultValue: "Open" })}</MenuItem>
              <MenuItem value="in_progress">{t("tabs.risks.ticketLink.statusInProgress", { defaultValue: "In progress" })}</MenuItem>
              <MenuItem value="done">{t("tabs.risks.ticketLink.statusDone", { defaultValue: "Done" })}</MenuItem>
              <MenuItem value="all">{t("tabs.risks.ticketLink.statusAll", { defaultValue: "All" })}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t("tabs.risks.ticketLink.type", { defaultValue: "Type" })}</InputLabel>
            <Select value={issueType} label={t("tabs.risks.ticketLink.type", { defaultValue: "Type" })} onChange={(e) => setIssueType(e.target.value)}>
              <MenuItem value="__all__">{t("tabs.risks.ticketLink.allTypes", { defaultValue: "All types" })}</MenuItem>
              {issueTypes
                .filter((it) => !it.name.toLowerCase().includes("subtask"))
                .map((it) => (
                  <MenuItem key={it.id} value={it.name}>
                    {it.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Stack>
        <FormControlLabel
          sx={{ mb: 1 }}
          control={<Checkbox size="small" checked={hideLinked} onChange={(e) => setHideLinked(e.target.checked)} data-testid="ticket-link-hide-linked" />}
          label={<Typography variant="caption">{t("tabs.risks.ticketLink.hideLinked", { defaultValue: "Hide tickets linked already" })}</Typography>}
        />

        {/* Suggested: the same mitigation on other risks */}
        {suggested.length > 0 && (
          <Box sx={{ mb: 1.5 }} data-testid="ticket-link-suggested">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {t("tabs.risks.ticketLink.suggested", { defaultValue: "Suggested — linked to {{mitigation}} on other risks", mitigation: mitigationId })}
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 1, mt: 0.5 }}>
              <Stack divider={<Divider />}>
                {suggested.map((s) => row({ key: s.key, url: s.url ?? port.ticketUrl(s.key), ticketStatus: s.ticketStatus }, `suggested-${s.key}`))}
              </Stack>
            </Paper>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : failed ? (
          <Typography variant="caption" color="error">
            {t("tabs.risks.ticketLink.failed", { defaultValue: "The tickets could not be loaded." })}
          </Typography>
        ) : listed.length === 0 ? (
          <Box sx={{ py: 1.5, textAlign: "center" }} data-testid="ticket-link-empty">
            <Typography variant="body2" color="text.secondary">
              {t("tabs.risks.ticketLink.empty", { defaultValue: "No tickets in this filter." })}
            </Typography>
            <Button size="small" onClick={onCreateInstead} sx={{ mt: 0.5 }} data-testid="ticket-link-create-instead">
              {t("tabs.risks.ticketLink.createInstead", { defaultValue: "Create a new ticket" })}
            </Button>
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ maxHeight: 340, overflow: "auto", borderRadius: 1 }}>
            <Stack divider={<Divider />}>{listed.map((x) => row(x, `ticket-${x.key}`))}</Stack>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button variant="contained" disabled={!chosen || linking} onClick={handleLink} data-testid="ticket-link-confirm">
          {chosen
            ? t("tabs.risks.ticketLink.linkKey", { defaultValue: "Link {{key}}", key: chosen.key })
            : t("tabs.risks.ticketLink.link", { defaultValue: "Link" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
