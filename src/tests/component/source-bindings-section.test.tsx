// src/tests/component/source-bindings-section.test.tsx
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceBinding } from "shared";
import { SourceBindingsSection } from "features/overview/components/source-bindings-section";
import { resolveSourceBinding } from "features/overview/services/source-binding-service";

// Resolve-flow tests below mock resolveSourceBinding directly rather than
// window.git — the consent-gating and host-extraction logic it wraps is
// already fully covered in src/tests/unit/source-binding-service.test.ts;
// here we only need to verify the component wires the result correctly
// (persist on success, show the right message on failure, label toggling).
vi.mock("features/overview/services/source-binding-service", async () => {
  const actual = await vi.importActual<
    typeof import("features/overview/services/source-binding-service")
  >("features/overview/services/source-binding-service");
  return {
    ...actual,
    resolveSourceBinding: vi.fn(),
  };
});

// Self-contained i18n mock. `t()` returns `defaultValue` when passed, else
// falls back to a small table of the well-known `common.*` keys the app's
// real i18n resources already translate (SourceBindingsSection calls
// t("common.edit")/t("common.cancel")/t("common.save") without a
// defaultValue, mirroring ProjectInfo/ProjectSettings — those keys are
// expected to already exist in the app's translation bundle, not to be
// invented here), else the raw key. Drop this in favour of the project's
// global test i18n setup if/once one exists for component tests.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const knownTranslations: Record<string, string> = {
        "common.edit": "Edit",
        "common.cancel": "Cancel",
        "common.save": "Save",
      };
      return knownTranslations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const binding: SourceBinding = {
  id: "b-1",
  repoUrl: "https://github.com/org/repo.git",
  refType: "tag",
  refLabel: "v2.3.1",
  driftEvents: [],
};

describe("SourceBindingsSection", () => {
  it("renders the empty state when there are no bindings and not editing", () => {
    render(
      <SourceBindingsSection
        bindings={[]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No source references recorded."),
    ).toBeInTheDocument();
  });

  it("renders existing bindings read-only, including the 'not yet resolved' hint (Phase 1 has no resolution)", () => {
    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(binding.repoUrl)).toBeInTheDocument();
    expect(screen.getByText(binding.refLabel)).toBeInTheDocument();
    expect(
      screen.getByText("Not yet resolved to a commit."),
    ).toBeInTheDocument();
  });

  it("does not call onUpdate on Cancel, even after adding a row", () => {
    const onUpdate = vi.fn();
    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Add reference"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(onUpdate).not.toHaveBeenCalled();
    // back to read-only view with the original single row
    expect(screen.getAllByText(binding.repoUrl)).toHaveLength(1);
  });

  it("calls onUpdate with the edited draft on Save, including a newly added row", () => {
    const onUpdate = vi.fn();
    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Add reference"));

    const urlInputs = screen.getAllByPlaceholderText(
      "https://github.com/org/repo.git",
    );
    fireEvent.change(urlInputs[urlInputs.length - 1], {
      target: { value: "https://github.com/org/new-repo.git" },
    });
    const refLabelInputs = screen.getAllByPlaceholderText("main, v2.3.1…");
    fireEvent.change(refLabelInputs[refLabelInputs.length - 1], {
      target: { value: "main" },
    });

    fireEvent.click(screen.getByText("Save"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const saved = onUpdate.mock.calls[0][0] as SourceBinding[];
    expect(saved).toHaveLength(2);
    expect(saved[0]).toEqual(binding);
    expect(saved[1]).toMatchObject({
      repoUrl: "https://github.com/org/new-repo.git",
      refLabel: "main",
    });
  });

  it("removes a row via the trash button before saving", () => {
    const onUpdate = vi.fn();
    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByLabelText("Remove"));
    fireEvent.click(screen.getByText("Save"));

    expect(onUpdate).toHaveBeenCalledWith([]);
  });

  it("warns when the repo URL looks like a local filesystem path", () => {
    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Edit"));
    const urlInput = screen.getByDisplayValue(binding.repoUrl);
    fireEvent.change(urlInput, {
      target: { value: "/home/juergen/repos/mdv-backend" },
    });

    expect(
      screen.getByText(
        "This looks like a local path — only the remote URL is stored.",
      ),
    ).toBeInTheDocument();
  });

  it("resolves a binding and persists the SHA + timestamp on success, from the read-only view", async () => {
    const onUpdate = vi.fn();
    vi.mocked(resolveSourceBinding).mockResolvedValue({
      success: true,
      reachable: true,
      sha: "abcdef1234567890",
    });

    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Resolve"));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const saved = onUpdate.mock.calls[0][0] as SourceBinding[];
    expect(saved[0].resolvedCommitSha).toBe("abcdef1234567890");
    expect(saved[0].resolvedAt).toBeDefined();
  });

  it("shows an unreachable-host message and does not persist anything on failure", async () => {
    const onUpdate = vi.fn();
    vi.mocked(resolveSourceBinding).mockResolvedValue({
      success: false,
      reachable: false,
      error: "getaddrinfo ENOTFOUND github.com",
    });

    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Resolve"));

    await screen.findByText("Could not reach github.com.");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows a distinct message when consent was denied", async () => {
    const onUpdate = vi.fn();
    vi.mocked(resolveSourceBinding).mockResolvedValue({
      success: false,
      reachable: false,
      error: "consent_denied",
    });

    render(
      <SourceBindingsSection
        bindings={[binding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText("Resolve"));

    await screen.findByText("Network access was not allowed.");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("labels the action 'Re-resolve' and shows the short SHA once a binding is already resolved", () => {
    const resolvedBinding: SourceBinding = {
      ...binding,
      resolvedCommitSha: "1234567890abcdef",
      resolvedAt: new Date().toISOString(),
    };

    render(
      <SourceBindingsSection
        bindings={[resolvedBinding]}
        scopeLabel="Project Source Reference"
        scopeDescriptionKey="sourceBinding.projectScope.description"
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Re-resolve")).toBeInTheDocument();
    expect(screen.getByText(/Resolved to 1234567/)).toBeInTheDocument();
  });
});
