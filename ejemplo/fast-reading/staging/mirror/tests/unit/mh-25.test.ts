import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

function shortTokens(n: number): TimedToken[] {
  const pool = ['la', 'de', 'el', 'un', 'en', 'sol', 'mar', 'pan'];
  return Array.from({ length: n }, (_, i) => ({ text: pool[i % pool.length] }));
}

describe('[MH-25] cambio de WPM en marcha', () => {
  it('[MH-25] setWpm tras el token 30 ni salta ni repite tokens y aplica el nuevo ritmo desde el siguiente', () => {
    const clock = new FakeClock();
    const idx: number[] = [];
    const at: number[] = [];
    const player = createPlayer({
      tokens: shortTokens(60),
      clock,
      wpm: 300,
      onWord: (i, t) => { idx.push(i); at.push(t); },
    });
    player.play();
    clock.advanceUntil(() => idx.length >= 31); // se acaba de mostrar el token 30
    clock.advance(1);
    expect(idx[idx.length - 1]).toBe(30);
    player.setWpm(600);
    expect(player.wpm).toBe(600);
    clock.runAll();

    expect(idx).toEqual(Array.from({ length: 60 }, (_, i) => i));
    const d = at.slice(1).map((t, i) => t - at[i]);
    for (let i = 20; i < 30; i++) {
      expect(Math.abs(d[i] - 200)).toBeLessThanOrEqual(1);
    }
    // d[30] (token en pantalla durante el cambio) no se comprueba.
    for (let i = 31; i < d.length; i++) {
      expect(Math.abs(d[i] - 100)).toBeLessThanOrEqual(1);
    }
  });

  it('[MH-25] por defecto 300 wpm y setWpm se limita a 100–1000', () => {
    const player = createPlayer({ tokens: shortTokens(10), clock: new FakeClock() });
    expect(player.wpm).toBe(300);
    player.setWpm(50);
    expect(player.wpm).toBe(100);
    player.setWpm(5000);
    expect(player.wpm).toBe(1000);
    player.setWpm(450);
    expect(player.wpm).toBe(450);
  });

  it('[MH-25] el clamp se refleja en las duraciones (5000 → 1000 wpm → 60 ms por token)', () => {
    const clock = new FakeClock();
    const at: number[] = [];
    const player = createPlayer({ tokens: shortTokens(40), clock, wpm: 300, onWord: (_i, t) => { at.push(t); } });
    player.setWpm(5000);
    player.play();
    clock.runAll();
    const d = at.slice(1).map((t, i) => t - at[i]);
    expect(d.length).toBe(39);
    for (let i = 20; i < d.length; i++) {
      expect(Math.abs(d[i] - 60)).toBeLessThanOrEqual(1);
    }
  });
});
