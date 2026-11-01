// src/tests/component/update-session-fields.test.tsx
//
// Update mechanism and session control on the Process and Multiprocess forms
// (iec-62443-4-2-cra-coverage.md P-2): the session switches keep "not
// specified" apart from "no" — the IEC 62443 matrix reads the first as
// unknown, the second as not met.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Grid } from "@mui/material";
import { SessionControlFields, UpdateMechanismField } from "features/dfd/components/forms/update-session-fields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const BASE = "tabs.dfd.element_description.process.fields";

const choose = (comboboxIndex: number, option: string) => {
  fireEvent.mouseDown(screen.getAllByRole("combobox")[comboboxIndex]);
  fireEvent.click(screen.getByRole("option", { name: option }));
};

describe("SessionControlFields", () => {
  const renderFields = (value?: Parameters<typeof SessionControlFields>[0]["value"]) => {
    const onChange = vi.fn();
    render(
      <Grid container>
        <SessionControlFields i18nBase={BASE} value={value} onChange={onChange} />
      </Grid>,
    );
    return onChange;
  };

  it("an explicit no is stored as false", () => {
    const onChange = renderFields();
    choose(0, "No");
    expect(onChange).toHaveBeenCalledWith({ sessionLockEnabled: false });
  });

  it("back to not specified removes the key, and the object when it is empty", () => {
    const onChange = renderFields({ sessionLockEnabled: true });
    choose(0, "Not specified");
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps the other settings", () => {
    const onChange = renderFields({ sessionLockEnabled: true, maxConcurrentSessions: 2 });
    choose(1, "Yes");
    expect(onChange).toHaveBeenCalledWith({ sessionLockEnabled: true, maxConcurrentSessions: 2, remoteTerminationEnabled: true });
  });

  it("the session limit is a whole number ≥ 0; empty clears it", () => {
    const onChange = renderFields({ remoteTerminationEnabled: false });
    const input = screen.getByLabelText("Max. Concurrent Sessions (0 = unlimited)");
    fireEvent.change(input, { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith({ remoteTerminationEnabled: false, maxConcurrentSessions: 3 });
    cleanup();
    const onClear = renderFields({ remoteTerminationEnabled: false, maxConcurrentSessions: 2 });
    fireEvent.change(screen.getByLabelText("Max. Concurrent Sessions (0 = unlimited)"), { target: { value: "" } });
    expect(onClear).toHaveBeenLastCalledWith({ remoteTerminationEnabled: false });
  });
});

describe("UpdateMechanismField", () => {
  it("offers every update mechanism; not specified is undefined", () => {
    const onChange = vi.fn();
    render(
      <Grid container>
        <UpdateMechanismField i18nBase={BASE} value="signed_ota" onChange={onChange} />
      </Grid>,
    );
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(8);
    fireEvent.click(screen.getByRole("option", { name: "Not specified" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
