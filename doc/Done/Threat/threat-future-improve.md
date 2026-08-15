# Threat Eval — Future Improvements

Deferred from Step 3. Implement when capacity allows.

---

## 1. Inline Relevance Chip (clickable)

**Where:** Threat table rows (per-element + per-interaction)

**What:** Each row has a clickable `ThreatRelevance` chip directly in the row.
No dialog required for status change. Click rotates through:
`unrated → relevant → not_relevant → uncertain → unrated`

Sets `relevance` + `workflowStatus = "reviewed"` in-place via `updateThreat`.

---

## 2. Quick Action Buttons on Hover

**Where:** Threat table rows (per-element + per-interaction)

**What:** Three icon buttons visible on row hover, right-aligned in the actions column:

```
[✓ relevant]  [? uncertain]  [✗ not_relevant]
```

Each button sets `relevance` + `workflowStatus = "reviewed"` immediately.
Complement to the dialog — for fast triage without opening the eval workspace.

---

## 3. Bulk Action Bar

**Where:** Threat table (per-element + per-interaction)

**What:** Checkbox column on the left. When ≥1 row selected, an action bar appears
above the table:

```
[N selected]  [✓ Mark relevant]  [✗ Dismiss]  [? Uncertain]  [Clear]
```

**Typical use case:** All Spoofing threats inside an internal Trust Boundary are
not relevant because no authentication boundary exists → select all, dismiss at once.

Implementation notes:
- Checkbox state is local to the table (not persisted)
- Bulk action calls `updateThreat` for each selected threat
- Clear deselects all without changing relevance

---

## Priority

| Item | Effort | Value |
|------|--------|-------|
| Inline Relevance Chip | Low | Medium |
| Quick Action Buttons | Low | Medium |
| Bulk Action Bar | Medium | High |
