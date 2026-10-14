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
    // Los tests leen sus ficheros de prueba de aquí: process.env.FIXTURES
    env: { FIXTURES: path.join(oracle, 'fixtures') },
  },
};
