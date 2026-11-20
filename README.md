# Computational Design Lab

A client-side suite of AI-assisted industrial and product design tools powered by the Google Gemini API (`@google/genai`), built with TypeScript, Vite, `lit-html`, and RxJS.

The repository centers on two primary applications:

- **Canvas (`canvas.html`)** — An infinite mood-board and generative design workspace with multimodal tools, synthetic user testing, action trace recording, and an autonomous Auto-Iterate agent.
- **Photo Studio (`studio.html`)** — A structured product visualization studio that turns material/form libraries, reference scans, and XML scene graphs into staged product photography and animated video clips.

It also ships two standalone single-file companion pages:

- **Canvas Guide (`canvas-guide.html`)** — Human-facing interactive handbook with looping demo clips for every Canvas tool.
- **Prompt Library (`prompt-library.html`)** — Inspectable, interactive catalog of every prompt template used by Canvas and Photo Studio, designed for auditing, migration, and porting to other platforms.

---

## Local Development

### Prerequisites

- **Node.js 22+** (matches `.github/workflows/deploy.yml`) and `npm`
- A **Gemini API key** (entered in the browser UI; no backend server is required)

### Install & Run

```bash
npm install
npm run dev
```

Vite serves the multi-page app under the `/computational-design-lab/` base path (configured in `vite.config.ts`). Once the dev server is running (default port `5173`), open:

| Page | Local URL |
| --- | --- |
| **Canvas** | `http://localhost:5173/computational-design-lab/canvas.html` |
| **Photo Studio** | `http://localhost:5173/computational-design-lab/studio.html` |
| **Canvas Guide** | `http://localhost:5173/computational-design-lab/canvas-guide.html` |
| **Prompt Library** | `http://localhost:5173/computational-design-lab/prompt-library.html` |

> **Configuring your API key:** Click **Setup** in the top-right header of Canvas or Photo Studio, paste your Gemini API key, and optionally click **Test** to verify connectivity. Keys are stored locally in `localStorage` under `moodboard-ai-api-keys` and are shared across all apps on the same origin.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Type-check (`tsc`), build the multi-page apps (`build:apps`), and build standalone single-file bundles for `prompt-library.html` and `canvas-guide.html` into `dist/`. |
| `npm run preview` | Preview the production `dist/` build locally. |
| `npm test` | Run Vitest unit tests (excludes `*.live.test.ts`). Also verifies that `docs/prompts/` matches `src/prompt-templates/`. |
| `npx vitest run -u` | Regenerate `docs/prompts/` snapshots after modifying any prompt template. |
| `npm run test:live` | Run live integration spot tests (`src/**/*.live.test.ts`) against the Gemini API. Reads `GEMINI_API_KEY` from `.env` (tests skip if unset). |

---

## Architecture Overview

### UI & State Stack

- **Multi-page Vite app:** Entry points are defined in `vite.config.ts` (`canvas.html`, `studio.html`, plus legacy/experimental `index.html` and `wizard.html`). `canvas-guide.html` and `prompt-library.html` are built separately with `vite-plugin-singlefile` so each can be shared or opened as a self-contained HTML artifact.
- **Reactive components (`src/sdk/`):** UI components are built with `createComponent` (`src/sdk/create-component.ts`), which pairs `lit-html` templates with `rxjs` streams (`BehaviorSubject` / `Observable`) via a custom `observe()` directive (`src/sdk/observe-directive.ts`).
- **Custom Elements for media:** `<generative-image>` (`src/components/generative-image/`) and `<generative-video>` (`src/components/generative-video/`) encapsulate Gemini image/video generation and caching behind standard Web Component tags.
- **Client-side persistence:** Application state lives in IndexedDB (`src/components/connections/storage.ts` → `moodboard-db` for Canvas cards; `src/lib/persistence.ts` → `computational-design-lab-persistence` for Studio state, action logs, and cached media blobs) and `localStorage` (API keys and Canvas viewport center).
- **Centralized model configuration:** All Gemini model IDs and thinking levels are declared in `src/lib/gemini-models.ts` (covering text/reasoning, the Auto-Iterate agent, image generation/editing, video generation, Gemini Live audio, and the Decisions API).

---

## Core Applications

### 1. Canvas (`canvas.html` / `src/canvas-page.ts`)

Canvas is an infinite spatial board (`src/components/canvas/`) with a live minimap (`minimap.component.ts`) and a resizable right-hand Context Tray (`src/components/context-tray/`) whose tools adapt to the current card selection.

**Key capabilities:**

