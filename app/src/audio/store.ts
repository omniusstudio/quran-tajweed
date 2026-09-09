// IndexedDB store for the learner's own recordings and the teacher's clips (PROMPT.md §8).

const DB = 'nutq';
const STORE = 'recordings';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredClip {
  blob: Blob;
  mime: string;
  at: number;
}

async function tx(mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putClip(key: string, blob: Blob): Promise<void> {
  const st = await tx('readwrite');
  await new Promise<void>((res, rej) => {
    const r = st.put({ blob, mime: blob.type, at: Date.now() } as StoredClip, key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function getClip(key: string): Promise<StoredClip | undefined> {
  const st = await tx('readonly');
  return new Promise((res, rej) => {
    const r = st.get(key);
    r.onsuccess = () => res(r.result as StoredClip | undefined);
    r.onerror = () => rej(r.error);
  });
}

export async function deleteClip(key: string): Promise<void> {
  const st = await tx('readwrite');
  await new Promise<void>((res, rej) => {
    const r = st.delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function listKeys(prefix: string): Promise<string[]> {
  const st = await tx('readonly');
  return new Promise((res, rej) => {
    const r = st.getAllKeys();
    r.onsuccess = () => res((r.result as string[]).filter((k) => k.startsWith(prefix)));
    r.onerror = () => rej(r.error);
  });
}

/** Pick the best container the browser can record. */
export function recordingMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  return '';
}

export function extensionFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

/** Start recording from the microphone; returns a stop() that resolves with the blob. */
export async function startRecording(): Promise<{ stop: () => Promise<Blob>; stream: MediaStream }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  const mime = recordingMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  return {
    stream,
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }));
        };
        rec.stop();
      }),
  };
}
