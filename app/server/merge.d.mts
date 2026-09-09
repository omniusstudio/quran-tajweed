export interface SyncState {
  v: 1;
  progress: Record<string, unknown> | null;
  deck: Record<string, unknown>;
  settings: Record<string, unknown> | null;
  alignments: Record<string, { updatedAt: number; [k: string]: unknown }>;
}
export function mergeState(a: SyncState | null, b: SyncState | null): SyncState | null;
export function mergeProgress(a: unknown, b: unknown): unknown;
export function mergeDeck(a: unknown, b: unknown): unknown;
export function newer<T extends { updatedAt?: number }>(a: T | null | undefined, b: T | null | undefined): T | null;
export function mergeAlignments(a: unknown, b: unknown): unknown;
