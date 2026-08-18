// ==================== SENSOR DESCRIPTION FORM ====================
// Transducer (physical → cyber). STRIDE focus: Spoofing / Tampering / Information
// Disclosure / DoS of the measured value. Active sensors (radar/LiDAR/ultrasonic)
// are modelled as a dual-role element (Sensor + emission Actuator) — not here.
//
// Structure: Context → Security → Safety → Documentation (no accordions)

import React, { useCallback } from "react";
import { BufferedTextField } from "../shared/buffered-text-field";
import { useTranslation } from "react-i18next";
import { Grid, Stack } from "@mui/material";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import type { SensorProperties } from "../../models/transducer-properties";
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

interface SensorFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface SensorGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

// Option lists are typed against the SensorProperties unions — a typo'd literal
// is a compile error.
const MEASURAND_OPTIONS: NonNullable<SensorProperties["measurand"]>[] = [
  "temperature",
  "pressure",
  "position",
  "velocity",
  "flow",
  "optical",
  "acoustic",
  "chemical",
  "electrical",
  "other",
  "unspecified",
];
const TRANSDUCTION_PRINCIPLE_OPTIONS: NonNullable<
  SensorProperties["transductionPrinciple"]
>[] = [
  "capacitive",
  "resistive",
  "piezoelectric",
  "magnetic",
  "optical",
  "mems_inertial",
  "ultrasonic",
  "electrochemical",
  "thermal",
  "other",
  "unspecified",
];
const SIGNAL_AUTH_OPTIONS: NonNullable<
  SensorProperties["signalAuthentication"]
>[] = ["none", "plausibility_only", "source_authenticated", "cryptographic"];
const PLAUSIBILITY_OPTIONS: NonNullable<
  SensorProperties["plausibilityCheck"]
>[] = ["none", "range", "range_rate", "model_based"];
const REDUNDANCY_OPTIONS: NonNullable<SensorProperties["redundancy"]>[] = [
  "none",
  "homogeneous",
  "diverse",
];
const LOSS_DETECTION_OPTIONS: NonNullable<SensorProperties["lossDetection"]>[] = [
  "none",
  "detected_degraded",
  "detected_failsafe",
];
const STIMULUS_DOMAIN_OPTIONS: NonNullable<
  SensorProperties["stimulusDomain"]
>[] = [
  "rf",
  "optical",
  "acoustic",
  "magnetic",
  "electric_field",
  "chemical",
  "mechanical",
  "thermal",
  "other",
];
const SENSING_EXPOSURE_OPTIONS: NonNullable<
  SensorProperties["sensingExposure"]
>[] = ["shielded", "partially_exposed", "exposed"];

const SensorGeneralTab: React.FC<SensorGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<SensorProperties>(element, onChange);
  const { props } = form;

  const set = useCallback(
    (field: keyof SensorProperties, value: unknown) => {
      const current = (element.properties ?? {}) as SensorProperties;

      // location is normally derived from PhysicalBoundary containment — a manual
      // choice is an override, clearing it returns to auto-derivation.
      if (field === "location") {
        onChange({
          properties: {
            ...current,
            location: value as SensorProperties["location"],
            locationProvenance: value ? "override" : "derived",
          } as SensorProperties,
        });
        return;
      }

      onChange({
        properties: { ...current, [field]: value } as SensorProperties,
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
            label={t("tabs.dfd.element_description.sensor.fields.type.label", {
              defaultValue: "Device kind",
            })}
            value={(props.type as string) ?? ""}
            onCommit={(v) => set("type", v || undefined)}
            placeholder={t(
              "tabs.dfd.element_description.sensor.fields.type.placeholder",
              { defaultValue: "e.g. PT100, MEMS accelerometer" },
            )}
          />
        </Grid>
        <EnumField
          ns="sensor"
          field="measurand"
          label="Measurand"
          value={props.measurand ?? ""}
          options={MEASURAND_OPTIONS}
          onChange={(v) => set("measurand", v)}
        />
        <EnumField
          ns="sensor"
          field="transductionPrinciple"
          label="Transduction principle"
          value={props.transductionPrinciple ?? ""}
          options={TRANSDUCTION_PRINCIPLE_OPTIONS}
          onChange={(v) => set("transductionPrinciple", v)}
        />
        <EnumField
          ns="sensor"
          field="stimulusDomain"
          label="Stimulus domain"
          value={props.stimulusDomain ?? ""}
          options={STIMULUS_DOMAIN_OPTIONS}
          onChange={(v) => set("stimulusDomain", v)}
        />
        <LocationField
          ns="sensor"
          value={props.location}
          provenance={props.locationProvenance}
          onChange={(v) => set("location", v)}
        />
        <PhysicalExposureField
          ns="sensor"
          value={props.physicalExposureLevel}
          onChange={(v) => set("physicalExposureLevel", v)}
        />
        <EnumField
          ns="sensor"
          field="sensingExposure"
          label="Sensing exposure"
          value={props.sensingExposure ?? ""}
          options={SENSING_EXPOSURE_OPTIONS}
          onChange={(v) => set("sensingExposure", v)}
        />
        <SecondaryChannelsField
          ns="sensor"
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
          ns="sensor"
          field="signalAuthentication"
          label="Signal authentication"
          value={props.signalAuthentication ?? ""}
          options={SIGNAL_AUTH_OPTIONS}
          onChange={(v) => set("signalAuthentication", v)}
        />
        <EnumField
          ns="sensor"
          field="plausibilityCheck"
          label="Plausibility check"
          value={props.plausibilityCheck ?? ""}
          options={PLAUSIBILITY_OPTIONS}
          onChange={(v) => set("plausibilityCheck", v)}
        />
        <EnumField
          ns="sensor"
          field="redundancy"
          label="Redundancy"
          value={props.redundancy ?? ""}
          options={REDUNDANCY_OPTIONS}
          onChange={(v) => set("redundancy", v)}
        />
        <EnumField
          ns="sensor"
          field="lossDetection"
          label="Loss detection"
          value={props.lossDetection ?? ""}
          options={LOSS_DETECTION_OPTIONS}
          onChange={(v) => set("lossDetection", v)}
        />
      </Grid>

      {/* ── Safety ──────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.safety", {
          defaultValue: "Safety",
        })}
      />
      <Grid container rowSpacing={2} columnSpacing={2}>
        <SafetyRelevantField
          ns="sensor"
          value={props.safetyRelevant}
          onChange={(v) => set("safetyRelevant", v)}
        />
        <EnumField
          ns="sensor"
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
              "tabs.dfd.element_description.sensor.fields.safetyRationale.label",
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
        ns="sensor"
        owner={props.owner}
        onOwnerChange={(v) => set("owner", v)}
        securityControlOwnership={props.securityControlOwnership ?? []}
        form={form}
      />
    </Stack>
  );
};

export const SensorDescriptionForm = React.memo<SensorFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={<SensorGeneralTab element={element} onChange={onChange} />}
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default SensorDescriptionForm;
