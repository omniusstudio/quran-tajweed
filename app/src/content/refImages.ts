// Annotated reference illustrations, imported straight from the repo's images/ folder.
const mods = import.meta.glob('../../../images/annotated/*.png', { eager: true, import: 'default' }) as Record<string, string>;

export function refImage(name: string): string | undefined {
  for (const k of Object.keys(mods)) if (k.endsWith(`/${name}.png`)) return mods[k];
  return undefined;
}
