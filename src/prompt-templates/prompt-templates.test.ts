import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as geminiModels from "../lib/gemini-models";
import { promptTemplates, type TemplateItem } from ".";
import type { RenderedPrompt } from "./prompt-template.types";

/**
 * Keeps the prompt library honest:
 * - every template renders (defaults and every preset),
 * - every template names a model the app actually uses and source files that exist.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

/** Model ids exported by src/lib/gemini-models.ts (the file also exports thinking levels, which are skipped). */
const knownModels = new Set(
  (Object.values(geminiModels) as unknown[]).filter(
    (value): value is string => typeof value === "string" && value.startsWith("gemini-"),
  ),
);

function defaultValues(item: TemplateItem): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item.module.metadata.slots).map(([name, slot]) => [
      name,
      slot.type === "number" ? 0 : slot.type === "boolean" ? false : slot.multiple ? [] : "",
    ]),
  );
}

function render(item: TemplateItem, values: Record<string, unknown>): RenderedPrompt {
  return item.module.template(values as never);
}

describe("prompt library", () => {
  it("has unique ids that match their module files", () => {
    const ids = promptTemplates.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(existsSync(resolve(here, `${id}.ts`)), `${id}.ts`).toBe(true);
  });

  it("registers every template module in the folder", () => {
    const files = readdirSync(here)
      .filter((file) => /^(canvas|studio)-.*\.ts$/.test(file) && !file.endsWith(".test.ts"))
      .map((file) => file.replace(/\.ts$/, ""));
    expect(promptTemplates.map((item) => item.id).sort()).toEqual(files.sort());
  });

  describe.each(promptTemplates.map((item) => [item.id, item] as const))("%s", (_id, item) => {
    it("uses a model the app uses", () => {
      expect(knownModels, `unknown model ${item.module.metadata.model}`).toContain(item.module.metadata.model);
    });

    it("points at existing source files", () => {
      expect(item.module.metadata.sourceFiles.length).toBeGreaterThan(0);
      for (const file of item.module.metadata.sourceFiles) expect(existsSync(resolve(repoRoot, file)), file).toBe(true);
    });

    it("renders with defaults and every preset", () => {
      expect(() => render(item, defaultValues(item))).not.toThrow();
      expect(item.module.presets.length).toBeGreaterThan(0);
      for (const preset of item.module.presets) {
        const rendered = render(item, { ...defaultValues(item), ...preset.values });
        // Some prompts are system-instruction only in some cases (e.g. a live interview with no cards selected).
        expect(`${rendered.developer ?? ""}${rendered.system ?? ""}${rendered.user}`.trim(), preset.title).not.toBe("");
        for (const key of Object.keys(preset.values))
          expect(item.module.metadata.slots, `${preset.title}: ${key}`).toHaveProperty(key);
      }
    });
  });
});
