import jsPDF from 'jspdf';

// ---------------------------------------------------------------------------
// Shared markdown-stripping helpers
// ---------------------------------------------------------------------------

function stripHeadingMarkers(raw: string): string {
  return raw.replace(/^#{1,6}\s*/, '').trim();
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

type ParsedToken =
  | { kind: 'name'; text: string }
  | { kind: 'contact'; text: string }
  | { kind: 'divider' }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'entry'; left: string; right: string }
  | { kind: 'plain'; text: string };

function parseLineToken(raw: string): ParsedToken | null {
  if (/^#{1,6}\s/.test(raw)) {
    return { kind: 'heading', text: stripInlineMarkdown(stripHeadingMarkers(raw)).toUpperCase() };
  }
  if (/^-{3,}$/.test(raw.trim()) || /^\*{3,}$/.test(raw.trim()) || /^_{3,}$/.test(raw.trim())) {
    return { kind: 'divider' };
  }
  if (/^[-*]\s/.test(raw) || raw.trimStart().startsWith('\u2022')) {
    return { kind: 'bullet', text: stripInlineMarkdown(raw.replace(/^[-*\u2022]\s*/, '').trim()) };
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const clean = stripInlineMarkdown(trimmed);
  if (clean.length > 3 && clean === clean.toUpperCase() && !clean.includes('@') && !/\d{4}/.test(clean)) {
    return { kind: 'heading', text: clean };
  }
  return { kind: 'plain', text: clean };
}

function parseCVTokens(cvText: string): ParsedToken[] {
  const rawLines = cvText.split('\n');
  const tokens: ParsedToken[] = [];
  let nameEmitted = false;
  let contactEmitted = false;
  let headersDone = false;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();

    if (!headersDone) {
      if (!trimmed) continue;
      if (!nameEmitted) {
        tokens.push({ kind: 'name', text: stripInlineMarkdown(stripHeadingMarkers(trimmed)) });
        nameEmitted = true;
        continue;
      }
      if (!contactEmitted) {
        tokens.push({ kind: 'contact', text: stripInlineMarkdown(trimmed) });
        tokens.push({ kind: 'divider' });
        contactEmitted = true;
        headersDone = true;
        continue;
      }
    }

    if (!trimmed) continue;

    const token = parseLineToken(raw);
    if (!token) continue;

    if (token.kind === 'plain') {
      const datePattern = /(\d{4}|Present|present)/;
      if (datePattern.test(token.text)) {
        const splitMatch = token.text.match(/^(.+?)\s{2,}(.+)$/);
        if (splitMatch) {
          tokens.push({ kind: 'entry', left: splitMatch[1].trim(), right: splitMatch[2].trim() });
          continue;
        }
      }
      if (/^\*\*/.test(raw.trim())) {
        tokens.push({ kind: 'entry', left: token.text, right: '' });
        continue;
      }
    }

    tokens.push(token);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Section routing helpers (mirrors CVBuilderPage logic)
// ---------------------------------------------------------------------------

const LEFT_SECTIONS = new Set([
  'SUMMARY', 'PERSONAL SUMMARY', 'PROFILE', 'OBJECTIVE',
  'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT', 'EMPLOYMENT HISTORY',
  'CUSTOM', 'CERTIFICATIONS', 'CERTIFICATIONS AND ACHIEVEMENTS', 'PROJECTS', 'CERTIFICATES',
  'LANGUAGES', 'TRAINING', 'COURSES', 'TRAINING AND COURSES',
]);

const RIGHT_SECTIONS = new Set([
  'KEY ACHIEVEMENTS', 'ACHIEVEMENTS',
  'SKILLS', 'TECHNICAL SKILLS', 'SOFT SKILLS',
  'CORE COMPETENCIES', 'COMPETENCIES',
  'EDUCATION', 'EDUCATION AND QUALIFICATIONS', 'QUALIFICATIONS',
  'REFERENCES',
]);

function getSectionSide(heading: string): 'left' | 'right' {
  const upper = heading.toUpperCase().trim();
  if (LEFT_SECTIONS.has(upper)) return 'left';
  if (RIGHT_SECTIONS.has(upper)) return 'right';
  for (const s of LEFT_SECTIONS) if (upper.includes(s)) return 'left';
  for (const s of RIGHT_SECTIONS) if (upper.includes(s)) return 'right';
  return 'left';
}

// ---------------------------------------------------------------------------
// Language proficiency bar parser
// ---------------------------------------------------------------------------

function parseLanguageLine(text: string): { lang: string; level: number } | null {
  const patterns = [/^(.+?)[\s\-–:]+(.+)$/, /^(.+?)\s+\((.+?)\)$/];
  const levels: Record<string, number> = {
    native: 5, fluent: 5, advanced: 4, proficient: 4,
    intermediate: 3, conversational: 2, basic: 1, beginner: 1,
  };
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const score = levels[m[2].trim().toLowerCase()];
      if (score !== undefined) return { lang: m[1].trim(), level: score };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Columnar token structure
// ---------------------------------------------------------------------------

interface ColSection {
  heading: string;
  tokens: ParsedToken[];
}

function buildColumns(tokens: ParsedToken[]): {
  name: string;
  contact: string;
  left: ColSection[];
  right: ColSection[];
} {
  let name = '';
  let contact = '';
  const left: ColSection[] = [];
  const right: ColSection[] = [];
  let currentSide: 'left' | 'right' = 'left';
  let currentSection: ColSection | null = null;

  const flush = () => {
    if (!currentSection) return;
    if (currentSide === 'left') left.push(currentSection);
    else right.push(currentSection);
    currentSection = null;
  };

  for (const token of tokens) {
    if (token.kind === 'name') { name = token.text; continue; }
    if (token.kind === 'contact') { if (!contact) contact = token.text; continue; }
    if (token.kind === 'divider') continue;
    if (token.kind === 'heading') {
      flush();
      currentSide = getSectionSide(token.text);
      currentSection = { heading: token.text, tokens: [] };
      continue;
    }
    if (currentSection) currentSection.tokens.push(token);
  }
  flush();

  return { name, contact, left, right };
}

// ---------------------------------------------------------------------------
// Helper: safe filename part
// ---------------------------------------------------------------------------

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'cv';
}

// ---------------------------------------------------------------------------
// Legacy single-column PDF (kept for backward-compat)
// ---------------------------------------------------------------------------

export function downloadCVAsPDF(cvText: string, jobTitle: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 56;
  const marginRight = 56;
  const marginTop = 56;
  const marginBottom = 56;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = marginTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Personalised CV \u2014 ${jobTitle}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 20;

  const lines = cvText.split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const isSectionHeading =
      line.trim().length > 0 &&
      line.trim() === line.trim().toUpperCase() &&
      line.trim().length > 3;

    if (isSectionHeading) {
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(line.trim(), marginLeft, y);
      y += 3;
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.4);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;
      continue;
    }

    if (line.trim() === '') { y += 6; continue; }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);

    const wrapped = doc.splitTextToSize(line, contentWidth);
    for (const wrappedLine of wrapped) {
      if (y + 14 > pageHeight - marginBottom) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, pageHeight - marginBottom + 6, pageWidth - marginRight, pageHeight - marginBottom + 6);
        doc.addPage();
        y = marginTop;
      }
      doc.text(wrappedLine, marginLeft, y);
      y += 14;
    }
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, pageHeight - marginBottom + 6, pageWidth - marginRight, pageHeight - marginBottom + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Aur.a \u00b7 ATS-Optimised CV', pageWidth / 2, pageHeight - marginBottom + 18, { align: 'center' });

  doc.save(`personalised-cv-${safeFilePart(jobTitle)}.pdf`);
}

