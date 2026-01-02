import { openDB } from "idb";
import { type BehaviorSubject } from "rxjs";
import { skip } from "rxjs/operators";

const DB_NAME = "computational-design-lab-persistence";
const STORE_NAME = "keyval";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME);
  },
});

export async function get<T>(key: string): Promise<T | undefined> {
  return (await dbPromise).get(STORE_NAME, key);
}

export async function set(key: string, val: any): Promise<void> {
  return void (await dbPromise).put(STORE_NAME, val, key);
}

/**
 * Synchronizes a BehaviorSubject with IndexedDB.
 * Loads the initial value from DB and subscribes to future changes.
 */
export function persistSubject<T>(subject: BehaviorSubject<T>, key: string): void {
  // Load initial value
  get<T>(key).then((value) => {
    if (value !== undefined) {
      subject.next(value);
    }
  });

  // Persist changes, skipping the initial default value of the BehaviorSubject
  subject.pipe(skip(1)).subscribe((value) => {
    set(key, value);
  });
}
