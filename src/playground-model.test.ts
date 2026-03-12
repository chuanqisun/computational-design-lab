import { describe, expect, it } from "vitest";
import {
  buildRenderContext,
  createDefaultSlotValues,
  parseEditableValues,
  playgroundTemplates,
  renderPrompt,
  serializeEditableValues,
} from "./playground-model";

const packagingTemplate = playgroundTemplates[0];

describe("playground model", () => {
  it("creates a starter value for every slot", () => {
    const values = createDefaultSlotValues(packagingTemplate);

    expect(Object.keys(values)).toEqual(packagingTemplate.slots.map((slot) => slot.id));
    expect(values.productType).toEqual([""]);
    expect(values.referenceImages).toEqual([{ dataUrl: "", fileName: "", imageName: "" }]);
  });

  it("serializes values to editable JSON and parses them back", () => {
    const original = {
      ...createDefaultSlotValues(packagingTemplate),
      productType: ["water bottle"],
      materials: ["glass", "brushed aluminum", "matte plastic"],
      referenceImages: [{ dataUrl: "", fileName: "bottle.png", imageName: "Reference Bottle A" }],
    };

    const serialized = serializeEditableValues(packagingTemplate, original);
    const parsed = parseEditableValues(packagingTemplate, serialized);

    expect(parsed.error).toBeUndefined();
    expect(parsed.values).toEqual(original);
  });

  it("accepts scalar JSON entries for single slots and arrays for multiple slots", () => {
    const parsed = parseEditableValues(
      packagingTemplate,
      JSON.stringify({
        productType: "water bottle",
        brandContext: "A modern hydration brand for cyclists.",
        materials: ["glass", "brushed aluminum"],
        referenceImages: [{ imageName: "Cap Detail B" }],
      }),
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.values?.productType).toEqual(["water bottle"]);
    expect(parsed.values?.materials).toEqual(["glass", "brushed aluminum"]);
    expect(parsed.values?.referenceImages).toEqual([{ dataUrl: "", fileName: "", imageName: "Cap Detail B" }]);
  });

  it("renders multi-value slots with plural-aware formatting and fallback image names", () => {
    const values = {
      ...createDefaultSlotValues(packagingTemplate),
      productType: ["water bottle"],
      brandContext: ["A durable commuter brand."],
      materials: ["glass", "brushed aluminum", "matte plastic"],
      brandTraits: ["minimal", "precise"],
      referenceImages: [
        { dataUrl: "data:image/png;base64,abc", fileName: "", imageName: "" },
        { dataUrl: "", fileName: "", imageName: "Cap Detail B" },
      ],
    };

    expect(buildRenderContext(packagingTemplate, values)).toMatchObject({
      materials: "glass, brushed aluminum, and matte plastic",
      brandTraits: "minimal and precise",
      referenceImages: "Reference Image 1 and Cap Detail B",
    });
  });

  it("renders both mustache and legacy ${slot} placeholders", () => {
    const values = {
      ...createDefaultSlotValues(packagingTemplate),
      productType: ["water bottle"],
      brandContext: ["A durable commuter brand."],
      materials: ["glass", "brushed aluminum"],
      brandTraits: [],
      referenceImages: [],
      constraints: [],
    };

    const prompt = renderPrompt(
      packagingTemplate,
      [
        "Design a {{productType}} for {{brandContext}}.",
        "Use these material cues: ${materials}.",
        "{{#brandTraits}}Reflect these brand traits: {{brandTraits}}.{{/brandTraits}}",
      ].join("\n"),
      values,
    );

    expect(prompt).toBe([
      "Design a water bottle for A durable commuter brand..",
      "Use these material cues: glass and brushed aluminum.",
    ].join("\n"));
  });

  it("reports invalid editable JSON without discarding the current text", () => {
    const parsed = parseEditableValues(packagingTemplate, "{");

    expect(parsed.values).toBeUndefined();
    expect(parsed.error).toMatch(/expected property name/i);
  });
});
