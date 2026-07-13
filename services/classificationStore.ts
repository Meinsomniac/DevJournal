let classifyingIds = new Set<string>();
let listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getClassifyingIds(): ReadonlySet<string> {
  return classifyingIds;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function clearClassifyingIds(): void {
  classifyingIds = new Set();
  notify();
}