// ---------------------------------------------------------------------------
// Two-column PDF download
// ---------------------------------------------------------------------------

export function downloadATSReadableCVAsPDF(cvText: string, fileNameBase: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginT = 44;
  const marginB = 44;
  const marginL = 44;
  const marginR = 44;

  const bodyW = pageW - marginL - marginR;
  const colGap = 12;
  const leftW = Math.floor(bodyW * 0.635);
  const rightW = bodyW - leftW - colGap;
  const leftX = marginL;
  const rightX = marginL + leftW + colGap;

  const BLUE = [26, 115, 232] as [number, number, number];
  const DARK = [51, 51, 51] as [number, number, number];
  const GRAY = [107, 114, 128] as [number, number, number];
  const LIGHT_GRAY = [209, 213, 219] as [number, number, number];

  const lhBody = 14;
  const lhSmall = 12.5;

  // Track Y per column, per page
  let leftY = marginT;
  let rightY = marginT;

  // ── Header (full width) ───────────────────────────────────────────────────
  const tokens = parseCVTokens(cvText);
  const { name, contact, left, right } = buildColumns(tokens);
  const contactParts = contact.split(/\s*[|•·]\s*/).filter(Boolean);
  const subtitle = contactParts.shift() || '';

  let hY = marginT;

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(name.toUpperCase(), pageW / 2, hY, { align: 'center' });
  hY += 18;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(subtitle, pageW / 2, hY, { align: 'center' });
    hY += 13;
  }

  // Contact row
  if (contactParts.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const contactLine = contactParts.join('   ·   ');
    doc.text(contactLine, pageW / 2, hY, { align: 'center' });
    hY += 12;
  }

  // Full-width hr
  doc.setDrawColor(...DARK);
  doc.setLineWidth(1);
  doc.line(marginL, hY, pageW - marginR, hY);
  hY += 14;

  leftY = hY;
  rightY = hY;

  // ── Column rendering helpers ──────────────────────────────────────────────

  const ensureSpace = (colX: number, neededH: number, colYRef: { v: number }) => {
    if (colYRef.v + neededH <= pageH - marginB) return;
    // Add new page and reset both columns
    doc.addPage();
    leftY = marginT;
    rightY = marginT;
    colYRef.v = marginT;
  };

  const renderSection = (
    section: ColSection,
    colX: number,
    colWidth: number,
    colYRef: { v: number }
  ) => {
    const isLanguages = /LANGUAGE/i.test(section.heading);
    const isRight = colX === rightX;

    // HR above section
    ensureSpace(colX, 18, colYRef);
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.8);
    doc.line(colX, colYRef.v, colX + colWidth, colYRef.v);
    colYRef.v += 4;

    // Section heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isRight ? 8.5 : 9);
    doc.setTextColor(...DARK);
    doc.text(section.heading.toUpperCase(), colX, colYRef.v);
    colYRef.v += isRight ? 10 : 11;

    // Tokens
    for (const token of section.tokens) {
      if (token.kind === 'entry') {
        ensureSpace(colX, lhBody, colYRef);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isRight ? 8.5 : 9.5);
        doc.setTextColor(...DARK);
        // Left portion
        const leftMaxW = token.right ? colWidth * 0.65 : colWidth;
        const leftWrapped = doc.splitTextToSize(token.left, leftMaxW);
        doc.text(leftWrapped[0], colX, colYRef.v);
        // Right date
        if (token.right) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...GRAY);
          doc.text(token.right, colX + colWidth, colYRef.v, { align: 'right' });
        }
        colYRef.v += lhSmall;
      } else if (token.kind === 'bullet') {
        ensureSpace(colX, lhSmall, colYRef);
        const bulletW = colWidth - 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isRight ? 8 : 8.5);
        doc.setTextColor(...DARK);
        const wrapped = doc.splitTextToSize(token.text, bulletW);
        // Blue arrow bullet
        doc.setTextColor(...BLUE);
        doc.text('\u25b8', colX + 1, colYRef.v);
        doc.setTextColor(...DARK);
        for (let wi = 0; wi < wrapped.length; wi++) {
          ensureSpace(colX, lhSmall, colYRef);
          doc.text(wrapped[wi], colX + 8, colYRef.v);
          colYRef.v += wi < wrapped.length - 1 ? lhSmall : lhSmall - 1;
        }
      } else if (token.kind === 'plain') {
        if (isLanguages) {
          const parsed = parseLanguageLine(token.text);
          if (parsed) {
            ensureSpace(colX, 14, colYRef);
            // Language name
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...DARK);
            doc.text(parsed.lang, colX, colYRef.v);
            // Pill bars
            const barStartX = colX + 62;
            const barW = 16;
            const barH = 5;
            const barGap = 3;
            const barY = colYRef.v - barH + 1;
            for (let n = 1; n <= 5; n++) {
              const bx = barStartX + (n - 1) * (barW + barGap);
              if (n <= parsed.level) {
                doc.setFillColor(...BLUE);
              } else {
                doc.setFillColor(...LIGHT_GRAY);
              }
              doc.roundedRect(bx, barY, barW, barH, 2, 2, 'F');
            }
            colYRef.v += 12;
            continue;
          }
        }
        ensureSpace(colX, lhSmall, colYRef);
        const wrapped = doc.splitTextToSize(token.text, colWidth);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isRight ? 8 : 8.5);
        doc.setTextColor(80, 80, 80);
        for (const wl of wrapped) {
          ensureSpace(colX, lhSmall, colYRef);
          doc.text(wl, colX, colYRef.v);
          colYRef.v += lhSmall;
        }
      } else if (token.kind === 'heading') {
        // Sub-heading within a section
        ensureSpace(colX, lhSmall, colYRef);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isRight ? 7.5 : 8.5);
        doc.setTextColor(...DARK);
        doc.text(token.text.toUpperCase(), colX, colYRef.v);
        colYRef.v += lhSmall - 1;
      }
    }

    colYRef.v += 8; // gap after section
  };

  // ── Render left and right columns ─────────────────────────────────────────
  const leftRef = { v: leftY };
  const rightRef = { v: rightY };

  for (const section of left) {
    renderSection(section, leftX, leftW, leftRef);
    // Sync leftY global
    leftY = leftRef.v;
  }
  for (const section of right) {
    renderSection(section, rightX, rightW, rightRef);
    rightY = rightRef.v;
  }

  // Draw vertical separator between columns (on first page only approximation)
  const separatorH = Math.max(leftY, rightY) - hY;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginL + leftW + colGap / 2, hY, marginL + leftW + colGap / 2, hY + separatorH);

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('Generated by Aur.a', pageW / 2, pageH - 20, { align: 'center' });
  }

  doc.save(`${safeFilePart(fileNameBase)}.pdf`);
}

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Two-column Word (HTML) download
// ---------------------------------------------------------------------------

