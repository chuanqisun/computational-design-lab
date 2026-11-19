---
applyTo: "**"
---

## Coding paradigm

- TypeScript. Infer type as much, annotate when necessary
- When import types, prefix them with `type` keyboard. We have `verbatimModuleSyntax` enabled
- Functional core with RxJS
- Effectives are handled on the top layer in main.ts
- Functions over classes, but use class when internal state is complex
- Views are templated with lit-html, stored in /src/components/{component-name}/\*.component.ts

## Workflow

- Do NOT run commands in terminal unless explicitly requested by the user. In case any package is missing or test/build is needed, remind user to do that in the very end of the task.
- If user provided new information or changed requirements, you must update .github/copilot-instructions.md and .github/instructions/\*.instructions.md to stay up to date.

## Coding style

- Compact and efficient
- Use empty lines judiciously to separate logical blocks
- Minimum comments, only when necessary

## Styling

- Use latest CSS features, including variables, grid, flexbox
- Nesting is ok
- Component specific styles should be in the {component-name}.css file, next to {component-name}.ts
- Component CSS should nest all internal styles under a root class, e.g. `.component-name { ... }`
- The component ts file should import its own css file
- Global styles are in /src/main.css

## File organization

/index.html contains the app root
/src/\*.ts are the main pages of the app.
/src/lib/ contains lower level functions
/src/components/ contains reactive UI components using the createComponent pattern

## `src/*.ts` main page files

- Top down organization, high level first, low level later
- Get any static global dom reference first
- Create shared state using BehaviorSubject observables
- Instantiate components and pass shared state as props
- Render components to their respective DOM containers

## RxJS patterns in main page files

- Shared state is hoisted to main.ts and passed down to components
- Components handle their own internal state and effects
- No manual subscriptions needed in main.ts as components manage their own reactive behavior

## Gemini Interactions API

- Centralize Canvas model and thinking-level constants in `src/lib/gemini-models.ts`: `gemini-4-hydrogen` (`thinking_level: "low"`) for quick text/JSON calls, `gemini-4-neon` (`thinking_level: "medium"`) for demanding multi-reference synthesis and comparative design ranking, `gemini-nano-banana-2.1` (`thinking_level: "minimal"`) for image generation/editing and grounded per-card image search, `gemini-omni-1.2-flash` for video generation/editing, and `gemini-3.8-live` for real-time voice user interviews. Gemini 4 Hydrogen and Neon reject `thinking_level: "minimal"` (HTTP 400), and `gemini-nano-banana-2.1` rejects `"low"` and sampling parameters (`temperature`, `topP`, `topK`, `seed`, `logprobs`).
- Pass `input` to `ai.interactions.create` as an explicit `Interactions.Step[]` using `user_input` and `model_output` steps. Do not pass string, `Content[]`, or deprecated `{ role, content }` turn-list shorthand.
- Never pass deprecated `response_modalities` (only accepted on `v1beta`); use `response_format` on GA `v1` (e.g., `response_format: { type: "image" }` for image-only output, or omit for plain text).
- For Gemini Omni 1.2 Animate (`gemini-omni-1.2-flash`), route requests to `v1beta` (`api_version: "v1beta"` and `apiVersion: "v1beta"`), omit `response_format.duration` for the model default or send `4s`/`8s`/`15s` for explicit choices (`extend` is capped at `<= 10s`), use `delivery: "inline"` with `store: false`, and describe `Image1`/`Image2` roles in natural language instead of deprecated `<FIRST_FRAME>` / `<IMAGE_REF_n>` tags.
- For Gemini Live API (`gemini-3.8-live` via `ai.live.connect`), use the client-side ephemeral token strategy on `v1beta`: mint a single-use token via `authTokens.create` (`apiVersion: "v1beta"`), then connect with `new GoogleGenAI({ apiKey: token.name, apiVersion: "v1beta" })`. Assign each generated synthetic user a verified Gemini Live voice profile from `src/lib/gemini-voices.ts` matching `female`/`male` genders and handling `neutral` (gender-neutral / non-binary) personas with balanced voice selection and gender-neutral role-play guidance, passed via `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
- For Gemini Live API (`gemini-3.8-live` via `ai.live.connect`), use the client-side ephemeral token strategy on `v1beta`: mint a single-use token via `authTokens.create` (`apiVersion: "v1beta"`), then connect with `new GoogleGenAI({ apiKey: token.name, apiVersion: "v1beta" })`. Assign each generated synthetic user a verified Gemini Live voice profile from `src/lib/gemini-voices.ts` matching `female`/`male` genders and handling `neutral` (gender-neutral / non-binary) personas with balanced voice selection and gender-neutral role-play guidance, passed via `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
- For Gemini Omni Animate task type, omit `generation_config` for Default or send the selected explicit mode as `generation_config.video_config.task`.
- Track text, image, and video LLM calls in `progress$`; decrement counters with observable teardown/finally semantics and wire `AbortController` so errors and `Stop` cancellation are covered.

