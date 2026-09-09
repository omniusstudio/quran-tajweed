import data from './lessons.json';

export interface Example {
  surah: number;
  surahName: string;
  basri: number;
  kufi: number | null;
  words: string[];
  hit: number[];
  targets: string[];
}
export interface Figure {
  img: string | null;
  caption: string;
}
export interface Rule {
  id: string;
  name: string;
  text: string;
  figures: Figure[];
  examples: Example[];
}
export interface Section {
  id: string;
  title: string;
  intro: string | null;
  rules: Rule[];
}

export const SECTIONS: Section[] = data.sections as Section[];
export const RULES: Record<string, Rule> = Object.fromEntries(SECTIONS.flatMap((s) => s.rules.map((r) => [r.id, r])));
