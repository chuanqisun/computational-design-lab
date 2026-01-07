import { BehaviorSubject, map } from "rxjs";
import { stopAllTasks } from "../context-tray/tasks";

export interface AppProgress {
  imageGen: number;
  textGen: number;
  videoGen: number;
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
  videoGen: 0,
});

export const progressText = progress$.pipe(
  map((status) => {
    const tasks = [];
    if (status.textGen > 0) tasks.push(`Writing ${status.textGen}`);
    if (status.imageGen > 0) tasks.push(`Rendering ${status.imageGen}`);
    if (status.videoGen > 0) tasks.push(`Directing ${status.videoGen}`);
    return tasks.join(" | ") || "Idle";
  }),
);

export const hasActiveTasks = progress$.pipe(
  map((status) => status.imageGen > 0 || status.textGen > 0 || status.videoGen > 0),
);

export const stopTasks = () => {
  stopAllTasks();
};
