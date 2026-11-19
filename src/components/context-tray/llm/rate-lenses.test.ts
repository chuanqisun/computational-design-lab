import { describe, expect, it } from "vitest";
import { SCAN_LENSES } from "../../../lib/actions/defs/generate";
import { buildDecisionInput, buildLensQuestion, toLensScores } from "./rate-lenses";

describe("rate-lenses", () => {
  it("asks a single choice question over every lens", () => {
    const question = buildLensQuestion();
    expect(question.type).toBe("choice");
    expect(question.criteria).toEqual(SCAN_LENSES);
  });

  it("builds image and text blocks from cards", () => {
    const input = buildDecisionInput([
      { id: "1", x: 0, y: 0, width: 1, height: 1, title: "Cap", body: "Matte", imageSrc: "data:image/png;base64,QUJD" },
    ]);
    expect(input).toEqual([
      { type: "image", data: "QUJD", mime_type: "image/png" },
      { type: "text", text: "Cap: Matte\n" },
    ]);
  });

  it("keeps raw probabilities and scales meters relative to the top lens", () => {
    const result = toLensScores({
      best_lens: {
        type: "choice",
        choice: "color",
        confidence: 0.6,
        probabilities: { color: 0.6, shape: 0.3, emotions: 0.1 },
      },
    });
    expect(result.probabilities.color).toBe(0.6);
    expect(result.relative.color).toBe(1);
    expect(result.relative.shape).toBeCloseTo(0.5);
    expect(result.relative.narrative).toBe(0);
  });

  it("returns all zeros when the answer is missing", () => {
    const result = toLensScores(undefined);
    expect(Object.values(result.relative).every((v) => v === 0)).toBe(true);
  });
});
