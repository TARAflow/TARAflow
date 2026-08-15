# Mitigation ownership — what belongs to the measure, what to the risk

**Status:** design, nothing implemented
**Trigger:** the same catalog mitigation selected in several risks produces
several independent tickets
**Related:** `attacktree-ui-rework-design.md` (the attack-tree table shows
mitigations per path and made the duplication visible)

---

## 1. The symptom

A path in an attack tree carries `[M-001]`. So does a path in another tree, and
so does a per-element STRIDE threat. Three risks select the same measure, and
the analyst is asked three times to create a ticket for it.

The workaround suggests itself: create the ticket on the first, link the second
and third to it by hand. That works, and it is the wrong fix — it makes the
meaning of a field depend on who got there first. If the first risk is later
deleted, or the measure deselected there, the other two point at a ticket whose
origin no longer exists.

---

## 2. The cause

`SelectedMitigation` lives on `Risk.selectedMitigations` and carries:

```ts
export interface SelectedMitigation {
  id?: string;                 // catalog id, or undefined for a custom entry
  notes?: string;
  status: MitigationStatus;    // open → in_progress → … → verified | rejected
  rejectionReason?: string;
  statusChangedAt?: string;
  evidenceRef?: string;
  evidenceNote?: string;
  ticketId?: string;           // ← per risk
  ticketUrl?: string;          // ← per risk
  ticketStatus?: TicketStatus; // ← per risk
  ticketSyncedAt?: string;
  scopeOverride?: MitigationPropertyRole[];
}
```

Select `M-001` in three risks and it exists three times, with three independent
statuses and three independent tickets. Nothing in the model says these are the
same measure.

### Two different statements in one field

`MitigationStatus` conflates two things that behave differently:

- **`implemented`** is a fact about the system. The firmware signature check is
  built or it is not. It cannot be built for one risk and unbuilt for another.
- **`rejected`** is a decision about *this* risk — "we are not applying this
  measure here". Perfectly per-risk.

Both live in one field, which is why the ticket ended up in the wrong place:
the ticket tracks implementation, implementation is global, but the field it
sits next to is per-risk.

### It is already inconsistent

`mitigationLookup` in the attack-tree tab is a project-wide `Map<id,
MitigationReference>` carrying `status` and `ticketId`. Something already
decides which of the three per-risk states wins when a measure appears
repeatedly. Whatever that rule is, it is an unwritten answer to this question.

---

## 3. The split

**Global — a property of the measure:**

| field | why |
|---|---|
| implementation status | the measure is built or it is not |
| ticket id / url / status / synced-at | one ticket per measure |
| evidence reference and note | evidence that it was built |

**Per risk — a property of the selection:**

| field | why |
|---|---|
| selected at all | not every risk uses every measure |
| `rejectionReason` | "not applicable here" is a local decision |
| `notes` | annotation in this risk's context |
| `scopeOverride` | already per-interaction-specific |
| verification | the same measure may fully address one threat and only partly another |

Verification is the interesting one: it is *not* the same question as
implementation. "Is it built?" is global; "does it actually cover this threat?"
is local. Today both hide behind `implemented` / `verified` in one enum.

---

## 4. Consequences

**The duplicate ticket disappears.** One ticket per measure, any number of
risks pointing at it. No first-come rule, nothing to link by hand.

**Implementation progress becomes truthful.** `deriveImplementationProgress`
aggregates per-risk statuses today; with a global status it reflects the
project, and per-risk aggregation becomes "how much of what this risk relies on
is built".

**The closed loop back to architecture gets its anchor.** A measure with a
status is a thing that can be tracked, reported and verified once — which is
what the whole mitigation-to-architecture idea rests on.

**Custom entries are unaffected.** An entry without `id` is analyst-local by
definition and stays exactly where it is.

---

## 5. Migration

The one case that needs care: today two risks may carry *different* tickets for
the same measure. Consolidation must not silently discard one.

Rule: collect all `SelectedMitigation` entries per catalog id. If they carry at
most one distinct ticket, lift it. If they carry several, keep the first by
`statusChangedAt` as the measure's ticket and record the others in the measure's
notes, so nothing is lost and the conflict is visible rather than resolved
behind the analyst's back. Same principle as Class B in path identity: never
drop a decision silently.

The status lifts by taking the furthest-advanced value — a measure someone
recorded as `implemented` in one risk is implemented.

---

## 6. Open points

1. **Where does the global record live?** The mitigation catalog is shared
   reference data; project-specific status is not. Likely a project-level
   `mitigationStates` map keyed by catalog id, not the catalog itself.
2. **Does verification need its own status enum**, or is a boolean per risk plus
   the existing evidence fields enough?
3. **What happens to `deriveImplementationProgress`?** Its rules are written
   against per-risk statuses and will need restating against the split.
4. **Ticket creation flow.** With one ticket per measure, creating it from a
   risk dialog is still fine — but the dialog must show that the ticket already
   exists rather than offering to create a second one.
