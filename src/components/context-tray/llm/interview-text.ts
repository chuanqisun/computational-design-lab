import { GoogleGenAI, type Interactions } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../../lib/gemini-models";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";
import { buildInterviewContextParts, buildInterviewSystemPrompt, type InterviewTurn } from "./interview";

/**
 * Text equivalent of the live voice interview: the same persona system prompt and discussion context,
 * answered turn by turn in text. Produces the same transcript shape that `summarizeInterview$` consumes.
 */
export function textInterview$(input: {
  personaCard: CanvasItem;
  contextItems: CanvasItem[];
  questions: string[];
  apiKey: string;
  interviewerName?: string;
}): Observable<InterviewTurn[]> {
  return new Observable<InterviewTurn[]>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    void (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: input.apiKey });
        const personaName = input.personaCard.title?.trim() || "Synthetic User";
        const interviewer = input.interviewerName ?? "Interviewer";
        const systemInstruction = `${buildInterviewSystemPrompt(input.personaCard, input.contextItems)}
- This interview happens in text. Answer each question in 2-4 natural sentences, in first person, as ${personaName}.`;

        const contextParts = await buildInterviewContextParts(input.contextItems);
        const contextContent: Interactions.Content[] = contextParts.flatMap((part): Interactions.Content[] => {
          if (part.text) return [{ type: "text", text: part.text }];
          if (part.inlineData?.data) {
            return [{ type: "image", mime_type: part.inlineData.mimeType as "image/png", data: part.inlineData.data }];
          }
          return [];
        });

        const turns: InterviewTurn[] = [];
        let previousId: string | undefined;

        for (const [index, question] of input.questions.entries()) {
          const content: Interactions.Content[] = [
            ...(index === 0 ? contextContent : []),
            { type: "text", text: question },
          ];
          const interaction = await ai.interactions.create(
            {
              model: GEMINI_TEXT_MODEL,
              system_instruction: systemInstruction,
              input: [{ type: "user_input", content }],
              previous_interaction_id: previousId,
              generation_config: { thinking_level: GEMINI_TEXT_THINKING },
              store: true,
            },
            { signal: abortController.signal },
          );
          previousId = interaction.id;
          const answer = (interaction.steps ?? [])
            .flatMap((step) => (step.type === "model_output" ? (step.content ?? []) : []))
            .flatMap((content) => (content.type === "text" ? [content.text] : []))
            .join("")
            .trim();
          turns.push({ speaker: interviewer, text: question }, { speaker: personaName, text: answer || "(no answer)" });
        }

        subscriber.next(turns);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
