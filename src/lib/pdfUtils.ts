import jsPDF from 'jspdf';

// ---------------------------------------------------------------------------
// Shared markdown-stripping parser (mirrors CVBuilderPage logic)
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

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  const headerText = `Personalised CV — ${jobTitle}`;
  doc.text(headerText, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 20;

  // ── Body: parse lines and sections ───────────────────────────────────────
  const lines = cvText.split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Detect ALL-CAPS section headings (e.g. PROFESSIONAL SUMMARY)
    const isSectionHeading =
      line.trim().length > 0 &&
      line.trim() === line.trim().toUpperCase() &&
      line.trim().length > 3;

    if (isSectionHeading) {
      y += 6; // breathing room before heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(line.trim(), marginLeft, y);
      y += 3;
      // Underline the heading
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.4);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;
      continue;
    }

    // Empty line → paragraph gap
    if (line.trim() === '') {
      y += 6;
      continue;
    }

    // Regular body text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);

    const wrapped = doc.splitTextToSize(line, contentWidth);
    for (const wrappedLine of wrapped) {
      if (y + 14 > pageHeight - marginBottom) {
        // Add footer line on current page
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

  // ── Footer on last page ───────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, pageHeight - marginBottom + 6, pageWidth - marginRight, pageHeight - marginBottom + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Aur.a · ATS-Optimised CV', pageWidth / 2, pageHeight - marginBottom + 18, {
    align: 'center',
  });

  const safeTitle = jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  doc.save(`personalised-cv-${safeTitle}.pdf`);
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'cv';
}

export function downloadATSReadableCVAsPDF(cvText: string, fileNameBase: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const lh = 15.6;
  let y = margin + 16;

  const ensureSpace = (h: number) => {
    if (y + h <= pageHeight - margin) return;
    doc.addPage();
    y = margin + 16;
  };

  const tokens = parseCVTokens(cvText);

  for (const token of tokens) {
    switch (token.kind) {
      case 'name':
        ensureSpace(28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text(token.text, pageWidth / 2, y, { align: 'center' });
        y += 22;
        break;

      case 'contact':
        ensureSpace(16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(token.text, pageWidth / 2, y, { align: 'center' });
        y += 10;
        break;

      case 'divider':
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 12;
        break;

      case 'heading':
        ensureSpace(28);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(token.text, margin, y);
        y += 4;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
        break;

      case 'bullet': {
        const wrapped = doc.splitTextToSize(`\u2022 ${token.text}`, contentWidth - 16);
        for (const wl of wrapped) {
          ensureSpace(lh);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text(wl, margin + 12, y);
          y += lh;
        }
        break;
      }

      case 'entry':
        ensureSpace(lh + 4);
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(token.left, margin, y);
        if (token.right) {
          doc.setFont('helvetica', 'normal');
          doc.text(token.right, pageWidth - margin, y, { align: 'right' });
        }
        y += lh;
        break;

      case 'plain': {
        const wrapped = doc.splitTextToSize(token.text, contentWidth);
        for (const wl of wrapped) {
          ensureSpace(lh);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text(wl, margin, y);
          y += lh;
        }
        break;
      }
    }
  }

  doc.save(`${safeFilePart(fileNameBase)}.pdf`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadATSReadableCVAsWord(cvText: string, fileNameBase: string): void {
  const tokens = parseCVTokens(cvText);
  const bodyParts: string[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case 'name':
        bodyParts.push(`<h1>${escapeHtml(token.text)}</h1>`);
        break;
      case 'contact':
        bodyParts.push(`<p class="contact">${escapeHtml(token.text)}</p>`);
        break;
      case 'divider':
        bodyParts.push('<hr class="divider" />');
        break;
      case 'heading':
        bodyParts.push(`<h2>${escapeHtml(token.text)}</h2>`);
        break;
      case 'bullet':
        bodyParts.push(`<p class="bullet">\u2022 ${escapeHtml(token.text)}</p>`);
        break;
      case 'entry':
        bodyParts.push(
          `<p class="entry-header"><strong>${escapeHtml(token.left)}</strong>${token.right ? `<span class="date">${escapeHtml(token.right)}</span>` : ''}</p>`
        );
        break;
      case 'plain':
        bodyParts.push(`<p>${escapeHtml(token.text)}</p>`);
        break;
    }
  }

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; color: #000000; font-size: 13px; line-height: 1.6; margin: 40px; }
h1 { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 4px; }
p.contact { font-size: 13px; font-weight: 400; text-align: center; margin: 0 0 8px; }
hr.divider { border: none; border-top: 1px solid #cccccc; margin: 4px 0 12px; }
h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 0; padding-bottom: 3px; border-bottom: 1px solid #cccccc; }
p { font-size: 13px; margin: 0 0 2px; }
p.bullet { margin-left: 16px; }
p.entry-header { display: flex; justify-content: space-between; font-weight: 700; margin-top: 6px; margin-bottom: 0; }
p.entry-header .date { font-weight: 400; }
</style>
</head>
<body>${bodyParts.join('')}</body>
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
