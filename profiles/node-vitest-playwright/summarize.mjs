// Resume resultados de Vitest y Playwright por feature. Uso: node summarize.mjs <tmpdir> <MH-XX>...
// Asocia cada fichero a su feature por el nombre: mh-07.test.ts → MH-07.
import fs from 'node:fs';
import path from 'node:path';
const [tmp, ...features] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8')); } catch { return null; } };
const tail = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8').slice(-1500); } catch { return ''; } };
const cut = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1200);
const out = {};
for (const f of features) out[f] = { passed: 0, failed: 0, skipped: 0, errors: [] };
const idOf = (file) => { const m = /mh-(\d+)\./i.exec(file); return m ? `MH-${m[1]}` : null; };

const vit = read('vitest.json');
const seen = new Set();
if (vit) {
  for (const file of vit.testResults ?? []) {
    const id = idOf(file.name); if (!id || !out[id]) continue;
    seen.add(id);
    const r = out[id];
    for (const a of file.assertionResults ?? []) {
      if (a.status === 'passed') r.passed++;
      else if (a.status === 'failed') { r.failed++; r.errors.push(`${a.fullName}: ${cut((a.failureMessages ?? []).join('\n'))}`); }
      else r.skipped++;
    }
    if (file.status === 'failed' && !(file.assertionResults ?? []).length) r.errors.push(`no carga: ${cut(file.message)}`);
  }
}
const e2e = read('e2e.json');
if (e2e) {
  const walk = (s) => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(walk)];
  for (const spec of (e2e.suites ?? []).flatMap(walk)) {
    const id = idOf(spec.file); if (!id || !out[id]) continue;
    seen.add(id);
    const r = out[id];
    for (const t of spec.tests ?? []) {
      const res = t.results?.[t.results.length - 1];
      if (t.status === 'skipped') r.skipped++;
      else if (res?.status === 'passed') r.passed++;
      else { r.failed++; r.errors.push(`${spec.title}: ${cut(res?.error?.message ?? res?.status)}`); }
    }
  }
  const e2eIds = (process.env.E2E_IDS ?? '').split(',').filter(Boolean);
  for (const e of e2e.errors ?? []) for (const f of e2eIds) if (out[f]) out[f].errors.push(`playwright: ${cut(e.message)}`);
}
for (const f of features) {
  const r = out[f];
  if (!seen.has(f) && !r.errors.length) r.errors.push(`sin resultados. log: ${cut(tail('vitest.log') || tail('e2e.log'))}`);
  r.errors = r.errors.slice(0, 8);
}
process.stdout.write(JSON.stringify(out));
