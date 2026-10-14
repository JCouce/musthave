// Config del oráculo. Se copia a <repo>/.oracle/ y se ejecuta con --root <repo>.
import path from 'node:path';
const root = process.cwd();
const oracle = path.join(root, '.oracle');
export default {
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    include: ['.oracle/tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    env: {
      FIXTURES: path.join(oracle, 'fixtures'),
      RSVP_BOOK: path.join(oracle, 'fixtures', 'book.pdf'),
    },
  },
};
