import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

// Dos frases de 12 tokens: inicios en 0 y 12.
function sentences(lengths: number[]): TimedToken[] {
  const out: TimedToken[] = [];
  for (const len of lengths) {
    for (let j = 0; j < len; j++) {
      const last = j === len - 1;
      out.push(last ? { text: 'fin.', sentenceEnd: true, sentenceLength: len } : { text: 'la', sentenceLength: len });
    }
  }
  return out;
}

function playAndPauseAt(target: number) {
  const clock = new FakeClock();
  const player = createPlayer({ tokens: sentences([12, 12]), clock, wpm: 300 });
  player.play();
  clock.advanceUntil(() => player.index === target);
  clock.advance(20); // en mitad del token
  player.pause();
  expect(player.playing).toBe(false);
  expect(player.index).toBe(target);
  return { clock, player };
}

describe('[MH-30] reanudar tras una pausa larga', () => {
  it('[MH-30] pausa de más de 3000 ms → al dar play vuelve al inicio de la frase actual', () => {
    const { clock, player } = playAndPauseAt(15);
    const pausedAt = clock.now();
    clock.advance(3500);
    expect(clock.now() - pausedAt).toBeGreaterThan(3000);
    player.play();
    clock.advance(1);
    expect(player.playing).toBe(true);
    expect(player.index).toBe(12);
  });

  it('[MH-30] pausa de 2000 ms → sigue donde estaba', () => {
    const { clock, player } = playAndPauseAt(15);
    clock.advance(2000);
    player.play();
    clock.advance(1);
    expect(player.playing).toBe(true);
    // Según se re-muestre el token actual o se pase al siguiente, 15 o 16; nunca el inicio de frase.
    expect([15, 16]).toContain(player.index);
  });

  it('[MH-30] en la primera frase, pausa larga vuelve a 0', () => {
    const { clock, player } = playAndPauseAt(6);
    clock.advance(4000);
    player.play();
    clock.advance(1);
    expect(player.index).toBe(0);
  });
});
