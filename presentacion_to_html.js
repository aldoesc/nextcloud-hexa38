// Convierte la presentación Markdown a HTML estilizado para PDF (Chrome)
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const inputFile = path.join(__dirname, 'PRESENTACION_PROYECTO_NUBE.md');
const outputFile = path.join(__dirname, 'PRESENTACION_PROYECTO_NUBE.html');

marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false });
const htmlBody = marked.parse(fs.readFileSync(inputFile, 'utf-8'));

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Proyecto Nube — Presentación</title>
<style>
  @page {
    size: A4;
    margin: 1.8cm 1.7cm 1.8cm 1.7cm;
    @top-right {
      content: "Nube Personal · Servidor Dedicado Low Cost";
      font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #9aa; font-style: italic;
    }
    @bottom-center {
      content: "Página " counter(page);
      font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #9aa;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Calibri', Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.55; color: #243447; margin: 0; padding: 0;
  }
  h1, h2, h3, h4 { color: #14507d; font-weight: 600; margin-top: 1.1em; margin-bottom: 0.45em; page-break-after: avoid; }
  h1 {
    font-size: 21pt; border-bottom: 3px solid #14507d; padding-bottom: 7px;
    margin-top: 0; page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-size: 15pt; border-bottom: 1px solid #2E86C1; padding-bottom: 3px; margin-top: 1.3em; }
  h3 { font-size: 12.5pt; color: #2E86C1; }
  p { margin: 0.55em 0; text-align: justify; }
  a { color: #2E86C1; text-decoration: none; }
  ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
  li { margin: 0.22em 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.7em 0; font-size: 9.5pt; page-break-inside: avoid; }
  th { background-color: #14507d; color: #fff; text-align: left; padding: 7px 9px; font-weight: 600; border: 1px solid #14507d; }
  td { padding: 6px 9px; border: 1px solid #ccd; vertical-align: top; }
  tr:nth-child(even) td { background-color: #F4F8FB; }
  code { background-color: #EEF2F5; color: #C7254E; padding: 1px 5px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 9pt; }
  pre {
    background-color: #1f2d3d; color: #ECF0F1; padding: 12px 14px; border-radius: 5px;
    overflow-x: auto; font-family: 'Consolas', monospace; font-size: 8.5pt; line-height: 1.4;
    margin: 0.7em 0; page-break-inside: avoid; white-space: pre-wrap; word-wrap: break-word;
  }
  pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
  blockquote {
    border-left: 4px solid #2E86C1; background-color: #E9F4FC; margin: 0.9em 0;
    padding: 8px 14px; color: #243447; font-style: italic;
  }
  blockquote p { margin: 0.35em 0; }
  hr { border: none; border-top: 1px solid #d3dae0; margin: 1.4em 0; }
  /* PORTADA */
  .cover { text-align: center; margin-top: 5.5cm; page-break-after: always; }
  .cover .tag { font-size: 11pt; letter-spacing: 3px; color: #2E86C1; text-transform: uppercase; }
  .cover h1 { font-size: 34pt; color: #14507d; border: none; margin: 0.15em 0 0 0; padding: 0; page-break-before: avoid; }
  .cover h2 { font-size: 17pt; color: #2E86C1; border: none; font-weight: 400; margin-top: 0.2em; }
  .cover .subtitle { font-size: 13pt; color: #5a6b7a; font-style: italic; margin: 1.4em 0 3em 0; }
  .cover .meta { font-size: 11.5pt; color: #444; margin-top: 3.5em; }
  .cover .meta p { margin: 0.35em 0; text-align: center; }
  .cover .badges { margin-top: 2.2em; font-size: 10.5pt; color: #14507d; }
</style>
</head>
<body>

<div class="cover">
  <div class="tag">Proyecto de Infraestructura</div>
  <h1>NUBE PERSONAL</h1>
  <h2>Servidor Dedicado Low Cost</h2>
  <p class="subtitle">Nextcloud · Docker · Cloudflare Tunnel · Tailscale · MCP</p>
  <div class="badges">
    🔒 Seguro &nbsp;·&nbsp; 💾 Backup 3-2-1 &nbsp;·&nbsp; 📡 Monitoreo en 3 capas &nbsp;·&nbsp; 🧠 Gestión con IA
  </div>
  <div class="meta">
    <p><strong>Documento de presentación y estudio</strong></p>
    <p>Junio 2026 · Costo anual ~$46 USD</p>
  </div>
</div>

${htmlBody}

</body>
</html>`;

fs.writeFileSync(outputFile, html, 'utf-8');
console.log('HTML generado:', outputFile, '-', (fs.statSync(outputFile).size / 1024).toFixed(1), 'KB');
