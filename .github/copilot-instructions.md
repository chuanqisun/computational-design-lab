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

- Centralize Canvas model and thinking-level constants in `src/lib/gemini-models.ts`: `gemini-4-hydrogen` (`thinking_level: "low"`) for quick text/JSON calls, `gemini-4-neon` (`thinking_level: "medium"`) for demanding multi-reference synthesis and comparative design ranking, `gemini-nano-banana-2.1` (`thinking_level: "minimal"`, or `"medium"` for grounded image search) for image generation/editing, and `gemini-omni-1.2-flash` for video generation/editing. Gemini 4 Hydrogen and Neon reject `thinking_level: "minimal"` (HTTP 400), and `gemini-nano-banana-2.1` rejects sampling parameters (`temperature`, `topP`, `topK`, `seed`, `logprobs`).
- Pass `input` to `ai.interactions.create` as an explicit `Interactions.Step[]` using `user_input` and `model_output` steps. Do not pass string, `Content[]`, or deprecated `{ role, content }` turn-list shorthand.
- Never pass deprecated `response_modalities` (only accepted on `v1beta`); use `response_format` on GA `v1` (e.g., `response_format: { type: "image" }` for image-only output, or omit for plain text).
- For Gemini Omni 1.2 Animate (`gemini-omni-1.2-flash`), route requests to `v1beta` (`api_version: "v1beta"` and `apiVersion: "v1beta"`), omit `response_format.duration` for the model default or send `4s`/`8s`/`15s` for explicit choices (`extend` is capped at `<= 10s`), use `delivery: "inline"` with `store: false`, and describe `Image1`/`Image2` roles in natural language instead of deprecated `<FIRST_FRAME>` / `<IMAGE_REF_n>` tags.
- For Gemini Omni Animate task type, omit `generation_config` for Default or send the selected explicit mode as `generation_config.video_config.task`.
- Track text, image, and video LLM calls in `progress$`; decrement counters with observable teardown/finally semantics and wire `AbortController` so errors and `Stop` cancellation are covered.

## `src/components/*`

- Use the createComponent utility for reactive components
- Follow the pattern: props -> internal state -> actions -> effects -> template
- Components receive shared state as Observable props and return reactive templates
- Effects are handled internally using RxJS merge with ignoreElements()

## `sdk/*.ts`

- lit-html helper functions for working with observables
