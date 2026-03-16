export type PromptTextValue = string | string[] | undefined;

export function toTextLines(value: PromptTextValue): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

export function toTextBlock(value: PromptTextValue, fallback = ""): string {
  const text = toTextLines(value).join("\n");
  return text || fallback;
}

export function toInlineText(value: PromptTextValue, fallback = ""): string {
  const text = toTextLines(value).join(", ");
  return text || fallback;
}