- The Auto-Iterate agent uses `GEMINI_AGENT_MODEL` (`gemini-4-neon`, `thinking_level: "medium"`) and only the agent loop uses it. Restrict tools per turn with `generation_config.tool_choice.allowed_tools` and `mode: "validated"`. The API rejects `"auto"` there, and `"any"` would force a tool call every turn.
- Function results may carry `image` and `video` parts (`FunctionResultSubcontent`). The agent perceives the board this way.

## Action layer (human ⇄ AI parity)

Spec: `docs/20261118-ai-instrumentation.md`.

- Every board change goes through `runtime.dispatch$(name, args, actor)` (`src/lib/actions/`). The UI adapter is `runUserAction` in `app-runtime.ts`, which alerts on errors. The AI adapter is the agent loop in `src/lib/agent/auto-iterate.ts`, which never alerts. Components must not mutate `items$` for semantic changes. The only exceptions are presentation-only state (z-order on click, legacy `<generative-image>` completion).
- Actions live in `src/lib/actions/defs/*.ts`. One `ActionDef` is both the UI behavior and the Gemini function declaration. `isAvailable` drives tray visibility on the selection and the agent's allowed tools on the board, with the same predicate. `cardIds` defaults to the selection.
- Every action declares `humanEntry` (a key in `src/lib/actions/human-entries.ts`) and `agent`. `native` means the same input. `equivalent` means a different input with the same output transform (e.g. sketch strokes become region boxes, voice interview becomes text Q&A). `perception` covers `observe`, `view_cards` and `wait_for_idle`. `{ unsupported: reason }` means no realistic equivalent. Device-only inputs (drawings, transcripts, files) are passed as `_`-prefixed `humanArgs`; the agent can never send them.
- A new UI capability must ship as a registered action plus a `HUMAN_ENTRIES` entry, otherwise `registry.test.ts` fails.
- Card fill and image rendering live in the action layer (`card-fill.ts`, `ctx.settle$`). They are not in `CardComponent`. Actions complete after their cards settle. `metadata.pending` marks in-flight work. `async` actions (e.g. `animate`) return immediately and keep working through `ctx.background`.
- New cards are placed with `placeRows` (rows below the board) via `ctx.place` or `ctx.placer`. `user-testing-layout.ts` is the only exception.
- Cancellation: `stop$` in `context-tray/tasks.ts` stops UI tasks, actions and the agent.
- Tests: TDD for the registry/parity, dispatcher, observation, agent loop and placement (mock all LLM calls). Prompt changes are verified with `npm run test:live` (`*.live.test.ts`, reads `GEMINI_API_KEY` from `.env`, excluded from `npm test`).

## Dialogs and popovers

- Open and close dialogs and popovers declaratively with `commandfor` + `command` (`show-modal`, `close`, `toggle-popover`, …). Do not call `.showModal()`, `.close()` or `.showPopover()`, and do not add click listeners only to open or close.
- Never combine `popovertarget` and `commandfor` on one button. Listen to `toggle`/`close`/`command` on the target element, since they do not bubble. No polyfills are needed; the app targets the latest Chromium.
- UI terms: *Workflow* (an `AGENTS.md`, built-in or saved), *Run* (the AI following it), *Trace* (recorded actions). Workflow controls live in the Workflow section at the bottom of the context tray (`workflow-section.component.ts`). Details live in `#trace-dialog` (Timeline + AI view) and `#workflow-editor` (Steps + Instructions). Built-in workflows are in `src/lib/workflows/builtin-workflows.ts` and must pass `builtin-workflows.test.ts`.

## `src/components/*`

- Use the createComponent utility for reactive components
- Follow the pattern: props -> internal state -> actions -> effects -> template
- Components receive shared state as Observable props and return reactive templates
- Effects are handled internally using RxJS merge with ignoreElements()

## `sdk/*.ts`

- lit-html helper functions for working with observables
