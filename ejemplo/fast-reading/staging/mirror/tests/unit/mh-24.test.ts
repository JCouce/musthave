import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

function shortTokens(n: number): TimedToken[] {
  const pool = ['la', 'de', 'el', 'un', 'en', 'sol', 'mar', 'pan'];
  return Array.from({ length: n }, (_, i) => ({ text: pool[i % pool.length] }));
}

function diffs(at: number[]): number[] {
  return at.slice(1).map((t, i) => t - at[i]);
}

describe('[MH-24] rampa de arranque', () => {
  it('[MH-24] a 300 wpm: empieza al 60 %, baja de forma monótona y desde el token 20 va al 100 %', () => {
    const clock = new FakeClock();
    const at: number[] = [];
    const idx: number[] = [];
    const player = createPlayer({
      tokens: shortTokens(40),
      clock,
      wpm: 300,
      onWord: (i, t) => { idx.push(i); at.push(t); },
    });
    player.play();
    clock.runAll();
    expect(idx).toEqual(Array.from({ length: 40 }, (_, i) => i));
    const d = diffs(at); // d[i] = duración del token i

    expect(d[0]).toBeGreaterThanOrEqual(200);
    expect(Math.abs(d[0] - 60000 / (0.6 * 300))).toBeLessThanOrEqual(1);

    for (let i = 0; i < 20; i++) {
      expect(d[i + 1]).toBeLessThanOrEqual(d[i] + 1e-6);
    }
    for (let i = 20; i < d.length; i++) {
      expect(Math.abs(d[i] - 200)).toBeLessThanOrEqual(1);
    }
  });

  it('[MH-24] a 1000 wpm el primer token dura al menos 200 ms', () => {
    const clock = new FakeClock();
    const at: number[] = [];
    const player = createPlayer({
      tokens: shortTokens(40),
      clock,
      wpm: 1000,
      onWord: (_i, t) => { at.push(t); },
    });
    player.play();
    clock.runAll();
    const d = diffs(at);
    expect(d[0]).toBeGreaterThanOrEqual(200 - 1e-6);
    for (let i = 20; i < d.length; i++) {
      expect(Math.abs(d[i] - 60)).toBeLessThanOrEqual(1);
    }
  });

  it('[MH-24] un segundo play() tras una pausa vuelve a empezar la rampa', () => {
    const clock = new FakeClock();
    const events: { i: number; t: number }[] = [];
    const player = createPlayer({
      tokens: shortTokens(80),
      clock,
      wpm: 300,
      onWord: (i, t) => { events.push({ i, t }); },
    });
    player.play();
    clock.advanceUntil(() => events.length >= 31);
    clock.advance(50); // en mitad del token 30, ya fuera de rampa
    player.pause();
    const before = events.length;
    clock.advance(1000); // < 3000 ms: no entra en juego el retroceso de MH-30
    expect(events.length).toBe(before);

    player.play();
    clock.runAll();
    const after = events.slice(before).map((e) => e.t);
    expect(after.length).toBeGreaterThan(22);
    const d = diffs(after);
    expect(d[0]).toBeGreaterThanOrEqual(200);
    expect(Math.abs(d[0] - 60000 / (0.6 * 300))).toBeLessThanOrEqual(1);
    for (let i = 0; i < 20; i++) {
      expect(d[i + 1]).toBeLessThanOrEqual(d[i] + 1e-6);
    }
    for (let i = 20; i < d.length; i++) {
      expect(Math.abs(d[i] - 200)).toBeLessThanOrEqual(1);
    }
  });
});
