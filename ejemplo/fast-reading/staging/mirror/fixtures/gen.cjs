// Genera los PDFs de prueba y la solución del sintético de párrafos (MH-5).
// Uso: node gen.cjs <ruta a fast-reading>   (usa pdf-lib del proyecto)
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const repo = process.argv[2];
if (!repo) { console.error('uso: node gen.cjs <repo>'); process.exit(2); }
const { PDFDocument, StandardFonts, rgb } = require(require.resolve('pdf-lib', { paths: [repo] }));
const out = __dirname;

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const SENTENCES = [
  'El cerebro del niño cambia con cada experiencia que vive.',
  'Los padres pueden ayudar a integrar las dos mitades del cerebro.',
  'Cuando una emoción fuerte aparece, conviene nombrarla con calma.',
  'Contar lo que ha pasado ayuda a ordenar los recuerdos.',
  'La parte de arriba del cerebro tarda años en madurar del todo.',
  'Un niño que se siente escuchado se calma antes.',
  'Las rabietas son también una oportunidad para enseñar.',
  'Mover el cuerpo cambia el estado de ánimo de forma sorprendente.',
  'La memoria implícita guarda cosas que no sabemos que recordamos.',
  'Hablar de los sentimientos los vuelve más manejables.',
  'Cada familia encuentra su propio ritmo con el tiempo.',
  'Jugar juntos fortalece la conexión entre padres e hijos.',
  'Antes de corregir, conviene conectar con lo que siente el niño.',
  'La atención es como un foco que podemos aprender a dirigir.',
  'Nadie es un padre perfecto, y no hace falta serlo.',
  'Los hermanos aprenden a convivir a base de pequeños conflictos.',
];

function paragraphText(nSent) {
  const s = [];
  for (let i = 0; i < nSent; i++) s.push(SENTENCES[Math.floor(rand() * SENTENCES.length)]);
  return s.join(' ');
}

function wrap(words, font, size, width, firstIndent) {
  const lines = [];
  let cur = [];
  let indent = firstIndent;
  for (const w of words) {
    const test = [...cur, w].join(' ');
    if (cur.length && font.widthOfTextAtSize(test, size) + indent > width) {
      lines.push({ text: cur.join(' '), indent });
      cur = [w];
      indent = 0;
    } else cur.push(w);
  }
  if (cur.length) lines.push({ text: cur.join(' '), indent });
  return lines;
}

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function paragraphs() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const png = await doc.embedPng(PNG_1x1);
  const W = 360, H = 480, M = 40, SIZE = 11, LH = 15, GAP = 12, INDENT = 18;
  const words = [];
  const starts = [];
  let page = doc.addPage([W, H]);
  let y = H - M;
  let linesOnPages = 0;
  let imageInserted = false;

  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const imagePage = () => {
    const p = doc.addPage([W, H]);
    p.drawImage(png, { x: M, y: M, width: W - 2 * M, height: H - 2 * M });
  };

  const N = 18;
  for (let p = 0; p < N; p++) {
    const text = paragraphText(2 + Math.floor(rand() * 4));
    const pw = text.split(/\s+/);
    // Estilos: sangría (por defecto) o hueco sin sangría. Si el párrafo cae en lo alto de página, siempre sangría.
    let style = p % 3 === 2 ? 'gap' : 'indent';
    if (style === 'gap') y -= GAP;
    if (y - LH < M) { newPage(); }
    if (y >= H - M - 0.1) style = 'indent';
    starts.push(words.length);
    words.push(...pw);
    const lines = wrap(pw, font, SIZE, W - 2 * M, style === 'indent' ? INDENT : 0);
    lines.forEach((ln, i) => {
      if (y - LH < M) newPage();
      // Una página que solo es imagen en mitad de una frase, una sola vez.
      if (!imageInserted && p >= 6 && i === 1 && lines.length > 2) {
        imagePage();
        newPage();
        imageInserted = true;
      }
      page.drawText(ln.text, { x: M + ln.indent, y: y - SIZE, size: SIZE, font, color: rgb(0, 0, 0) });
      y -= LH;
      linesOnPages++;
    });
  }
  if (!imageInserted) throw new Error('no se insertó la página de imagen');
  fs.writeFileSync(path.join(out, 'paragraphs.pdf'), await doc.save());
  fs.writeFileSync(path.join(out, 'paragraphs.truth.json'), JSON.stringify({ words, paragraphStarts: starts, pageCount: doc.getPageCount() }, null, 2));
  return doc.getPageCount();
}

async function sample() {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const W = 400, H = 560, M = 44, SIZE = 12, LH = 17;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const put = (t, font, indent = 0) => { if (y - LH < M) { page = doc.addPage([W, H]); y = H - M; } page.drawText(t, { x: M + indent, y: y - SIZE, size: SIZE, font }); y -= LH; };
  put('CAPÍTULO UNO', bold);
  y -= 10;
  const paras = [
    'El cerebro del niño cambia con cada experiencia. Los padres pueden ayudar a integrar sus partes, y eso se nota en el día a día. ¿Por qué ocurre esto? Porque las conexiones se refuerzan con el uso.',
    'Cuando aparece una emoción fuerte, conviene nombrarla con calma: «¡Estás enfadado!», dijo la madre. Después, el niño pudo contar lo que había pasado, paso a paso, sin prisa.',
    'La parte de arriba del cerebro tarda años en madurar. Por eso no podemos exigir a un niño de cuatro años lo mismo que a uno de doce. Mientras tanto, nuestra tarea es acompañar.',
    'Jugar juntos fortalece la conexión. Leer un cuento antes de dormir, inventar canciones o simplemente escuchar son pequeños gestos con un efecto enorme a largo plazo.',
  ];
  for (const t of paras) {
    for (const ln of wrap(t.split(' '), body, SIZE, W - 2 * M, 18)) put(ln.text, body, ln.indent);
    y -= 6;
  }
  fs.writeFileSync(path.join(out, 'sample.pdf'), await doc.save());
}

async function noText() {
  const doc = await PDFDocument.create();
  const p = doc.addPage([300, 300]);
  p.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(0.2, 0.4, 0.8) });
  fs.writeFileSync(path.join(out, 'notext.pdf'), await doc.save());
}

function encrypted() {
  execFileSync('qpdf', ['--encrypt', 'usuario', 'propietario', '256', '--', path.join(out, 'sample.pdf'), path.join(out, 'encrypted.pdf')]);
}

function corrupt() {
  const bytes = Buffer.alloc(4096);
  Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R').copy(bytes);
  for (let i = 60; i < bytes.length; i++) bytes[i] = Math.floor(rand() * 256);
  fs.writeFileSync(path.join(out, 'corrupt.pdf'), bytes);
}

function notPdf() {
  fs.writeFileSync(path.join(out, 'imagen-con-extension.pdf'), PNG_1x1);
}

(async () => {
  const pages = await paragraphs();
  await sample();
  await noText();
  encrypted();
  corrupt();
  notPdf();
  console.log(`ok · paragraphs.pdf ${pages} páginas`);
})().catch((e) => { console.error(e); process.exit(1); });
