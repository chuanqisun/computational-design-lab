# RFC: Migrate Canvas and Studio to the Gemini Interactions API

- Scope: Gemini calls reachable from `src/canvas-page.ts` and `src/studio-page.ts`

## Summary

Migrate all runtime-reachable Gemini `models.generateContent` and
`models.generateContentStream` calls used by Canvas and Studio to the Gemini
Interactions API. The migration covers text generation, multimodal
understanding, structured output, image generation, and the Gemini connection
test.

The first release will use stateless interactions (`store: false`) and preserve
the current client-managed conversation and RxJS behavior. This keeps the API
migration independent from data-retention and product-state changes. A later
RFC may move Studio revisions to stored interactions and
`previous_interaction_id`.

Veo calls through `models.generateVideos` are not `generateContent` calls and
are not part of this migration. They remain on the existing long-running
operation API.

## Motivation

The Interactions API is the recommended interface for new Gemini development
and is where new models, tools, multimodal capabilities, and agent features
will launch. Moving now gives Canvas and Studio a single request/response model
and creates a future path to server-side conversation state and improved cache
hit rates.

The current application depends on `@google/genai` 1.42.0. Interactions support
requires `@google/genai` 2.3.0 or newer, so the SDK upgrade is a prerequisite.

## Goals

- Replace every active `generateContent` and `generateContentStream` call
  reachable from Canvas and Studio.
- Preserve current prompts, models, modalities, schemas, incremental UI
  updates, cancellation, progress counters, and fallback behavior.
- Migrate each owning module directly to the Interactions SDK without adding a
  temporary adapter layer.
- Make storage behavior explicit and avoid new server-side retention in the
  parity release.
- Leave no runtime dependency on Generate Content response types in the two
  application graphs.

## Non-goals

- Migrating `models.generateVideos` or Veo operation polling.
- Changing prompts, model selection, generation quality, or product UX.
- Adopting agents, tools, background execution, or remote MCP.
- Introducing server-managed Studio conversation state in the first release.
- Migrating dormant helpers, reference implementations, prompt-library source
  references, or instruction documentation unless they become runtime code.

## Current State

The page entry points do not directly generate content. They register custom
elements, create components, and pass shared RxJS state into modules that own
the Gemini calls.

There are 16 unique active legacy call sites: 11 reachable from Canvas and 7
reachable from Studio. The connection test and shared image provider are used
by both applications.

### Shared Calls

| File and function                                                         | Current operation                                            | Behavior to preserve                                                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/connections/test-connections.ts` — `testGeminiConnection` | Streaming text, `gemini-2.5-flash-lite`                      | Collect all text and return the exact connection-test response. Reachable through `ConnectionsComponent` from both pages.                                                 |
| `src/components/design/generate-image-gemini.ts` — `generateImage`        | Streaming image generation, default `gemini-3.1-flash-image` | Text plus optional inline images, image-only output, aspect ratio, abort on unsubscribe, and first-image selection. Used by the Canvas renderer and Studio photo gallery. |

### Canvas Calls

| File and function                                                          | Current operation                                                    | Behavior to preserve                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/canvas/ai-helpers.ts` — `enhancePrompt`                    | Non-streaming text, `gemini-3-flash-preview`                         | Return one enhanced prompt.                                                               |
| `src/components/canvas/ai-helpers.ts` — `fillCard`                         | Non-streaming multimodal JSON, `gemini-3-flash-preview`              | Return only missing card fields; retain empty-object fallback on invalid or empty output. |
| `src/components/canvas/ai-helpers.ts` — `generateRefinedCardText`          | Non-streaming two-image JSON, `gemini-3-flash-preview`               | Return title/body and retain old-content fallback.                                        |
| `src/components/context-tray/llm/blend-images.ts` — `blendImages`          | Streaming image generation, `gemini-3.1-flash-image`                 | Blend multiple images, abort on unsubscribe, and retain current last-image selection.     |
| `src/components/context-tray/llm/design-concepts.ts` — `designConcepts$`   | Streaming structured output, `gemini-3-flash-preview`                | Incrementally emit completed design objects from the `designs` array.                     |
| `src/components/context-tray/llm/scan-concepts.ts` — `scanConcepts$`       | Streaming structured output, `gemini-3-flash-preview`                | Incrementally emit completed concept objects from the `concepts` array.                   |
| `src/components/context-tray/llm/synthetic-users.ts` — `generatePersonas$` | Streaming structured output, `gemini-3-flash-preview`                | Incrementally emit completed persona objects.                                             |
| `src/components/context-tray/llm/synthetic-users.ts` — `rankDesigns$`      | Non-streaming multimodal structured output, `gemini-3-flash-preview` | Validate returned IDs and append omitted designs in their existing order.                 |
| `src/components/semantic-scan/image-to-image.ts` — `imageToimage`          | Streaming image generation, `gemini-3.1-flash-lite-image`            | Return the first generated image after the response completes.                            |

`src/components/canvas/ai-helpers.ts#getCaption` and the Gemini modules for
definition, title, image-prompt, and mood generation have no runtime callers
from `canvas-page.ts`. They are excluded from this RFC's required inventory,
but should either be migrated when activated or removed before activation.

