// ==================== MAIN LAYOUT ====================
// Pure composition shell — renders ProjectShell which owns all state.
//
// Phase D: all logic moved to:
//   ProjectShell     → project state, dialogs, sidebar
//   WorkspaceLayout  → feature tabs, tab handlers
//   useProjectManager → all project operations
//   ProjectContext   → shared state without prop drilling

import React from "react";
import { ProjectShell } from "./project-shell";

export const MainLayout: React.FC = () => <ProjectShell />;

export default MainLayout;
