import { OpenAI } from "openai";
import { Observable } from "rxjs";

export function generateDescription$(params: { image: string; apiKey: string }): Observable<string> {
  return new Observable<string>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    (async () => {
      try {
        const prompt = `
Analyze this image and provide a concise, one-paragraph description that would allow an image generation model to recreate this image with high fidelity. Include the overall composition, objects and their positions, colors, lighting, materials, textures, style, and any important details in a flowing description.
        `.trim();

        const response = await openai.responses.create(
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
            reasoning: { effort: "minimal" },
            text: { verbosity: "low" },
          },
          {
            signal: abortController.signal,
          },
        );

        const outputItem = response.output.find((item) => item.type === "message");
        const contentItem = outputItem?.content?.find((content) => content.type === "output_text");
        const description = contentItem?.text || "";
        subscriber.next(description);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}
