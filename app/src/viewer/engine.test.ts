import { describe, expect, it } from 'vitest';
import { ARTICULATIONS, BY_ID, CONTRAST_PAIRS } from './articulations';
import { LANDMARKS, LIP_POINTS, LIP_STATES, SIDE_POINTS, SIDE_SHAPES, TOP_POINTS, TOP_SHAPES, tongueAllowedAt } from './artwork';
import { sampleState, validate } from './engine';

const STEPS = 60;

describe('traced artwork', () => {
  it('every side-view shape has the same number of points, ordered from the tongue root', () => {
    for (const [name, pts] of Object.entries(SIDE_SHAPES)) {
      expect(pts, name).toHaveLength(SIDE_POINTS);
      const [x0, y0] = pts[0];
      expect(x0 + y0, `${name} starts at the bottom-right (root)`).toBeGreaterThan(1200);
    }
  });

  it('every top-view and lips shape is consistently sized', () => {
    for (const [name, pts] of Object.entries(TOP_SHAPES)) expect(pts, name).toHaveLength(TOP_POINTS);
    for (const [name, st] of Object.entries(LIP_STATES)) {
      expect(st.outer, `${name}.outer`).toHaveLength(LIP_POINTS);
      expect(st.inner, `${name}.inner`).toHaveLength(LIP_POINTS);
    }
  });

  it('found every contact point in the annotated images', () => {
    for (const [k, v] of Object.entries(LANDMARKS)) {
      if ('c' in v) expect(v.r, k).toBeGreaterThan(20);
      else expect(v[0], k).toBeGreaterThan(0);
    }
    expect(LANDMARKS.qaf[0]).toBeGreaterThan(LANDMARKS.kaf[0]); // ق is further back than ك
    expect(LANDMARKS.throat1[1]).toBeGreaterThan(LANDMARKS.throat2[1]);
    expect(LANDMARKS.throat2[1]).toBeGreaterThan(LANDMARKS.throat3[1]);
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
      expect(sampleState(a, 0).phase, a.id).toBe('rest');
      expect(sampleState(a, 1).phase, a.id).toBe('rest');
      expect(sampleState(a, 0).velum, a.id).toBe(0);
    }
  });

  it('hold the jaw on one of the three drawn positions (no permanent crossfade ghosting)', () => {
    for (const a of ARTICULATIONS) {
      for (const k of a.keyframes) {
        if (k.phase === 'hold' || k.phase === 'contact') expect([0, 0.5, 1], `${a.id} jaw=${k.jaw}`).toContain(k.jaw);
      }
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
        for (let k = 0; k < SIDE_POINTS; k++) maxJump = Math.max(maxJump, Math.hypot(s.tongue[k][0] - prev.tongue[k][0], s.tongue[k][1] - prev.tongue[k][1]));
        // 1/240 of a 2.6 s cycle is ~11 ms; in 1024-px artwork space a release moves ~20 px in that time
        expect(maxJump, `${a.id} at t=${i / (STEPS * 4)}`).toBeLessThan(a.id.startsWith('ra') ? 30 : 22);
        prev = s;
      }
    }
  });

  it('shows the contact dot only during the contact/hold phases', () => {
    for (const a of ARTICULATIONS) {
      const hasContact = a.keyframes.some((k) => k.contact);
      if (!hasContact) continue;
      expect(sampleState(a, 0.02).contact?.opacity ?? 0, `${a.id} at rest`).toBe(0);
      const holdKf = a.keyframes.find((k) => k.contact)!;
      expect(sampleState(a, holdKf.t + 0.01).contact?.opacity ?? 0, `${a.id} in contact`).toBeGreaterThan(0.5);
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
    for (const id of ['qaf', 'ba', 'sin', 'alif_madd']) expect(sampleState(BY_ID[id], 0.45).velum, id).toBeGreaterThan(0.95);
  });
});

describe('anatomical plausibility (PROMPT.md §9)', () => {
  it('the interpolated tongue never leaves the region the artwork itself draws it in', () => {
    for (const a of ARTICULATIONS) {
      for (let i = 0; i <= STEPS; i++) {
        const s = sampleState(a, i / STEPS);
        // a linear morph may clip a corner (e.g. the ث tip sweeping past the lower incisors); allow a few points
        const outside = s.tongue.filter(([x, y]) => !tongueAllowedAt(x, y));
        expect(outside.length, `${a.id} t=${(i / STEPS).toFixed(2)}: ${outside.length} points outside the drawn envelope, first at (${outside[0]?.[0].toFixed(0)}, ${outside[0]?.[1].toFixed(0)})`).toBeLessThanOrEqual(SIDE_POINTS * 0.05);
      }
    }
  });

  it('lips close fully for ب and م, and the tip protrudes for ث ذ ظ', () => {
    for (const id of ['ba', 'mim', 'ghunnah_mim']) expect(sampleState(BY_ID[id], 0.45).lips.openness, id).toBeLessThan(0.02);
    const restTip = Math.min(...SIDE_SHAPES.rest.map((p) => p[0]));
    for (const id of ['tha', 'dhal', 'zha']) {
      const tip = Math.min(...sampleState(BY_ID[id], 0.5).tongue.map((p) => p[0]));
      expect(tip, `${id} tip forward of the rest position`).toBeLessThan(restTip - 60);
    }
  });

  it('imālah keeps the back of the tongue lower than the heavy shape', () => {
    const im = sampleState(BY_ID.imalah, 0.5).tongue;
    const hv = SIDE_SHAPES.heavy;
    const backTop = (pts: [number, number][]) => Math.min(...pts.filter((p) => p[0] > 600).map((p) => p[1]));
    expect(backTop(im)).toBeGreaterThan(backTop(hv) - 5);
  });
});
