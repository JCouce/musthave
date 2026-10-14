import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

function shortTokens(n: number): TimedToken[] {
  const pool = ['la', 'de', 'el', 'un', 'en', 'sol', 'mar', 'pan'];
  return Array.from({ length: n }, (_, i) => ({ text: pool[i % pool.length] }));
}

describe('[MH-27] fin del libro', () => {
  it('[MH-27] al terminar: onEnd una vez, se para en el último token y no vuelve al principio', () => {
    const clock = new FakeClock();
    const idx: number[] = [];
    let ended = 0;
    const player = createPlayer({
      tokens: shortTokens(10),
      clock,
      wpm: 300,
      onWord: (i) => { idx.push(i); },
      onEnd: () => { ended++; },
    });
    player.play();
    clock.runAll();

    expect(idx).toEqual(Array.from({ length: 10 }, (_, i) => i));
    expect(ended).toBe(1);
    expect(player.playing).toBe(false);
    expect(player.index).toBe(9);

    clock.advance(60000);
    expect(idx.length).toBe(10);
    expect(ended).toBe(1);
    expect(player.index).toBe(9);

    // play() al final no peta ni rebobina por sí solo.
    const seen = idx.length;
    expect(() => {
      player.play();
      clock.advance(10000);
    }).not.toThrow();
    expect(player.index).toBe(9);
    for (const i of idx.slice(seen)) expect(i).toBe(9);
  });
});
