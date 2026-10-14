// Config del oráculo. Se copia a <repo>/.oracle/; testDir y cwd son relativos a este fichero.
// Si tu app no es Vite, cambia webServer.command (y SERVE_CMD en project.env para el evaluador).
export default {
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: { baseURL: 'http://localhost:4173', browserName: 'chromium', headless: true },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180000,
  },
};
