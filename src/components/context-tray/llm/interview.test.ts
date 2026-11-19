import { firstValueFrom } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";
import {
  appendTranscriptChunk,
  buildInterviewContextParts,
  buildInterviewSystemPrompt,
  formatInterviewTranscript,
  isSyntheticUserCard,
  resolveInterviewSelection,
  resolvePersonaCardVoice,
  summarizeInterview$,
} from "./interview";

const createInteractionMock = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    interactions = {
      create: createInteractionMock,
    };
  },
}));

const item = (overrides: Partial<CanvasItem>): CanvasItem => ({
  id: crypto.randomUUID(),
  x: 0,
  y: 0,
  width: 200,
  height: 300,
  ...overrides,
});

describe("synthetic user live interview helpers", () => {
  afterEach(() => {
    createInteractionMock.mockReset();
    progress$.next({ imageGen: 0, textGen: 0, videoGen: 0 });
  });

  it("identifies synthetic user cards by metadata or legacy persona- id prefix", () => {
    expect(isSyntheticUserCard(item({ id: "card-1", metadata: { kind: "synthetic-user" } }))).toBe(true);
    expect(isSyntheticUserCard(item({ id: "persona-123" }))).toBe(true);
    expect(isSyntheticUserCard(item({ id: "design-123" }))).toBe(false);
  });

  it("enables interview only when exactly one synthetic user is selected with 0 or more non-user cards", () => {
    const user1 = item({ id: "persona-1", title: "Maya" });
    const user2 = item({ id: "persona-2", title: "Leo" });
    const design1 = item({ id: "design-1", title: "Bottle A" });
    const design2 = item({ id: "design-2", title: "Bottle B" });

    expect(resolveInterviewSelection([design1])).toEqual({
      personaCard: null,
      contextItems: [design1],
      canInterview: false,
    });

    expect(resolveInterviewSelection([user1])).toEqual({
      personaCard: user1,
      contextItems: [],
      canInterview: true,
    });

    expect(resolveInterviewSelection([user1, design1, design2])).toEqual({
      personaCard: user1,
      contextItems: [design1, design2],
      canInterview: true,
    });

    expect(resolveInterviewSelection([user1, user2, design1])).toEqual({
      personaCard: null,
      contextItems: [design1],
      canInterview: false,
    });
  });

  it("builds role-play system prompts for both selected-item and open-ended conversations", () => {
    const user = item({ id: "persona-1", title: "Maya", body: "Industrial designer, age 32\nValues tactile materials." });
    const design = item({ id: "design-1", title: "Pebble Bottle", body: "Matte ceramic feel." });

    const withContext = buildInterviewSystemPrompt(user, [design]);
    expect(withContext).toContain("Persona Name: Maya");
    expect(withContext).toContain("Values tactile materials.");
    expect(withContext).toContain("selected 1 design item");

    const openEnded = buildInterviewSystemPrompt(user, []);
    expect(openEnded).toContain("Persona Name: Maya");
    expect(openEnded).toContain("No specific design items are selected");

    const neutralUser = item({
      id: "persona-neutral",
      title: "Alex",
      body: "UX researcher, age 29",
      metadata: { kind: "synthetic-user", gender: "neutral", voiceName: "Zephyr" },
    });
    const neutralPrompt = buildInterviewSystemPrompt(neutralUser, []);
    expect(neutralPrompt).toContain("gender-neutral / non-binary");
  });

  it("resolves assigned Gemini Live voice profiles from synthetic user card metadata", () => {
    expect(
      resolvePersonaCardVoice(
        item({
          id: "persona-1",
          title: "Maya",
          metadata: { kind: "synthetic-user", gender: "female", voiceName: "Kore" },
        }),
      ),
    ).toBe("Kore");

    expect(
      resolvePersonaCardVoice(
        item({
          id: "persona-2",
          title: "Alex",
          metadata: { kind: "synthetic-user", persona: { gender: "non-binary", voiceName: "Umbriel" } },
        }),
      ),
    ).toBe("Umbriel");
  });

  it("builds multimodal context parts containing text and images from all selected non-user items", async () => {
    const parts = await buildInterviewContextParts([
      item({ title: "Concept A", body: "Soft matte finish", imageSrc: "data:image/png;base64,IMG_A" }),
      item({ title: "Note B", body: "Eco refill pouch" }),
    ]);

    expect(parts).toEqual([
      { text: "Here are the 2 selected canvas items we are discussing in this interview:" },
      { text: "Item 1:\nTitle: Concept A\nBody: Soft matte finish" },
      { inlineData: { mimeType: "image/png", data: "IMG_A" } },
      { text: "Item 2:\nTitle: Note B\nBody: Eco refill pouch" },
    ]);
  });

  it("merges consecutive transcript chunks by speaker and formats dialogue cleanly", () => {
    let turns = appendTranscriptChunk([], "Interviewer", "What do you think");
    turns = appendTranscriptChunk(turns, "Interviewer", "of the cap?");
    turns = appendTranscriptChunk(turns, "Maya", "It feels very intuitive");
    turns = appendTranscriptChunk(turns, "Maya", "!");

    expect(formatInterviewTranscript(turns)).toBe(
      "Interviewer: What do you think of the cap?\nMaya: It feels very intuitive!",
    );
  });

  it("summarizes the interview transcript with Gemini 4 Hydrogen and updates progress$", async () => {
    createInteractionMock.mockResolvedValue({
      id: "interaction-summary-1",
      steps: [
        {
          type: "model_output",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Maya Prefers Matte Cap",
                body: "Maya highlighted the tactile matte finish and intuitive grip, but wanted clearer dosage markings.",
              }),
            },
          ],
        },
      ],
    });

    const summary = await firstValueFrom(
      summarizeInterview$({
        personaCard: item({ id: "persona-1", title: "Maya", body: "Designer, age 32" }),
        contextItems: [item({ id: "design-1", title: "Concept A", body: "Matte bottle" })],
        transcript: [
          { speaker: "Interviewer", text: "What stands out to you?" },
          { speaker: "Maya", text: "I love the matte finish, though dosage markings could be clearer." },
        ],
        apiKey: "test-key",
      }),
    );

    expect(createInteractionMock).toHaveBeenCalledTimes(1);
    const [params, requestOptions] = createInteractionMock.mock.calls[0];
    expect(params.model).toBe("gemini-4-hydrogen");
    expect(params.generation_config).toEqual({ thinking_level: "low" });
    expect(params.store).toBe(false);
    expect(requestOptions).toEqual({ signal: expect.any(AbortSignal) });
    expect(summary).toEqual({
      title: "Maya Prefers Matte Cap",
      body: "Maya highlighted the tactile matte finish and intuitive grip, but wanted clearer dosage markings.",
    });
    expect(progress$.value.textGen).toBe(0);
  });
});
