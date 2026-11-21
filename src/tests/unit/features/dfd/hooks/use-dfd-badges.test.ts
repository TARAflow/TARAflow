// The badge update in the editor (0.20): after the load and on every change
// of what the badges show; reload + save only when the diagram changes.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDfdBadges, badgeSignature, type UseDfdBadgesOptions } from "features/dfd/hooks/use-dfd-badges";
import type { UseDrawioBridgeReturn } from "features/dfd/hooks/use-drawio-bridge";
import type { UseDFDPersistenceReturn } from "features/dfd/hooks/use-dfd-persistence";
import type { DFDElement } from "features/dfd/models/dfd-types";

const XML =
  '<mxfile><diagram id="p" name="P"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<object label="M [TB]" type="trustboundary" id="tb"><mxCell parent="1" style="strokeColor=#FF3333;" vertex="1"><mxGeometry height="100" width="100" as="geometry"/></mxCell></object>' +
  "</root></mxGraphModel></diagram></mxfile>";

const tb = (props: object): DFDElement =>
  ({ id: "tb", type: "TrustBoundary", name: "M", properties: props }) as unknown as DFDElement;

const options = (props: object, extra: Partial<UseDfdBadgesOptions> = {}): UseDfdBadgesOptions => ({
  elements: [tb(props)],
  pages: undefined,
  enabled: true,
  en50742: false,
  delay: 10,
  ...extra,
});

describe("badgeSignature", () => {
  it("changes with the level, the zone, the setting and the page links — not with other properties", () => {
    const base = badgeSignature(options({ defaultExposureLevel: "EL1" }));
    expect(badgeSignature(options({ defaultExposureLevel: "EL1", boundaryType: "network" }))).toBe(base);
    expect(badgeSignature(options({ defaultExposureLevel: "EL2" }))).not.toBe(base);
    expect(badgeSignature(options({ defaultExposureLevel: "EL1" }, { enabled: false }))).not.toBe(base);
    expect(badgeSignature(options({ defaultExposureLevel: "EL1", safetyZone: "yes" }, { en50742: true }))).not.toBe(
      badgeSignature(options({ defaultExposureLevel: "EL1" }, { en50742: true })),
    );
    expect(
      badgeSignature(options({ defaultExposureLevel: "EL1" }, { pages: [{ pageId: "p", name: "P", order: 0, links: [{ cellId: "c", tfId: "tb", role: "ref" }] }] })),
    ).not.toBe(base);
  });
});

describe("useDfdBadges", () => {
  let xml: string;
  let bridge: UseDrawioBridgeReturn;
  let persistence: UseDFDPersistenceReturn;

  beforeEach(() => {
    vi.useFakeTimers();
    xml = XML;
    bridge = {
      isLoading: false,
      getCurrentXML: vi.fn(() => xml),
      loadXML: vi.fn(async (next: string) => {
        xml = next;
      }),
    } as unknown as UseDrawioBridgeReturn;
    persistence = { scheduleDrawioSave: vi.fn() } as unknown as UseDFDPersistenceReturn;
  });
  afterEach(() => vi.useRealTimers());

  it("writes the badges after the load, then only on a change", async () => {
    const { rerender } = renderHook((o: UseDfdBadgesOptions) => useDfdBadges(bridge, persistence, o), {
      initialProps: options({ defaultExposureLevel: "EL1" }),
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(bridge.loadXML).toHaveBeenCalledTimes(1);
    expect(xml).toContain('label="EL1"');
    expect(persistence.scheduleDrawioSave).toHaveBeenCalledWith(xml);

    // a re-render with the same data does nothing
    rerender(options({ defaultExposureLevel: "EL1", boundaryType: "network" }));
    await vi.advanceTimersByTimeAsync(20);
    expect(bridge.loadXML).toHaveBeenCalledTimes(1);

    rerender(options({ defaultExposureLevel: "EL3" }));
    await vi.advanceTimersByTimeAsync(20);
    expect(bridge.loadXML).toHaveBeenCalledTimes(2);
    expect(xml).toContain('label="EL3"');
    expect(xml).not.toContain('label="EL1"');
  });

  it("a diagram that already shows the badges is not reloaded", async () => {
    renderHook(() => useDfdBadges(bridge, persistence, options({})));
    await vi.advanceTimersByTimeAsync(20);
    expect(bridge.loadXML).not.toHaveBeenCalled();
    expect(persistence.scheduleDrawioSave).not.toHaveBeenCalled();
  });

  it("waits for the editor", async () => {
    (bridge as { isLoading: boolean }).isLoading = true;
    renderHook(() => useDfdBadges(bridge, persistence, options({ defaultExposureLevel: "EL1" })));
    await vi.advanceTimersByTimeAsync(50);
    expect(bridge.getCurrentXML).not.toHaveBeenCalled();
  });
});
