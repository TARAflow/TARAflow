// taraflow-verifier/cli/resolve-policy.ts
//
// Pure policy assembly for the verify CLI. A Policy can come from a JSON file
// (--policy, so it can be versioned/committed) and/or individual flags; flags
// override the file field-by-field, exactly like taraflow-report overrides the
// saved documentation.configuration without discarding the rest.
//
// No I/O here — the caller reads the file and passes the parsed object in — so
// this stays unit-testable without a filesystem.

import { makePolicy, type Policy } from "../../src/features/audit/services/verify/policy";

/** Flags the CLI may set (all optional; only the ones present override). */
export interface PolicyFlags {
  anchor?: string;
  ref?: string;
  strict?: boolean;
  fourEyes?: boolean;
  protectedBranches?: string[];
}

/** A partial policy as it may appear in a --policy JSON file. */
export interface PolicyFile {
  bootstrapAnchor?: string;
  ref?: string;
  strict?: boolean;
  mandateFourEyes?: boolean;
  protectedBranches?: string[];
}

/**
 * Merge flags over an optional policy-file object into a validated Policy.
 * Precedence per field: flag (if given) > file (if given) > makePolicy default.
 * Throws (via makePolicy) if no bootstrap anchor is resolved from either source.
 */
export function resolvePolicy(
  flags: PolicyFlags,
  file?: PolicyFile,
): Policy {
  const bootstrapAnchor = flags.anchor ?? file?.bootstrapAnchor ?? "";
  return makePolicy({
    bootstrapAnchor,
    ref: flags.ref ?? file?.ref,
    strict: flags.strict ?? file?.strict,
    mandateFourEyes: flags.fourEyes ?? file?.mandateFourEyes,
    protectedBranches: flags.protectedBranches ?? file?.protectedBranches,
  });
}
