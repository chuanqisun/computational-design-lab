# Spec: Dual-Driver Canvas, Workflows, and the Run Agent

**Date:** 2026-11-18
**Scope:** Computational Mood Board (`canvas.html` / `src/canvas-page.ts`)

## Goal

1. Either a human or a Gemini agent can drive the board through **one shared action layer**.
2. The agent can **perceive** the UI state: text, images, video, pending work, and which actions are available right now.
3. Human and AI actions are recorded into an **editable trace**, which is distilled into an [`AGENTS.md`](https://agents.md/) workflow.
4. **Run** starts a Gemini agent loop steered by the selected workflow (`AGENTS.md`).
5. Workflow controls are in a **Workflow section of the context tray**. The trace and the workflow editor are **declarative `<dialog>`s**.

---

## 1. Requirements and Principles

1. **One action layer, two drivers.** Every board state change goes through `dispatch$(name, args, actor)`.
   - The UI adapter maps clicks, forms and gestures to args.
   - The AI adapter maps `function_call` to args.
   - The core transform is identical for both.
2. **Parity.** Every step a human can take, the agent can take with the same input→output transform. Where the agent can't operate the human's input device (pen, mic, clipboard), it gets an **equivalent transform**: a different input, the same kind of output, the same effect on the board. If no realistic equivalent exists, the action is **unsupported for the agent** and marked as such with a reason. The agent is never given a fake substitute.
3. **Perceivable state.** `UiState` is derived from `items$` plus task state. Humans perceive it through the rendered UI. The agent perceives it through `buildObservation()`, which sends text, image and video parts within a size budget.
4. **One availability predicate.** Each action's `isAvailable(state)` drives both tray visibility and the agent's `allowed_tools`.
5. **Settle-then-return.** An action resolves only after its effects settle, including card auto-fill. Explicitly async actions are the exception.
6. **Single cancellation.** One `stop$` cancels UI tasks, in-flight LLM requests and the agent loop.
7. **TDD only at seams that regress silently:** registry/parity, dispatcher, observation, agent loop and placement. Prompt quality is checked with live spot tests that use `GEMINI_API_KEY` from `.env`.

---

## 2. Action Layer

### 2.1 Types (`src/lib/actions/types.ts`)

```ts
export type Actor = "user" | "ai";

export interface CardView {
  id: string;
  kind: "text" | "image" | "video" | "mixed";
  title?: string;
  body?: string;
  isSelected: boolean;
  pending?: "fill" | "image" | "video" | "search";
  x: number; y: number; width: number; height: number;
}

export interface UiState {
  cards: CardView[];
  selectedIds: string[];
  pending: { cardId: string; what: "fill" | "image" | "video" | "search" }[];
  running: { actionId: string; name: string; actor: Actor }[];
  viewport: { x: number; y: number; width: number; height: number };
}

export interface ActionResult {
  summary: string;                     // one line; shown in timeline and returned to the agent
  created?: string[];
  updated?: string[];
  deleted?: string[];
  pending?: string[];                  // async actions: cards still settling
  data?: unknown;                      // e.g. personas, rankings
  media?: MediaPart[];                 // image/video parts returned to the agent
  error?: string;
  reason?: string;                     // unavailable/precondition explanation
}

export type AgentSupport = "native" | "equivalent" | "perception" | { unsupported: string };

export interface ActionDef<A = Record<string, unknown>> {
  name: string;                        // snake_case; used as the Gemini function name
  description: string;                 // written for the model; also used as UI tooltip
  parameters: JSONSchemaObject;        // used as the Gemini function declaration
  isAvailable(state: UiState): true | { reason: string };
  run(args: A, ctx: ActionContext): Observable<ActionResult>;  // completes after settle
  async?: boolean;                     // returns immediately with `pending`
  log: "record" | "coalesce" | "skip";
  humanEntry: string;                  // key of HUMAN_ENTRIES, e.g. "tray:Blend", "canvas:drag", "dialog:open"
  agent: AgentSupport;
  humanArgs?: string[];                // "_"-prefixed device inputs only the UI may pass (drawings, transcripts, files)
  needsApiKey?: boolean;
}

export interface ActionContext {
  items$: BehaviorSubject<CanvasItem[]>;
  apiKey: string;
  actor: Actor;
  signal: AbortSignal;
  place(count: number, near?: string[]): Position[];
}
```

Add `pending?: CardView["pending"]` to `CanvasItem.metadata` (replacing the ad-hoc `metadata.pendingImage`).

### 2.2 Registry (`src/lib/actions/registry.ts`)

- `registry: Map<string, ActionDef>` collects all actions from `src/lib/actions/defs/*.ts`.
- `getAgentDeclarations()` returns function declarations for every action whose `agent` is `native`, `equivalent` or `perception`.
- `availableActionNames(state)` and `unavailableReasons(state)` both come from `isAvailable`.

### 2.3 Dispatcher (`src/lib/actions/dispatch.ts`)

`dispatch$(name, args, actor): Observable<ActionResult>` runs these steps in order:

1. Look up the action. Unknown names return `{ error: "unknown_action" }`.
2. Validate `args` against `parameters`. Invalid args return `{ error: "invalid_args", reason }`.
3. If `actor === "ai"` and `agent` is `unsupported`, return `{ error: "unsupported_for_agent", reason }`.
4. Check `isAvailable(getUiState())`. If unavailable, return `{ error: "unavailable", reason }`.
5. Append an `ActionRecord` with status `running` to `actionLog$`, honoring the action's `log` mode.
6. Run `def.run(args, ctx)` with `takeUntil(stop$)` and an `AbortSignal` that aborts on `stop$`.
7. Update the record to `done` or `error` with `durationMs`, `outputIds` and `outputThumbs`.

Errors are returned as data and never thrown into `alert()`.

**Adapters:**
- UI: `submitTask(dispatch$(name, args, "user"))`. The UI adapter alone shows the alert when `result.error` is set.
- AI: `await lastValueFrom(dispatch$(name, args, "ai"))`.

**`src/components/context-tray/tasks.ts` changes:**
- Export `stop$`, which replaces the private `stopTasks$`, and `createAbortSignal()`, which is aborted on `stop$`.
- `stopAllTasks()` emits `stop$`. The existing top-bar **Stop** button keeps calling it.
- Pass the signal through to the LLM helpers in `components/context-tray/llm/*` that accept one.

### 2.4 Action Inventory (`src/lib/actions/defs/`)

| Action | Human entry | Agent | Args → output | Notes |
| :-- | :-- | :-- | :-- | :-- |
| `observe` | the rendered UI | perception | `{}` → observation (§3.1) | `log: skip` |
| `view_cards` | open card dialog / zoom | perception | `{cardIds, maxPx?}` → full text + image parts + video part or keyframes | ≤6 media parts, default 512px. `log: skip` |
| `wait_for_idle` | watching progress | perception | `{timeoutS?}` → observation once nothing is pending | `log: skip` |
| `select_cards` | click, shift-click, marquee, Ctrl+A, background click | native | `{cardIds?, mode: "replace"\|"add"\|"remove"\|"all"\|"none"}` | `log: coalesce` |
| `move_cards` | drag; Canvas → Gather / Focus | native | `{moves?: [{id,x,y}], arrange?: "gather"\|"focus"\|"rows"}` | `log: coalesce` |
| `delete_cards` | Delete/Backspace, Cut | native | `{cardIds}` | |
| `clear_canvas` | Canvas → Destroy | native | `{confirm: true}` | The agent may call it only if `AGENTS.md` explicitly allows it |
| `duplicate_cards` | copy + paste of cards | equivalent | `{cardIds}` → new card ids | Clipboard replaced by direct duplication |
| `edit_card` | card dialog field edit | native | `{cardId, title?, body?, imagePrompt?}` | Triggers the same fill/regenerate rules |
| `regenerate_image` | card dialog → Regenerate | native | `{cardId, prompt?}` | |
| `add_card` | New → note; paste plain text | native | `{text}` → text card (auto-filled) | |
| `add_media` | Capture (webcam/file); paste image | **unsupported** | — | Reason: input is the user's physical world or local files; `search_references` covers web imagery |
| `render_image` | New → render | native | `{prompt, cardIds?}` | |
| `search_references` | New → search | native | `{prompt, cardIds?, maxResults?}` | Resolves after the stream completes |
| `visualize_concept` | Visualize | native | `{style: "abstract"\|"concrete", cardIds}` | |
| `scan_concept` | Scan | native | `{lens, cardIds}` | |
| `blend_images` | Blend | native | `{instruction, cardIds}` | Available when ≥2 selected cards have images |
| `design_concepts` | Design | native | `{requirements, brandGuide?, count?, cardIds}` | |
| `iterate_designs` | Iterate | native | `{direction?, brandGuide?, count?, cardIds}` | |
| `run_user_testing` | User testing → Run | native | `{trait, segment?, numUsers?, cardIds}` → persona + ranking cards | Rankings in `data`. Keeps `user-testing-layout.ts` |
| `interview_persona` | User testing → Interview (live voice) | equivalent | `{cardIds (exactly one persona + context), questions: string[]}` → interview summary card | Text Q&A with the persona instead of live audio; same summary-card output |
| `edit_image` | Sketch (freehand overlay + instruction) | equivalent | `{cardIds, instruction, regions?: [{x,y,w,h,label}]}` → new image card | Regions are rasterized into the same overlay format as freehand strokes, then go through the same `imageToimage` call |
| `animate` | Animate | native | `{cardIds, instruction?, aspectRatio?, duration?, task?, roles?: [{imageId, role}]}` → video card | `async: true`; the human dialog also passes its drawn annotations as `humanArgs` |
| `export_cards` | Export (Open in Studio) | **unsupported** | — | Reason: output opens a new Studio browser tab for the user; the agent reads cards via `observe`/`view_cards` |

**Human-only actions** (`add_media`, `export_cards`) still go through `dispatch$` with `actor: "user"`, so they're logged and can appear in traces. In `AGENTS.md` they're written as *"Human step: …"*. When the agent reaches one, it stops its turn and asks the user to do it.

Card ids are short (`prefix-xxxxxxxx`) so the agent can read and echo them reliably. After an action, created cards are revealed (scrolled into view); for the agent, changed cards are revealed too.

**Parity manifest** (`src/lib/actions/human-entries.ts`): `HUMAN_ENTRIES` lists every tray section, card-dialog button, canvas gesture and keyboard shortcut, plus `meta:*` entries for workflow controls (§5.4). Every non-meta entry maps to exactly one action, and every action's `humanEntry` (other than `perception`) is in the manifest.

### 2.5 Canvas Gestures

`CanvasComponent` keeps high-frequency local state (drag frames, marquee rectangle, pan) and dispatches only at gesture end:

- drag mouseup → `move_cards`
- click/marquee end → `select_cards`
- Ctrl+A → `select_cards {mode: "all"}`
- Delete/Backspace and Cut → `delete_cards`
- card dialog field blur → `edit_card`
- dialog Regenerate → `regenerate_image`
- paste → `add_card`, `add_media` or `duplicate_cards`, depending on the clipboard content

Viewport scroll and pan stay local and are mirrored into `UiState.viewport`.

`CanvasTool` (Gather/Focus/Destroy) and `ExportTool` call `dispatch$`.

### 2.6 Card Fill and Settle Semantics

- Move the auto-fill effect from `CardComponent` into `src/lib/actions/card-fill.ts` as `fillCard$(cardId, ctx)`. Actions that create or edit cards compose it, and `CardComponent` only renders `metadata.pending`.
- `run()` completes after created and updated cards have no `pending`.
- `async` actions complete immediately with `{created, pending}`, and their remaining work keeps running under `stop$`.

### 2.7 Placement (`src/components/canvas/layout.ts`)

`placeRows(items, count, { near?: string[], columns = 4, gap = 24 }): Position[]`:
- The first row starts at `max(y + height) + gap` over all cards, or at the viewport top-left if the board is empty.
- `x` starts at the leftmost `x` of the `near` cards, or of all cards. Cards fill left to right and wrap after `columns`.
- `ctx.place` uses it for every card-creating action except `run_user_testing`, which keeps `user-testing-layout.ts`.
- This replaces `getNextPositions` for generated cards.

---

## 3. Perception

### 3.1 Observation (`src/lib/agent/observe.ts`)

`getUiState(items$, tasks) → UiState` and `buildObservation(state, prev, lastResult, budget) → FunctionResultSubcontent[]`:

- **Text part (always):**
  - one line per card: `id | kind | title | body (≤120 chars) | selected | pending | x,y`
  - the `selectedIds`
  - the `running` actions, with their actor
  - `available_actions`, plus `unavailable` with a reason for each
  - a diff against `prev` (`+created`, `~updated`, `-deleted`), including changes made by the user
- **Media parts:** thumbnails (≤4, 384px JPEG) of cards created by the last action. Anything else is fetched with `view_cards`.
- **Video:** clips under the size cap are sent as a `VideoContent` part. Larger clips are sent as the poster frame plus first/middle/last keyframes as images, with the duration as text.
- **Budget:** a byte cap per observation. When over the cap, media is dropped before text, and a note is added: `"(N thumbnails omitted; call view_cards)"`.

Every AI `function_result.result` is `[{type: "text", text: JSON.stringify(result without media)}, ...result.media, ...buildObservation(...)]`.

### 3.2 Exposing Available Actions

- Send the full `getAgentDeclarations()` on every turn.
- Restrict each turn with `generation_config.tool_choice: { allowed_tools: { mode: "validated", tools: availableActionNames(state) } }`. The API accepts only `ANY` or `VALIDATED` for `allowed_tools`; `validated` still lets the model end a turn with text.
- The dispatcher re-checks availability, so if the model ignores `allowed_tools` it gets an `unavailable` result back.

### 3.3 Agent View (Human Counterpart)

The **Agent view** tab in the Workflow dialog (§5.2) renders the current `buildObservation()` output: the text table and the media parts exactly as the agent would receive them.

---

## 4. Action Log, Trace and `AGENTS.md`

### 4.1 Action Log (`src/lib/workflows/action-log.ts`)

```ts
export interface ActionRecord {
  id: string;
  timestamp: number;
  actor: Actor;
  action: string;
  args: Record<string, unknown>;
  inputIds: string[];
  outputIds: string[];
  outputThumbs: string[];              // small data URLs (≤96px)
  summary: string;
  status: "running" | "done" | "error";
  error?: string;
  durationMs?: number;
}
```

- `actionLog$: BehaviorSubject<ActionRecord[]>` is persisted with `persistSubject` (IndexedDB) and capped at 500 records.
- `coalesce` merges consecutive records of the same action and actor that are within 1.5s of each other.
- `skip` records nothing.

### 4.2 Trace Draft

```ts
export interface TraceStep {
  id: string;
  action: string;
  actor: Actor;
  args: Record<string, unknown>;
  note: string;
  included: boolean;
  humanOnly: boolean;
  thumbs: string[];
}
```

Selected records are copied into a draft `TraceStep[]`, and the log itself is never mutated. In the draft, users can edit args (key fields or raw JSON), write notes, reorder steps, and toggle or remove them.

### 4.3 Summarizer (`src/lib/workflows/summarize-agents-md.ts`)

`summarizeTraceToAgentsMd$(name, goal, steps, apiKey): Observable<string>`
- Model: `GEMINI_TEXT_MODEL`.
- Input: multimodal. The included steps plus their thumbnails.
- The output is plain Markdown with these sections:
  1. `# <Name>`: objective
  2. `## Tools`: the registry action names used and their parameter conventions
  3. `## Workflow`: ordered, generalized steps with no raw card ids, using intent-based selection such as "the top-ranked designs from the previous step". Human-only steps appear as `Human step: …`.
  4. `## Aesthetic & Quality Criteria`
  5. `## Guardrails & Stop Conditions`: turn and card limits, whether `clear_canvas` is allowed, and when to stop
- A post-check, `validateAgentsMd(md)`, warns on action names that aren't in the registry.

### 4.4 Storage (`src/lib/workflows/workflow-storage.ts`)

```ts
export interface SavedWorkflow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  agentsMd: string;
  sourceSteps?: TraceStep[];
}
```

- `localStorage` key `"moodboard-saved-workflows"`. The active workflow id is stored under `"moodboard-active-workflow"`.
- Functions: `loadWorkflows`, `saveWorkflow`, `deleteWorkflow`, `setActiveWorkflow`, `exportAgentsMd` (download `AGENTS.md`), `importAgentsMd` (file or pasted text).

---

## 5. Workflow UI

Terminology used everywhere in the UI:
- **Workflow:** one `AGENTS.md`, either built-in or saved by the user.
- **Run:** the AI following the selected workflow.
- **Trace:** the recorded actions of the user and the AI.

The top bar keeps only progress, Stop and Setup. Workflow controls live in a **Workflow** section at the top of the context tray. The detailed UI lives in two declarative dialogs, both following Chrome's [declarative dialog & popover control guide](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/declarative-dialog-popover-control.md.txt).

### 5.1 Workflow Section (`src/components/workflow/workflow-section.component.ts`)

- **Workflow list:** built-in workflows first (tagged *Built-in*), then saved ones. Each is a radio row with a name and a one-line summary. The selection is the workflow that Run uses (`workflowStore.select`).
- **Brief:** optional text passed to the run as its focus (persisted).
- **Actions:**
  - **Run/Stop:** primary. Disabled with a reason when there is no API key or no workflow selected.
  - **View/Edit:** opens `#workflow-editor` with `command="show-modal"`. Built-ins are read-only, so saving one creates a copy.
  - **New:** opens an empty editor.
- **Status:** `Idle`, `Running · <action> · step n/12`, `Finished`, etc., plus the AI's latest message (clamped).
- **Trace preview:** the last 4 trace rows and an **Open trace** button (`commandfor="trace-dialog"`).

### 5.2 Built-in Workflows (`src/lib/workflows/builtin-workflows.ts`)

| Workflow | Tools exercised |
| :-- | :-- |
| Brief to moodboard | `search_references`, `view_cards`, `scan_concept` (emotions), `visualize_concept` |
| Design sprint | `design_concepts`, `run_user_testing`, `view_cards`, `iterate_designs` |
| Material study | `scan_concept` (material, tactility), `blend_images`, `edit_image` (regions) |
| Persona interview | `run_user_testing` (1 user), `view_cards`, `interview_persona` |
| Motion teaser | `view_cards`, `render_image`, `animate`, `wait_for_idle` |

A test checks that every built-in uses only registered tool names, has all standard sections, and never allows `clear_canvas`.

### 5.3 Trace Dialog (`src/components/workflow/trace-dialog.component.ts`)

`<dialog id="trace-dialog">` merges the activity list and the AI status:
- **AI status bar:** the same status and latest AI message as the tray.
- **Timeline tab:** newest-first rows (actor badge *You*/*AI*, action, summary, time, output thumbnails) with checkboxes. Buttons: **New workflow from N selected** (opens `#workflow-editor` with the steps), Select all, Clear selection, Clear trace.
- **AI view tab:** the live `buildObservation()` output (§3.3).

### 5.4 Workflow Editor (`src/components/workflow/workflow-editor.component.ts`)

`<dialog id="workflow-editor">`, with the workflow name in the header:
- **Steps tab:** the recorded steps from the trace. Each has Include, reorder and remove controls, a "Why this step matters" note, and collapsible arguments (JSON). There's a goal field and **Generate instructions**, which runs the summarizer.
- **Instructions tab:** the `AGENTS.md` editor with validation warnings, **Import AGENTS.md…** and **Download AGENTS.md**.
- **Footer:** **Save** (save and select). **Delete** for saved workflows opens `#workflow-delete-confirm` with `command="show-modal"`; its Cancel and Delete buttons use `command="close"`.

### 5.5 Dialog and Popover Rules

- All open and close goes through `commandfor` + `command` (`show-modal`, `close`, `toggle-popover`, `show-popover`, `hide-popover`).
  - No `.showModal()`, `.close()` or `.showPopover()` calls.
  - No click listeners whose only job is to open or close.
- Don't put `popovertarget` and `commandfor` on the same button.
- To react to opening or closing, listen for `command`, `toggle` or `close` on the **target element**. The `command` event doesn't bubble.
- Set the `popover` attribute with `setAttribute`, never with the `.popover` property.
- Popover CSS selectors use `:popover-open`.
- When a popover is hidden from a button inside it, move focus back to the invoker.
- No polyfills: the app targets the latest Chromium, which supports invoker commands and popover natively.

### 5.6 Meta-Controls

The Workflow section and dialog controls (select a workflow, Run/Stop, edit the trace or `AGENTS.md`) drive the agent itself. They aren't board actions: they appear in `HUMAN_ENTRIES` as `meta:*` and aren't exposed to the agent.

---

## 6. Run Agent (`src/lib/agent/auto-iterate.ts`)

### 6.1 Model

Add to `src/lib/gemini-models.ts`:

```ts
export const GEMINI_AGENT_MODEL = "gemini-4-neon";
export const GEMINI_AGENT_THINKING = "medium" as const;
```

The agent loop uses `GEMINI_AGENT_MODEL`. The actions it calls keep their own models (`GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `GEMINI_VIDEO_MODEL`, etc.).

### 6.2 System Instruction (`src/lib/agent/agent-prompt.ts`)

`buildAgentSystemInstruction(agentsMd)` = `BASE_AGENT_PROMPT` + `\n\n---\n\n` + `agentsMd`.

`BASE_AGENT_PROMPT` covers:
- the role (a design assistant operating a mood board through tools)
- how to read observations
- calling `view_cards` before judging visuals
- acting only on ids that appear in the latest observation
- doing human-only steps by stopping and asking the user
- respecting the guardrails
- ending with a short text summary when the workflow's stop conditions are met

### 6.3 Loop

```ts
export interface AgentRunner {
  run(opts: { agentsMd: string; goal?: string; maxTurns: number; signal: AbortSignal }): Observable<AgentEvent>;
}
```

1. The first input is the goal (or "Follow the workflow") plus the initial observation.
2. Each turn calls `ai.interactions.create({ model: GEMINI_AGENT_MODEL, system_instruction, input, tools: getAgentDeclarations(), previous_interaction_id, generation_config: { thinking_level: GEMINI_AGENT_THINKING, tool_choice: { allowed_tools: { mode: "validated", tools } } }, store: true }, { signal })`.
3. Collect the `function_call` steps that have no matching `function_result`, and run them **sequentially** through `dispatch$(name, args, "ai")`.
4. Return one `function_result` per call, with `call_id` and `name` (content as in §3.1), and `is_error: true` when `result.error` is set.
5. Stop when a turn has no function calls, or on a guardrail, abort or `stop$`.

`AgentEvent` (turn started, action started/finished, message, stopped with reason) feeds the Workflow section status and the Trace dialog's AI status bar.

### 6.4 Guardrails

- `maxTurns = 12`.
- Pause after 25 new cards in a run.
- Separate budgets for image generations and video generations per run.
- `clear_canvas` is refused unless `AGENTS.md` contains an explicit allow rule.
- Toggle-off, Stop, or closing the page emits `stop$`, which aborts in-flight requests.
- Human edits during a run show up in the next observation diff. Calls that reference deleted cards return `card_not_found`.

---

## 7. Testing

### 7.1 Unit Tests (written before implementation)

| File | Covers |
| :-- | :-- |
| `src/lib/actions/registry.test.ts` | Valid JSON Schema, unique names, `humanEntry` and `agent` set on every action. `HUMAN_ENTRIES` ⇄ registry match both ways. Unsupported actions have reasons and are absent from `getAgentDeclarations()`. |
| `src/lib/actions/dispatch.test.ts` | Unknown action, invalid args, unsupported-for-agent, unavailable. Log lifecycle and coalescing. `stop$` cancels and aborts the signal. No `alert` on the AI path. **Parity:** same action and args with `actor: "user"` vs `"ai"` produce an identical `items$` diff (LLM helpers mocked). |
| `src/lib/agent/observe.test.ts` | Card table, diff (including user-made changes), available/unavailable lists, budget drops media before text, video keyframe fallback. |
| `src/lib/agent/auto-iterate.test.ts` | Uses `GEMINI_AGENT_MODEL`. `call_id` threading, `is_error` results, `allowed_tools` computed from state, sequential dispatch, turn/card caps, abort. Mocked `interactions.create`. |
| `src/components/canvas/layout.test.ts` | `placeRows`: below existing cards, wraps at `columns`, aligns to `near`, empty board. |

The existing tests (`animate`, `search-images`, `user-testing-layout`, `interview`, `gemini-voices`) must stay green.

### 7.2 Live Spot Tests (`npm run test:live`)

`vitest` with the `*.live.test.ts` pattern. Reads `GEMINI_API_KEY` from `.env` and is skipped when the key is unset. Not run by `npm test`.

- `GEMINI_AGENT_MODEL` correctly answers questions about image parts and a video part inside a `function_result`.
- `allowed_tools` restricts which functions are called.
- `BASE_AGENT_PROMPT` + a sample `AGENTS.md` on a seeded board yields a sensible 3–5 action sequence.
- The summarizer output contains the §4.3 sections and passes `validateAgentsMd`.

---

## 8. File Map

| Path | Purpose |
| :-- | :-- |
| `src/lib/actions/types.ts` | Types (§2.1) |
| `src/lib/actions/registry.ts` | Registry and declarations (§2.2) |
| `src/lib/actions/dispatch.ts` | Dispatcher (§2.3) |
| `src/lib/actions/human-entries.ts` | Parity manifest (§2.4) |
| `src/lib/actions/card-fill.ts` | `fillCard$` (§2.6) |
| `src/lib/actions/defs/*.ts` | One file per action group: `board`, `generate`, `analyze`, `media`, `perception` |
| `src/lib/agent/observe.ts` | `getUiState`, `buildObservation` (§3.1) |
| `src/lib/agent/agent-prompt.ts` | System instruction (§6.2) |
| `src/lib/agent/auto-iterate.ts` | Agent loop (§6.3) |
| `src/lib/workflows/action-log.ts` | Action log (§4.1) |
| `src/lib/workflows/summarize-agents-md.ts` | Summarizer (§4.3) |
| `src/lib/workflows/workflow-storage.ts` | Storage (§4.4) |
| `src/components/workflow/workflow-section.component.ts` | Tray section (§5.1) |
| `src/components/workflow/trace-dialog.component.ts` | Trace dialog (§5.3) |
| `src/components/workflow/workflow-editor.component.ts` | Workflow editor (§5.4) |
| `src/lib/workflows/builtin-workflows.ts` | Built-in workflows (§5.2) |
| `src/components/context-tray/tasks.ts` | `stop$`, abort signal (§2.3) |
| `src/components/context-tray/tools/*.tool.ts` | Thin forms calling `dispatch$`, visibility from `isAvailable` |
| `src/components/canvas/canvas.component.ts`, `card.component.ts` | Gesture-end dispatch, render `pending` (§2.5–2.6) |
| `src/canvas-page.ts` | Dialog mount |
| `src/lib/gemini-models.ts` | `GEMINI_AGENT_MODEL`, `GEMINI_AGENT_THINKING` |

---

## 9. Implementation Order

1. **Action layer**
   - Write `registry`, `dispatch` and `layout` tests.
   - Implement the types, registry, dispatcher, `getUiState`, and the `stop$`/abort changes in `tasks.ts`.
   - Implement the board actions (`select`, `move`, `delete`, `clear`, `duplicate`, `edit_card`, `add_card`) and the human-only `export_cards`/`add_media`.
   - Rewire `CanvasComponent`, `CanvasTool` and `ExportTool`.
2. **Generative actions**
   - Extract `fillCard$` and the `pending` state.
   - Port `render_image`, `search_references`, `visualize_concept`, `scan_concept`, `blend_images`, `design_concepts`, `iterate_designs`, `run_user_testing`, `regenerate_image`, `edit_image`, `animate` and `interview_persona`.
   - The tray derives its visibility from `isAvailable`.
3. **Perception**
   - Write the `observe` tests, then implement `observe.ts`, `view_cards` and `wait_for_idle`.
   - Live spot tests: multimodal `function_result` and `allowed_tools`.
4. **Workflow capture and UI**
   - Implement the action log, trace draft, summarizer (with its live spot test) and storage.
   - Build the Workflow tray section, the Trace dialog and the Workflow editor; add the built-in workflows.
5. **Run agent**
   - Add the model constants and write the `auto-iterate` tests.
   - Implement the agent prompt, loop and guardrails, then wire Run/Stop and the status display.
   - Run the live end-to-end spot test and tune `BASE_AGENT_PROMPT`.
6. **Docs**
   - Update `.github/copilot-instructions.md` and `src/components/context-tray/context-tray.instructions.md` with the action-layer rule: every new UI capability ships as a registered action with a `humanEntry` and an `agent` mode, or the parity test fails.
   - Add the §5.3 dialog/popover rules.
