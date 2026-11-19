/**
 * Live spot tests against the Gemini API (prompt engineering aids, not CI).
 * Run: npm run test:live   (reads GEMINI_API_KEY from .env; skipped when unset)
 */
import { GoogleGenAI, type Interactions } from "@google/genai";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BehaviorSubject, lastValueFrom, of, toArray } from "rxjs";
import { describe, expect, it } from "vitest";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { boardActions } from "../actions/defs/board";
import { createPerceptionActions } from "../actions/defs/perception";
import { createRegistry } from "../actions/registry";
import { createActionRuntime } from "../actions/runtime";
import { GEMINI_AGENT_MODEL, GEMINI_AGENT_THINKING } from "../gemini-models";
import { runAgent$, type AgentEvent } from "./auto-iterate";
import type { MediaEncoders } from "./observe";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const live = apiKey ? describe : describe.skip;
const dir = mkdtempSync(join(tmpdir(), "agent-live-"));

function ffmpeg(args: string[], out: string): string {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, join(dir, out)]);
  return readFileSync(join(dir, out)).toString("base64");
}

const solidPng = (color: string) => ffmpeg(["-f", "lavfi", "-i", `color=${color}:s=96x96`, "-frames:v", "1"], `${color}.png`);

const textOut = (steps: Interactions.Step[] | undefined) =>
  (steps ?? [])
    .filter((s): s is Interactions.ModelOutputStep => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c): c is Interactions.TextContent => c.type === "text")
    .map((c) => c.text)
    .join("");

const calls = (steps: Interactions.Step[] | undefined) =>
  (steps ?? []).filter((s): s is Interactions.FunctionCallStep => s.type === "function_call");

const viewTool: Interactions.Function = {
  type: "function",
  name: "view_cards",
  description: "See the images of cards.",
  parameters: { type: "object", properties: { cardIds: { type: "array", items: { type: "string" } } }, required: ["cardIds"] },
};

