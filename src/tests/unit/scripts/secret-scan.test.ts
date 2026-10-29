// src/tests/unit/scripts/secret-scan.test.ts
//
// Secret scan (2026-10-29): the repository's scan (scripts/secret-scan.mjs,
// CI + versioned pre-commit hook) and the pre-commit hook TARAflow installs
// in audit repositories use the same patterns; the rules find secret fields
// in project files and token formats anywhere, and report lines, never values.
// Test values are assembled at run time so this file does not trip the scan.

import { describe, it, expect } from "vitest";
import { SECRET_KEY_PATTERN, SECRET_VALUE_PATTERNS, scanText } from "../../../../scripts/secret-scan.mjs";
import {
  SECRET_KEY_PATTERN as HOOK_KEY_PATTERN,
  SECRET_VALUE_PATTERNS as HOOK_VALUE_PATTERNS,
  hookScript,
  HOOKS_VERSION,
  MANAGED_MARKER,
} from "features/audit/services/audit-repo-hooks";

const atlassian = "ATA" + "TT" + "x".repeat(30);
const github = "gh" + "p_" + "a".repeat(36);
const aws = "AK" + "IA" + "A".repeat(16);
const pem = "-----BEGIN " + "RSA PRIVATE KEY-----";

describe("one set of patterns", () => {
  it("repository scan and audit-repo hook are equal", () => {
    expect(SECRET_KEY_PATTERN).toBe(HOOK_KEY_PATTERN);
    expect(SECRET_VALUE_PATTERNS).toEqual([...HOOK_VALUE_PATTERNS]);
  });

  it("the audit-repo pre-commit hook is managed, versioned and prints line numbers only", () => {
    const s = hookScript("pre-commit");
    expect(s.startsWith("#!/bin/sh")).toBe(true);
    expect(s).toContain(MANAGED_MARKER);
    expect(s).toContain(`HOOKS_VERSION=${HOOKS_VERSION}`);
    expect(s).toContain([HOOK_KEY_PATTERN, ...HOOK_VALUE_PATTERNS].join("|"));
    expect(s).toContain('grep -nE -- "$pattern" | cut -d: -f1');
  });
});

describe("scanText", () => {
  it("a secret field in a project file or fixture, not in other JSON", () => {
    const line = `  "credentials": { "email": "a@b", "apiToken": "x1" }`;
    expect(scanText("p/demo.tara.json", line)).toEqual([{ line: 1, rule: "secret field" }]);
    expect(scanText("src/tests/fixtures/x.json", `{\n${line}\n}`)).toEqual([{ line: 2, rule: "secret field" }]);
    // i18n label keys like "password": "Password" are fine
    expect(scanText("src/i18n/locales/en/dfd.json", `"password": "Password"`)).toEqual([]);
    // an empty value is not a secret
    expect(scanText("p/demo.tara.json", `"apiToken": ""`)).toEqual([]);
  });

  it("token formats in any file; findings carry line and rule, never the value", () => {
    const text = ["ok", `const t = "${atlassian}";`, `key=${aws}`, github, pem, "fine"].join("\n");
    const findings = scanText("src/anything.ts", text);
    expect(findings).toEqual([
      { line: 2, rule: "token format" },
      { line: 3, rule: "token format" },
      { line: 4, rule: "token format" },
      { line: 5, rule: "token format" },
    ]);
    expect(JSON.stringify(findings)).not.toContain(atlassian);
  });

  it("local patterns apply to JSON files (docs and tests may name such domains)", () => {
    expect(scanText("data/x.json", `{"mail": "someone@example.org"}`, ["@example\\.org"])).toEqual([
      { line: 1, rule: "local pattern" },
    ]);
    expect(scanText("README.md", "mail me: someone@example.org", ["@example\\.org"])).toEqual([]);
  });
});
