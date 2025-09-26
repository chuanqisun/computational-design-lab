import { OpenAI } from "openai";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";
import type { Spectrum } from "./spectrums";

export interface ExtrapolatedSpectrum {
  leftEnd: string;
  rightEnd: string;
}

export function extrapolateSpectrum$(params: {
  prompt: string;
  spectrum: Spectrum;
  apiKey: string;
}): Observable<ExtrapolatedSpectrum> {
  return new Observable<ExtrapolatedSpectrum>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    // Call OpenAI responses API
    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const prompt = `
Given the base prompt: "${params.prompt}"

Spectrum name: "${params.spectrum.name}"

Spectrum description: "${params.spectrum.description}"

Generate two alternative text prompts, one for the ${params.spectrum.leftEndName} end and one for the ${params.spectrum.rightEndName} end.

Respond in this JSON format:
{
  "leftEnd": "text prompt for the ${params.spectrum.leftEndName} end",
  "rightEnd": "text prompt for the ${params.spectrum.rightEndName} end"
}
        `.trim();

        const response = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: prompt }],
              },
            ],
            text: { verbosity: "low", format: { type: "json_object" } },
            reasoning: { effort: "minimal" },
          },
          {
            signal: abortController.signal,
          },
        );

        const content = response.output_text;
        const result = JSON.parse(content) as ExtrapolatedSpectrum;
        subscriber.next(result);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      } finally {
        progress$.next({ ...progress$.value, textGen: progress$.value.textGen - 1 });
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}
