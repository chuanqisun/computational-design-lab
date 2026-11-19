import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { progress$ } from "../../components/progress/progress";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../gemini-models";
import type { TraceStep } from "./workflow-storage";

export interface CatalogEntry {
  name: string;
  description: string;
  humanOnly: boolean;
}

const MAX_THUMBS = 12;

function formatArgs(args: Record<string, unknown>): string {
  const json = JSON.stringify(args);
  return json.length > 400 ? `${json.slice(0, 400)}…` : json;
}

export function buildSummarizerPrompt(input: {
  name: string;
  goal: string;
  steps: TraceStep[];
  catalog: CatalogEntry[];
}): string {
  const included = input.steps.filter((step) => step.included);
  const stepLines = included
    .map(
      (step, index) =>
        `${index + 1}. [${step.actor}] ${step.action}${step.humanOnly ? " (HUMAN-ONLY)" : ""} args=${formatArgs(step.args)}${step.note.trim() ? `\n   Note: ${step.note.trim()}` : ""}`,
    )
    .join("\n");
  const catalog = input.catalog
    .map((entry) => `- \`${entry.name}\`${entry.humanOnly ? " (human-only)" : ""}: ${entry.description}`)
    .join("\n");

  return `You write AGENTS.md files (https://agents.md/): plain, high-signal Markdown instructions for an AI agent.

Distill the recorded design session below into a reusable workflow that an agent can follow on a mood-board canvas using the tools listed. The agent sees the board as a card table plus images, and calls tools by name.

Workflow name: ${input.name}
Goal: ${input.goal || "(infer from the steps)"}

## Tool catalog (exact names)
${catalog}

## Recorded steps (edited by the user; notes explain intent)
${stepLines || "(no steps)"}

Images after the steps show what some steps produced (in step order).

Write the AGENTS.md with exactly these sections:
# ${input.name}
One short paragraph: the design objective.
## Tools
Bullet list of the tool names used (backticked, exactly as in the catalog) with parameter conventions that matter.
## Workflow
Numbered, generalized procedure. Never use raw card ids; describe targets by intent (e.g. "the three highest-ranked designs from the previous step", "the persona card"). Human-only steps become "Human step: <what the user must do>" and the agent must pause and ask the user.
## Aesthetic & Quality Criteria
Recurring visual, material, brand or evaluation criteria inferred from prompts, notes and images.
## Guardrails & Stop Conditions
Turn/card limits, when to stop, what never to do. Do not allow \`clear_canvas\` unless the user's notes explicitly ask for it.

Rules: only use tool names from the catalog; be concise (under 400 words); output only the Markdown, no code fences.`;
}

export function summarizeTraceToAgentsMd$(input: {
  name: string;
  goal: string;
  steps: TraceStep[];
  catalog: CatalogEntry[];
  apiKey: string;
}): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    void (async () => {
      try {
        const content: Interactions.Content[] = [{ type: "text", text: buildSummarizerPrompt(input) }];
        const thumbs = input.steps
          .filter((step) => step.included)
          .flatMap((step) => step.thumbs)
          .slice(0, MAX_THUMBS);
        for (const thumb of thumbs) {
          const match = /^data:([^;,]+);base64,(.+)$/s.exec(thumb);
          if (match) content.push({ type: "image", mime_type: match[1] as "image/jpeg", data: match[2] });
        }

        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const interaction = await ai.interactions.create(
          {
            model: GEMINI_TEXT_MODEL,
            input: [{ type: "user_input", content }],
            generation_config: { thinking_level: GEMINI_TEXT_THINKING },
            store: false,
          },
          { signal: abortController.signal },
        );
        const text = (interaction.steps ?? [])
          .filter((step): step is Interactions.ModelOutputStep => step.type === "model_output")
          .flatMap((step) => step.content ?? [])
          .filter((part): part is Interactions.TextContent => part.type === "text")
          .map((part) => part.text)
          .join("")
          .replace(/^```(?:markdown|md)?\s*\n/, "")
          .replace(/\n```\s*$/, "")
          .trim();
        if (!text) throw new Error("Gemini returned an empty AGENTS.md.");
        subscriber.next(text);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
