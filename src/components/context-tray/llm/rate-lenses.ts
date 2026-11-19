import { GoogleGenAI, type Decisions } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_DECISION_MODEL } from "../../../lib/gemini-models";
import { SCAN_LENSES, type ScanLens } from "../../../lib/actions/defs/generate";
import type { CanvasItem } from "../../canvas/canvas.component";

export interface LensScores {
  /** Calibrated probability that each lens is the single best one; sums to 1. */
  probabilities: Record<ScanLens, number>;
  /** Probabilities relative to the top lens, in [0, 1] (top lens = 1). Used for meter length. */
  relative: Record<ScanLens, number>;
}

const QUESTION_KEY = "best_lens";
const LENSES = Object.keys(SCAN_LENSES) as ScanLens[];

/**
 * One `choice` question over all lenses. Unlike independent `score` questions (which cluster around
 * the middle), the lenses compete for probability mass, so the spread is much more pronounced.
 */
export function buildLensQuestion(): Decisions.ChoiceQuestion {
  return {
    type: "choice",
    instructions:
      "A designer will run exactly one of the following analyses on the provided items. " +
      "Which analysis would yield the richest, most specific, non-obvious design insight for these particular items?",
    criteria: { ...SCAN_LENSES },
  };
}

export function buildDecisionInput(items: CanvasItem[]): Decisions.DecisionInputContent[] {
  const parts: Decisions.DecisionInputContent[] = [];
  for (const item of items) {
    if (item.imageSrc) {
      const data = item.imageSrc.replace(/^data:image\/\w+;base64,/, "");
      const mime_type = item.imageSrc.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
      parts.push({ type: "image", data, mime_type });
    }
    if (item.title || item.body) {
      parts.push({ type: "text", text: `${item.title || ""}: ${item.body || ""}\n` });
    }
  }
  return parts;
}

export function toLensScores(answers: Decisions.CreateDecisionResponse["answers"]): LensScores {
  const answer = answers?.[QUESTION_KEY];
  const raw = answer?.type === "choice" ? answer.probabilities : {};
  const probabilities = Object.fromEntries(LENSES.map((lens) => [lens, raw[lens] ?? 0])) as Record<ScanLens, number>;
  const max = Math.max(...Object.values(probabilities));
  const relative = Object.fromEntries(LENSES.map((lens) => [lens, max > 0 ? probabilities[lens] / max : 0])) as Record<
    ScanLens,
    number
  >;
  return { probabilities, relative };
}

/** Scores every scan lens in a single Decisions API call. Unsubscribing aborts the HTTP request. */
export function rateLenses$(inputs: { items: CanvasItem[]; apiKey: string }): Observable<LensScores> {
  return new Observable<LensScores>((subscriber) => {
    const abortController = new AbortController();
    const ai = new GoogleGenAI({ apiKey: inputs.apiKey });

    ai.decisions
      .create(
        {
          api_version: "v1beta",
          model: GEMINI_DECISION_MODEL,
          input: buildDecisionInput(inputs.items),
          questions: { [QUESTION_KEY]: buildLensQuestion() },
        },
        { fetch_options: { signal: abortController.signal } },
      )
      .then((response) => {
        subscriber.next(toLensScores(response.answers));
        subscriber.complete();
      })
      .catch((error) => {
        if (!abortController.signal.aborted) subscriber.error(error);
      });

    return () => abortController.abort();
  });
}
