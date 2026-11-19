import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { rateLenses$ } from "./rate-lenses";

const apiKey = process.env.GEMINI_API_KEY ?? "";

describe.skipIf(!apiKey)("rateLenses$ (live)", () => {
  it("picks acoustics as the best lens for a sound-centric card", async () => {
    const scores = await firstValueFrom(
      rateLenses$({
        apiKey,
        items: [
          {
            id: "1",
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            title: "Snap cap",
            body: "A flip-top bottle cap that makes a crisp, satisfying click when closed, with a soft pop when opened.",
          },
        ],
      }),
    );
    console.log(scores);
    const sum = Object.values(scores.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(scores.relative.acoustics).toBe(1);
  });
});
