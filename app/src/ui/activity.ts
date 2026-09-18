// Who is using the app right now? Audio that is playing or a recording in progress counts as
// activity, so the ambient screen never takes over in the middle of a recitation.

const busy = new Set<string>();

export function setBusy(key: string, on: boolean) {
  if (on) busy.add(key);
  else busy.delete(key);
}

export function isBusy(): boolean {
  return busy.size > 0;
}
