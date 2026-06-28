// Convierte el Markdown a HTML estilizado para luego pasarlo a PDF con Chrome
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const inputFile = path.join(__dirname, 'GUIA_DEFINITIVA_NEXTCLOUD_HEXA38.md');
const outputFile = path.join(__dirname, 'GUIA_DEFINITIVA_NEXTCLOUD_HEXA38.html');

const md = fs.readFileSync(inputFile, 'utf-8');

// Configurar marked
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false
});

const htmlBody = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Guía Definitiva — Nextcloud Hexa38</title>
<style>
  @page {
    size: A4;
    margin: 2cm 1.8cm 2cm 1.8cm;
    @top-right {
      content: "Proyecto Nube con Servidor Dedicado Low Cost | Nextcloud";
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      color: #888;
      font-style: italic;
    }
    @bottom-center {
      content: "Página " counter(page);
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      color: #888;
    }
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', 'Calibri', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #2C3E50;
    margin: 0;
    padding: 0;
    max-width: 100%;
  }

  h1, h2, h3, h4, h5, h6 {
    color: #1B5E8C;
    font-weight: 600;
    margin-top: 1.2em;
    margin-bottom: 0.5em;
    page-break-after: avoid;
  }

  h1 {
    font-size: 22pt;
    border-bottom: 3px solid #1B5E8C;
    padding-bottom: 8px;
    margin-top: 0;
    page-break-before: always;
  }

  h1:first-of-type {
    page-break-before: avoid;
  }

  h2 {
    font-size: 16pt;
    border-bottom: 1px solid #2E86C1;
    padding-bottom: 4px;
    margin-top: 1.5em;
  }

  h3 {
    font-size: 13pt;
    color: #2E86C1;
  }

  h4 {
    font-size: 11.5pt;
    color: #2E86C1;
  }

  p {
    margin: 0.6em 0;
    text-align: justify;
  }

  a {
    color: #2E86C1;
    text-decoration: none;
  }

  ul, ol {
    margin: 0.6em 0;
    padding-left: 1.6em;
  }

  li {
    margin: 0.25em 0;
  }

  /* TABLAS */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.8em 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  th {
    background-color: #1B5E8C;
    color: white;
    text-align: left;
    padding: 7px 9px;
    font-weight: 600;
    border: 1px solid #1B5E8C;
  }

  td {
    padding: 6px 9px;
    border: 1px solid #ccc;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background-color: #F5F5F5;
  }

  /* CÓDIGO */
  code {
    background-color: #F0F0F0;
    color: #C7254E;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 9pt;
  }

  pre {
    background-color: #2C3E50;
    color: #ECF0F1;
    padding: 12px 14px;
    border-radius: 5px;
    overflow-x: auto;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 8.5pt;
    line-height: 1.4;
    margin: 0.8em 0;
    page-break-inside: avoid;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  pre code {
    background-color: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  /* BLOCKQUOTES */
  blockquote {
    border-left: 4px solid #2E86C1;
    background-color: #E8F4FD;
    margin: 1em 0;
    padding: 8px 14px;
    color: #2C3E50;
    font-style: italic;
  }

  blockquote p {
    margin: 0.4em 0;
  }

  /* HR */
  hr {
    border: none;
    border-top: 1px solid #CCC;
    margin: 1.5em 0;
  }

  /* CHECKBOXES */
  input[type="checkbox"] {
    margin-right: 6px;
  }

  /* PORTADA */
  .cover {
    text-align: center;
    margin-top: 6cm;
    page-break-after: always;
  }

  .cover h1 {
    font-size: 32pt;
    color: #1B5E8C;
    border: none;
    margin-bottom: 0;
    padding-bottom: 0;
    page-break-before: avoid;
  }

  .cover h2 {
    font-size: 20pt;
    color: #2E86C1;
    border: none;
    font-weight: 400;
    margin-top: 0.3em;
  }

  .cover .subtitle {
    font-size: 14pt;
    color: #555;
    font-style: italic;
    margin: 0.5em 0 3em 0;
  }

  .cover .meta {
    font-size: 12pt;
    color: #444;
    margin-top: 4em;
  }

  .cover .meta p {
    margin: 0.4em 0;
    text-align: center;
  }

  /* Mejorar legibilidad en tablas grandes */
  table.compact {
    font-size: 8.5pt;
  }

  /* Evitar saltos malos */
  table, pre, blockquote {
    page-break-inside: avoid;
  }

  h1, h2, h3, h4 {
    page-break-after: avoid;
  }

</style>
</head>
<body>

<!-- PORTADA -->
<div class="cover">
  <h1>PROYECTO</h1>
  <h2>Nube con Servidor Dedicado Low Cost</h2>
  <p class="subtitle">Guía Definitiva — Infraestructura, Operación, Monitoreo y Mantenimiento</p>

  <div class="meta">
    <p><strong>Stack:</strong> Nextcloud + Docker + Cloudflare Tunnel + Tailscale + MCP</p>
    <p><strong>Versión 3.3</strong> — Junio 2026</p>
    <p>Costo anual: ~$46 USD</p>
  </div>
</div>

<!-- CONTENIDO -->
${htmlBody}

</body>
</html>`;

fs.writeFileSync(outputFile, html, 'utf-8');
console.log('✅ HTML generado:', outputFile);
console.log('Tamaño:', (fs.statSync(outputFile).size / 1024).toFixed(1), 'KB');
