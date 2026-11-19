import { describe, expect, it } from "vitest";
import { GEMINI_LIVE_VOICES, normalizePersonaGender, resolvePersonaVoice } from "./gemini-voices";

const voiceGenderByName = new Map<string, "female" | "male" | "neutral">(
  GEMINI_LIVE_VOICES.map((v) => [v.name, v.gender]),
);

describe("gemini-voices", () => {
  it("normalizes female, male, and gender-neutral / non-binary gender labels", () => {
    expect(normalizePersonaGender("female")).toBe("female");
    expect(normalizePersonaGender("Woman")).toBe("female");
    expect(normalizePersonaGender("she/her")).toBe("female");
    expect(normalizePersonaGender("male")).toBe("male");
    expect(normalizePersonaGender("Man")).toBe("male");
    expect(normalizePersonaGender("he/him")).toBe("male");
    expect(normalizePersonaGender("neutral")).toBe("neutral");
    expect(normalizePersonaGender("non-binary")).toBe("neutral");
    expect(normalizePersonaGender("they/them")).toBe("neutral");
    expect(normalizePersonaGender(undefined)).toBe("neutral");
  });

  it("keeps gender-matched voices and remaps binary mismatches", () => {
    expect(resolvePersonaVoice({ gender: "female", voiceName: "Kore" })).toBe("Kore");
    expect(resolvePersonaVoice({ gender: "male", voiceName: "Charon" })).toBe("Charon");

    const correctedFemale = resolvePersonaVoice({ gender: "female", voiceName: "Fenrir", seed: "Maya" });
    expect(voiceGenderByName.get(correctedFemale)).toBe("female");

    const correctedMale = resolvePersonaVoice({ gender: "male", voiceName: "Aoede", seed: "Marcus" });
    expect(voiceGenderByName.get(correctedMale)).toBe("male");
  });

  it("preserves any valid voice for gender-neutral personas and falls back to balanced neutral-friendly voices", () => {
    expect(resolvePersonaVoice({ gender: "neutral", voiceName: "Puck" })).toBe("Puck");
    expect(resolvePersonaVoice({ gender: "non-binary", voiceName: "Zephyr" })).toBe("Zephyr");

    const fallback = resolvePersonaVoice({ gender: "neutral", voiceName: "UnknownVoice", seed: "Alex" });
    const profile = GEMINI_LIVE_VOICES.find((v) => v.name === fallback);
    expect(profile && "neutralFriendly" in profile && profile.neutralFriendly).toBe(true);
  });

  it("avoids repeating voices in a batch when usedVoices is provided", () => {
    const used = new Set<string>();
    const v1 = resolvePersonaVoice({ gender: "female", seed: "same-seed", usedVoices: used });
    used.add(v1);
    const v2 = resolvePersonaVoice({ gender: "female", seed: "same-seed", usedVoices: used });
    expect(v2).not.toBe(v1);
    expect(voiceGenderByName.get(v2)).toBe("female");
  });
});
