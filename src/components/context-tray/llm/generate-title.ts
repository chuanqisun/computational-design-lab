import { OpenAI } from "openai";
import { Observable, from } from "rxjs";
import { progress$ } from "../../progress/progress";

export interface GenerateTitleProps {
  fullText: string;
  apiKey: string;
}

export function generateTitle$(props: GenerateTitleProps): Observable<string> {
  return new Observable<string>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
    });

    from(
      (async () => {
        const openai = new OpenAI({
          dangerouslyAllowBrowser: true,
          apiKey: props.apiKey,
        });

        const response = await openai.responses.create({
          model: "gpt-5-mini",
          input: [
            {
              role: "developer",
              content: [{ type: "input_text", text: "Summarize user provided content into one word or short phrase" }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: props.fullText }],
            },
          ],
          reasoning: { effort: "minimal" },
          text: { verbosity: "low" },
        });

        // Extract the text from the response
        const outputItem = response.output.find((item) => item.type === "message");
        if (outputItem && "content" in outputItem) {
          const content = outputItem.content?.[0];
          if (content?.type === "output_text") {
            return content.text.trim();
          }
        }

        throw new Error("Failed to generate title");
      })(),
    ).subscribe(subscriber);
  });
}
