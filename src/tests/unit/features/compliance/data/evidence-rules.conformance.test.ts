// Conformance of the IEC 62443-4-2 evidence rules with the DFD element
// property types (iec-62443-4-2-cra-coverage.md D-15, D-18) — checked by the
// compiler: `tsc` in `npm run build` type-checks src/tests too. Every
// property path a rule reads must exist on each element type it names, and
// every `in` / `notIn` value must be assignable to that property's type. A
// renamed property or a changed enum breaks the build instead of making a
// rule silently stop matching.
//
// Lives in the tests so the compliance feature itself never imports the dfd
// feature (feature boundary); the rules are declared `as const satisfies`, so
// their literal paths and values are visible here.
import { describe, it, expect } from "vitest";
import type {
  ChipBoundaryProperties,
  DataFlowProperties,
  DataStoreProperties,
  ExternalEntityProperties,
  InterfaceProperties,
  MultiprocessProperties,
  PhysicalBoundaryProperties,
  ProcessProperties,
  TrustBoundaryProperties,
} from "features/dfd/models/element-properties";
import type { EvidenceRuleLiterals } from "features/compliance/data/evidence-rules";
import { ALL_EVIDENCE_RULES } from "features/compliance";

// ==================== TYPE MACHINERY ====================

interface PropsByType {
  Process: ProcessProperties;
  Multiprocess: MultiprocessProperties;
  DataStore: DataStoreProperties;
  DataFlow: DataFlowProperties;
  ExternalEntity: ExternalEntityProperties;
  Interface: InterfaceProperties;
  TrustBoundary: TrustBoundaryProperties;
  ChipBoundary: ChipBoundaryProperties;
  PhysicalBoundary: PhysicalBoundaryProperties;
}
type ElementType = keyof PropsByType;

/** Element of a multi-select property, else the value itself. */
type Elem<V> = V extends readonly (infer U)[] ? U : V;

/** Dot paths into a properties interface (nested objects up to three levels). */
type Paths<T, Depth extends unknown[] = []> = Depth["length"] extends 3
  ? never
  : {
      [K in keyof T & string]-?: NonNullable<T[K]> extends readonly unknown[]
        ? K
        : NonNullable<T[K]> extends object
          ? K | `${K}.${Paths<NonNullable<T[K]>, [...Depth, 0]>}`
          : K;
    }[keyof T & string];

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<NonNullable<T[K]>, Rest>
    : never
  : P extends keyof T
    ? NonNullable<T[P]>
    : never;

/**
 * A value list is checkable only against a literal type: a property typed as
 * plain `string` would accept any value, so it is reported as unchecked.
 */
type ValueViolation<E extends ElementType, P extends string, Values, Kind extends string> =
  string extends Elem<PathValue<PropsByType[E], P>>
    ? { element: E; property: P; uncheckedValues: "the property is typed as string" }
    : [Values] extends [Elem<PathValue<PropsByType[E], P>>]
      ? never
      : { element: E; property: P; [k: string]: unknown } & Record<Kind, Exclude<Values, Elem<PathValue<PropsByType[E], P>>>>;

/** Violations of one check on one element type (distributes over the checks). */
type CheckViolation<E extends ElementType, C> = C extends { readonly property: infer P extends string }
  ? P extends Paths<PropsByType[E]>
    ?
        | (C extends { readonly in: readonly (infer V)[] } ? ValueViolation<E, P, V, "badInValues"> : never)
        | (C extends { readonly notIn: readonly (infer V)[] } ? ValueViolation<E, P, V, "badNotInValues"> : never)
    : { element: E; unknownPath: P }
  : never;

type ForEachType<E, C> = E extends ElementType ? CheckViolation<E, C> : never;

type ChecksOf<T> =
  | (T extends { readonly appliesIf: readonly (infer C)[] } ? C : never)
  | (T extends { readonly satisfiedIf: readonly (infer C)[] } ? C : never);

type TargetViolation<T> =
  | (T extends { readonly elementTypes: readonly (infer E)[] } ? ForEachType<E, ChecksOf<T>> : never)
  | (T extends { readonly endpointIf: { readonly elementTypes: readonly (infer E)[]; readonly checks: readonly (infer C)[] } }
      ? ForEachType<E, C>
      : never)
  | (T extends { readonly connectedIf: { readonly elementTypes: readonly (infer E)[]; readonly checks: readonly (infer C)[] } }
      ? ForEachType<E, C>
      : never);

