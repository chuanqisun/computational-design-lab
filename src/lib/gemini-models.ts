export const GEMINI_TEXT_MODEL = "gemini-4-hydrogen";
export const GEMINI_TEXT_THINKING = "low" as const;

export const GEMINI_REASONING_MODEL = "gemini-4-hydrogen";
export const GEMINI_REASONING_THINKING = "low" as const;

/** Model driving the Auto-Iterate agent loop only; tools keep their own models. */
export const GEMINI_AGENT_MODEL = "gemini-4-neon";
export const GEMINI_AGENT_THINKING = "medium" as const;

export const GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
export const GEMINI_IMAGE_THINKING = "minimal" as const;
export const GEMINI_SEARCH_IMAGE_THINKING = "minimal" as const;
export const GEMINI_IMAGE_EDIT_MODEL = "gemini-nano-banana-2.1";

export const GEMINI_VIDEO_MODEL = "gemini-omni-1.2-flash";
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
