// src/tests/unit/app/hooks/workspace/use-local-project-settings.test.ts
//
// MT-1: machine-local audit / tracker values are adopted once per opened
// project and merged into the blocks the tabs see; the ticket adapter
// follows the connection.

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  remember: vi.fn(),
  createTicketAdapter: vi.fn((c: unknown) => ({ adapterFor: c })),
}));

vi.mock("app/services/local-user-settings", () => ({
  rememberLocalSettings: (...a: unknown[]) => h.remember(...a),
  withLocalAudit: (id: string, audit: object | null) => (audit ? { ...audit, localFor: id } : null),
  withLocalIntegration: (id: string, integration: { connection?: unknown } | null) =>
    integration ? { ...integration, localFor: id } : null,
}));
vi.mock("features/integration", () => ({
  createTicketAdapter: (c: unknown) => h.createTicketAdapter(c),
}));

import { useLocalProjectSettings } from "app/hooks/workspace/use-local-project-settings";

beforeEach(() => {
  h.remember.mockClear();
  h.createTicketAdapter.mockClear();
});

const audit = { lastModified: "a" } as never;
const integration = { connection: { tool: "jira" } } as never;

describe("useLocalProjectSettings", () => {
  it("remembers once per project id, only missing values", () => {
    const hook = renderHook(
      ({ id, a }: { id: string; a: never }) => useLocalProjectSettings(id, a, integration),
      { initialProps: { id: "p1", a: audit } },
    );
    hook.rerender({ id: "p1", a: { lastModified: "b" } as never });
    expect(h.remember).toHaveBeenCalledTimes(1);
    expect(h.remember).toHaveBeenCalledWith("p1", audit, integration, { onlyMissing: true });
    hook.rerender({ id: "p2", a: audit });
    expect(h.remember).toHaveBeenCalledTimes(2);
    expect(h.remember.mock.calls[1][0]).toBe("p2");
  });

  it("merges the local values for the project", () => {
    const { result } = renderHook(() => useLocalProjectSettings("p1", audit, integration));
    expect(result.current.localAudit).toEqual({ lastModified: "a", localFor: "p1" });
    expect(result.current.localIntegration).toEqual({ connection: { tool: "jira" }, localFor: "p1" });
    expect(result.current.ticketPort).toEqual({ adapterFor: { tool: "jira" } });
  });

  it("passes the blocks through without a project and remembers nothing", () => {
    const { result } = renderHook(() => useLocalProjectSettings(undefined, audit, null));
    expect(result.current.localAudit).toBe(audit);
    expect(result.current.localIntegration).toBeNull();
    expect(h.createTicketAdapter).toHaveBeenCalledWith(null);
    expect(h.remember).not.toHaveBeenCalled();
  });

  it("keeps the ticket adapter while the connection is unchanged", () => {
    const hook = renderHook(() => useLocalProjectSettings("p1", audit, integration));
    const first = hook.result.current.ticketPort;
    hook.rerender();
    expect(hook.result.current.ticketPort).toBe(first);
    expect(h.createTicketAdapter).toHaveBeenCalledTimes(1);
  });
});