- **Create & Gather:** Upload images/videos, capture from webcam, write notes (auto-titled and illustrated), render images from prompts, and search real-world references with Google Search + image search grounding.
- **Explore & Synthesize:** Visualize text cards in abstract or concrete styles; **Scan** selections through 10 conceptual lenses (Emotions, Associations, Symbolism, Shape, Material, Color, Tactility, Acoustics, Interactions, Narrative) ranked dynamically by the Gemini Decisions API; **Blend** multiple cards; **Design Create / Iterate** with optional requirements and brand guides.
- **Synthetic User Testing:** Generate personas for a target segment, rank selected designs against a trait, and run **live voice interviews** over the microphone via Gemini Live (`gemini-3.8-live`) with automatic transcript summarization.
- **Media Editing:** **Sketch** (annotate an image in a drawing dialog and edit via the image model) and **Animate** (generate video clips with starting-frame/reference roles).
- **Board Management:** Gather off-screen cards into view, Organize cards into an action timeline, Focus on selected cards, or Destroy all cards.

**Action Registry, Workflows & Auto-Iterate Agent:**

- **Unified Action Registry (`src/lib/actions/`):** Board, perception, generative, and media operations (`src/lib/actions/defs/*.ts`) are registered in one place (`app-registry.ts`) and executed through `ActionRuntime` (`runtime.ts`), exposing the same capabilities to both human UI clicks and AI tool calls.
- **Traces & `AGENTS.md` Workflows (`src/lib/workflows/`, `src/components/workflow/`):** Every action is logged to an inspectable trace (`TraceDialogComponent`). Users can edit a trace and distill it into a reusable Markdown workflow (`AGENTS.md`) via `summarize-agents-md.ts`.
- **Auto-Iterate Agent (`src/lib/agent/`):** `auto-iterate.ts` and `agent-controller.ts` run a Gemini function-calling loop (`GEMINI_AGENT_MODEL`) that observes the canvas state (including card thumbnails), follows the active `AGENTS.md` workflow, and invokes available registry actions within turn and card-count guardrails.

---

### 2. Photo Studio (`studio.html` / `src/studio-page.ts`)

Photo Studio is a structured product-design and photo/video staging environment built around a declarative XML scene representation.

**Key capabilities:**

- **Attribute Library & Photo Scan (`src/components/left-panel/`, `src/components/material-library/`, `src/components/scan-dialog/`):** Browse curated shapes, materials, surface finishes, mechanisms, and colors, or scan reference photos with `runScanAI` (`src/lib/studio-ai.ts`), which streams structured JSON constrained to library-backed enums and automatically selects matching attributes.
- **Scene XML Synthesis & Multi-Turn Revision (`src/components/center-panel/`, `src/lib/studio-ai.ts`, `src/sdk/xml-editor.ts`):** Synthesize a hierarchical product scene XML (covering subject, setting, camera, lighting, style, and color grade) from selected attributes, reference photos, custom instructions, and an optional brand guide. Edit the XML directly in a CodeMirror 6 XML editor or iterate conversationally via multi-turn revision history.
- **Photo Staging & Animation (`src/components/photo-gallery/`):** Re-stage the synthesized product XML into different photo scenes ("Take Photo"), render high-resolution stills via `<generative-image>`, automatically generate matching sound descriptions, and animate staged photos into 9:16 video clips via `<generative-video>`.
- **Canvas → Studio Handoff:** Selected concept cards from Canvas can be opened directly in Photo Studio via the `?fromCanvasBlob=...` query parameter (`src/studio-page.ts`), which automatically scans card images and populates custom instructions from card text.

---

## Companion Docs & Tools

### Canvas Guide (`canvas-guide.html`)

- **Audience:** Designers, workshop participants, and human users learning Canvas.
- **What it is:** A standalone, hash-routed reference guide (`src/canvas-guide-page.ts`) documenting every Canvas tool with **What it does**, **How it works**, **Requires**, and looping `.mp4` walkthroughs (`src/canvas-guide-clips/`).
- **Packaging:** Built via `vite-canvas-guide.config.ts` using `vite-plugin-singlefile`, which inlines CSS, JS, and video clips as data URIs into a single portable `dist/canvas-guide.html`. Linked directly from the **Help** link in the Canvas header.

### Prompt Library (`prompt-library.html`, `src/prompt-templates/`, `docs/prompts/`)

- **Audience:** Developers and AI engineers auditing prompts, migrating models, or porting workflows to other platforms (e.g., Vertex AI, LangChain, internal services, or other model providers).
- **Source of truth:** Every LLM prompt used by Canvas and Photo Studio is defined as a typed template module in `src/prompt-templates/` (`canvas-*.ts` and `studio-*.ts`) with metadata (model, input/output types, slots, JSON output schema, source file references) and example presets.
- **Interactive browser:** `prompt-library.html` (`src/prompt-library-page.ts`, built as a single-file bundle via `vite-prompt-library.config.ts`) lets you browse templates, tweak slot values or switch presets, inspect rendered system/user prompts and JSON schemas, and copy them cleanly. Linked from the **Prompts** link in the Canvas header.
- **Drift protection & Markdown export:** `src/prompt-templates/prompt-templates.test.ts` ensures every template references a valid model from `src/lib/gemini-models.ts` and existing source files, and snapshots generated Markdown documentation into `docs/prompts/README.md` and `docs/prompts/templates/*.md`. Run `npx vitest run -u` to update the Markdown docs whenever you change a template.

