import { openDB } from "idb";
import { type BehaviorSubject } from "rxjs";
import { skip } from "rxjs/operators";

const DB_NAME = "computational-design-lab-persistence";
const STORE_NAME = "keyval";
const IMAGE_CACHE_STORE = "image-cache";

const dbPromise = openDB(DB_NAME, 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore(STORE_NAME);
    }
    if (oldVersion < 2) {
      db.createObjectStore(IMAGE_CACHE_STORE);
    }
  },
});

export async function get<T>(key: string): Promise<T | undefined> {
  return (await dbPromise).get(STORE_NAME, key);
}

export async function set(key: string, val: any): Promise<void> {
  return void (await dbPromise).put(STORE_NAME, val, key);
}

export async function getCachedImage(key: string): Promise<string | undefined> {
  return (await dbPromise).get(IMAGE_CACHE_STORE, key);
}

export async function setCachedImage(key: string, url: string): Promise<void> {
  return void (await dbPromise).put(IMAGE_CACHE_STORE, url, key);
}

export async function clearAllPersistence(): Promise<void> {
  const db = await dbPromise;
  await db.clear(STORE_NAME);
  await db.clear(IMAGE_CACHE_STORE);
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
