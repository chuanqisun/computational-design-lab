export type PersonaGender = "female" | "male" | "neutral";

export interface GeminiLiveVoiceProfile {
  readonly name: GeminiLiveVoiceName;
  readonly gender: PersonaGender;
  readonly tone: string;
  readonly neutralFriendly?: boolean;
}

export const GEMINI_LIVE_VOICES = [
  { name: "Zephyr", gender: "female", tone: "Bright", neutralFriendly: true },
  { name: "Puck", gender: "male", tone: "Upbeat", neutralFriendly: true },
  { name: "Charon", gender: "male", tone: "Informative" },
  { name: "Kore", gender: "female", tone: "Firm" },
  { name: "Fenrir", gender: "male", tone: "Excitable" },
  { name: "Leda", gender: "female", tone: "Youthful" },
  { name: "Orus", gender: "male", tone: "Firm" },
  { name: "Aoede", gender: "female", tone: "Breezy", neutralFriendly: true },
  { name: "Callirrhoe", gender: "female", tone: "Easy-going", neutralFriendly: true },
  { name: "Autonoe", gender: "female", tone: "Bright" },
  { name: "Enceladus", gender: "male", tone: "Breathy" },
  { name: "Iapetus", gender: "male", tone: "Clear" },
  { name: "Umbriel", gender: "male", tone: "Easy-going", neutralFriendly: true },
  { name: "Algieba", gender: "male", tone: "Smooth" },
  { name: "Despina", gender: "female", tone: "Smooth" },
  { name: "Erinome", gender: "female", tone: "Clear" },
  { name: "Algenib", gender: "male", tone: "Gravelly" },
  { name: "Rasalgethi", gender: "male", tone: "Informative" },
  { name: "Laomedeia", gender: "female", tone: "Upbeat" },
  { name: "Achernar", gender: "female", tone: "Soft" },
  { name: "Alnilam", gender: "male", tone: "Firm" },
  { name: "Schedar", gender: "male", tone: "Even", neutralFriendly: true },
  { name: "Gacrux", gender: "female", tone: "Mature" },
  { name: "Pulcherrima", gender: "neutral", tone: "Forward", neutralFriendly: true },
  { name: "Achird", gender: "male", tone: "Friendly", neutralFriendly: true },
  { name: "Zubenelgenubi", gender: "male", tone: "Casual" },
  { name: "Vindemiatrix", gender: "female", tone: "Gentle" },
  { name: "Sadachbia", gender: "male", tone: "Lively" },
  { name: "Sadaltager", gender: "male", tone: "Knowledgeable" },
  { name: "Sulafat", gender: "female", tone: "Warm", neutralFriendly: true },
] as const;

export type GeminiLiveVoiceName = (typeof GEMINI_LIVE_VOICES)[number]["name"];

export const GEMINI_LIVE_VOICE_NAMES: readonly GeminiLiveVoiceName[] = GEMINI_LIVE_VOICES.map((v) => v.name);

const VOICE_BY_LOWER = new Map<string, GeminiLiveVoiceProfile>(
  GEMINI_LIVE_VOICES.map((v) => [v.name.toLowerCase(), v]),
);

const FEMALE_VOICES = GEMINI_LIVE_VOICES.filter((v) => v.gender === "female");
const MALE_VOICES = GEMINI_LIVE_VOICES.filter((v) => v.gender === "male");
const NEUTRAL_VOICES = GEMINI_LIVE_VOICES.filter((v) => v.gender === "neutral");
const NEUTRAL_FRIENDLY_VOICES = [
  ...NEUTRAL_VOICES,
  ...GEMINI_LIVE_VOICES.filter((v) => v.gender !== "neutral" && "neutralFriendly" in v && v.neutralFriendly),
];

export function normalizePersonaGender(raw: unknown): PersonaGender {
  if (typeof raw !== "string") return "neutral";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "female" || normalized === "woman" || normalized === "f" || normalized === "she/her") {
    return "female";
  }
  if (normalized === "male" || normalized === "man" || normalized === "m" || normalized === "he/him") {
    return "male";
  }
  return "neutral";
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolvePersonaVoice({
  gender,
  voiceName,
  seed = "",
  usedVoices,
}: {
  gender?: unknown;
  voiceName?: unknown;
  seed?: string;
  usedVoices?: ReadonlySet<string>;
}): GeminiLiveVoiceName {
  const normalizedGender = normalizePersonaGender(gender);
  const matched = typeof voiceName === "string" ? VOICE_BY_LOWER.get(voiceName.trim().toLowerCase()) : undefined;

  if (matched) {
    if (normalizedGender === "neutral" || matched.gender === normalizedGender) {
      return matched.name;
    }
  }

  const pool =
    normalizedGender === "female"
      ? FEMALE_VOICES
      : normalizedGender === "male"
        ? MALE_VOICES
        : NEUTRAL_FRIENDLY_VOICES;

  const available = usedVoices ? pool.filter((v) => !usedVoices.has(v.name)) : pool;
  const candidates = available.length > 0 ? available : pool;
  const idx = hashSeed(seed || normalizedGender) % candidates.length;
  return candidates[idx].name;
}

export function formatVoiceCatalogForPrompt(): string {
  const formatGroup = (voices: readonly { readonly name: string; readonly tone: string }[]) =>
    voices.map((v) => `${v.name} (${v.tone})`).join(", ");

  return [
    `Female voices: ${formatGroup(FEMALE_VOICES)}`,
    `Male voices: ${formatGroup(MALE_VOICES)}`,
    `Gender-neutral voice: ${formatGroup(NEUTRAL_VOICES)}`,
    `Additional balanced voices well-suited for gender-neutral / non-binary personas: ${formatGroup(NEUTRAL_FRIENDLY_VOICES.filter((v) => v.gender !== "neutral"))} (or any voice above that best fits the persona's tone)`,
  ].join("\n");
}