type RuleViolation<R> = R extends { readonly targets: readonly (infer T)[] }
  ?
      | TargetViolation<T>
      | (R extends { readonly appliesWhen: readonly (infer W)[] } ? TargetViolation<W> : never)
  : never;

/** Compiles only for `never`; the error message shows the offending check. */
type AssertNone<V extends never> = V;

// ==================== THE CHECK ====================

/** Every rule: no unknown path, no value outside its property's type. */
export type RulesConform = AssertNone<RuleViolation<EvidenceRuleLiterals[number]>>;

// ==================== NEGATIVE CASES ====================
// The machinery must reject broken rules — otherwise the check above proves
// nothing (D-18: `satisfies` without `as const` widened every path to string).

type ProbeRule<Check> = { readonly targets: readonly [{ readonly elementTypes: readonly ["Process"]; readonly satisfiedIf: readonly [Check] }] };

/** A correct rule passes. */
export type AcceptsValid = AssertNone<RuleViolation<ProbeRule<{ readonly property: "inputValidation"; readonly in: readonly ["strict"] }>>>;

/** A correct nested path passes. */
export type AcceptsNested = AssertNone<RuleViolation<ProbeRule<{ readonly property: "sessionControl.sessionLockEnabled"; readonly in: readonly [true] }>>>;

// @ts-expect-error — a property that does not exist on the element type
export type RejectsUnknownPath = AssertNone<RuleViolation<ProbeRule<{ readonly property: "noSuchProperty" }>>>;

// @ts-expect-error — a nested path that does not exist
export type RejectsUnknownNestedPath = AssertNone<RuleViolation<ProbeRule<{ readonly property: "sessionControl.noSuchFlag" }>>>;

// @ts-expect-error — a value outside the property's enum
export type RejectsUnknownValue = AssertNone<RuleViolation<ProbeRule<{ readonly property: "inputValidation"; readonly in: readonly ["very_strict"] }>>>;

// @ts-expect-error — a notIn value outside the property's enum
export type RejectsUnknownNotInValue = AssertNone<RuleViolation<ProbeRule<{ readonly property: "inputValidation"; readonly notIn: readonly ["nope"] }>>>;

// @ts-expect-error — a value list on a property typed as plain string cannot be checked
export type RejectsStringTypedProperty = AssertNone<RuleViolation<ProbeRule<{ readonly property: "securityControls"; readonly in: readonly ["x"] }>>>;

// @ts-expect-error — a connectedIf check on the neighbour's type is checked too
export type RejectsUnknownNeighbourPath = AssertNone<RuleViolation<{ readonly targets: readonly [{ readonly elementTypes: readonly ["Process"]; readonly connectedIf: { readonly elementTypes: readonly ["ExternalEntity"]; readonly checks: readonly [{ readonly property: "noSuchProperty" }] } }] }>>;

// @ts-expect-error — a property of another element type (DataFlow) on a Process
export type RejectsWrongElementType = AssertNone<RuleViolation<ProbeRule<{ readonly property: "encryptionInTransit" }>>>;

// ==================== RUNTIME PART ====================
// The check is type-level; this keeps the file a regular test and guards the
// shape the type check relies on.

describe("evidence rules conformance", () => {
  it("is checked by the compiler (npm run build); every check names a property", () => {
    for (const rule of ALL_EVIDENCE_RULES) {
      for (const target of [...rule.targets, ...(rule.appliesWhen ?? [])]) {
        expect(target.elementTypes.length, rule.id).toBeGreaterThan(0);
        const checks = [
          ...(target.appliesIf ?? []),
          ...(target.satisfiedIf ?? []),
          ...(target.endpointIf?.checks ?? []),
          ...(target.connectedIf?.checks ?? []),
        ];
        for (const check of checks) {
          expect(check.property, rule.id).toMatch(/^[a-zA-Z]+(\.[a-zA-Z]+)*$/);
        }
      }
    }
  });
});
