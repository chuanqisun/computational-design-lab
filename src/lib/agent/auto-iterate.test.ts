import type { Interactions } from "@google/genai";
import { BehaviorSubject, Subject, lastValueFrom, of, toArray } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { boardActions } from "../actions/defs/board";
import { createPerceptionActions } from "../actions/defs/perception";
import { createRegistry } from "../actions/registry";
import { createActionRuntime } from "../actions/runtime";
import { GEMINI_AGENT_MODEL, GEMINI_AGENT_THINKING } from "../gemini-models";
import { runAgent$, type AgentEvent } from "./auto-iterate";
import type { MediaEncoders } from "./observe";

const encoders: MediaEncoders = {
  image: async (src) => ({ type: "image", mime_type: "image/jpeg", data: `thumb-${src}` }),
  videoFrames: async () => undefined,
};

const card = (id: string, extra: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  x: 0,
  y: 0,
  width: 200,
  height: 300,
  title: id,
  body: `${id} body`,
  ...extra,
});

type Call = { name: string; args?: Record<string, unknown>; id?: string };
const turn = (id: string, calls: Call[], text?: string) =>
  ({
    id,
    steps: [
      ...(text ? [{ type: "model_output", content: [{ type: "text", text }] }] : []),
      ...calls.map((call, index) => ({
        type: "function_call",
        id: call.id ?? `${id}-call-${index}`,
        name: call.name,
        arguments: call.args ?? {},
      })),
    ],
  }) as unknown as Interactions.Interaction;

function setup(items: CanvasItem[], script: Interactions.Interaction[], agentsMd = "# Test workflow\n## Workflow\n1. Do it.") {
  const items$ = new BehaviorSubject<CanvasItem[]>(items);
  const stop$ = new Subject<void>();
  let n = 0;
  const runtime = createActionRuntime({
    items$,
    apiKeys$: { value: { gemini: "k" } },
    registry: createRegistry([...createPerceptionActions(encoders), ...boardActions]),
    stop$,
    settle: () => of(undefined),
    newId: (prefix) => `${prefix}-${++n}`,
  });
  const requests: Record<string, any>[] = [];
  const signals: AbortSignal[] = [];
  const createInteraction = vi.fn(async (params: Record<string, any>, options: { signal: AbortSignal }) => {
    requests.push(structuredClone(params));
    signals.push(options.signal);
    const next = script[requests.length - 1];
    if (!next) throw new Error("script exhausted");
    return next;
  });
  const run = (overrides: Partial<Parameters<typeof runAgent$>[0]> = {}) =>
    lastValueFrom(
      runAgent$({ agentsMd, runtime, encoders, createInteraction, stop$, ...overrides }).pipe(toArray()),
    );
  return { items$, runtime, stop$, requests, signals, run, createInteraction };
}

const resultsOf = (request: Record<string, any>) => request.input as Interactions.FunctionResultStep[];
const textOf = (result: Interactions.FunctionResultStep) =>
  (result.result as { type: string; text?: string }[]).filter((p) => p.type === "text").map((p) => p.text).join("\n");

