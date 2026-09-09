import { describe, expect, it } from 'vitest';
import { ARTICULATIONS, BY_ID, CONTRAST_PAIRS } from './articulations';
import { sampleState, validate } from './engine';
import { LIP_KINDS, SHAPES, resample, roofY, TONGUE_N } from './geometry';
import type { LipKind } from './types';

const STEPS = 60;

describe('geometry', () => {
  it('resamples every shape to TONGUE_N points, front to back', () => {
    for (const [name, pts] of Object.entries(SHAPES)) {
      const r = resample(pts);
      expect(r, name).toHaveLength(TONGUE_N);
      expect(r[0][0], `${name} starts at the front`).toBeLessThan(r[r.length - 1][0]);
      expect(r[0]).toEqual(pts[0]);
    }
  });

  it('defines every lip kind', () => {
    const kinds: LipKind[] = ['rest', 'closed', 'rounded', 'teeth_on_lip', 'open', 'narrow', 'spread'];
    for (const k of kinds) expect(LIP_KINDS[k]).toBeDefined();
  });
});

describe('articulations', () => {
  it('are all well-formed', () => {
    for (const a of ARTICULATIONS) expect(() => validate(a), a.id).not.toThrow();
  });

  it('have unique ids', () => {
    const ids = ARTICULATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contrast pairs reference existing articulations', () => {
    for (const p of CONTRAST_PAIRS) {
      expect(BY_ID[p.a], `${p.id}.a`).toBeDefined();
      expect(BY_ID[p.b], `${p.id}.b`).toBeDefined();
    }
  });

  it('cover all 28 letters plus hamzah', () => {
    const letters = 'ءبتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
    const shown = ARTICULATIONS.filter((a) => !a.wrong).map((a) => a.letters.replace(/[ً-ْ]/g, '')).join('');
    for (const l of letters) expect(shown, `letter ${l}`).toContain(l === 'ه' ? 'هـ' : l);
  });

  it('start and end at rest with the velum open (breathing)', () => {
    for (const a of ARTICULATIONS) {
      const s0 = sampleState(a, 0);
      const s1 = sampleState(a, 1);
      expect(s0.phase, a.id).toBe('rest');
      expect(s1.phase, a.id).toBe('rest');
      expect(s0.velum, a.id).toBe(0);
    }
  });
});

describe('keyframe engine', () => {
  it('produces continuous motion (no jumps between adjacent frames)', () => {
    for (const a of ARTICULATIONS) {
      let prev = sampleState(a, 0);
      for (let i = 1; i <= STEPS * 4; i++) {
        const s = sampleState(a, i / (STEPS * 4));
        let maxJump = 0;
        for (let k = 0; k < TONGUE_N; k++) maxJump = Math.max(maxJump, Math.hypot(s.tongue[k][0] - prev.tongue[k][0], s.tongue[k][1] - prev.tongue[k][1]));
        // 1/240 of a 2.6 s cycle is ~11 ms; a plosive release may move ~8 px in that time, the ر flap a little more
        expect(maxJump, `${a.id} at t=${i / (STEPS * 4)}`).toBeLessThan(a.id.startsWith('ra') ? 10 : 8);
        prev = s;
      }
    }
  });

  it('shows the contact dot only during the contact/hold phases', () => {
    for (const a of ARTICULATIONS) {
      const hasContact = a.keyframes.some((k) => k.contact);
      if (!hasContact) continue;
      const s = sampleState(a, 0.02);
      expect(s.contact?.opacity ?? 0, `${a.id} at rest`).toBe(0);
      const holdKf = a.keyframes.find((k) => k.contact)!;
      const mid = sampleState(a, holdKf.t + 0.01);
      expect(mid.contact?.opacity ?? 0, `${a.id} in contact`).toBeGreaterThan(0.5);
    }
  });

  it('ticks the harakah counter through the hold phase', () => {
    for (const a of ARTICULATIONS.filter((x) => x.harakat)) {
      const holds = a.keyframes.filter((k) => k.phase === 'hold');
      expect(holds.length, a.id).toBeGreaterThanOrEqual(2);
      const start = holds[0].t;
      const end = holds[holds.length - 1].t;
      expect(sampleState(a, start + 0.001).hold).toBeCloseTo(0, 1);
      expect(sampleState(a, end - 0.001).hold).toBeCloseTo(1, 1);
      expect(sampleState(a, 0.05).hold).toBe(0);
    }
  });

  it('opens the velum for every nasal sound and closes it for oral holds', () => {
    for (const id of ['nun', 'mim', 'ghunnah_nun', 'ghunnah_mim']) {
      const s = sampleState(BY_ID[id], 0.5);
      expect(s.velum, id).toBeLessThan(0.05);
      expect(s.airflow?.type, id).toBe('nasal');
    }
    for (const id of ['qaf', 'ba', 'sin', 'alif_madd']) {
      expect(sampleState(BY_ID[id], 0.45).velum, id).toBeGreaterThan(0.95);
    }
  });
});

describe('anatomical plausibility (PROMPT.md §9)', () => {
  it('the tongue never passes through the roof of the mouth or the pharynx wall', () => {
    for (const a of ARTICULATIONS) {
      for (let i = 0; i <= STEPS; i++) {
        const s = sampleState(a, i / STEPS);
        for (const [x, y] of s.tongue) {
          expect(x, `${a.id} t=${i / STEPS}: tongue behind the pharynx wall`).toBeLessThan(322);
          const roof = roofY(x);
          if (Number.isFinite(roof)) expect(y, `${a.id} t=${i / STEPS}: tongue above the roof at x=${x.toFixed(0)}`).toBeGreaterThanOrEqual(roof - 2.5);
        }
      }
    }
  });

  it('contact points sit on the roof, the teeth, or in the throat', () => {
    for (const a of ARTICULATIONS) {
      for (const k of a.keyframes) {
        if (!k.contact || k.contactKind === 'near') continue;
        const [x, y] = k.contact;
        const roof = roofY(x);
        if (Number.isFinite(roof) && x >= 104 && y < 200) expect(Math.abs(y - roof), `${a.id} contact off the roof`).toBeLessThan(8);
      }
    }
  });

  it('lips close fully for ب and م, and the tip protrudes for ث ذ ظ', () => {
    for (const id of ['ba', 'mim', 'ghunnah_mim']) expect(sampleState(BY_ID[id], 0.45).lips.open, id).toBeLessThan(0.02);
    for (const id of ['tha', 'dhal', 'zha']) {
      const s = sampleState(BY_ID[id], 0.5);
      expect(s.tongue[0][0], `${id} tip past the upper incisors`).toBeLessThan(92);
      expect(s.top.forward, id).toBeGreaterThan(0.9);
    }
  });

  it('ق contacts further back than ك, and imālah keeps the back of the tongue low', () => {
    const q = BY_ID.qaf.keyframes.find((k) => k.contact)!.contact![0];
    const k = BY_ID.kaf.keyframes.find((k) => k.contact)!.contact![0];
    expect(q).toBeGreaterThan(k);
    const im = sampleState(BY_ID.imalah, 0.5).tongue;
    const back = im.filter((p) => p[0] > 250);
    for (const p of back) expect(p[1], 'imālah back stays low').toBeGreaterThan(150);
  });
});