export function downloadATSReadableCVAsWord(cvText: string, fileNameBase: string): void {
  const tokens = parseCVTokens(cvText);
  const { name, contact, left, right } = buildColumns(tokens);
  const contactParts = contact.split(/\s*[|•·]\s*/).filter(Boolean);
  const subtitle = contactParts.shift() || '';

  function renderColSections(sections: ColSection[], isRight: boolean): string {
    const fs = isRight ? '10px' : '11px';
    const headFs = isRight ? '9px' : '10px';
    const parts: string[] = [];

    for (const section of sections) {
      const isLang = /LANGUAGE/i.test(section.heading);
      parts.push(`<div class="cv-section">`);
      parts.push(`<hr class="section-hr" />`);
      parts.push(`<p class="section-heading" style="font-size:${headFs}">${escapeHtml(section.heading)}</p>`);

      if (isLang) {
        for (const t of section.tokens) {
          if (t.kind !== 'plain' && t.kind !== 'bullet') continue;
          const text = (t as any).text as string;
          const parsed = parseLanguageLine(text);
          if (parsed) {
            const bars = [1,2,3,4,5].map(n =>
              `<span class="pill${n <= parsed.level ? ' pill-active' : ''}"></span>`
            ).join('');
            parts.push(`<div class="lang-row"><span class="lang-name">${escapeHtml(parsed.lang)}</span><span class="pills">${bars}</span></div>`);
          } else {
            parts.push(`<p style="font-size:${fs};margin:0 0 2px;color:#555">${escapeHtml(text)}</p>`);
          }
        }
      } else {
        for (const t of section.tokens) {
          if (t.kind === 'entry') {
            parts.push(`<div class="entry-row"><strong style="font-size:${fs}">${escapeHtml(t.left)}</strong>${t.right ? `<span class="date">${escapeHtml(t.right)}</span>` : ''}</div>`);
          } else if (t.kind === 'bullet') {
            parts.push(`<div class="bullet-row" style="font-size:${fs}"><span class="bullet-arrow">&#9656;</span><span>${escapeHtml(t.text)}</span></div>`);
          } else if (t.kind === 'plain') {
            parts.push(`<p style="font-size:${fs};margin:0 0 3px;color:#555;line-height:1.55">${escapeHtml(t.text)}</p>`);
          } else if (t.kind === 'heading') {
            parts.push(`<p style="font-size:${headFs};font-weight:700;color:#333;text-transform:uppercase;margin:6px 0 2px;letter-spacing:.03em">${escapeHtml(t.text)}</p>`);
          }
        }
      }

      parts.push(`</div>`);
    }

    return parts.join('\n');
  }

  // Contact parts
  const contactHtml = contactParts
    .map(p => `<span class="contact-item">${escapeHtml(p)}</span>`)
    .join('<span class="contact-sep">·</span>');

  const leftHtml = renderColSections(left, false);
  const rightHtml = renderColSections(right, true);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, Arial, sans-serif; color: #333; font-size: 11px; line-height: 1.55; background: #fff; padding: 36px 44px; }

  /* Header */
  .cv-header { text-align: center; margin-bottom: 14px; }
  .cv-name { font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #1a1a1a; margin-bottom: 4px; }
  .cv-subtitle { color: #1A73E8; font-size: 11px; margin-bottom: 5px; }
  .cv-contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; font-size: 10px; color: #555; margin-top: 6px; }
  .contact-item { display: inline-flex; align-items: center; gap: 3px; }
  .contact-sep { color: #1A73E8; margin: 0 4px; font-weight: 700; }

  /* Full-width header divider */
  .header-hr { border: none; border-top: 1.5px solid #333; margin: 10px 0 14px; }

  /* Two-column grid */
  .cv-body { display: table; width: 100%; table-layout: fixed; }
  .col-left { display: table-cell; width: 64%; vertical-align: top; padding-right: 10px; }
  .col-divider { display: table-cell; width: 1px; vertical-align: top; background: #e5e7eb; }
  .col-right { display: table-cell; width: 35%; vertical-align: top; padding-left: 10px; }

  /* Sections */
  .cv-section { margin-bottom: 14px; }
  .section-hr { border: none; border-top: 1.5px solid #333; margin: 0 0 4px; }
  .section-heading { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #333; margin-bottom: 7px; }

  /* Entry rows */
  .entry-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .entry-row strong { color: #333; }
  .date { font-size: 9px; color: #6b7280; flex-shrink: 0; margin-left: 6px; font-weight: 400; }

  /* Bullet rows */
  .bullet-row { display: flex; align-items: flex-start; gap: 5px; margin-bottom: 3px; line-height: 1.55; color: #333; }
  .bullet-arrow { color: #1A73E8; font-size: 10px; flex-shrink: 0; padding-top: 1px; }

  /* Language pills */
  .lang-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .lang-name { font-size: 10px; color: #333; width: 72px; flex-shrink: 0; }
  .pills { display: flex; gap: 3px; }
  .pill { display: inline-block; width: 18px; height: 7px; border-radius: 4px; background: #d1d5db; }
  .pill.pill-active { background: #1A73E8; }
</style>
</head>
<body>
  <div class="cv-header">
    <div class="cv-name">${escapeHtml(name)}</div>
    ${subtitle ? `<div class="cv-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    <div class="cv-contact">${contactHtml}</div>
  </div>
  <hr class="header-hr" />
  <div class="cv-body">
    <div class="col-left">${leftHtml}</div>
    <div class="col-divider">&nbsp;</div>
    <div class="col-right">${rightHtml}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilePart(fileNameBase)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
