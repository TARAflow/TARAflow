// tests/unit/features/dfd/services/validators/dfd-factory.ts
//
// Minimal typed builders for DFDElement / DFDConnection used by the validator
// tests. There is no element/connection factory in tests/test-helpers.ts, so
// this is the shared one. Not a *.test.ts file → Vitest will not execute it.
//
// ⚠ WIRING: deep import specifiers. If features/dfd has a barrel that re-exports
// these types, switch to `from "features/dfd"`.

import type { DFDElement, DFDConnection } from "features/dfd/models/dfd-types";
import type { DFDElementType } from "features/dfd/models/dfd-element-types";
import type { DataStoreProperties } from "features/dfd/models/element-properties";

export function el(
  partial: Partial<DFDElement> & { id: string; type: DFDElementType },
): DFDElement {
  return {
    displayId: partial.id,
    name: partial.name ?? partial.id,
    position: { x: 0, y: 0 },
    size: { width: 80, height: 40 },
    properties: {},
    ...partial,
  } as DFDElement;
}

export function dataStore(
  id: string,
  properties: Partial<DataStoreProperties>,
  name = id,
): DFDElement {
  return el({ id, type: "DataStore", name, properties: properties as never });
}

export function conn(
  partial: Partial<DFDConnection> & { id: string; from: string; to: string },
): DFDConnection {
  return {
    displayId: partial.id,
    name: partial.name ?? "",
    ...partial,
  } as DFDConnection;
}
