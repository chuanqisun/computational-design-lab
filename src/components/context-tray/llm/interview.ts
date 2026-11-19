import { GoogleGenAI, Modality, type Interactions, type LiveServerMessage, type Part, type Session } from "@google/genai";
import { Observable } from "rxjs";
import { GEMINI_LIVE_MODEL, GEMINI_TEXT_MODEL, GEMINI_TEXT_THINKING } from "../../../lib/gemini-models";
import {
  normalizePersonaGender,
  resolvePersonaVoice,
  type GeminiLiveVoiceName,
  type PersonaGender,
} from "../../../lib/gemini-voices";
import type { CanvasItem } from "../../canvas/canvas.component";
import { progress$ } from "../../progress/progress";

export interface InterviewTurn {
  speaker: string;
  text: string;
}

export interface InterviewSummary {
  title: string;
  body: string;
}

export interface InterviewSelection {
  personaCard: CanvasItem | null;
  contextItems: CanvasItem[];
  canInterview: boolean;
}

export interface LiveInterviewSession {
  stop: () => Promise<InterviewTurn[]>;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

export function isSyntheticUserCard(item: CanvasItem): boolean {
  return item.metadata?.kind === "synthetic-user" || item.id.startsWith("persona-");
}

export function resolveInterviewSelection(selected: CanvasItem[]): InterviewSelection {
  const personaCards = selected.filter(isSyntheticUserCard);
  const contextItems = selected.filter((item) => !isSyntheticUserCard(item));
  const personaCard = personaCards.length === 1 ? personaCards[0] : null;
  return {
    personaCard,
    contextItems,
    canInterview: personaCard !== null,
  };
}

export function resolvePersonaCardGender(personaCard: CanvasItem): PersonaGender {
  const persona = personaCard.metadata?.persona as Record<string, unknown> | undefined;
  return normalizePersonaGender(personaCard.metadata?.gender ?? persona?.gender);
}

export function resolvePersonaCardVoice(personaCard: CanvasItem): GeminiLiveVoiceName {
  const persona = personaCard.metadata?.persona as Record<string, unknown> | undefined;
  const gender = resolvePersonaCardGender(personaCard);
  const rawVoiceName = personaCard.metadata?.voiceName ?? persona?.voiceName;
  return resolvePersonaVoice({
    gender,
    voiceName: rawVoiceName,
    seed: `${personaCard.title || ""}:${personaCard.id}`,
  });
}

export function buildInterviewSystemPrompt(personaCard: CanvasItem, contextItems: CanvasItem[]): string {
  const personaName = personaCard.title?.trim() || "Synthetic User";
  const personaDetails = personaCard.body?.trim() || "A thoughtful design research participant.";
  const gender = resolvePersonaCardGender(personaCard);
  const genderGuidance =
    gender === "neutral"
      ? "\n- Maintain a gender-neutral / non-binary identity naturally (avoid binary gendered self-references unless explicitly stated in your persona profile)."
      : "";

  const topicGuidance =
    contextItems.length > 0
      ? `The interviewer has selected ${contextItems.length} design ${contextItems.length === 1 ? "item" : "items"} on the canvas to discuss with you (provided in the conversation context with their text and images). Engage naturally in a spoken user-research interview about these selected items from your persona's honest perspective—react to specific visual details, strengths, friction points, and personal preferences.`
      : `No specific design items are selected on the canvas right now. Engage naturally in a spoken user-research conversation about whatever topics, needs, habits, or questions the interviewer brings up, staying fully in character.`;

  return `You are role-playing a synthetic user research participant in a live voice interview.

Persona Name: ${personaName}
Persona Profile:
${personaDetails}

Instructions:
- Stay fully in character as ${personaName} throughout the conversation. Never break character or mention being an AI.
- Speak naturally, concisely, and conversationally—like a real person in a live voice interview.${genderGuidance}
- ${topicGuidance}`;
}

export function appendTranscriptChunk(turns: InterviewTurn[], speaker: string, chunk: string): InterviewTurn[] {
  const text = chunk.trim();
  if (!text) return turns;

  const last = turns.at(-1);
  if (last && last.speaker === speaker) {
    const needsSpace = !last.text.endsWith(" ") && !/^[.,!?;:'")]/.test(text);
    return [...turns.slice(0, -1), { speaker, text: `${last.text}${needsSpace ? " " : ""}${text}` }];
  }

  return [...turns, { speaker, text }];
}

export function formatInterviewTranscript(turns: InterviewTurn[]): string {
  return turns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n");
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

async function imageUrlToInlineData(src: string): Promise<{ mimeType: string; data: string } | null> {
  const inline = parseDataUrl(src);
  if (inline) return inline;

  const response = await fetch(src);
  if (!response.ok) return null;
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(parseDataUrl(String(reader.result || "")));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export async function buildInterviewContextParts(
  contextItems: CanvasItem[],
  resolveImage: (src: string) => Promise<{ mimeType: string; data: string } | null> = imageUrlToInlineData,
): Promise<Part[]> {
  if (contextItems.length === 0) return [];

  const parts: Part[] = [
    {
      text: `Here are the ${contextItems.length} selected canvas ${contextItems.length === 1 ? "item" : "items"} we are discussing in this interview:`,
    },
  ];

  for (let index = 0; index < contextItems.length; index += 1) {
    const item = contextItems[index];
    const textLines = [
      `Item ${index + 1}:`,
      item.title?.trim() ? `Title: ${item.title.trim()}` : "",
      item.body?.trim() ? `Body: ${item.body.trim()}` : "",
      !item.imageSrc && item.imagePrompt?.trim() ? `Image prompt: ${item.imagePrompt.trim()}` : "",
    ].filter(Boolean);

    parts.push({ text: textLines.join("\n") });

    if (item.imageSrc) {
      try {
        const inline = await resolveImage(item.imageSrc);
        if (inline) {
          parts.push({
            inlineData: {
              mimeType: inline.mimeType,
              data: inline.data,
            },
          });
        }
      } catch (error) {
        console.error("Failed to attach image to live interview context", error);
      }
    }
  }

  return parts;
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === INPUT_SAMPLE_RATE) return input;
  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const low = Math.floor(sourceIndex);
    const high = Math.min(low + 1, input.length - 1);
    const weight = sourceIndex - low;
    result[i] = input[low] * (1 - weight) + input[high] * weight;
  }
  return result;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < float32.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return samples;
}

const PCM_CAPTURE_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input && input.length > 0) {
      this.port.postMessage(new Float32Array(input));
    }
    return true;
  }
}
registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
`;

export async function startLiveInterview(options: {
  personaCard: CanvasItem;
  contextItems: CanvasItem[];
  apiKey: string;
  onStatus?: (status: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}): Promise<LiveInterviewSession> {
  const personaName = options.personaCard.title?.trim() || "Synthetic User";
  let turns: InterviewTurn[] = [];
  let closed = false;
  let session: Session | null = null;
  let mediaStream: MediaStream | null = null;
  let captureContext: AudioContext | null = null;
  let playbackContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let scriptNode: ScriptProcessorNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let workletUrl: string | null = null;
  const activeSources = new Set<AudioBufferSourceNode>();
  let nextPlayTime = 0;

  const clearAudioQueue = () => {
    for (const node of activeSources) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already stopped audio nodes
      }
    }
    activeSources.clear();
    nextPlayTime = 0;
  };

  const enqueueAudioChunk = (base64Pcm: string) => {
    if (!playbackContext || closed) return;
    if (playbackContext.state === "suspended") {
      void playbackContext.resume();
    }
    const samples = base64Pcm16ToFloat32(base64Pcm);
    if (samples.length === 0) return;

    const buffer = playbackContext.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackContext.destination);

    const startAt = Math.max(playbackContext.currentTime, nextPlayTime);
    source.start(startAt);
    nextPlayTime = startAt + buffer.duration;
    activeSources.add(source);
    source.onended = () => {
      activeSources.delete(source);
      source.disconnect();
    };
  };

  const cleanupResources = async () => {
    if (closed) return;
    closed = true;

    clearAudioQueue();

    if (workletNode) {
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      workletNode = null;
    }
    if (scriptNode) {
      scriptNode.onaudioprocess = null;
      scriptNode.disconnect();
      scriptNode = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (workletUrl) {
      URL.revokeObjectURL(workletUrl);
      workletUrl = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (session) {
      try {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // Ignore if socket is already closing
      }
      try {
        session.close();
      } catch {
        // Ignore close errors
      }
      session = null;
    }
    if (captureContext) {
      await captureContext.close().catch(() => {});
      captureContext = null;
    }
    if (playbackContext) {
      await playbackContext.close().catch(() => {});
      playbackContext = null;
    }
  };

  try {
    options.onStatus?.("Requesting microphone...");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    options.onStatus?.("Preparing interview context...");
    const systemPrompt = buildInterviewSystemPrompt(options.personaCard, options.contextItems);
    const contextParts = await buildInterviewContextParts(options.contextItems);

    playbackContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    if (playbackContext.state === "suspended") {
      await playbackContext.resume();
    }

    options.onStatus?.(`Connecting to ${personaName}...`);
    const tokenClient = new GoogleGenAI({ apiKey: options.apiKey, apiVersion: "v1beta" });
    const now = Date.now();
    const token = await tokenClient.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      },
    });
    if (!token.name) {
      throw new Error("Failed to create ephemeral token for live interview.");
    }

    const ai = new GoogleGenAI({ apiKey: token.name, apiVersion: "v1beta" });
    const voiceName = resolvePersonaCardVoice(options.personaCard);

    session = await ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
        systemInstruction: { parts: [{ text: systemPrompt }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          options.onStatus?.(`Interviewing ${personaName}...`);
        },
        onmessage: (message: LiveServerMessage) => {
          const content = message.serverContent;
          if (!content) return;

          if (content.interrupted) {
            clearAudioQueue();
          }

          if (content.modelTurn?.parts) {
            for (const part of content.modelTurn.parts) {
              if (part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith("audio/"))) {
                enqueueAudioChunk(part.inlineData.data);
              }
            }
          }

          if (content.inputTranscription?.text) {
            turns = appendTranscriptChunk(turns, "Interviewer", content.inputTranscription.text);
          }

          if (content.outputTranscription?.text) {
            turns = appendTranscriptChunk(turns, personaName, content.outputTranscription.text);
          }
        },
        onerror: (event: ErrorEvent) => {
          const err = event.error instanceof Error ? event.error : new Error(event.message || "Live interview error");
          options.onError?.(err);
        },
        onclose: () => {
          if (!closed) {
            void cleanupResources().then(() => options.onClose?.());
          }
        },
      },
    });

    if (contextParts.length > 0) {
      session.sendClientContent({
        turns: [{ role: "user", parts: contextParts }],
        turnComplete: false,
      });
    }

    captureContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    if (captureContext.state === "suspended") {
      await captureContext.resume();
    }
    sourceNode = captureContext.createMediaStreamSource(mediaStream);

    const sendFloat32Audio = (chunk: Float32Array) => {
      if (closed || !session || !captureContext) return;
      const resampled = downsampleTo16k(chunk, captureContext.sampleRate);
      const data = float32ToPcm16Base64(resampled);
      try {
        session.sendRealtimeInput({
          audio: { data, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
        });
      } catch {
        // Ignore transient send errors during teardown
      }
    };

    if (captureContext.audioWorklet) {
      workletUrl = URL.createObjectURL(new Blob([PCM_CAPTURE_WORKLET_CODE], { type: "application/javascript" }));
      await captureContext.audioWorklet.addModule(workletUrl);
      workletNode = new AudioWorkletNode(captureContext, "pcm-capture-processor");
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        sendFloat32Audio(event.data);
      };
      sourceNode.connect(workletNode);
    } else {
      scriptNode = captureContext.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (event) => {
        sendFloat32Audio(event.inputBuffer.getChannelData(0));
      };
      sourceNode.connect(scriptNode);
      scriptNode.connect(captureContext.destination);
    }

    options.onStatus?.(`Interviewing ${personaName}...`);

    return {
      stop: async () => {
        await cleanupResources();
        return [...turns];
      },
    };
  } catch (error) {
    await cleanupResources();
    throw error;
  }
}

function getInteractionText(steps: Interactions.Step[] | undefined): string {
  return (steps || [])
    .filter((step): step is Interactions.ModelOutputStep => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((content): content is Interactions.TextContent => content.type === "text")
    .map((content) => content.text)
    .join("");
}

export function summarizeInterview$(input: {
  personaCard: CanvasItem;
  contextItems: CanvasItem[];
  transcript: InterviewTurn[];
  apiKey: string;
}): Observable<InterviewSummary> {
  return new Observable<InterviewSummary>((subscriber) => {
    progress$.next({ ...progress$.value, textGen: progress$.value.textGen + 1 });
    const abortController = new AbortController();

    subscriber.add(() => {
      progress$.next({ ...progress$.value, textGen: Math.max(0, progress$.value.textGen - 1) });
      abortController.abort();
    });

    void (async () => {
      const personaName = input.personaCard.title?.trim() || "Synthetic User";
      const transcriptText = formatInterviewTranscript(input.transcript);
      const discussedItems = input.contextItems
        .map(
          (item, index) =>
            `- Item ${index + 1}${item.title?.trim() ? ` ("${item.title.trim()}")` : ""}${item.body?.trim() ? `: ${item.body.trim()}` : ""}`,
        )
        .join("\n");

      const schema = {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["title", "body"],
      };

      const prompt = `Summarize the following live user-research interview with ${personaName} into concise, actionable design findings for a moodboard card.

Persona Profile:
${input.personaCard.body?.trim() || personaName}
${discussedItems ? `\nDiscussed Canvas Items:\n${discussedItems}\n` : ""}
Interview Transcript:
${transcriptText}

Return a JSON object with:
- "title": a short, descriptive card title (max 6 words) referencing ${personaName} or the main finding.
- "body": a concise summary of key takeaways, pain points, preferences, and design recommendations (3-5 sentences or compact bullet points).`;

      const ai = new GoogleGenAI({ apiKey: input.apiKey });
      const interaction = await ai.interactions.create(
        {
          model: GEMINI_TEXT_MODEL,
          input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { thinking_level: GEMINI_TEXT_THINKING },
          store: false,
        },
        { signal: abortController.signal },
      );

      const text = getInteractionText(interaction.steps);
      if (!text) {
        throw new Error("Gemini returned no interview summary.");
      }

      const parsed = JSON.parse(text) as Partial<InterviewSummary>;
      subscriber.next({
        title: parsed.title?.trim() || `${personaName} Interview Findings`,
        body: parsed.body?.trim() || transcriptText,
      });
      subscriber.complete();
    })().catch((error) => {
      subscriber.error(error);
    });
  });
}
