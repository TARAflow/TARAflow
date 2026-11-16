// ==================== COMPONENT TFID ====================
// Multi-project TARA: the machine tfIds of an imported component's elements
// and flows are `cmp` + 12 hex digits (componentInstanceTfId in
// insert-component.ts). Readers that only need to know "imported or not"
// (e.g. the duplicate id label check) use this, without the import code.

const COMPONENT_TF_ID = /^cmp[0-9a-f]{12}$/;

/** True for the tfId of an element or flow that came with an imported component instance. */
export function isComponentInstanceTfId(tfId: string | undefined | null): boolean {
  return !!tfId && COMPONENT_TF_ID.test(tfId);
}
