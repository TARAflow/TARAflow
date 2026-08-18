// ==================== ACTUATOR DESCRIPTION FORM ====================
// Transducer (cyber → physical). STRIDE focus: Tampering / Spoofing of commands,
// DoS of the safe-state function. Usually the bowtie top event — forced, blocked
// or absent actuation IS the hazard.
//
// Structure: Context → Security → Safety → Documentation (no accordions)

import React, { useCallback } from "react";
import { BufferedTextField } from "../shared/buffered-text-field";
import { useTranslation } from "react-i18next";
import { Grid, Stack } from "@mui/material";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import type { ActuatorProperties } from "../../models/transducer-properties";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  SectionLabel,
  EnumField,
  SafetyRelevantField,
  LocationField,
  PhysicalExposureField,
  SecondaryChannelsField,
  TransducerDocumentationSection,
  SAFETY_CLASSIFICATION_OPTIONS,
} from "./transducer-form-shared";

interface ActuatorFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface ActuatorGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

// Option lists are typed against the ActuatorProperties unions — a typo'd
// literal is a compile error.
const ACTUATOR_CLASS_OPTIONS: NonNullable<
  ActuatorProperties["actuatorClass"]
>[] = [
  "motion",
  "flow",
  "power_switching",
  "thermal",
  "emission",
  "dispensing",
  "signaling",
  "other",
  "unspecified",
];
const ENERGY_DOMAIN_OPTIONS: NonNullable<ActuatorProperties["energyDomain"]>[] = [
  "electrical",
  "hydraulic",
  "pneumatic",
  "thermal",
  "mechanical",
  "other",
  "unspecified",
];
const COMMAND_AUTH_OPTIONS: NonNullable<
  ActuatorProperties["commandAuthentication"]
>[] = ["none", "integrity_checked", "source_authenticated", "cryptographic"];
const HARDWARE_INTERLOCK_OPTIONS: NonNullable<
  ActuatorProperties["hardwareInterlock"]
>[] = ["none", "sw_bypassable", "independent"];
const HAZARD_POTENTIAL_OPTIONS: NonNullable<
  ActuatorProperties["hazardPotential"]
>[] = ["unassessed", "informational", "low", "medium", "high", "catastrophic"];
const SAFE_STATE_OPTIONS: NonNullable<ActuatorProperties["safeState"]>[] = [
  "none_defined",
  "de_energize_to_safe",
  "energize_to_safe",
  "hold_last",
];
const FAIL_BEHAVIOR_OPTIONS: NonNullable<ActuatorProperties["failBehavior"]>[] = [
  "unassessed",
  "fail_dangerous",
  "fail_safe",
  "fail_operational",
];
const FEEDBACK_VERIFICATION_OPTIONS: NonNullable<
  ActuatorProperties["feedbackVerification"]
>[] = ["none", "closed_loop_shared", "closed_loop_independent"];

