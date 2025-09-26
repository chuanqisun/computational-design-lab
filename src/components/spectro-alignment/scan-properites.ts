import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";
import { progress$ } from "../progress/progress";

export interface Property {
  name: string;
  lowEnd: string;
  highEnd: string;
  value?: number;
}

export function streamProperties$(params: { image: string; apiKey: string }): Observable<Property> {
  return new Observable<Property>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit properties
    parser.onValue = (entry) => {
      // Check if this is an array item under the "properties" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const property = entry.value as unknown as Property;
        if (property.name && property.lowEnd && property.highEnd) {
          subscriber.next(property);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
      try {
        const prompt = `
Analyze this product image and generate conceptual and material properties that can be adjusted to simulate different designs.

Generate 5 properties, each with a name, and two labels for a slider scale from 1 to 5 (where 1 is one extreme, 5 is the other extreme).

Name should be one word or short phrase. It can be physical or conceptual. For example: contour (curved, angular), transparency (opaque, transparent)...

Respond in this JSON format:
{
  "properties": [
    {
      "name": "string",
      "lowEnd": "string",
      "highEnd": "string"
    }
  ]
}
        `.trim();

        const responseStream = await openai.responses.create(
          {
            model: "gpt-5-mini",
            input: [
              {
                role: "user",
                content: [
                  { type: "input_text", text: prompt },
                  { type: "input_image", image_url: params.image, detail: "auto" },
                ],
              },
            ],
            text: { verbosity: "low", format: { type: "json_object" } },
            reasoning: { effort: "minimal" },
            stream: true,
          },
          {
            signal: abortController.signal,
          },
        );

        for await (const chunk of responseStream) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }
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