describe("runAgent$", () => {
  it("calls the agent model with AGENTS.md, declarations, thinking level and allowed tools", async () => {
    const { run, requests } = setup([card("a")], [turn("i1", [], "Nothing to do.")], "# Moody\nUse `add_card`.");
    const events = await run();
    const [request] = requests;
    expect(request.model).toBe(GEMINI_AGENT_MODEL);
    expect(request.system_instruction).toContain("# Moody");
    expect(request.generation_config.thinking_level).toBe(GEMINI_AGENT_THINKING);
    expect(request.store).toBe(true);
    const declared = request.tools.map((t: { name: string }) => t.name);
    expect(declared).toContain("add_card");
    expect(declared).not.toContain("add_media");
    expect(declared).not.toContain("export_cards");
    const allowed: string[] = request.generation_config.tool_choice.allowed_tools.tools;
    expect(allowed).toContain("observe");
    expect(allowed).not.toContain("clear_canvas"); // not allowed by this AGENTS.md
    // initial input carries the board observation
    expect(JSON.stringify(request.input)).toContain("a | text | a | a body");
    expect(events.at(-1)).toEqual({ type: "stopped", reason: "done", message: "Nothing to do." });
  });

  it("dispatches calls as the ai actor and threads call_id, name and previous_interaction_id", async () => {
    const { run, requests, items$, runtime } = setup(
      [card("a"), card("b")],
      [turn("i1", [{ name: "select_cards", args: { cardIds: ["b"] }, id: "c1" }]), turn("i2", [], "Done.")],
    );
    await run();
    expect(items$.value.find((i) => i.id === "b")?.isSelected).toBe(true);
    const second = requests[1];
    expect(second.previous_interaction_id).toBe("i1");
    const [result] = resultsOf(second);
    expect(result).toMatchObject({ type: "function_result", call_id: "c1", name: "select_cards" });
    expect(result.is_error).toBeFalsy();
    expect(textOf(result)).toContain("Selected 1 card(s)");
    expect(textOf(result)).toContain("Selected: b");
    expect(runtime.log.records[0]).toMatchObject({ actor: "ai", action: "select_cards" });
  });

  it("returns errors as is_error results instead of throwing", async () => {
    const { run, requests } = setup(
      [card("a")],
      [turn("i1", [{ name: "delete_cards", args: { cardIds: ["nope"] } }]), turn("i2", [], "ok")],
    );
    await run();
    const [result] = resultsOf(requests[1]);
    expect(result.is_error).toBe(true);
    expect(textOf(result)).toContain("card_not_found");
  });

  it("runs several calls of one turn sequentially, in order, observing once at the end", async () => {
    const { run, requests, items$ } = setup(
      [card("a")],
      [
        turn("i1", [
          { name: "add_card", args: { text: "first" } },
          { name: "add_card", args: { text: "second" } },
        ]),
        turn("i2", [], "done"),
      ],
    );
    await run();
    expect(items$.value.map((i) => i.title)).toEqual(["a", "first", "second"]);
    const results = resultsOf(requests[1]);
    expect(results).toHaveLength(2);
    expect(textOf(results[0])).not.toContain("## Board");
    expect(textOf(results[1])).toContain("## Board");
  });

  it("refuses clear_canvas unless AGENTS.md allows it", async () => {
    const { run, requests, items$ } = setup(
      [card("a")],
      [turn("i1", [{ name: "clear_canvas", args: { confirm: true } }]), turn("i2", [], "ok")],
    );
    await run();
    expect(items$.value).toHaveLength(1);
    const [result] = resultsOf(requests[1]);
    expect(result.is_error).toBe(true);
    expect(textOf(result)).toContain("not allowed");
  });

  it("stops at the turn cap", async () => {
    const loop = Array.from({ length: 5 }, (_, i) => turn(`i${i}`, [{ name: "observe" }]));
    const { run, createInteraction } = setup([card("a")], loop);
    const events = await run({ maxTurns: 3 });
    expect(createInteraction).toHaveBeenCalledTimes(3);
    expect(events.at(-1)).toMatchObject({ type: "stopped", reason: "max_turns" });
  });

  it("stops when the new-card cap is reached", async () => {
    const { run, items$ } = setup(
      [card("a")],
      [
        turn("i1", [
          { name: "add_card", args: { text: "one" } },
          { name: "add_card", args: { text: "two" } },
          { name: "add_card", args: { text: "three" } },
        ]),
        turn("i2", [], "never"),
      ],
    );
    const events = await run({ maxNewCards: 2 });
    expect(items$.value).toHaveLength(3);
    expect(events.at(-1)).toMatchObject({ type: "stopped", reason: "card_limit" });
  });

  it("reports user changes made between turns", async () => {
    const harness = setup([card("a"), card("b")], [turn("i1", [{ name: "observe" }]), turn("i2", [], "ok")]);
    harness.createInteraction.mockImplementationOnce(async (params: Record<string, any>) => {
      harness.requests.push(structuredClone(params));
      // the human deletes a card while the model is thinking
      await lastValueFrom(harness.runtime.dispatch$("delete_cards", { cardIds: ["b"] }, "user"));
      return turn("i1", [{ name: "observe" }]);
    });
    await harness.run();
    const text = textOf(resultsOf(harness.requests[1])[0]);
    expect(text).toContain("-deleted: b");
    expect(text).toContain("[user] delete_cards");
  });

  it("emits progress events for each action", async () => {
    const { run } = setup([card("a")], [turn("i1", [{ name: "observe" }]), turn("i2", [], "fin")]);
    const events = (await run()) as AgentEvent[];
    expect(events.map((e) => e.type)).toEqual(["turn", "action-start", "action-end", "turn", "stopped"]);
  });

  it("aborts the in-flight request and stops on stop$", async () => {
    const harness = setup([card("a")], []);
    harness.createInteraction.mockImplementationOnce(
      (_params: Record<string, any>, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          harness.signals.push(options.signal);
          options.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const pending = harness.run();
    await vi.waitFor(() => expect(harness.createInteraction).toHaveBeenCalled());
    harness.stop$.next();
    const events = await pending;
    expect(harness.signals[0].aborted).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "stopped", reason: "stopped" });
  });

  it("surfaces API errors as a stopped event with the message", async () => {
    const { run, createInteraction } = setup([card("a")], []);
    createInteraction.mockRejectedValueOnce(new Error("quota exceeded"));
    const events = await run();
    expect(events.at(-1)).toEqual({ type: "stopped", reason: "error", message: "quota exceeded" });
  });
});
