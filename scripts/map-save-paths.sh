#!/usr/bin/env bash
# ============================================================================
# map-save-paths.sh — TARAflow persistence write-source cartography
#
# Collects every grep needed to map how `project` gets mutated and persisted,
# into ONE structured report. Run from the repo root (the dir that contains
# `src/`). Produces: save-paths-report.txt
#
#   chmod +x map-save-paths.sh
#   ./map-save-paths.sh
#
# Then upload save-paths-report.txt.
# ============================================================================

set -uo pipefail

# --- locate src ------------------------------------------------------------
if [ -d "src" ]; then
  ROOT="src"
elif [ -d "../src" ]; then
  ROOT="../src"
else
  echo "ERROR: no src/ directory found. Run from the repo root." >&2
  exit 1
fi

OUT="save-paths-report.txt"
: > "$OUT"   # truncate

# grep flags: recursive, line numbers, only ts/tsx
GREP=(grep -rn --include=*.ts --include=*.tsx)

section() {
  {
    echo ""
    echo "############################################################"
    echo "## $1"
    echo "## $2"
    echo "############################################################"
  } >> "$OUT"
}

# run a grep, append results + a count. Never abort on no-match.
run() {
  local pattern="$1"; shift
  local scope="${1:-$ROOT}"
  local count
  # shellcheck disable=SC2068
  "${GREP[@]}" -E "$pattern" "$scope" >> "$OUT" 2>/dev/null
  count=$("${GREP[@]}" -E "$pattern" "$scope" 2>/dev/null | wc -l | tr -d ' ')
  echo "" >> "$OUT"
  echo "  → $count match(es) for /$pattern/ in $scope" >> "$OUT"
}

# --- header ----------------------------------------------------------------
{
  echo "TARAflow — Save-Path Cartography Report"
  echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "Scope root: $ROOT"
  echo "Git HEAD:   $(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
  echo "Branch:     $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
} >> "$OUT"

# --- 1. central write channel ---------------------------------------------
section "1. updateProject — the central write channel" \
        "Who calls it? (1) + (9) together answer: does EVERYTHING go through it?"
run "updateProject"

# --- 2. real persistence endpoints ----------------------------------------
section "2. Persistence endpoints (disk / storage)" \
        "Who actually writes out? Should be few, localized."
run "writeProject|saveProject|saveDFD|serialiseProject|prepareForDisk"

# --- 3. onUpdate definitions & pass-through -------------------------------
section "3. onUpdate — the upward callback from feature tabs" \
        "Definitions + prop pass-through. Builds the call graph."
run "onUpdate"

# --- 4. the three DFD save paths (definitions) ----------------------------
section "4. DFD save paths (definitions in use-dfd-persistence)" \
        "scheduleSave / scheduleDrawioSave / save / flush"
run "scheduleSave|scheduleDrawioSave|\.save\(|flush\("

# --- 5. callers of the DFD save paths -------------------------------------
section "5. Callers of the DFD save paths" \
        "Where are scheduleSave/scheduleDrawioSave/flush actually invoked?"
run "persistence\.|\.scheduleSave|\.scheduleDrawioSave|\.flush\(\)"

# --- 6. Assets tab transactional dialog save ------------------------------
section "6. Assets tab — transactional dialog save" \
        "The 'Save' button commit path in the asset dialog."
run "saveAssets|onSave|handleSave|handleAssetsUpdate|handleAssetChange" "$ROOT"

# --- 7. draw.io autosave (the invisible third source) ---------------------
section "7. draw.io autosave — the invisible third write source" \
        "Who triggers scheduleDrawioSave / saveDFDFromXml?"
run "scheduleDrawioSave|saveDFDFromXml|drawio.*[Aa]utosave|[Aa]utosave.*drawio"

# --- 8. persistence hook instantiation sites ------------------------------
section "8. Persistence hook instantiation" \
        "Where are the persistence/auto-save hooks created?"
run "useProjectPersistence|useAutoSave|useDFDPersistence|useProjectManager"

# --- 9. direct project-state mutations (channel bypassers) ----------------
section "9. Direct project-state mutations (potential bypassers)" \
        "setProject(s)/setActiveProject — direct writers that skip updateProject."
run "setProject|setProjects|setActiveProject"

# --- 10. the 'freshest state' refs ----------------------------------------
section "10. 'freshest state' refs (symptom of missing serialization)" \
        "pendingSaveRef / lastCommittedDfdRef / activeProjectRef / projectRef / projectsRef"
run "pendingSaveRef|lastCommittedDfdRef|activeProjectRef|projectRef|projectsRef"

# --- 11. bonus: setProjects/state setters in context/providers ------------
section "11. Context/provider state setters (where project state actually lives)" \
        "useState/useReducer holding the project list or active project."
run "useState<.*Project|useReducer|const \[project|const \[projects|const \[activeProject"

# --- 12. bonus: file structure of the two prime suspects ------------------
section "12. File inventory — persistence & layout" \
        "Line counts of the files we'll be refactoring."
{
  echo ""
  for f in \
    "$ROOT/app/components/layout/workspace-layout.tsx" \
    "$ROOT/app/contexts/project-context.ts" \
    "$ROOT/features/dfd/hooks/use-dfd-persistence.ts" \
    "$ROOT/features/dfd/hooks/use-dfd-data.ts" \
    "$ROOT/app/hooks/use-project-persistence.ts" \
    "$ROOT/app/hooks/use-auto-save.ts" \
    "$ROOT/app/hooks/use-project-manager.ts" \
    "$ROOT/app/services/project-repository.ts" \
    "$ROOT/app/services/project-service.ts"
  do
    if [ -f "$f" ]; then
      printf '  %6s lines  %s\n' "$(wc -l < "$f" | tr -d ' ')" "$f" >> "$OUT"
    else
      printf '  %6s        %s\n' "MISSING" "$f" >> "$OUT"
    fi
  done
} >> "$OUT"

# --- footer ----------------------------------------------------------------
{
  echo ""
  echo "############################################################"
  echo "## END OF REPORT"
  echo "############################################################"
} >> "$OUT"

echo "Done. Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)."
echo "Upload $OUT to continue."
