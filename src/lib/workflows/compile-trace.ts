import type { ActionRecord } from "./action-log";

/** Canonical JSON (sorted keys) so `{a,b}` and `{b,a}` compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const isSelect = (record: ActionRecord) => record.action === "select_cards";

function isEmptySelection(record: ActionRecord): boolean {
  if (!isSelect(record)) return false;
  const mode = (record.args.mode as string | undefined) ?? "replace";
  const ids = (record.args.cardIds as string[] | undefined) ?? [];
  return mode === "none" || ((mode === "replace" || mode === "add") && ids.length === 0);
}

/** Whether an action relies on the selection: it targets cards but names none explicitly. */
const usesSelection = (record: ActionRecord, targetsCards: (action: string) => boolean) =>
  !isSelect(record) &&
  targetsCards(record.action) &&
  !Array.isArray(record.args.cardIds) &&
  typeof record.args.cardId !== "string" &&
  !Array.isArray(record.args.moves);

function mergeInto(target: ActionRecord, next: ActionRecord, args: Record<string, unknown>): ActionRecord {
  return {
    ...target,
    args,
    outputIds: [...new Set([...target.outputIds, ...next.outputIds])],
    outputThumbs: [...target.outputThumbs, ...next.outputThumbs],
    summary: next.summary || target.summary,
    timestamp: next.timestamp,
  };
}

/**
 * "Compile" recorded actions into meaningful workflow steps:
 * drop failed/unfinished actions and selections with no effect on later steps,
 * collapse consecutive duplicates, and merge consecutive moves and same-card edits.
 */
export function compileTrace(
  records: ActionRecord[],
  /** Whether an action takes target cards (defaults to all actions). */
  targetsCards: (action: string) => boolean = () => true,
): ActionRecord[] {
  const done = records.filter((record) => record.status === "done" && !isEmptySelection(record));
  // Dropping selections can make new neighbors identical, so merge again afterwards.
  return mergeAdjacent(dropIneffectiveSelections(mergeAdjacent(done), targetsCards));
}

function mergeAdjacent(records: ActionRecord[]): ActionRecord[] {
  const merged: ActionRecord[] = [];
  for (const record of records) {
    const last = merged.at(-1);
    if (last && last.action === record.action) {
      if (isSelect(record)) {
        merged[merged.length - 1] = mergeInto(last, record, record.args); // later selection supersedes
        continue;
      }
      if (record.action === "move_cards" && Array.isArray(last.args.moves) && Array.isArray(record.args.moves)) {
        const byId = new Map<string, unknown>();
        for (const move of [...(last.args.moves as { id: string }[]), ...(record.args.moves as { id: string }[])]) {
          byId.delete(move.id);
          byId.set(move.id, move);
        }
        const order = [
          ...new Set(
            [...(last.args.moves as { id: string }[]), ...(record.args.moves as { id: string }[])].map((m) => m.id),
          ),
        ];
        merged[merged.length - 1] = mergeInto(last, record, { ...last.args, moves: order.map((id) => byId.get(id)) });
        continue;
      }
      if (record.action === "edit_card" && last.args.cardId === record.args.cardId) {
        merged[merged.length - 1] = mergeInto(last, record, { ...last.args, ...record.args });
        continue;
      }
      if (canonical(last.args) === canonical(record.args)) {
        merged[merged.length - 1] = mergeInto(last, record, last.args);
        continue;
      }
    }
    merged.push(record);
  }
  return merged;
}

/** Keep a selection only if the next non-selection step relies on it. */
function dropIneffectiveSelections(merged: ActionRecord[], targetsCards: (action: string) => boolean): ActionRecord[] {
  return merged.filter((record, index) => {
    if (!isSelect(record)) return true;
    const next = merged.slice(index + 1).find((candidate) => !isSelect(candidate));
    return !!next && usesSelection(next, targetsCards);
  });
}
