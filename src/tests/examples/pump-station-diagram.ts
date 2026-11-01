// src/tests/examples/pump-station-diagram.ts
//
// The draw.io diagram of the "Pump Station Controller" example (IEC 62443-4-2 /
// CRA, iec-62443-4-2-cra-coverage.md IEC-10): pump-station.drawio.xml, laid out
// by hand in the app's DFD editor and taken over verbatim — the generator
// never moves a shape. The project generator (pump-station-example.ts) lets
// the app's own DFD parser turn it into elements and flows, so diagram and
// records cannot drift apart.
//
// To change the layout: edit the example in TARAflow, save, copy dfd.xml of
// the saved project into pump-station.drawio.xml. The example test checks
// that every flow still passes the interfaces it should.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export function pumpStationXml(): string {
  return readFileSync(join(HERE, "pump-station.drawio.xml"), "utf-8");
}
