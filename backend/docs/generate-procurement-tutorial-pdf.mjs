/**
 * Generate bilingual (ID + EN) procurement tutorial as .md, .html, and .pdf
 * Usage: node generate-procurement-tutorial-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const idMdPath = path.join(__dirname, 'procurement-tutorial.md');
const enJsonPath = path.join(__dirname, 'procurement-tutorial-en.json');
const cssPath = path.join(__dirname, 'procurement-tutorial-pdf.css');
const outMdPath = path.join(__dirname, 'procurement-tutorial-bilingual.md');
const outHtmlPath = path.join(__dirname, 'procurement-tutorial-bilingual.html');
const outPdfPath = path.join(__dirname, 'procurement-tutorial-bilingual.pdf');

const idContent = fs.readFileSync(idMdPath, 'utf8');
const enData = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

const enById = new Map(enData.sections.map((s) => [s.id, s]));

function extractSectionNumber(headerLine) {
  const m = headerLine.match(/^##\s+(\d+)\./);
  return m ? m[1] : null;
}

function extractSectionTitle(headerLine) {
  const m = headerLine.match(/^##\s+\d+\.\s+(.+)$/);
  return m ? m[1].trim() : headerLine.replace(/^##\s+/, '').trim();
}

function isAppendix(headerLine) {
  return /checklist go-live/i.test(headerLine);
}

function wrapLang(label, cssClass, content) {
  return `<div class="lang-block ${cssClass}">\n<span class="lang-label">${label}</span>\n\n${content.trim()}\n</div>\n`;
}

function splitSections(markdown) {
  const lines = markdown.split('\n');
  const introLines = [];
  const sections = [];
  let current = null;
  let inIntro = true;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      inIntro = false;
      if (current) sections.push(current);
      current = { header: line, body: [] };
      continue;
    }
    if (inIntro) introLines.push(line);
    else if (current) current.body.push(line);
  }
  if (current) sections.push(current);

  return { introLines, sections };
}

function sectionKey(header) {
  const num = extractSectionNumber(header);
  if (num) return num;
  if (isAppendix(header)) return 'appendix';
  return null;
}

function buildToc(sections, enByIdMap) {
  const items = sections
    .filter((s) => {
      const key = sectionKey(s.header);
      const titleId = extractSectionTitle(s.header);
      return key || !/daftar isi/i.test(titleId);
    })
    .map((s) => {
      const key = sectionKey(s.header);
      const titleId = extractSectionTitle(s.header);
      const en = key ? enByIdMap.get(key) : null;
      const titleEn = en?.titleEn ?? titleId;
      return `<li><strong>${titleId}</strong> / <em>${titleEn}</em></li>`;
    })
    .join('\n');

  return `<div class="toc">\n\n## Daftar Isi / Table of Contents\n\n<ol>\n${items}\n</ol>\n\n</div>\n\n---\n\n`;
}

function buildBilingualMarkdown() {
  const { introLines, sections } = splitSections(idContent);

  let md = `# ${enData.docTitleId}\n\n`;
  md += `# ${enData.docTitleEn}\n\n`;
  md += `> **Versi / Version:** Agustus / August 2026  \n`;
  md += `> **Target:** End users / Pengguna akhir\n\n`;
  md += `---\n\n`;

  md += wrapLang('Bahasa Indonesia', 'lang-id', enData.docSubtitleId);
  md += wrapLang('English', 'lang-en', enData.docSubtitleEn);
  md += `\n---\n\n`;

  md += buildToc(sections, enById);

  for (const section of sections) {
    const key = sectionKey(section.header);
    const titleId = extractSectionTitle(section.header);
    // Skip embedded table-of-contents section from source ID file
    if (!key && /daftar isi/i.test(titleId)) continue;
    const bodyId = section.body.join('\n').trim();
    const en = key ? enById.get(key) : null;
    const titleEn = en?.titleEn ?? titleId;
    const bodyEn = en?.bodyEn ?? '_English translation pending._';

    md += `## ${titleId} / ${titleEn}\n\n`;
    md += wrapLang('Bahasa Indonesia', 'lang-id', bodyId);
    md += wrapLang('English', 'lang-en', bodyEn);
    md += `\n---\n\n`;
  }

  md += wrapLang('Bahasa Indonesia', 'lang-id', introLines.slice(-3).join('\n'));
  md += wrapLang(
    'English',
    'lang-en',
    '*This document describes KEA One Procurement module features as of August 2026. If the UI differs from your environment, a feature may not be enabled in Settings or role permissions may be missing.*\n\n**Questions or additional training?** Contact your KEA One administrator / implementation team.',
  );

  return md;
}

function buildHtmlFromMarkdown(md) {
  const css = fs.readFileSync(cssPath, 'utf8');

  let body = md
    .replace(/^# (.+)$/gm, (_, t) => `<h1 class="main-title">${t}</h1>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2>${t}</h2>`)
    .replace(/^### (.+)$/gm, (_, t) => `<h3>${t}</h3>`)
    .replace(/<div class="lang-block lang-id">[\s\S]*?<\/div>/g, (block) => block)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr />');

  // Simple markdown table conversion
  body = body.replace(/\n(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)+)/g, (_, header, _sep, rows) => {
    const ths = header
      .split('|')
      .filter(Boolean)
      .map((c) => `<th>${c.trim()}</th>`)
      .join('');
    const trs = rows
      .trim()
      .split('\n')
      .map((row) => {
        const tds = row
          .split('|')
          .filter(Boolean)
          .map((c) => `<td>${c.trim()}</td>`)
          .join('');
        return `<tr>${tds}</tr>`;
      })
      .join('');
    return `\n<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>\n`;
  });

  body = body.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  body = body.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  body = body.replace(/^- (.+)$/gm, '<li>$1</li>');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>KEA One Procurement Tutorial — Bilingual</title>
<style>${css}</style>
</head>
<body>
<div class="cover">
  <h1>KEA One</h1>
  <div class="subtitle">Procurement Module Tutorial<br/>Tutorial Modul Pengadaan</div>
  <div class="langs">🇮🇩 Bahasa Indonesia &nbsp;•&nbsp; 🇬🇧 English</div>
  <div class="meta">Version August 2026 • End User Guide</div>
</div>
${body}
<div class="page-footer">KEA One — Procurement Module Tutorial (Bilingual) — August 2026</div>
</body>
</html>`;
}

async function main() {
  console.log('Building bilingual markdown…');
  const bilingualMd = buildBilingualMarkdown();
  fs.writeFileSync(outMdPath, bilingualMd, 'utf8');
  console.log(`✓ ${path.basename(outMdPath)}`);

  console.log('Generating PDF via md-to-pdf…');
  await mdToPdf(
    { content: bilingualMd },
    {
      dest: outPdfPath,
      css: cssPath,
      pdf_options: {
        format: 'A4',
        margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#999;padding:0 16mm;">KEA One Procurement Tutorial — Bilingual — <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      },
      launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    },
  );
  console.log(`✓ ${path.basename(outPdfPath)}`);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
