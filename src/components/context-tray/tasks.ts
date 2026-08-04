import { catchError, ignoreElements, mergeMap, Observable, of, Subject, takeUntil } from "rxjs";

export type Task = Observable<unknown>;

const taskQueue$ = new Subject<Task>();
const stopTasks$ = new Subject<void>();

export const submitTask = (task$: Task) => {
  taskQueue$.next(task$);
};

export const stopAllTasks = () => {
  stopTasks$.next();
};

export const taskRunner$ = taskQueue$.pipe(
  mergeMap((task$) =>
    task$.pipe(
      takeUntil(stopTasks$),
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
