import React from "react";
import { useTranslation } from "react-i18next";
import {
  emptyItemDefinition,
  type ItemDefinition,
  type ItemFunction,
  type ItemSection,
  type ItemSectionId,
} from "shared";
import type { ItemModelItem } from "../models/overview-types";
import { ItemSectionCard } from "./item-section-card";
import { ItemFunctionsCard } from "./item-functions-card";
import { ItemAssumptionsCard } from "./item-assumptions-card";

// ==================== ITEM DEFINITION VIEW ====================
// The "Definition" sub-tab of the Overview (ISO/SAE 21434 9.3, RQ-09-01/02;
// conformance plan Phase 1 stage A, decisions 8 and 24). Every preset sees it;
// the preset only decides which sections are mandatory (findings, A-4).
//
//   Purpose and functions   the project description (info.description)
//   Functions               over the lifecycle, optionally a function asset
//   Item boundary           RQ-09-01 a)
//   Preliminary architecture RQ-09-01 c)
//   Operational environment RQ-09-02
//   Constraints             supporting (legal requirements, constraints)
//
// Each section: text, source reference, links to the model. Then the
// assumptions (A-3), which trust boundaries link.

interface ItemDefinitionViewProps {
  description: string;
  itemDefinition: ItemDefinition | undefined;
  modelItems: readonly ItemModelItem[];
  /** assumption id → boundaries that link it */
  assumptionUsage?: Readonly<Record<string, readonly string[]>>;
  onChange: (change: { description?: string; itemDefinition: ItemDefinition }) => void;
}

const TEXT_SECTIONS: readonly Exclude<ItemSectionId, "functions">[] = [
  "boundary",
  "architecture",
  "environment",
  "constraints",
];

const SECTION_DEFAULTS: Record<Exclude<ItemSectionId, "functions">, { title: string; hint: string }> = {
  boundary: {
    title: "Item boundary",
    hint: "What belongs to the item and what does not; its interfaces to other items and to the environment (9.3 a).",
  },
  architecture: {
    title: "Preliminary architecture",
    hint: "The item's main building blocks and how they work together (9.3 c) — refer to the DFD instead of redrawing it.",
  },
  environment: {
    title: "Operational environment",
    hint: "Where and how the item is used, as far as relevant to cybersecurity (9.3, RQ-09-02).",
  },
  constraints: {
    title: "Constraints and legal requirements",
    hint: "Technical, organisational and legal constraints the analysis has to respect.",
  },
};

export const ItemDefinitionView: React.FC<ItemDefinitionViewProps> = ({
  description,
  itemDefinition,
  modelItems,
  assumptionUsage = {},
  onChange,
}) => {
  const { t } = useTranslation();
  const def = itemDefinition ?? emptyItemDefinition();

  const withSection = (id: ItemSectionId, section: ItemSection): ItemDefinition => {
    const sections = { ...def.sections };
    if (section.text?.trim() || section.source || section.modelRefs?.length) sections[id] = section;
    else delete sections[id];
    return { ...def, sections };
  };

  const functionAssets = modelItems.filter(
    (m) => m.kind === "asset" && (m.detail === "function" || m.detail === "process"),
  );

  return (
    <div data-testid="item-definition-view">
      <p className="text-sm text-gray-600 mb-4">
        {t("itemDefinition.intro", {
          defaultValue:
            "What is analysed: the item (ISO/SAE 21434 9.3), its boundary, functions, preliminary architecture and operational environment. Describe it here or refer to the architecture document it comes from.",
        })}
      </p>

      <ItemSectionCard
        testId="item-definition-purpose"
        title={t("itemDefinition.purpose.title", { defaultValue: "Purpose and functions" })}
        hint={t("itemDefinition.purpose.hint", {
          defaultValue: "What the item is for and what it does — the former project description.",
        })}
        text={description}
        section={def.sections.functions}
        modelItems={modelItems}
        onSave={(text, section) =>
          onChange({ description: text, itemDefinition: withSection("functions", section) })
        }
      />

      <ItemFunctionsCard
        functions={def.functions}
        functionAssets={functionAssets}
        onSave={(functions: ItemFunction[]) => onChange({ itemDefinition: { ...def, functions } })}
      />

      {TEXT_SECTIONS.map((id) => (
        <ItemSectionCard
          key={id}
          testId={`item-definition-${id}`}
          title={t(`itemDefinition.sections.${id}.title`, { defaultValue: SECTION_DEFAULTS[id].title })}
          hint={t(`itemDefinition.sections.${id}.hint`, { defaultValue: SECTION_DEFAULTS[id].hint })}
          text={def.sections[id]?.text ?? ""}
          section={def.sections[id]}
          modelItems={modelItems}
          onSave={(text, section) =>
            onChange({
              itemDefinition: withSection(id, { ...section, ...(text.trim() ? { text } : {}) }),
            })
          }
        />
      ))}

      <ItemAssumptionsCard
        assumptions={def.assumptions}
        usage={assumptionUsage}
        onSave={(assumptions) => onChange({ itemDefinition: { ...def, assumptions } })}
      />
    </div>
  );
};
