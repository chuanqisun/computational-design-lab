import { BehaviorSubject } from "rxjs";
import type { Actor } from "../actions/types";

export interface ActionRecord {
  id: string;
  timestamp: number;
  actor: Actor;
  action: string;
  args: Record<string, unknown>;
  inputIds: string[];
  outputIds: string[];
  /** Small data URLs (≤96px) of produced cards. */
  outputThumbs: string[];
  summary: string;
  status: "running" | "done" | "error";
  error?: string;
  durationMs?: number;
}

export const ACTION_LOG_CAP = 500;
export const COALESCE_WINDOW_MS = 1500;

export class ActionLog {
  readonly records$: BehaviorSubject<ActionRecord[]>;

  constructor(
    initial: ActionRecord[] = [],
    private readonly now: () => number = () => Date.now(),
  ) {
    this.records$ = new BehaviorSubject<ActionRecord[]>(initial);
  }

  get records(): ActionRecord[] {
    return this.records$.value;
  }

  /**
   * Start a record. With `coalesce`, a consecutive record of the same action and actor within the window
   * is reused (args replaced) instead of appending a new one.
   */
  start(entry: Pick<ActionRecord, "actor" | "action" | "args" | "inputIds">, mode: "record" | "coalesce"): string {
    const timestamp = this.now();
    const records = this.records;
    const last = records.at(-1);

    if (
      mode === "coalesce" &&
      last &&
      last.action === entry.action &&
      last.actor === entry.actor &&
      timestamp - last.timestamp <= COALESCE_WINDOW_MS
    ) {
      const merged: ActionRecord = { ...last, ...entry, timestamp, status: "running", error: undefined };
      this.records$.next([...records.slice(0, -1), merged]);
      return last.id;
    }

    const id = `act-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record: ActionRecord = {
      id,
      timestamp,
      outputIds: [],
      outputThumbs: [],
      summary: "",
      status: "running",
      ...entry,
    };
    const next = [...records, record];
    this.records$.next(next.length > ACTION_LOG_CAP ? next.slice(next.length - ACTION_LOG_CAP) : next);
    return id;
  }

  update(id: string, patch: Partial<ActionRecord>): void {
    const records = this.records;
    if (!records.some((record) => record.id === id)) return;
    this.records$.next(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  }

  clear(): void {
    this.records$.next([]);
  }
}
