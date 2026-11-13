import { useSyncExternalStore } from 'react';
import { emptyProgress, importProgress, type Progress } from '@kcna/engine';

// Progress lives in localStorage under one versioned key. It is small (well
// under 1 MB even after thousands of answers), synchronous to read, and easy to
// export/import. Each origin (GitHub Pages vs Hugging Face) has its own copy.
export const STORAGE_KEY = 'kcna-progress-v1';

let state: Progress = load();
const listeners = new Set<() => void>();
let storageOk = true;

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? importProgress(raw) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false; // private mode / quota: keep working in memory
  }
}

export function getProgress(): Progress {
  return state;
}

export function setProgress(next: Progress) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function updateProgress(fn: (p: Progress) => Progress) {
  setProgress(fn(state));
}

export function storageAvailable() {
  return storageOk;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// keep tabs in sync
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}

export function download(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
