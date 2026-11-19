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
 * - every template names a model the app actually uses and source files that exist,
 * - docs/prompts is generated from the templates (`npx vitest run -u` regenerates; a plain run fails if stale).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const docsDir = resolve(repoRoot, "docs/prompts");

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

const fence = (body: string, lang = "text") => {
  const ticks = body.includes("```") ? "~~~~" : "```";
  return `${ticks}${lang}\n${body.trimEnd()}\n${ticks}`;
};

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

function templateDoc(item: TemplateItem): string {
  const { metadata, presets } = item.module;
  const example = presets[0];
  const rendered = render(item, { ...defaultValues(item), ...(example?.values ?? {}) });
  const slots = Object.entries(metadata.slots);

  return [
    "<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->",
    "",
    `# ${metadata.title}`,
    "",
    metadata.purpose,
    "",
    `- **Template:** \`src/prompt-templates/${item.id}.ts\``,
    `- **Model:** \`${metadata.model}\``,
    `- **Input → output:** ${metadata.inputType} → ${metadata.outputType}`,
    `- **Sources:** ${metadata.sourceFiles.map((file) => `\`${file}\``).join(", ")}`,
    `- **Categories:** ${metadata.categories.join(", ")}`,
    "",
    "## Slots",
    "",
    slots.length
      ? [
          "| Slot | Type | Required | Multiple | Description |",
          "| --- | --- | --- | --- | --- |",
          ...slots.map(
            ([name, slot]) =>
              `| \`${name}\` | ${slot.type} | ${slot.required ? "yes" : "no"} | ${slot.multiple ? "yes" : "no"} | ${cell(slot.description)} |`,
          ),
        ].join("\n")
      : "_None._",
    "",
    example ? `## Example: ${example.title}` : "## Example",
    "",
    ...(example?.description ? [example.description, ""] : []),
    ...(rendered.system ? ["### System", "", fence(rendered.system), ""] : []),
    ...(rendered.developer ? ["### System instruction", "", fence(rendered.developer), ""] : []),
    "### User",
    "",
    fence(rendered.user),
    "",
    ...(metadata.outputSchema
      ? ["## Output schema", "", fence(JSON.stringify(metadata.outputSchema, null, 2), "json"), ""]
      : []),
    "## Presets",
    "",
    ...(presets.length
      ? presets.map((preset) => `- **${preset.title}**${preset.description ? ` — ${preset.description}` : ""}`)
      : ["_None._"]),
    "",
  ].join("\n");
}

function readmeDoc(): string {
  const section = (title: string, prefix: string) => {
    const items = promptTemplates.filter((item) => item.id.startsWith(prefix));
    return [
      `## ${title}`,
      "",
      "| Template | Model | Input → Output | Purpose |",
      "| --- | --- | --- | --- |",
      ...items.map(
        ({ id, module: { metadata } }) =>
          `| [\`${id}\`](templates/${id}.md) | \`${metadata.model}\` | ${metadata.inputType} → ${metadata.outputType} | ${cell(metadata.purpose)} |`,
      ),
      "",
    ].join("\n");
  };
  return [
    "<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->",
    "",
    "# Prompt Inventory",
    "",
    "Every LLM prompt sent by the canvas app and the photo/video studio app. The template modules in",
    "`src/prompt-templates` are the source of truth (also browsable in `prompt-library.html`); these docs are",
    "generated from them, and the test fails when a template, its model, or its docs drift.",
    "",
    section("Canvas", "canvas-"),
    section("Studio", "studio-"),
  ].join("\n");
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

    it("has up-to-date docs", async () => {
      await expect(templateDoc(item)).toMatchFileSnapshot(resolve(docsDir, "templates", `${item.id}.md`));
    });
  });

  it("has an up-to-date README and no orphaned docs", async () => {
    await expect(readmeDoc()).toMatchFileSnapshot(resolve(docsDir, "README.md"));
    const docs = readdirSync(resolve(docsDir, "templates")).map((file) => file.replace(/\.md$/, ""));
    expect(docs.sort()).toEqual(promptTemplates.map((item) => item.id).sort());
  });
});