live("Gemini agent live spot tests", () => {
  const ai = new GoogleGenAI({ apiKey });

  it("understands image parts inside a function_result", async () => {
    const first = await ai.interactions.create({
      model: GEMINI_AGENT_MODEL,
      input: "Cards a, b and c are on the board. Look at them with view_cards, then tell me which card is red. Answer with just the id.",
      tools: [viewTool],
      generation_config: { thinking_level: GEMINI_AGENT_THINKING },
      store: true,
    });
    const [call] = calls(first.steps);
    expect(call?.name).toBe("view_cards");
    const second = await ai.interactions.create({
      model: GEMINI_AGENT_MODEL,
      previous_interaction_id: first.id,
      tools: [viewTool],
      input: [
        {
          type: "function_result",
          name: "view_cards",
          call_id: call.id,
          result: [
            { type: "text", text: "Image of card a:" },
            { type: "image", mime_type: "image/png", data: solidPng("blue") },
            { type: "text", text: "Image of card b:" },
            { type: "image", mime_type: "image/png", data: solidPng("red") },
            { type: "text", text: "Image of card c:" },
            { type: "image", mime_type: "image/png", data: solidPng("green") },
          ],
        },
      ],
      generation_config: { thinking_level: GEMINI_AGENT_THINKING },
      store: true,
    });
    const answer = textOut(second.steps);
    console.log("[image answer]", answer);
    expect(answer.toLowerCase()).toMatch(/\bb\b/);
  });

  it("understands a video part inside a function_result", async () => {
    const video = ffmpeg(
      ["-f", "lavfi", "-i", "color=red:s=128x128:d=1", "-f", "lavfi", "-i", "color=blue:s=128x128:d=1", "-filter_complex", "[0][1]concat=n=2:v=1", "-pix_fmt", "yuv420p"],
      "clip.mp4",
    );
    const first = await ai.interactions.create({
      model: GEMINI_AGENT_MODEL,
      input: "Card v has a video. Look at it with view_cards, then tell me the colour it starts with and the colour it ends with.",
      tools: [viewTool],
      generation_config: { thinking_level: GEMINI_AGENT_THINKING },
      store: true,
    });
    const [call] = calls(first.steps);
    expect(call?.name).toBe("view_cards");
    const second = await ai.interactions.create({
      model: GEMINI_AGENT_MODEL,
      previous_interaction_id: first.id,
      tools: [viewTool],
      input: [
        {
          type: "function_result",
          name: "view_cards",
          call_id: call.id,
          result: [
            { type: "text", text: "Video of card v:" },
            { type: "video", mime_type: "video/mp4", data: video },
          ],
        },
      ],
      generation_config: { thinking_level: GEMINI_AGENT_THINKING },
      store: true,
    });
    const answer = textOut(second.steps).toLowerCase();
    console.log("[video answer]", answer);
    expect(answer).toContain("red");
    expect(answer).toContain("blue");
  });

  it("respects tool_choice.allowed_tools", async () => {
    const tools: Interactions.Function[] = [
      { type: "function", name: "blend_images", description: "Blend images.", parameters: { type: "object", properties: {} } },
      { type: "function", name: "observe", description: "Look at the board.", parameters: { type: "object", properties: {} } },
    ];
    const interaction = await ai.interactions.create({
      model: GEMINI_AGENT_MODEL,
      input: "Blend the images now. Use whichever tool you can.",
      tools,
      generation_config: {
        thinking_level: GEMINI_AGENT_THINKING,
        tool_choice: { allowed_tools: { mode: "validated", tools: ["observe"] } },
      },
      store: false,
    });
    const names = calls(interaction.steps).map((c) => c.name);
    console.log("[allowed_tools calls]", names, textOut(interaction.steps));
    expect(names).not.toContain("blend_images");
  });

  it("follows a sample AGENTS.md on a seeded board through the real action layer", async () => {
    const encoders: MediaEncoders = { image: async () => undefined, videoFrames: async () => undefined };
    const items$ = new BehaviorSubject<CanvasItem[]>([
      { id: "c1", x: 0, y: 0, width: 200, height: 300, title: "Oak stool", body: "Low stool, matte oak, rounded legs" },
      { id: "c2", x: 240, y: 0, width: 200, height: 300, title: "Steel chair", body: "Glossy chrome tube chair" },
      { id: "c3", x: 480, y: 0, width: 200, height: 300, title: "Felt pouf", body: "Soft grey wool felt pouf" },
    ]);
    const runtime = createActionRuntime({
      items$,
      apiKeys$: { value: { gemini: apiKey } },
      registry: createRegistry([...createPerceptionActions(encoders), ...boardActions]),
      settle: () => of(undefined),
    });
    const agentsMd = `# Tactile Curation
Curate the board toward warm, tactile, matte materials.
## Tools
- \`select_cards\`, \`add_card\`, \`move_cards\` (arrange: "rows"), \`delete_cards\`
## Workflow
1. Read the board. Identify cards that are NOT warm/tactile/matte.
2. Delete those cards with \`delete_cards\`.
3. Add one text card with \`add_card\` summarizing the material direction in one sentence.
4. Tidy the remaining cards with \`move_cards\` arrange "rows".
## Aesthetic & Quality Criteria
Warm, matte, natural, soft-touch. Avoid gloss and chrome.
## Guardrails & Stop Conditions
At most 6 actions. Never use \`clear_canvas\`. Stop after tidying.`;
    const events = (await lastValueFrom(runAgent$({ agentsMd, runtime, encoders, apiKey }).pipe(toArray()))) as AgentEvent[];
    const actions = events.filter((e): e is Extract<AgentEvent, { type: "action-end" }> => e.type === "action-end");
    console.log(
      "[agent run]",
      actions.map((a) => `${a.name}${a.result.error ? `!${a.result.error}` : ""}`),
      events.at(-1),
    );
    expect(events.at(-1)).toMatchObject({ type: "stopped", reason: "done" });
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeLessThanOrEqual(8);
    expect(items$.value.some((i) => i.id === "c2")).toBe(false);
    expect(items$.value.some((i) => i.id === "c1")).toBe(true);
    expect(runtime.log.records.every((r) => r.actor === "ai")).toBe(true);
  });
});
