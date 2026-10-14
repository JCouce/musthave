import { describe, it, expect, vi, afterEach } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createStore, type Store } from '@/persist/store';
import type { Book } from '@/core/types';

const bookA: Book = {
  words: ['Hola', 'mundo.', 'Capítulo', 'uno', 'Era', 'tarde.'],
  paragraphStarts: [0, 4],
  titles: [{ start: 2, end: 4, text: 'Capítulo uno' }],
  pageCount: 3,
};
const bookB: Book = {
  words: ['Otro', 'libro', 'distinto.'],
  paragraphStarts: [0],
  titles: [],
  pageCount: 1,
};

// IDBFactory falso cuyo open() emite un evento error de forma asíncrona.
class FailingRequest extends EventTarget {
  result: unknown = undefined;
  error: DOMException | null = new DOMException('IndexedDB no disponible', 'UnknownError');
  readyState = 'done';
  source = null;
  transaction = null;
  onerror: ((ev: Event) => void) | null = null;
  onsuccess: ((ev: Event) => void) | null = null;
  onupgradeneeded: ((ev: Event) => void) | null = null;
  onblocked: ((ev: Event) => void) | null = null;
}
function erroringFactory(): IDBFactory {
  return {
    open() {
      const req = new FailingRequest();
      setTimeout(() => {
        const ev = new Event('error');
        req.dispatchEvent(ev);
        req.onerror?.call(req, ev);
      }, 0);
      return req;
    },
    deleteDatabase() {
      throw new DOMException('no', 'UnknownError');
    },
    cmp() {
      return 0;
    },
    databases: async () => [],
  } as unknown as IDBFactory;
}
function throwingFactory(): IDBFactory {
  return {
    open() {
      throw new DOMException('El acceso a IndexedDB está bloqueado', 'SecurityError');
    },
    deleteDatabase() {
      throw new DOMException('no', 'SecurityError');
    },
    cmp() {
      return 0;
    },
    databases: async () => [],
  } as unknown as IDBFactory;
}

async function exerciseInMemory(store: Store) {
  await expect(store.saveBook('k1', bookA)).resolves.toBeUndefined();
  expect(await store.loadBook('k1')).toEqual(bookA);
  await store.saveProgress('k1', { index: 3, wpm: 350 });
  expect(await store.loadProgress('k1')).toEqual({ index: 3, wpm: 350 });
  await store.setLastBook('k1');
  expect(await store.getLastBook()).toBe('k1');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('[MH-17] store con IndexedDB disponible', () => {
  it('[MH-17] mode "idb" sin warning; guarda y recupera libro, progreso y último libro', async () => {
    const store = await createStore(new IDBFactory());
    expect(store.mode).toBe('idb');
    expect(store.warning).toBeNull();
    expect(await store.loadBook('nada')).toBeNull();
    expect(await store.loadProgress('nada')).toBeNull();
    expect(await store.getLastBook()).toBeNull();
    await store.saveBook('k1', bookA);
    await store.saveBook('k2', bookB);
    expect(await store.loadBook('k1')).toEqual(bookA);
    expect(await store.loadBook('k2')).toEqual(bookB);
    await store.saveProgress('k1', { index: 4, wpm: 325 });
    await store.saveProgress('k1', { index: 5, wpm: 400 });
    expect(await store.loadProgress('k1')).toEqual({ index: 5, wpm: 400 });
    await store.setLastBook('k2');
    expect(await store.getLastBook()).toBe('k2');
  });

  it('[MH-17] los datos persisten en IndexedDB entre instancias del store', async () => {
    const factory = new IDBFactory();
    const s1 = await createStore(factory);
    await s1.saveBook('k1', bookA);
    await s1.saveProgress('k1', { index: 2, wpm: 500 });
    await s1.setLastBook('k1');
    const s2 = await createStore(factory);
    expect(s2.mode).toBe('idb');
    expect(await s2.loadBook('k1')).toEqual(bookA);
    expect(await s2.loadProgress('k1')).toEqual({ index: 2, wpm: 500 });
    expect(await s2.getLastBook()).toBe('k1');
  });
});

describe('[MH-17] IndexedDB caído', () => {
  it('[MH-17] createStore(null) → memoria con aviso, y funciona', async () => {
    const store = await createStore(null);
    expect(store.mode).toBe('memory');
    expect(typeof store.warning).toBe('string');
    expect(store.warning!.length).toBeGreaterThan(0);
    await exerciseInMemory(store);
  });

  it('[MH-17] open() que emite error → memoria con aviso, y funciona', async () => {
    const store = await createStore(erroringFactory());
    expect(store.mode).toBe('memory');
    expect(store.warning?.length ?? 0).toBeGreaterThan(0);
    await exerciseInMemory(store);
  });

  it('[MH-17] open() que lanza → memoria con aviso, y funciona', async () => {
    const store = await createStore(throwingFactory());
    expect(store.mode).toBe('memory');
    expect(store.warning?.length ?? 0).toBeGreaterThan(0);
    await exerciseInMemory(store);
  });
});

describe('[MH-17] QuotaExceededError al escribir', () => {
  it('[MH-17] saveBook no rechaza, pasa a memoria, avisa y conserva lo guardado en la sesión', async () => {
    const store = await createStore(new IDBFactory());
    expect(store.mode).toBe('idb');
    await store.saveBook('k1', bookA);
    await store.saveProgress('k1', { index: 1, wpm: 300 });
    await store.setLastBook('k1');

    const quota = () => {
      throw new DOMException('No queda espacio', 'QuotaExceededError');
    };
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(quota);
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(quota);

    await expect(store.saveBook('k2', bookB)).resolves.toBeUndefined();
    expect(store.mode).toBe('memory');
    expect(store.warning?.length ?? 0).toBeGreaterThan(0);
    expect(await store.loadBook('k2')).toEqual(bookB);
    // lo guardado antes del fallo sigue accesible
    expect(await store.loadBook('k1')).toEqual(bookA);
    expect(await store.loadProgress('k1')).toEqual({ index: 1, wpm: 300 });
    expect(await store.getLastBook()).toBe('k1');
    // y se sigue pudiendo escribir en memoria
    await expect(store.saveProgress('k2', { index: 2, wpm: 450 })).resolves.toBeUndefined();
    expect(await store.loadProgress('k2')).toEqual({ index: 2, wpm: 450 });
    await expect(store.setLastBook('k2')).resolves.toBeUndefined();
    expect(await store.getLastBook()).toBe('k2');
  });

  it('[MH-17] QuotaExceededError en saveProgress tampoco rechaza', async () => {
    const store = await createStore(new IDBFactory());
    await store.saveBook('k1', bookA);
    const quota = () => {
      throw new DOMException('No queda espacio', 'QuotaExceededError');
    };
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(quota);
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(quota);
    await expect(store.saveProgress('k1', { index: 3, wpm: 300 })).resolves.toBeUndefined();
    expect(store.mode).toBe('memory');
    expect(store.warning?.length ?? 0).toBeGreaterThan(0);
    expect(await store.loadProgress('k1')).toEqual({ index: 3, wpm: 300 });
    expect(await store.loadBook('k1')).toEqual(bookA);
  });
});
