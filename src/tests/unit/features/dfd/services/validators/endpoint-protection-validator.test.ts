import { describe, it, expect } from "vitest";
import { validateEndpointProtection } from "../../../../../../features/dfd/services/validators/endpoint-protection-validator";
import type { DFDElement, DFDConnection, ValidationFinding } from "../../../../../../features/dfd/models/dfd-types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function proc(id: string, tlsTermination?: string): DFDElement {
  return {
    id,
    displayId: id,
    name: id,
    type: "Process",
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    properties: { tlsTermination } as any,
  };
}

function flow(
  from: string,
  to: string,
  encryptionInTransit?: string,
  extra: Record<string, unknown> = {},
): DFDConnection {
  return {
    id: `${from}->${to}`,
    displayId: `DF-${from}${to}`,
    name: `push ${from}->${to}`,
    from,
    to,
    properties: { encryptionInTransit, ...extra } as any,
  };
}

function run(
  elements: DFDElement[],
  connections: DFDConnection[],
): ValidationFinding[] {
  const errors: ValidationFinding[] = [];
  validateEndpointProtection(connections, elements, errors);
  return errors;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("endpoint protection validator — TLS capability/usage, pair-level (A5)", () => {
  it("tls + one endpoint server → no finding (channel encrypted, one terminator)", () => {
    const els = [proc("A", "none"), proc("B", "server")];
    expect(run(els, [flow("A", "B", "tls")])).toHaveLength(0);
  });

  it("tls + server + mutual → no finding (mutual ⊃ server)", () => {
    const els = [proc("A", "server"), proc("B", "mutual")];
    expect(run(els, [flow("A", "B", "tls")])).toHaveLength(0);
  });

  it("mtls + both mutual → no finding", () => {
    const els = [proc("A", "mutual"), proc("B", "mutual")];
    expect(run(els, [flow("A", "B", "mtls")])).toHaveLength(0);
  });

  it("rule 1a: tls + both none → DF_TLS_NO_TERMINATOR", () => {
    const els = [proc("A", "none"), proc("B", "none")];
    const f = run(els, [flow("A", "B", "tls")]);
    expect(f).toHaveLength(1);
    expect(f[0].key).toBe(
      "tabs.dfd.validation.df.tls.noTerminator",
    );
  });

  it("rule 1b: mtls + only one mutual → DF_MTLS_REQUIRES_BOTH_MUTUAL", () => {
    const els = [proc("A", "server"), proc("B", "mutual")];
    const f = run(els, [flow("A", "B", "mtls")]);
    expect(f).toHaveLength(1);
    expect(f[0].key).toBe(
      "tabs.dfd.validation.df.tls.mtlsRequiresBothMutual",
    );
  });

  it("rule 2: tls + mutual + none → DF_TLS_HANDSHAKE_MISMATCH", () => {
    const els = [proc("A", "mutual"), proc("B", "none")];
    const f = run(els, [flow("A", "B", "tls")]);
    expect(f).toHaveLength(1);
    expect(f[0].key).toBe(
      "tabs.dfd.validation.df.tls.handshakeMismatch",
    );
  });

  it("direction-independence: reverse flow over same pair → identical result", () => {
    const els = [proc("A", "none"), proc("B", "server")];
    // A=client device, B=cloud server. Upload A->B and update B->A both fine.
    expect(run(els, [flow("A", "B", "tls")])).toHaveLength(0);
    expect(run(els, [flow("B", "A", "tls")])).toHaveLength(0);
  });

  it("Customer regression: device(none) ↔ cloud(server), upload + reverse update", () => {
    const els = [proc("device", "none"), proc("cloud", "server")];
    const conns = [
      flow("device", "cloud", "tls"), // sensor upload
      flow("cloud", "device", "tls"), // SW-update notice
    ];
    expect(run(els, conns)).toHaveLength(0);
  });

  it("physical-medium edges are skipped", () => {
    const els = [proc("A", "none"), proc("B", "none")];
    expect(
      run(els, [flow("A", "B", "tls", { medium: "physical" })]),
    ).toHaveLength(0);
  });

  it("non-TLS usage (vpn/none/undefined) is not gated", () => {
    const els = [proc("A", "none"), proc("B", "none")];
    expect(run(els, [flow("A", "B", "vpn")])).toHaveLength(0);
    expect(run(els, [flow("A", "B", undefined)])).toHaveLength(0);
  });
});