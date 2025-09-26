import { BehaviorSubject, map } from "rxjs";

export interface AppProgress {
  imageGen: number;
  textGen: number;
}

/**
 * If you make any LLM calls to generate text or image, you must track progress here:
 * increment the relevant field when starting a call, and decrement it when the call finishes.
 * Make sure to decrement with the "finally" semantics of rxjs so we can guarantee it always happens even on error.
 *
 */

export const progress$ = new BehaviorSubject<AppProgress>({
  imageGen: 0,
  textGen: 0,
});

export const progressText = progress$.pipe(
  map((status) => {
    const tasks = [];
    if (status.textGen > 0) tasks.push(`Writing ${status.textGen}`);
    if (status.imageGen > 0) tasks.push(`Rendering ${status.imageGen}`);
    return tasks.join(" | ") || "Idle";
  }),
);
