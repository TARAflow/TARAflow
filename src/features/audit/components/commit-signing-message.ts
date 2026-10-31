// The user-facing text of a commit-signing problem — shared by the commit
// dialog (shown before the click) and the Audit tab's commit handler (the
// final check), so both say the same.

import type { CommitSigningProblem } from "../services/audit-signing-identity";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function commitSigningMessage(t: Translate, problem: CommitSigningProblem, authorEmail: string): string {
  switch (problem) {
    case "key-missing":
      return t("audit.commit.signingKeyMissing", {
        defaultValue: "No signing key is set. Choose your key in the audit configuration (Config → Signing).",
      });
    case "empty-manifest":
      return t("audit.commit.signerManifestEmpty", {
        defaultValue:
          "Signing is enabled but the signer manifest is empty. Add yourself as a signer first (Config → Signers).",
      });
    case "email-not-authorized":
      return t("audit.commit.signerNotAuthorized", {
        email: authorEmail,
        defaultValue:
          "Your author email ({{email}}) is not authorized in the committed signer manifest. Add your key under this email (Config → Signers) and commit the manifest.",
      });
  }
}
