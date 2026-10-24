// ==================== TCS CANONICAL SERIALIZATION (re-export) ====================
// The serializer moved to src/shared/utils/tcs-canonical.ts (2026-10-24) so
// features can use it (calculation stamps). This file stays as a pure
// re-export: the Electron main process (electron/services/audit-verify-main.ts),
// the CLI verifier (taraflow-verifier/taraflow-verify.ts) and
// scripts/verify-fixtures.ts import from here. Relative path on purpose —
// tsconfig.electron.json defines no app path aliases.
//
// Location: src/app/services/tcs-serialize.ts

export { TCS_VERSION, canonicalStringify } from "../../shared/utils/tcs-canonical";