const ActuatorGeneralTab: React.FC<ActuatorGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<ActuatorProperties>(element, onChange);
  const { props } = form;

  const set = useCallback(
    (field: keyof ActuatorProperties, value: unknown) => {
      const current = (element.properties ?? {}) as ActuatorProperties;

      // location is normally derived from PhysicalBoundary containment — a manual
      // choice is an override, clearing it returns to auto-derivation.
      if (field === "location") {
        onChange({
          properties: {
            ...current,
            location: value as ActuatorProperties["location"],
            locationProvenance: value ? "override" : "derived",
          } as ActuatorProperties,
        });
        return;
      }

      onChange({
        properties: { ...current, [field]: value } as ActuatorProperties,
      });
    },
    [element.properties, onChange],
  );

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {/* ── Context ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.context", {
          defaultValue: "Context",
        })}
      />
      <Grid container rowSpacing={2} columnSpacing={2}>
        <Grid item xs={12} sm={6}>
          <BufferedTextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.actuator.fields.type.label",
              {
                defaultValue: "Device kind",
              },
            )}
            value={(props.type as string) ?? ""}
            onCommit={(v) => set("type", v || undefined)}
            placeholder={t(
              "tabs.dfd.element_description.actuator.fields.type.placeholder",
              { defaultValue: "e.g. ball valve, BLDC servo, contactor" },
            )}
          />
        </Grid>
        <EnumField
          ns="actuator"
          field="actuatorClass"
          label="Actuator class"
          value={props.actuatorClass ?? ""}
          options={ACTUATOR_CLASS_OPTIONS}
          onChange={(v) => set("actuatorClass", v)}
        />
        <EnumField
          ns="actuator"
          field="energyDomain"
          label="Energy domain"
          value={props.energyDomain ?? ""}
          options={ENERGY_DOMAIN_OPTIONS}
          onChange={(v) => set("energyDomain", v)}
        />
        <LocationField
          ns="actuator"
          value={props.location}
          provenance={props.locationProvenance}
          onChange={(v) => set("location", v)}
        />
        <PhysicalExposureField
          ns="actuator"
          value={props.physicalExposureLevel}
          onChange={(v) => set("physicalExposureLevel", v)}
        />
        <SecondaryChannelsField
          ns="actuator"
          value={props.secondaryChannelCapabilities}
          onChange={(v) => set("secondaryChannelCapabilities", v)}
        />
      </Grid>

      {/* ── Security ────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />
      <Grid container rowSpacing={2} columnSpacing={2}>
        <EnumField
          ns="actuator"
          field="commandAuthentication"
          label="Command authentication"
          value={props.commandAuthentication ?? ""}
          options={COMMAND_AUTH_OPTIONS}
          onChange={(v) => set("commandAuthentication", v)}
        />
        <EnumField
          ns="actuator"
          field="hardwareInterlock"
          label="Hardware interlock"
          value={props.hardwareInterlock ?? ""}
          options={HARDWARE_INTERLOCK_OPTIONS}
          onChange={(v) => set("hardwareInterlock", v)}
        />
      </Grid>

      {/* ── Safety ──────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.safety", {
          defaultValue: "Safety",
        })}
      />
      <Grid container rowSpacing={2} columnSpacing={2}>
        <EnumField
          ns="actuator"
          field="hazardPotential"
          label="Hazard potential"
          value={props.hazardPotential ?? ""}
          options={HAZARD_POTENTIAL_OPTIONS}
          onChange={(v) => set("hazardPotential", v)}
        />
        <EnumField
          ns="actuator"
          field="safeState"
          label="Safe state"
          value={props.safeState ?? ""}
          options={SAFE_STATE_OPTIONS}
          onChange={(v) => set("safeState", v)}
        />
        <EnumField
          ns="actuator"
          field="failBehavior"
          label="Fail behavior"
          value={props.failBehavior ?? ""}
          options={FAIL_BEHAVIOR_OPTIONS}
          onChange={(v) => set("failBehavior", v)}
        />
        <EnumField
          ns="actuator"
          field="feedbackVerification"
          label="Feedback verification"
          value={props.feedbackVerification ?? ""}
          options={FEEDBACK_VERIFICATION_OPTIONS}
          onChange={(v) => set("feedbackVerification", v)}
        />
        <SafetyRelevantField
          ns="actuator"
          value={props.safetyRelevant}
          onChange={(v) => set("safetyRelevant", v)}
        />
        <EnumField
          ns="actuator"
          field="safetyClassification"
          label="Safety classification"
          value={props.safetyClassification ?? ""}
          options={SAFETY_CLASSIFICATION_OPTIONS}
          onChange={(v) => set("safetyClassification", v)}
        />
        <Grid item xs={12}>
          <BufferedTextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              "tabs.dfd.element_description.actuator.fields.safetyRationale.label",
              { defaultValue: "Safety rationale" },
            )}
            value={(props.safetyRationale as string) ?? ""}
            onCommit={(v) => set("safetyRationale", v || undefined)}
          />
        </Grid>
      </Grid>

      {/* ── Documentation ───────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.documentation", {
          defaultValue: "Documentation",
        })}
      />
      <TransducerDocumentationSection
        ns="actuator"
        owner={props.owner}
        onOwnerChange={(v) => set("owner", v)}
        securityControlOwnership={props.securityControlOwnership ?? []}
        form={form}
      />
    </Stack>
  );
};

export const ActuatorDescriptionForm = React.memo<ActuatorFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={<ActuatorGeneralTab element={element} onChange={onChange} />}
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default ActuatorDescriptionForm;
