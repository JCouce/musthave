// Reloj falso determinista para los tests del reproductor. Compatible con `Clock` de @/core/player.

export interface FakeClockOptions {
  start?: number;
  /** Retraso extra (ms, >= 0) que se suma a cada setTimeout en el momento de programarlo. */
  jitter?: () => number;
}

interface Timer {
  id: number;
  due: number;
  seq: number;
  fn: () => void;
}

export class FakeClock {
  private t: number;
  private seq = 0;
  private nextId = 1;
  private timers: Timer[] = [];
  private readonly jitter?: () => number;

  constructor(opts: FakeClockOptions = {}) {
    this.t = opts.start ?? 0;
    this.jitter = opts.jitter;
  }

  now = (): number => this.t;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    const extra = this.jitter ? Math.max(0, this.jitter()) : 0;
    const timer: Timer = { id: this.nextId++, due: this.t + delay + extra, seq: this.seq++, fn };
    this.timers.push(timer);
    return timer.id;
  };

  clearTimeout = (handle: unknown): void => {
    this.timers = this.timers.filter((tm) => tm.id !== handle);
  };

  get pending(): number {
    return this.timers.length;
  }

  private popEarliest(limit: number): Timer | undefined {
    let best = -1;
    for (let i = 0; i < this.timers.length; i++) {
      const tm = this.timers[i];
      if (tm.due > limit) continue;
      if (best < 0) { best = i; continue; }
      const b = this.timers[best];
      if (tm.due < b.due || (tm.due === b.due && tm.seq < b.seq)) best = i;
    }
    if (best < 0) return undefined;
    return this.timers.splice(best, 1)[0];
  }

  /** Avanza el reloj `ms`, disparando en orden todos los timers que venzan por el camino. */
  advance(ms: number): void {
    const target = this.t + Math.max(0, ms);
    let guard = 0;
    for (;;) {
      const tm = this.popEarliest(target);
      if (!tm) break;
      if (++guard > 1_000_000) throw new Error('FakeClock.advance: demasiados timers (¿bucle infinito?)');
      this.t = Math.max(this.t, tm.due);
      tm.fn();
    }
    this.t = target;
  }

  /** Dispara timers hasta que no quede ninguno. */
  runAll(maxTimers = 1_000_000): void {
    let guard = 0;
    for (;;) {
      const tm = this.popEarliest(Infinity);
      if (!tm) return;
      if (++guard > maxTimers) throw new Error('FakeClock.runAll: demasiados timers (¿bucle infinito?)');
      this.t = Math.max(this.t, tm.due);
      tm.fn();
    }
  }

  /** Avanza en pasos de `step` ms hasta que `pred()` sea cierto. Lanza si no ocurre en `maxMs`. */
  advanceUntil(pred: () => boolean, step = 1, maxMs = 10_000_000): void {
    let elapsed = 0;
    while (!pred()) {
      if (elapsed >= maxMs) throw new Error('FakeClock.advanceUntil: la condición no se cumplió');
      this.advance(step);
      elapsed += step;
    }
  }
}

/** PRNG determinista (mulberry32) en [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jitter aleatorio determinista en [0, maxMs]. */
export function seededJitter(seed: number, maxMs: number): () => number {
  const rnd = seededRandom(seed);
  return () => rnd() * maxMs;
}
