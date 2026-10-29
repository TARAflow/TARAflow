// tests/unit/features/threats/catalog/mitigation-effects-valid.test.ts
//
// Closed-loop review CL-1, finding 7: every DFD effect of the mitigation
// catalog names a property the DFD has and a value it can hold — otherwise
// the SHOULD can never be met and Apply would write a value the form does
// not know. The "meets" table of the shared value semantics likewise only
// lists real options.

import { describe, it, expect } from "vitest";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import { CONTROL_PROPERTY_OPTIONS, controlPropertyOptions } from "features/dfd/models/control-property-options";
import { CONTROL_VALUE_MEETS } from "shared/utils/control-value-semantics";

describe("mitigation catalog effects", () => {
  it("every effect: a known property, a value it can hold", () => {
    const problems = getAllMitigations().flatMap((m) =>
      (m.affectsProperties ?? []).flatMap((e) => {
        const options = controlPropertyOptions(e.targetType, e.property);
        if (!options) return [`${m.id}: ${e.targetType}.${e.property} is not a DFD property`];
        return options.includes(e.expectedValue)
          ? []
          : [`${m.id}: ${e.targetType}.${e.property} = ${JSON.stringify(e.expectedValue)} is not an option`];
      }),
    );
    expect(problems).toEqual([]);
  });

  it("the meets table names options only", () => {
    const optionsOf = (property: string) =>
      Object.entries(CONTROL_PROPERTY_OPTIONS)
        .filter(([key]) => key.endsWith(`.${property}`))
        .flatMap(([, values]) => values);
    const problems = Object.entries(CONTROL_VALUE_MEETS).flatMap(([property, table]) => {
      const options = optionsOf(property);
      if (options.length === 0) return [`${property}: unknown property`];
      return Object.entries(table).flatMap(([expected, meeting]) =>
        [expected, ...meeting].filter((v) => !options.includes(v)).map((v) => `${property}: ${String(v)}`),
      );
    });
    expect(problems).toEqual([]);
  });
});
