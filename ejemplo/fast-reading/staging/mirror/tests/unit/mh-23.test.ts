import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock, seededJitter } from './helpers/fake-clock';

// Tokens cortos sin puntuación: multiplicador ×1 y ninguna pantalla en blanco.
function shortTokens(n: number): TimedToken[] {
  const pool = ['la', 'de', 'el', 'un', 'en', 'sol', 'mar', 'pan'];
  return Array.from({ length: n }, (_, i) => ({ text: pool[i % pool.length] }));
}

function run(jitter?: () => number): { idx: number[]; at: number[]; ended: number } {
  const clock = new FakeClock({ jitter });
  const idx: number[] = [];
  const at: number[] = [];
  let ended = 0;
  const player = createPlayer({
    tokens: shortTokens(1000),
    clock,
    wpm: 300,
    onWord: (i, t) => { idx.push(i); at.push(t); },
    onEnd: () => { ended++; },
  });
  player.play();
  clock.runAll();
  return { idx, at, ended };
}

describe('[MH-23] sin drift: instantes acumulados desde el play', () => {
  const A = run();
  const B = run(seededJitter(23, 8));

  it('[MH-23] ambas ejecuciones muestran los 1000 tokens en orden', () => {
    const expected = Array.from({ length: 1000 }, (_, i) => i);
    expect(A.idx).toEqual(expected);
    expect(B.idx).toEqual(expected);
    expect(A.ended).toBe(1);
    expect(B.ended).toBe(1);
  });

  it('[MH-23] con jitter ≤ 8 ms por tick, el último onWord no se desvía más de un tick', () => {
    const lastA = A.at[A.at.length - 1];
    const lastB = B.at[B.at.length - 1];
    expect(Math.abs(lastB - lastA)).toBeLessThanOrEqual(8.5);
  });

  it('[MH-23] ningún onWord con jitter llega antes que su homólogo sin jitter, ni acumula más de un tick', () => {
    for (let i = 0; i < 1000; i++) {
      expect(B.at[i]).toBeGreaterThanOrEqual(A.at[i] - 1e-6);
      expect(B.at[i] - A.at[i]).toBeLessThanOrEqual(8.5);
    }
  });
});