### Studio Calls

| File and function                                   | Current operation                                                  | Behavior to preserve                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio-ai.ts` — `runScanAI`                | Streaming image understanding with JSON schema, `gemini-2.5-flash` | Parse library-constrained shape, material, mechanism, and color arrays; merge scan results only after completion. |
| `src/lib/studio-ai.ts` — `synthesize`               | Streaming multimodal text, `gemini-3-flash-preview`                | Incrementally render XML and initialize client-managed revision history.                                          |
| `src/lib/studio-ai.ts` — `revise`                   | Streaming multi-turn text, `gemini-3-flash-preview`                | Replay the complete `Content[]` history, incrementally render revised XML, then append the completed turn.        |
| `src/lib/studio-ai.ts` — `takePhoto`                | Non-streaming text, `gemini-3-flash-preview`                       | Stage scene XML and update the matching gallery card.                                                             |
| `src/lib/studio-ai.ts` — `generateSoundDescription` | Non-streaming text, `gemini-3-flash-preview`                       | Run as a non-blocking follow-up and update the matching gallery card.                                             |

Studio also reaches both shared calls listed above. Its video gallery reaches
`src/components/generative-video/generate-video-gemini.ts`, but that module
uses `models.generateVideos` and remains unchanged.

## Proposed Design

### 1. Upgrade and verify the SDK

Upgrade `@google/genai` and the lockfile to the latest compatible release, with
2.3.0 as the minimum. Before changing feature modules, add a small compile-time
spike that confirms the installed JavaScript SDK's exact Interactions methods,
stream event types, structured-output configuration, image input/output shape,
abort support, and browser support.

The source notes describe the resource semantics but do not provide the exact
JavaScript request and event API. The implementation must use SDK types from
the installed version rather than `any` or locally guessed interfaces.

### 2. Migrate each call site directly

Each module in the inventory will call the upgraded SDK's Interactions API
directly. The migration must not introduce an Interactions adapter, temporary
compatibility wrapper, parallel legacy implementation, or feature flag.

At each call site:

- Replace `generateContent` or `generateContentStream` with the corresponding
  Interactions create or stream operation.
- Set `store: false` explicitly in the request.
- Map the existing input parts, system instruction, model configuration,
  thinking configuration, response modalities, and JSON schema locally.
- Read text and inline images from the returned execution steps or stream
  events using the upgraded SDK's concrete types.
- Preserve the module's existing abort, RxJS, progress, parsing, and fallback
  behavior.

Small pure functions may be extracted within an existing owning module when
needed to avoid repeated execution-step traversal in that same file. Do not add
a new cross-module abstraction during this migration. The existing shared
`generateImage` provider and connection-test module remain shared because they
already own those behaviors; they are migrated in place.

### 3. Preserve stateless behavior

Set `store: false` on every migrated request. Independent Canvas tasks must
remain isolated from one another. Studio should continue replaying its local
history for revisions rather than sending `previous_interaction_id`.

This decision preserves the current privacy boundary: requests are processed
but no Interaction resource is retained for later retrieval. It also avoids
introducing paid-tier 55-day or free-tier 1-day retention as an implicit product
change.

Because `store: false` cannot be combined with `previous_interaction_id` or
background execution, those features are explicitly deferred.

### 4. Migrate by response shape

Migrate call sites in four behavior groups so equivalent request and response
shapes can be implemented and reviewed together:

1. Plain text: connection test, prompt enhancement, synthesis, revision, photo
   staging, and sound description.
2. Structured JSON: card filling, refined card text, scan results, concepts,
   designs, personas, and rankings.
3. Image output: shared image generation, image blending, and sketch
   image-to-image.
4. Multimodal input: validate MIME type preservation across scans, cards,
   ranking, image generation, and Studio synthesis.

For incremental structured output, verify whether Interactions streaming emits
concatenable text deltas. If it does, retain `@streamparser/json`. If it emits
snapshots or typed structured events, adapt those events centrally and preserve
the existing per-array-item emission timing. Do not silently change these
observables to emit only at completion.

### 5. Decouple Studio history from Generate Content types

Replace the public `Content[]` dependency in `studio-page.ts`,
`center-panel.component.ts`, `studio-types.ts`, and `studio-ai.ts` with a local
conversation-turn type containing the text and inline-data fields Studio needs.
Map that type to Interactions input directly in `studio-ai.ts`.

This prevents the page state from depending on a legacy API type while keeping
the current semantics. Synthesis resets history to one user/model exchange;
revision replays and extends it; reset and Canvas import clear it.

## Delivery Plan

### Phase 0: SDK and contract spike

- Upgrade `@google/genai` and regenerate the lockfile.
- Confirm create, stream, structured output, multimodal image input, image
  output, abort, and `store: false` behavior in the browser build.
- Record the verified SDK method and type names in this RFC or the first
  migrated call site so subsequent changes use the same SDK conventions.

### Phase 1: Shared call sites

- Migrate `testGeminiConnection`.
- Migrate shared `generateImage` and verify Canvas and Studio consumers.
- Add focused tests for their text and image execution-step parsing; tests must
  not call the live Gemini API.

### Phase 2: Canvas

- Migrate the three active helpers in `canvas/ai-helpers.ts`.
- Migrate context-tray image, structured-concept, and synthetic-user calls.
- Migrate semantic scan image-to-image.
- Verify task cancellation, progress counters, item ordering, JSON fallbacks,
  and first-versus-last image selection.

### Phase 3: Studio

- Introduce the local conversation-turn type.
- Migrate scan, synthesis, revision, photo staging, and sound description.
- Verify progressive XML rendering, history reset/replay, parallel scan merge,
  gallery updates, and background sound-description failure isolation.

### Phase 4: Cleanup and rollout

- Remove active imports of Generate Content request, response, config, and
  `Content` types.
- Search runtime source for remaining `generateContent` and
  `generateContentStream` calls and classify every result as migrated, dormant,
  documentation, or out of scope.
- Run focused tests, the complete test suite, TypeScript compilation, and both
  application builds.
- Perform manual smoke tests with a test API key before release.

## Testing Strategy

Unit tests should cover the execution-step handling used at the migrated call
sites for:

- Text-only completion and streamed text deltas.
- Multiple model-output steps and empty output.
- Inline image output with MIME type preservation.
- Structured JSON split across arbitrary stream boundaries.
- Abort before response, during streaming, and after completion.
- API errors and malformed output.

Feature tests should cover current business behavior:

- Card JSON fallbacks and ranking ID repair.
- Incremental concept, design, and persona emissions.
- First-image selection in `generateImage` and `imageToimage` and last-image
  selection in `blendImages`.
- Studio scan enum mapping, progressive XML, revision history, gallery updates,
  and non-blocking sound generation.

Manual smoke tests should exercise Canvas prompt enhancement, card fill, image
generation, blend, concept scan, design generation, personas/ranking, and
sketch refinement, plus Studio scan, synthesis, revision, photo, image, video,
and connection testing. Video is tested for regression only; its API is not
migrated.

## Risks and Mitigations

| Risk                                                            | Mitigation                                                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Interactions stream events differ from Generate Content chunks. | Establish the correct SDK event handling in the first call of each behavior group, then apply the same verified pattern to the remaining calls. |
| Structured streaming loses incremental emissions.               | Preserve the parser contract or translate typed events into equivalent item-level emissions.                                     |
| Image output parts or MIME fields use a different envelope.     | Test image fixtures in each image-owning module and preserve MIME types during local conversion.                                  |
| SDK upgrade introduces unrelated type or browser changes.       | Complete the SDK spike first and keep the dependency upgrade isolated from feature batches.                                      |
| Cancellation stops RxJS work but not network work.              | Pass an abort signal through every streaming and image call and test unsubscription.                                             |
| Stateful interactions accidentally retain design data.          | Set `store: false` explicitly at every call site and do not use `previousInteractionId` in phase one.                            |
| Model/config support differs by endpoint.                       | Verify every currently used model, thinking setting, schema, response modality, and image aspect ratio during the spike.         |
| Dormant legacy modules are later activated.                     | Add a lint or CI search preventing new runtime `generateContent*` calls; migrate dormant modules before wiring them into a page. |

## Alternatives Considered

### Add a shared Interactions adapter

Rejected for this migration because the compressed delivery timeline does not
justify introducing and validating a new abstraction before converting the
call sites. Direct migration also keeps request configuration and response
handling beside the prompts, schemas, RxJS behavior, and fallbacks they serve.
Some execution-step traversal may be repeated temporarily; a shared abstraction
can be considered later if stable duplication remains after migration.

### Adopt `previous_interaction_id` immediately

Rejected for the parity release. It requires `store: true`, changes data
retention, introduces interaction-ID lifecycle and deletion requirements, and
would couple revision success to server retention. It also does not address
the existing mismatch between manually edited XML and Studio's saved model
history.

### Keep Generate Content for image generation

Rejected because the Interactions API is intended as the universal interface
for multimodal and image generation, and retaining two Gemini content APIs
would undermine the migration. Veo remains separate because it uses the video
long-running operation API rather than Generate Content.

## Acceptance Criteria

- All 16 active legacy call sites identified in this RFC use the Interactions
  API directly through the upgraded SDK.
- No new Interactions adapter, compatibility wrapper, parallel legacy path, or
  migration feature flag is introduced.
- No `generateContent` or `generateContentStream` call remains reachable from
  `canvas-page.ts` or `studio-page.ts`.
- Every migrated interaction explicitly uses `store: false`.
- Canvas and Studio preserve their current streaming, cancellation, progress,
  structured-output, image-selection, fallback, and conversation behavior.
- Veo generation continues to work without API changes.
- Unit tests, the full test suite, TypeScript compilation, and production builds
  pass.
- Manual Canvas and Studio smoke tests pass with no new interaction resources
  retained for follow-up retrieval.

## Follow-up

After the parity migration is stable, evaluate a separate opt-in stateful Studio
revision design. That proposal must define consent and retention UX,
`previous_interaction_id` persistence, expiration recovery, deletion on reset,
manual XML edit synchronization, and migration back to stateless replay.
