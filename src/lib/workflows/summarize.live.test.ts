/**
 * Live spot test for the AGENTS.md summarizer. Run: npm run test:live
 */
import { lastValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { createAppRegistry } from "../actions/app-registry";
import { summarizeTraceToAgentsMd$, type CatalogEntry } from "./summarize-agents-md";
import { validateAgentsMd, type TraceStep } from "./workflow-storage";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const live = apiKey ? describe : describe.skip;

const step = (action: string, args: Record<string, unknown>, note = "", actor: "user" | "ai" = "user"): TraceStep => ({
  id: `${action}-${Math.random()}`,
  action,
  actor,
  args,
  note,
  included: true,
  humanOnly: action === "add_media" || action === "export_cards",
  thumbs: [],
});

live("AGENTS.md summarizer (live)", () => {
  it("produces the standard sections using only registry tool names", async () => {
    const registry = createAppRegistry({ image: async () => undefined, videoFrames: async () => undefined });
    const catalog: CatalogEntry[] = [...registry.values()].map((def) => ({
      name: def.name,
      description: def.description,
      humanOnly: typeof def.agent === "object",
    }));
    const steps = [
      step("add_media", {}, "Photo of the client's living room"),
      step("search_references", { prompt: "japandi lounge chair", cardIds: ["image-1"], maxResults: 6 }, "Warm wood, low profile"),
      step("select_cards", { cardIds: ["search-2", "search-4", "search-5"], mode: "replace" }),
      step("scan_concept", { lens: "material", cardIds: ["search-2", "search-4", "search-5"] }, "Focus on tactile matte materials"),
      step("design_concepts", { requirements: "Lounge chair for a small flat", count: 3, cardIds: ["scan-7", "scan-8"] }),
      step("run_user_testing", { trait: "comfort", numUsers: 3, cardIds: ["design-9", "design-10", "design-11"] }),
      step("iterate_designs", { direction: "Address persona feedback about seat depth", count: 2, cardIds: ["design-10"] }, "Iterate on the top-ranked one"),
    ];

    const md = await lastValueFrom(
      summarizeTraceToAgentsMd$({ name: "Japandi Lounge Chair", goal: "Design a cozy small-space lounge chair", steps, catalog, apiKey }),
    );
    console.log(md);
    const validation = validateAgentsMd(md, registry.keys());
    expect(md).toMatch(/^# /m);
    expect(validation.missingSections).toEqual([]);
    expect(validation.unknownActions).toEqual([]);
    expect(md).toMatch(/Human step/i);
    expect(md).not.toMatch(/search-2|design-10/); // ids generalized away
  });
});
