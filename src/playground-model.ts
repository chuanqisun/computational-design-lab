import Mustache from "mustache";

export type PlaygroundSlotType = "text" | "longText" | "image";
export type PlaygroundSlotCardinality = "single" | "multiple";
export type PlaygroundSlotFormat = "inline-list" | "newline-list" | "bulleted-list";

export interface PlaygroundImageValue {
  dataUrl: string;
  fileName: string;
  imageName: string;
}

export type PlaygroundSlotValue = PlaygroundImageValue | string;
export type PlaygroundSlotValues = Record<string, PlaygroundSlotValue[]>;

export interface PlaygroundSlotDefinition {
  id: string;
  label: string;
  type: PlaygroundSlotType;
  required: boolean;
  placeholder: string;
  helpText: string;
  cardinality: PlaygroundSlotCardinality;
  formatStyle?: PlaygroundSlotFormat;
}

export interface PlaygroundTemplateDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  promptTemplate: string;
  slots: PlaygroundSlotDefinition[];
}

const emptyImageValue = (): PlaygroundImageValue => ({
  dataUrl: "",
  fileName: "",
  imageName: "",
});

const cloneImageValue = (value: Partial<PlaygroundImageValue> | undefined): PlaygroundImageValue => ({
  dataUrl: typeof value?.dataUrl === "string" ? value.dataUrl : "",
  fileName: typeof value?.fileName === "string" ? value.fileName : "",
  imageName: typeof value?.imageName === "string" ? value.imageName : "",
});

const coerceTextValue = (value: unknown) => (typeof value === "string" ? value : "");
const referenceImageOffset = 1;

const coerceSlotValue = (slot: PlaygroundSlotDefinition, value: unknown): PlaygroundSlotValue =>
  slot.type === "image" ? cloneImageValue(value as Partial<PlaygroundImageValue> | undefined) : coerceTextValue(value);

export const playgroundTemplates: PlaygroundTemplateDefinition[] = [
  {
    id: "packaging-concept",
    title: "Packaging concept prompt",
    description: "Structure a reusable concept-design prompt for a single product and several supporting cues.",
    category: "Concept",
    promptTemplate: [
      "Design a {{productType}} for {{brandContext}}.",
      "Use these material cues: {{materials}}.",
      "{{#brandTraits}}Reflect these brand traits: {{brandTraits}}.{{/brandTraits}}",
      "{{#referenceImages}}Reference images: {{referenceImages}}.{{/referenceImages}}",
      "{{#constraints}}Respect these constraints:",
      "{{constraints}}{{/constraints}}",
    ].join("\n"),
    slots: [
      {
        id: "productType",
        label: "Product type",
        type: "text",
        required: true,
        placeholder: "Water bottle",
        helpText: "Usually a single hero object.",
        cardinality: "single",
        formatStyle: "inline-list",
      },
      {
        id: "brandContext",
        label: "Brand context",
        type: "longText",
        required: true,
        placeholder: "A premium hydration brand for cyclists.",
        helpText: "Explain the brand, audience, and tone.",
        cardinality: "single",
        formatStyle: "newline-list",
      },
      {
        id: "materials",
        label: "Materials",
        type: "text",
        required: true,
        placeholder: "Glass",
        helpText: "Add, remove, and reorder the material cues.",
        cardinality: "multiple",
        formatStyle: "inline-list",
      },
      {
        id: "brandTraits",
        label: "Brand traits",
        type: "text",
        required: false,
        placeholder: "Minimal",
        helpText: "Optional brand adjectives and characteristics.",
        cardinality: "multiple",
        formatStyle: "inline-list",
      },
      {
        id: "referenceImages",
        label: "Reference images",
        type: "image",
        required: false,
        placeholder: "Reference Bottle A",
        helpText: "Name each uploaded image so the prompt can refer to it in text.",
        cardinality: "multiple",
        formatStyle: "inline-list",
      },
      {
        id: "constraints",
        label: "Constraints",
        type: "longText",
        required: false,
        placeholder: "Avoid printed labels.",
        helpText: "Each item becomes a separate line in the rendered prompt.",
        cardinality: "multiple",
        formatStyle: "bulleted-list",
      },
    ],
  },
  {
    id: "reference-analysis",
    title: "Reference analysis prompt",
    description: "Guide a model to explain what reference images contribute to a direction.",
    category: "Analysis",
    promptTemplate: [
      "Analyze the design language of {{subject}}.",
      "{{#referenceImages}}Use these references: {{referenceImages}}.{{/referenceImages}}",
      "{{#focusAreas}}Focus on these areas:",
      "{{focusAreas}}{{/focusAreas}}",
      "{{#notes}}Additional notes:",
      "{{notes}}{{/notes}}",
    ].join("\n"),
    slots: [
      {
        id: "subject",
        label: "Subject",
        type: "text",
        required: true,
        placeholder: "Portable speaker",
        helpText: "The object or experience being analyzed.",
        cardinality: "single",
        formatStyle: "inline-list",
      },
      {
        id: "referenceImages",
        label: "Reference images",
        type: "image",
        required: false,
        placeholder: "Speaker silhouette A",
        helpText: "Provide readable names for each reference image.",
        cardinality: "multiple",
        formatStyle: "inline-list",
      },
      {
        id: "focusAreas",
        label: "Focus areas",
        type: "text",
        required: false,
        placeholder: "CMF strategy",
        helpText: "Optional areas that should be compared explicitly.",
        cardinality: "multiple",
        formatStyle: "bulleted-list",
      },
      {
        id: "notes",
        label: "Additional notes",
        type: "longText",
        required: false,
        placeholder: "Mention how portability is expressed.",
        helpText: "Optional long-form guidance.",
        cardinality: "multiple",
        formatStyle: "newline-list",
      },
    ],
  },
];

