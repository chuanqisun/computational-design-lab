import { catchError, ignoreElements, mergeMap, Observable, of, Subject, takeUntil } from "rxjs";

export type Task = Observable<unknown>;

const taskQueue$ = new Subject<Task>();

/** Single cancellation signal for UI tasks, in-flight actions and the agent loop. */
export const stop$ = new Subject<void>();

export const submitTask = (task$: Task) => {
  taskQueue$.next(task$);
};

export const stopAllTasks = () => {
  stop$.next();
};

/** AbortSignal that aborts on the next `stop$` emission. */
export const createAbortSignal = (): AbortSignal => {
  const controller = new AbortController();
  const sub = stop$.subscribe(() => {
    controller.abort();
    sub.unsubscribe();
  });
  return controller.signal;
};

export const taskRunner$ = taskQueue$.pipe(
  mergeMap((task$) =>
    task$.pipe(
      takeUntil(stop$),
      catchError((error) => {
        const message = error instanceof Error ? error.message : "Task failed.";
        console.error(`Task error: ${message}`);
        alert(message);
        return of(undefined);
      }),
    ),
  ),
  ignoreElements(),
);
