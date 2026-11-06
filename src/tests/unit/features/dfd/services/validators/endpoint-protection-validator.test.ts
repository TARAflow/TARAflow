import { describe, it, expect } from "vitest";
import { validateEndpointProtection } from "../../../../../../features/dfd/services/validators/endpoint-protection-validator";
import type { DFDElement, DFDConnection, ValidationFinding } from "../../../../../../features/dfd/models/dfd-types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function proc(id: string, tlsTermination?: string | string[]): DFDElement {
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

describe("endpoint protection validator — secure channels as a selection (user 2026-11-06)", () => {
  it("TLS among other channels counts: [server, ssh] terminates a tls flow", () => {
    const els = [proc("A", ["none"]), proc("B", ["server", "ssh"])];
    expect(run(els, [flow("A", "B", "tls")])).toHaveLength(0);
  });

  it("only non-TLS channels (ssh, vpn, application) terminate no TLS: a tls flow between them is flagged", () => {
    const els = [proc("A", ["ssh"]), proc("B", ["vpn", "application"])];
    const f = run(els, [flow("A", "B", "tls")]);
    expect(f.map((x) => x.key)).toEqual(["tabs.dfd.validation.df.tls.noTerminator"]);
  });

  it("mutual in a selection: mtls between [mutual, ssh] and [mutual] is fine", () => {
    const els = [proc("A", ["mutual", "ssh"]), proc("B", ["mutual"])];
    expect(run(els, [flow("A", "B", "mtls")])).toHaveLength(0);
  });

  it("an older single value still counts as one entry", () => {
    const els = [proc("A", "none"), proc("B", "server")];
    expect(run(els, [flow("A", "B", "tls")])).toHaveLength(0);
  });
});

describe("endpoint protection validator — SSH, application level, unused channels (user 2026-11-06)", () => {
  const runAll = (elements: DFDElement[], connections: DFDConnection[]) => {
    const errors: ValidationFinding[] = [];
    const warnings: ValidationFinding[] = [];
    validateEndpointProtection(connections, elements, errors, warnings);
    return { errors: errors.map((e) => e.key), warnings };
  };

  it("an SSH flow needs one endpoint offering SSH (client / server)", () => {
    expect(runAll([proc("A", ["none"]), proc("B", ["server"])], [flow("A", "B", "ssh")]).errors).toEqual([
      "tabs.dfd.validation.df.tls.sshNoEndpoint",
    ]);
    expect(runAll([proc("A", ["none"]), proc("B", ["ssh"])], [flow("A", "B", "ssh")]).errors).toEqual([]);
  });

  it("an application-level flow (OPC UA Secure Channel) needs both endpoints", () => {
    expect(runAll([proc("A", ["application"]), proc("B", ["server"])], [flow("A", "B", "application")]).errors).toEqual([
      "tabs.dfd.validation.df.tls.applicationRequiresBoth",
    ]);
    expect(runAll([proc("A", ["application"]), proc("B", ["application"])], [flow("A", "B", "application")]).errors).toEqual([]);
  });

  it("a channel offered but used by no flow is a warning, naming element and channel", () => {
    const { warnings } = runAll([proc("P1", ["server", "ssh"]), proc("MP1", ["server"])], [flow("P1", "MP1", "tls")]);
    expect(warnings.map((w) => [w.elementId, w.params?.channel])).toEqual([["P1", "ssh"]]);
    expect(warnings[0].key).toBe("tabs.dfd.validation.df.tls.channelUnused");
  });

  it("mutual TLS counts as used by a tls flow; a server-only offer is unused next to mtls flows only", () => {
    expect(runAll([proc("A", ["mutual"]), proc("B", ["server"])], [flow("A", "B", "tls")]).warnings).toEqual([]);
    const { warnings } = runAll([proc("A", ["server", "mutual"]), proc("B", ["mutual"])], [flow("A", "B", "mtls")]);
    expect(warnings.map((w) => [w.elementId, w.params?.channel])).toEqual([["A", "server"]]);
  });

  it("'none' and elements without an offer give no warning; physical edges do not count as use", () => {
    expect(runAll([proc("A", ["none"]), proc("B")], [flow("A", "B", "tls", { medium: "physical" })]).warnings).toEqual([]);
    const { warnings } = runAll([proc("A", ["ssh"]), proc("B")], [flow("A", "B", "ssh", { medium: "physical" })]);
    expect(warnings.map((w) => w.params?.channel)).toEqual(["ssh"]);
  });
});

describe("endpoint protection validator — secure channel not stated (user 2026-11-06)", () => {
  const warningsOf = (elements: DFDElement[], connections: DFDConnection[]) => {
    const errors: ValidationFinding[] = [];
    const warnings: ValidationFinding[] = [];
    validateEndpointProtection(connections, elements, errors, warnings);
    return warnings.filter((w) => w.key === "tabs.dfd.validation.element.missingProperty");
  };

  it("a flow over a network and nothing chosen: asks for a choice (missing property)", () => {
    const w = warningsOf([proc("A"), proc("B", ["server"])], [flow("A", "B", "tls", { protocol: "opc_ua" })]);
    expect(w.map((x) => [x.elementId, x.params?.field, x.params?.elementType])).toEqual([["A", "tlsTermination", "Process"]]);
  });

  it("'none' is a choice: no warning", () => {
    expect(warningsOf([proc("A", ["none"]), proc("B", ["server"])], [flow("A", "B", "tls", { protocol: "opc_ua" })])).toEqual([]);
  });

  it("only human input or an unknown protocol: not asked (the field is not offered / still open)", () => {
    expect(warningsOf([proc("A"), proc("B")], [flow("A", "B", undefined, { protocol: "human_input" })])).toEqual([]);
    expect(warningsOf([proc("A"), proc("B")], [flow("A", "B", undefined)])).toEqual([]);
  });

  it("an on-board chip bus (UART, SPI, I²C) may carry one but is not asked for", () => {
    expect(warningsOf([proc("A"), proc("B")], [flow("A", "B", undefined, { protocol: "uart" })])).toEqual([]);
  });
});
