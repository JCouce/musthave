import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { Visibility } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

function shortTokens(n: number): TimedToken[] {
  const pool = ['la', 'de', 'el', 'un', 'en', 'sol', 'mar', 'pan'];
  return Array.from({ length: n }, (_, i) => ({ text: pool[i % pool.length] }));
}

class FakeVisibility implements Visibility {
  hidden = false;
  readonly callbacks: (() => void)[] = [];
  onChange(cb: () => void): void { this.callbacks.push(cb); }
  set(hidden: boolean): void {
    this.hidden = hidden;
    for (const cb of [...this.callbacks]) cb();
  }
}

describe('[MH-26] pausa automática al ocultar la pestaña', () => {
  it('[MH-26] reproduciendo, hidden=true pausa y no llegan más onWord', () => {
    const clock = new FakeClock();
    const visibility = new FakeVisibility();
    let words = 0;
    const player = createPlayer({
      tokens: shortTokens(200),
      clock,
      wpm: 300,
      visibility,
      onWord: () => { words++; },
    });
    player.play();
    clock.advance(1500);
    expect(player.playing).toBe(true);
    expect(words).toBeGreaterThan(0);
    expect(visibility.callbacks.length).toBeGreaterThan(0);

    visibility.set(true);
    expect(player.playing).toBe(false);
    const frozen = words;
    const index = player.index;
    clock.advance(20000);
    expect(words).toBe(frozen);
    expect(player.index).toBe(index);
    expect(player.playing).toBe(false);
  });
});
