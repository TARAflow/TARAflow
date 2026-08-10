// TARAflow/scripts/verify-fixtures.ts
// Run from the TARAflow repo:  npx tsx scripts/verify-fixtures.ts <path-to-TARAflow_Examples>
// Code (engine + canonicalStringify) is imported from THIS repo (TARAflow).
// The repo being VERIFIED is the SEPARATE TARAflow_Examples repo, passed as arg.
import { createGitReaderExec } from "../src/features/audit/services/verify/git-reader-exec";
import { verifyAudit } from "../src/features/audit/services/verify/engine";
import { makePolicy } from "../src/features/audit/services/verify/policy";
import { canonicalStringify } from "../src/app/services/prepare-for-disk";

const EXAMPLES = process.argv[2];
if (!EXAMPLES) {
  console.error("usage: tsx scripts/verify-fixtures.ts <path-to-TARAflow_Examples>");
  process.exit(2);
}
const reader = createGitReaderExec(EXAMPLES); // ← verifies the OTHER repo

const show = (label: string, r: Awaited<ReturnType<typeof verifyAudit>>) => {
  console.log(`\n=== ${label} → ${r.result.toUpperCase()} (${r.summary.error}E/${r.summary.warning}W/${r.summary.info}I) ===`);
  for (const f of r.findings)
    console.log(`  [${f.severity}] ${f.id}${f.commit ? " @" + f.commit.slice(0, 10) : ""} — ${f.message}`);
};

show("POSITIV (soll PASS)", await verifyAudit({
  reader,
  policy: makePolicy({ bootstrapAnchor: "cb29c3341316741628e78f65f1f92d5750c89627", ref: "main" }),
  canonicalize: canonicalStringify,
}));

show("NEGATIV (soll FAIL)", await verifyAudit({
  reader,
  policy: makePolicy({ bootstrapAnchor: "9456a26670931b4538b8c9c5e867fa899f0f35c1", ref: "fixture-broken-bootstrap" }),
  canonicalize: canonicalStringify,
}));
