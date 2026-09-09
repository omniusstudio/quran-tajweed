/** Tiny event bus: stores announce a local change; the sync module pushes it to the local server. */
export function changed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nutq:changed'));
}
