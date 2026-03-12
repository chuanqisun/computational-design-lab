import { describe, expect, it } from "vitest";
import { renderTemplate, registerHelpers } from "./playground-template";

registerHelpers();

describe("playground template rendering", () => {
  describe("basic variable substitution", () => {
    it("replaces a single variable", () => {
      const result = renderTemplate("Hello {{name}}", { name: "World" });
      expect(result).toBe("Hello World");
    });

    it("replaces multiple variables", () => {
      const result = renderTemplate("Design a {{productType}} for {{brand}}", {
        productType: "bottle",
        brand: "Acme",
      });
      expect(result).toBe("Design a bottle for Acme");
    });
  });

  describe("multi-value inline-list formatting", () => {
    it("renders one item without separator", () => {
      const result = renderTemplate("Use {{inlineList materials}}", {
        materials: ["glass"],
      });
      expect(result).toBe("Use glass");
    });

    it("renders two items with 'and'", () => {
      const result = renderTemplate("Use {{inlineList materials}}", {
        materials: ["glass", "aluminum"],
      });
      expect(result).toBe("Use glass and aluminum");
    });

    it("renders three+ items with Oxford comma", () => {
      const result = renderTemplate("Use {{inlineList materials}}", {
        materials: ["glass", "aluminum", "plastic"],
      });
      expect(result).toBe("Use glass, aluminum, and plastic");
    });
  });

  describe("multi-value newline-list formatting", () => {
    it("renders items separated by newlines", () => {
      const result = renderTemplate("Items:\n{{newlineList items}}", {
        items: ["first", "second", "third"],
      });
      expect(result).toBe("Items:\nfirst\nsecond\nthird");
    });

    it("renders single item without trailing newline", () => {
      const result = renderTemplate("Item: {{newlineList items}}", {
        items: ["only"],
      });
      expect(result).toBe("Item: only");
    });
  });

  describe("multi-value bulleted-list formatting", () => {
    it("renders items as bullet points", () => {
      const result = renderTemplate("Traits:\n{{bulletList traits}}", {
        traits: ["bold", "modern", "clean"],
      });
      expect(result).toBe("Traits:\n- bold\n- modern\n- clean");
    });

    it("renders single item as single bullet", () => {
      const result = renderTemplate("Trait: {{bulletList traits}}", {
        traits: ["bold"],
      });
      expect(result).toBe("Trait: - bold");
    });
  });

  describe("empty value handling", () => {
    it("replaces missing variables with empty string", () => {
      const result = renderTemplate("Hello {{name}}", {});
      expect(result).toBe("Hello ");
    });

    it("handles empty arrays in inlineList", () => {
      const result = renderTemplate("Use {{inlineList materials}}", {
        materials: [],
      });
      expect(result).toBe("Use ");
    });

    it("handles undefined in inlineList", () => {
      const result = renderTemplate("Use {{inlineList materials}}", {});
      expect(result).toBe("Use ");
    });

    it("handles empty arrays in bulletList", () => {
      const result = renderTemplate("Items:\n{{bulletList items}}", {
        items: [],
      });
      expect(result).toBe("Items:\n");
    });
  });

  describe("conditional sections", () => {
    it("renders section when variable is truthy", () => {
      const result = renderTemplate(
        "{{#if notes}}Notes: {{notes}}{{/if}}",
        { notes: "important" }
      );
      expect(result).toBe("Notes: important");
    });

    it("omits section when variable is falsy", () => {
      const result = renderTemplate(
        "Start. {{#if notes}}Notes: {{notes}}. {{/if}}End.",
        { notes: "" }
      );
      expect(result).toBe("Start. End.");
    });

    it("omits section when variable is missing", () => {
      const result = renderTemplate(
        "Start. {{#if notes}}Notes: {{notes}}. {{/if}}End.",
        {}
      );
      expect(result).toBe("Start. End.");
    });
  });

  describe("each block for iteration", () => {
    it("iterates over array", () => {
      const result = renderTemplate(
        "{{#each items}}{{this}}\n{{/each}}",
        { items: ["a", "b", "c"] }
      );
      expect(result).toBe("a\nb\nc\n");
    });
  });

  describe("complex template rendering", () => {
    it("renders a full prompt template", () => {
      const template = `Design a {{productType}} package for {{brand}}.

Use these materials: {{inlineList materials}}.

{{#if constraints}}Constraints:
{{bulletList constraints}}{{/if}}

{{#if referenceImages}}Reference images: {{inlineList referenceImages}}.{{/if}}`;

      const variables = {
        productType: "premium bottle",
        brand: "Luxe Spirits",
        materials: ["frosted glass", "brushed aluminum", "matte black"],
        constraints: ["must be recyclable", "max height 30cm"],
        referenceImages: ["Bottle A", "Cap Detail B"],
      };

      const result = renderTemplate(template, variables);
      expect(result).toContain("Design a premium bottle package for Luxe Spirits.");
      expect(result).toContain("frosted glass, brushed aluminum, and matte black");
      expect(result).toContain("- must be recyclable");
      expect(result).toContain("- max height 30cm");
      expect(result).toContain("Bottle A and Cap Detail B");
    });
  });
});
