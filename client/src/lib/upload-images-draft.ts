const DATABASE_NAME = "aska-upload-image-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";
const SESSION_ID_STORAGE_KEY = "aska.upload-image-draft-session";
const MAX_DRAFT_AGE_MS = 30 * 60 * 1_000;

export type UploadImagesDraft = {
  open: boolean;
  mode: "local" | "remote";
  remoteUrl: string;
  remoteUrls: string[];
  files: File[];
  updatedAt: number;
};

type UploadImagesDraftRecord = UploadImagesDraft & { id: string };
type StoredUploadImagesDraftRecord = Omit<
  UploadImagesDraftRecord,
  "remoteUrls"
> & {
  remoteUrls?: unknown;
};

let databasePromise: Promise<IDBDatabase> | undefined;

// IndexedDB preserves File objects, while this tab-scoped ID survives refreshes.
// Board placement is deliberately excluded: the live board store remains authoritative.
export function getUploadImagesDraftId(
  workspaceSlug: string,
  collectionPath: string,
): string | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  try {
    const sessionId = getSessionId();
    return JSON.stringify([sessionId, workspaceSlug, collectionPath]);
  } catch {
    return null;
  }
}

export async function loadUploadImagesDraft(
  id: string,
): Promise<UploadImagesDraft | null> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const completed = transactionComplete(transaction);
  pruneExpiredDrafts(store);
  const record = await requestResult<StoredUploadImagesDraftRecord | undefined>(
    store.get(id),
  );

  if (!record || isExpired(record.updatedAt) || !isValidDraft(record)) {
    if (record) store.delete(id);
    await completed;
    return null;
  }

  await completed;
  return {
    ...record,
    // Existing drafts predate URL chips; retain their files and typed URL.
    remoteUrls: Array.isArray(record.remoteUrls) ? record.remoteUrls : [],
  };
}

export async function saveUploadImagesDraft(
  id: string,
  draft: Omit<UploadImagesDraft, "updatedAt">,
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const completed = transactionComplete(transaction);

  store.put({
    id,
    ...draft,
    updatedAt: Date.now(),
  } satisfies UploadImagesDraftRecord);
  pruneExpiredDrafts(store);

  await completed;
}

export async function clearUploadImagesDraft(id: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const completed = transactionComplete(transaction);
  transaction.objectStore(STORE_NAME).delete(id);
  await completed;
}

export async function pruneExpiredUploadImagesDrafts(): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const completed = transactionComplete(transaction);
  pruneExpiredDrafts(transaction.objectStore(STORE_NAME));
  await completed;
}

function getSessionId(): string {
  const existingSessionId = window.sessionStorage.getItem(
    SESSION_ID_STORAGE_KEY,
  );
  if (existingSessionId) return existingSessionId;

  const sessionId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  return sessionId;
}

function getDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(STORE_NAME)
          ? request.transaction!.objectStore(STORE_NAME)
          : database.createObjectStore(STORE_NAME, { keyPath: "id" });

        if (!store.indexNames.contains("updatedAt")) {
          store.createIndex("updatedAt", "updatedAt");
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

function pruneExpiredDrafts(store: IDBObjectStore) {
  const cutoff = Date.now() - MAX_DRAFT_AGE_MS;
  const request = store
    .index("updatedAt")
    .openCursor(IDBKeyRange.upperBound(cutoff));

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
}

function isExpired(updatedAt: number): boolean {
  return (
    !Number.isFinite(updatedAt) || Date.now() - updatedAt > MAX_DRAFT_AGE_MS
  );
}

function isValidDraft(record: StoredUploadImagesDraftRecord): boolean {
  return (
    (record.mode === "local" || record.mode === "remote") &&
    typeof record.open === "boolean" &&
    typeof record.remoteUrl === "string" &&
    (record.remoteUrls === undefined ||
      (Array.isArray(record.remoteUrls) &&
        record.remoteUrls.every((url) => typeof url === "string"))) &&
    Array.isArray(record.files)
  );
}
