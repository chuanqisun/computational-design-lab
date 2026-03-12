import Handlebars from "handlebars";

export function registerHelpers() {
  Handlebars.registerHelper("inlineList", (items: unknown) => {
    if (!Array.isArray(items) || items.length === 0) return "";
    const strings = items.map(String);
    if (strings.length === 1) return strings[0];
    if (strings.length === 2) return `${strings[0]} and ${strings[1]}`;
    return strings.slice(0, -1).join(", ") + ", and " + strings[strings.length - 1];
  });

  Handlebars.registerHelper("newlineList", (items: unknown) => {
    if (!Array.isArray(items) || items.length === 0) return "";
    return items.map(String).join("\n");
  });

  Handlebars.registerHelper("bulletList", (items: unknown) => {
    if (!Array.isArray(items) || items.length === 0) return "";
    return items.map((item) => `- ${String(item)}`).join("\n");
  });
}

export function renderTemplate(templateSource: string, variables: Record<string, unknown>): string {
  const compiled = Handlebars.compile(templateSource, { noEscape: true });
  return compiled(variables);
}