---

## Repository Structure

```text
.
├── canvas.html                     # Canvas app entry point
├── studio.html                     # Photo Studio app entry point
├── canvas-guide.html               # Human-facing Canvas guide (single-file build)
├── prompt-library.html             # Interactive Prompt Library (single-file build)
├── index.html / wizard.html        # Legacy/auxiliary multi-step prototypes
├── docs/
│   └── prompts/                    # Auto-generated Markdown prompt inventory
├── src/
│   ├── canvas-page.ts              # Canvas bootstrap, IndexedDB sync, layout
│   ├── studio-page.ts              # Photo Studio bootstrap, scan pipeline, canvas import
│   ├── canvas-guide-page.ts        # Canvas Guide UI + video clip registry
│   ├── prompt-library-page.ts      # Prompt Library UI
│   ├── components/
│   │   ├── canvas/                 # Infinite board, cards, viewport, minimap, layout
│   │   ├── context-tray/           # Selection-aware Canvas tools & task runner
│   │   ├── connections/            # API key setup dialog & localStorage/IndexedDB storage
│   │   ├── generative-image/       # <generative-image> custom element
│   │   ├── generative-video/       # <generative-video> custom element
│   │   ├── left-panel/             # Studio attribute picker & scan trigger
│   │   ├── center-panel/           # Studio XML synthesis, revision & staging UI
│   │   ├── material-library/       # Curated shapes, materials, mechanisms, colors
│   │   ├── photo-gallery/          # Studio staged photos & video animation gallery
│   │   └── workflow/               # Action trace viewer & AGENTS.md workflow editor
│   ├── lib/
│   │   ├── gemini-models.ts        # Central Gemini model & thinking-level config
│   │   ├── persistence.ts          # IndexedDB key-val & media blob cache helpers
│   │   ├── studio-ai.ts            # Studio scan, XML synthesis, staging & sound calls
│   │   ├── actions/                # Unified Canvas action registry & runtime
│   │   ├── agent/                  # Auto-Iterate agent loop & observation encoders
│   │   └── workflows/              # Action log, trace compiler & workflow storage
│   ├── prompt-templates/           # Canonical prompt templates + drift tests
│   └── sdk/                        # createComponent, observe directive, CodeMirror XML editor
└── .github/workflows/deploy.yml    # GitHub Pages static deployment workflow
```

---

## Deployment & Enterprise Considerations

### Current Deployment (GitHub Pages + BYOK)

Today, the repository deploys as a **fully static site** to GitHub Pages via `.github/workflows/deploy.yml` on every push to `master`:

- There is **no backend server** and **no user authentication**.
- Each user brings their own Gemini API key (**BYOK**), stored in browser `localStorage`, and all `@google/genai` requests are sent directly from the browser to Google's APIs.
- All boards, studio states, and generated media are persisted locally in the user's browser (IndexedDB).

### Workshops & Short-Term Demos

For hands-on workshops, design sprints, or short-term evaluations, the static GitHub Pages deployment works well as-is:

- Provision **one-off, time-boxed Gemini API keys** (for example, per workshop or per participant with billing/quota caps).
- Distribute keys at the start of the session so attendees can paste them into the **Setup** dialog.
- **Revoke or delete the keys** immediately after the workshop ends.

### Longer-Term Enterprise Deployment

For sustained internal or enterprise rollout, static BYOK deployment is not appropriate because API keys cannot be safely embedded in client bundles or managed manually per user. Moving to an enterprise deployment requires:

1. **Authentication & Authorization:** Put the app behind corporate SSO (e.g., OIDC / OAuth 2.0 / SAML or Identity-Aware Proxy) so only authorized employees can access the apps and usage can be attributed per user or team.
2. **Backend API Proxy / Gateway:** Introduce a lightweight backend service that:
   - Holds Gemini credentials server-side (either Gemini Developer API keys in a secret manager or **Vertex AI** with IAM service accounts).
   - Proxies text, streaming JSON, image, video, and Decisions API calls from the frontend—and issues short-lived ephemeral tokens or proxies WebSockets for **Gemini Live** voice interviews—so raw credentials never reach the browser.
   - Enforces per-user rate limits, spend quotas, content/data-governance policies, and audit logging.
3. **Shared Persistence (Optional):** If users need to collaborate on boards, share `AGENTS.md` workflows, or sync Photo Studio projects across devices, replace or back up browser-only IndexedDB (`src/components/connections/storage.ts`, `src/lib/persistence.ts`) with authenticated cloud storage and object storage for generated media.
4. **Base Path & Hosting:** Update `base` in `vite.config.ts`, `vite-canvas-guide.config.ts`, and `vite-prompt-library.config.ts` if hosting at a root domain or custom subpath instead of `/computational-design-lab/`.