export function createDefaultSlotValues(template: PlaygroundTemplateDefinition): PlaygroundSlotValues {
  return Object.fromEntries(
    template.slots.map((slot) => [
      slot.id,
      [slot.type === "image" ? emptyImageValue() : ""],
    ]),
  );
}

export function normalizeSlotValues(
  template: PlaygroundTemplateDefinition,
  values: Record<string, unknown> | undefined,
): PlaygroundSlotValues {
  return Object.fromEntries(
    template.slots.map((slot) => {
      const raw = values?.[slot.id];
      const items = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === "" ? [] : [raw];
      const normalized = items.map((item) => coerceSlotValue(slot, item));
      return [slot.id, normalized.length > 0 ? normalized : [slot.type === "image" ? emptyImageValue() : ""]];
    }),
  );
}

const isEmptySlotValue = (slot: PlaygroundSlotDefinition, value: PlaygroundSlotValue) => {
  if (slot.type === "image") {
    const imageValue = value as PlaygroundImageValue;
    return !imageValue.fileName && !imageValue.imageName && !imageValue.dataUrl;
  }

  return (value as string).trim().length === 0;
};

const getImageReferenceName = (value: PlaygroundImageValue, index: number) =>
  value.imageName.trim() || value.fileName.trim() || `Reference Image ${index + referenceImageOffset}`;

const formatInlineList = (items: string[]) => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
};

const formatSlotItems = (slot: PlaygroundSlotDefinition, values: PlaygroundSlotValue[]) => {
  const items = values.flatMap((value, index) => {
    if (slot.type === "image") {
      const imageValue = value as PlaygroundImageValue;
      return isEmptySlotValue(slot, imageValue) ? [] : [getImageReferenceName(imageValue, index)];
    }

    const textValue = value as string;
    return isEmptySlotValue(slot, textValue) ? [] : [textValue.trim()];
  });

  switch (slot.formatStyle ?? "inline-list") {
    case "newline-list":
      return items.join("\n");
    case "bulleted-list":
      return items.map((item) => `- ${item}`).join("\n");
    case "inline-list":
    default:
      return formatInlineList(items);
  }
};

export function buildRenderContext(template: PlaygroundTemplateDefinition, values: PlaygroundSlotValues) {
  return Object.fromEntries(
    template.slots.map((slot) => [slot.id, formatSlotItems(slot, values[slot.id] ?? [])]),
  );
}

const legacyPlaceholderPattern = /\$\{([a-zA-Z0-9_-]+)\}/g;

export function renderPrompt(
  template: PlaygroundTemplateDefinition,
  promptTemplate: string,
  values: PlaygroundSlotValues,
) {
  const normalized = normalizeSlotValues(template, values);
  const context = buildRenderContext(template, normalized);
  const rendered = Mustache.render(promptTemplate.replaceAll(legacyPlaceholderPattern, "{{$1}}"), context);
  return rendered
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const toEditableValue = (slot: PlaygroundSlotDefinition, values: PlaygroundSlotValue[]) => {
  const normalized = values.map((value) => (slot.type === "image" ? cloneImageValue(value as PlaygroundImageValue) : value));
  if (slot.cardinality === "single") {
    return normalized[0] ?? (slot.type === "image" ? emptyImageValue() : "");
  }
  return normalized;
};

export function serializeEditableValues(template: PlaygroundTemplateDefinition, values: PlaygroundSlotValues) {
  const normalized = normalizeSlotValues(template, values);
  return `${JSON.stringify(
    Object.fromEntries(template.slots.map((slot) => [slot.id, toEditableValue(slot, normalized[slot.id] ?? [])])),
    null,
    2,
  )}\n`;
}

export function parseEditableValues(template: PlaygroundTemplateDefinition, raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      values: normalizeSlotValues(template, parsed),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}
