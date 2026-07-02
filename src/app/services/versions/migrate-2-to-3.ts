/**
 * Migrate schema version 2 → 3.
 * Splits interface.implementedControls.logicalAccessControl:
 *   secure_pairing → implementedControls.linkAuthentication = "pairing"
 *   password|certificate|mfa|hardware_token|challenge_response
 *                  → preserved in notes marker (re-model on process/flow — no guess)
 *   none | absent  → nothing carried
 * The obsolete key is always dropped. Idempotent.
 */
export function migrate_2_to_3(data: any): any {
  const migrateInterface = (el: any): any => {
    if (el?.type !== "Interface") return el;
    const props = el.properties;
    const lac = props?.implementedControls?.logicalAccessControl;
    if (!lac) return el; // already migrated / never set

    const { logicalAccessControl: _drop, ...restControls } =
      props.implementedControls ?? {};
    const nextProps: any = { ...props, implementedControls: restControls };

    if (lac === "secure_pairing") {
      nextProps.implementedControls.linkAuthentication = "pairing";
    } else if (lac !== "none") {
      const note =
        `[MIGRATED] logicalAccessControl=${lac} — re-model on the terminating ` +
        `process/flow (authenticationRequired / endpointAuthentication).`;
      nextProps.notes = props?.notes ? `${props.notes}\n${note}` : note;
    }
    return { ...el, properties: nextProps };
  };

  if (data.dfd?.elements?.length) {
    data = { ...data, dfd: { ...data.dfd,
      elements: data.dfd.elements.map(migrateInterface) } };
  }
  return { ...data, schemaVersion: 3 };
}