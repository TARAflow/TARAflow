// ==================== COMPONENT INSTANCE QUANTITY ====================
// Multi-project TARA, I5 (user 2026-11-08): identical units of a component
// in the same installation context are ONE instance with a quantity — one
// child page, one set of threats and risks, the quantity at the
// multiprocess and in the report. Units in other contexts are instances of
// their own. Pure.

import type { Project } from "../../models/project-types";

type Components = NonNullable<Project["components"]>;

/** The quantity an instance stands for (absent: 1). */
export function quantityOf(instance: { quantity?: number }): number {
  return instance.quantity && instance.quantity > 1 ? Math.floor(instance.quantity) : 1;
}

/** "SD1 · Smoke Detector" or "SD1 · Smoke Detector ×4". */
export function instanceLabel(instance: { prefix: string; quantity?: number }, componentName: string): string {
  const n = quantityOf(instance);
  return `${instance.prefix} · ${componentName}${n > 1 ? ` ×${n}` : ""}`;
}

/** The components block with the instance's quantity set (1 removes the field). */
export function withInstanceQuantity(components: Components, instanceId: string, quantity: number): Components {
  if (!Number.isFinite(quantity) || quantity < 1) throw new Error("A quantity is at least 1.");
  const n = Math.floor(quantity);
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const { quantity: _q, ...rest } = i;
      return n > 1 ? { ...rest, quantity: n } : rest;
    }),
  };
}
