import { BehaviorSubject } from "rxjs";

export interface AppProgress {
  imageGen: number;
  textGen: number;
}

export const progress$ = new BehaviorSubject<AppProgress>({
  imageGen: 0,
  textGen: 0,
});
