import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import jsPDF from 'jspdf';
import type { CVBuilderData } from '@/types/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "2023-02" → "Feb 2023", "" or undefined → "Present" */
function fmtDate(raw: string | undefined): string {
  if (!raw || !raw.trim()) return 'Present';
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const mon = parseInt(m[2], 10) - 1;
    return `${MONTHS[mon] ?? m[2]} ${m[1]}`;
  }
  return raw.trim();
}

function toTitleCase(str: string): string {
  return str.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function collapseSpaces(s: string): string {
  return s.replace(/  +/g, ' ').trim();
}

/**
 * Split a responsibilities string into clean bullet strings.
 * Lines that don't start with a bullet marker and whose previous line didn't
 * end a sentence are joined to the previous line.
 */
function splitDuties(raw: string): string[] {
  if (!raw.trim()) return [];

  const rawLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined: string[] = [];

  for (const line of rawLines) {
    const stripped = line.replace(/^[-*•]\s*/, '').trim();
    if (!stripped) continue;

    const hasBulletMarker = /^[-*•]/.test(line);
    const prevEnded = joined.length > 0 && /[.!?]$/.test(joined[joined.length - 1]);

    if (!hasBulletMarker && joined.length > 0 && !prevEnded) {
      joined[joined.length - 1] = collapseSpaces(joined[joined.length - 1] + ' ' + stripped);
    } else {
      joined.push(collapseSpaces(stripped));
    }
  }

  // Split very long single-sentence blobs into per-sentence bullets
  const result: string[] = [];
  for (const item of joined) {
    if (item.length > 300) {
      const sentences = item.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 1) {
        sentences.forEach((s) => { const t = s.trim(); if (t) result.push(t); });
        continue;
      }
    }
    result.push(item);
  }
  return result;
}

/**
 * Split a skills string into individual skill bullets.
 * Returns { groupName, items }[] — groupName is non-empty when the text has
 * a "Label:" prefix (e.g. "Technical Skills: ...").
 */
function parseSkillsText(raw: string): { groupName: string; items: string[] }[] {
  if (!raw.trim()) return [];

  // Check for "Group Name: item, item\nGroup Name: item" pattern
  const groupPattern = /^([A-Za-z][A-Za-z\s&]+):\s*(.+)$/;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const groups: { groupName: string; items: string[] }[] = [];

  for (const line of lines) {
    const gm = line.match(groupPattern);
    if (gm) {
      const items = splitSkillItems(gm[2]);
      if (items.length) groups.push({ groupName: gm[1].trim(), items });
    } else {
      // Plain line — add to last group or create unnamed group
      const items = splitSkillItems(line);
      if (!items.length) continue;
      if (groups.length && !groups[groups.length - 1].groupName) {
        groups[groups.length - 1].items.push(...items);
      } else {
        groups.push({ groupName: '', items });
      }
    }
  }

  return groups.length ? groups : [{ groupName: '', items: splitSkillItems(raw) }];
}

/** Split "Python, JavaScript, MS Office (Word, Excel)" keeping bracketed commas intact */
function splitSkillItems(raw: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of raw) {
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) {
      const t = cur.trim(); if (t) items.push(t); cur = '';
    } else if (ch === '\n' && depth === 0) {
      const t = cur.trim(); if (t) items.push(t); cur = '';
    } else {
      cur += ch;
    }
  }
  const t = cur.trim(); if (t) items.push(t);
  return items.filter(Boolean);
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'cv';
}

// ---------------------------------------------------------------------------
// PDF export — jsPDF, units in pt, single column
// ---------------------------------------------------------------------------

export function downloadATSReadableCVAsPDF(data: CVBuilderData, fileNameBase: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 595.28 pt
  const PH = doc.internal.pageSize.getHeight();  // 841.89 pt

  // Margins in pt  (14 mm = 39.7 pt, 16 mm = 45.4 pt)
  const MT = 39.7;
  const MB = 39.7;
  const ML = 45.4;
  const MR = 45.4;
  const CW = PW - ML - MR;   // full content width — every element uses this
  const BOTTOM = PH - MB;

  const DARK: [number, number, number] = [34, 34, 34];
  const GRAY: [number, number, number] = [68, 68, 68];

  const NAME_PT    = 18;
  const TITLE_PT   = 11;
  const CONTACT_PT = 9.5;
  const HEAD_PT    = 10.5;
  const BODY_PT    = 9.5;

  // Line heights = fontSize * 1.35
  const lh = (pt: number) => pt * 1.35;

  let y = MT;

  // ---- page-break guard: add page if less than `need` pt remain ----
  const guard = (need: number) => {
    if (y + need > BOTTOM) { doc.addPage(); y = MT; }
  };

  // ---- draw one wrapped text block, return nothing (y is advanced inside) ----
  const writeLine = (
    text: string,
    font: string,
    style: string,
    size: number,
    color: [number, number, number],
    x: number,
    width: number,
  ) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(collapseSpaces(text), width) as string[];
    for (const ln of lines) {
      guard(lh(size));
      doc.text(ln, x, y);
      y += lh(size);
    }
  };

  // ---- section heading with rule ----
  const writeHeading = (text: string) => {
    // Need room for heading line + rule gap + at least two body lines
    guard(lh(HEAD_PT) + 8 + lh(BODY_PT) * 2);
    y += 10; // 10 pt space above heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(HEAD_PT);
    doc.setTextColor(...DARK);
    doc.text(text.toUpperCase(), ML, y);
    y += 3; // gap between text baseline and rule
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.75);
    doc.line(ML, y, PW - MR, y);
    y += 5; // 4–5 pt below rule before first content line
  };

  // ---- bullet ----
  const BULLET_INDENT = 12; // pt
  const writeBullet = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY_PT);
    doc.setTextColor(...DARK);
    const bulletW = CW - BULLET_INDENT;
    const lines = doc.splitTextToSize(collapseSpaces(text), bulletW) as string[];
    for (let i = 0; i < lines.length; i++) {
      guard(lh(BODY_PT));
      if (i === 0) doc.text('\u2022', ML, y);
      doc.text(lines[i], ML + BULLET_INDENT, y);
      y += lh(BODY_PT);
    }
    y += 1; // 1 pt between bullets
  };

  const p = data.personalDetails;

  // ---- Header ----
  writeLine(toTitleCase(p.fullName) || 'Your Name', 'helvetica', 'bold', NAME_PT, DARK, ML, CW);

  if (p.targetJobTitle.trim()) {
    writeLine(p.targetJobTitle.trim(), 'helvetica', 'bold', TITLE_PT, DARK, ML, CW);
  }

  const contactParts = [p.phoneNumber, p.emailAddress, p.cityProvince].filter(Boolean);
  if (contactParts.length) {
    writeLine(contactParts.join(' | '), 'helvetica', 'normal', CONTACT_PT, DARK, ML, CW);
  }

  y += 4; // small gap before first section

  // ---- 1. SUMMARY ----
  if (data.personalSummary.trim()) {
    writeHeading('SUMMARY');
    writeLine(data.personalSummary.trim(), 'helvetica', 'normal', BODY_PT, DARK, ML, CW);
    y += 2;
  }

  // ---- 2. SKILLS ----
  const techGroups = parseSkillsText(data.skills.technical);
  const softGroups = parseSkillsText(data.skills.soft);
  const hasSkills = data.skills.technical.trim() || data.skills.soft.trim();
  if (hasSkills) {
    writeHeading('SKILLS');
    const renderSkillGroups = (groups: { groupName: string; items: string[] }[]) => {
      for (const g of groups) {
        if (g.groupName) {
          // Bold sub-heading
          guard(lh(BODY_PT) + 2);
          y += 3;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(BODY_PT);
          doc.setTextColor(...DARK);
          doc.text(g.groupName, ML, y);
          y += lh(BODY_PT);
        }
        for (const item of g.items) writeBullet(item);
      }
    };
    if (data.skills.technical.trim()) renderSkillGroups(techGroups);
    if (data.skills.soft.trim()) renderSkillGroups(softGroups);
    y += 2;
  }

  // ---- 3. WORK EXPERIENCE ----
  const jobs = [...data.workExperience]
    .filter((e) => e.jobTitle.trim() || e.companyName.trim())
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  if (jobs.length) {
    writeHeading('WORK EXPERIENCE');
    for (const job of jobs) {
      const title = [job.jobTitle, job.companyName].filter(Boolean).join(', ');
      const end = job.currentlyWorking ? 'Present' : fmtDate(job.endDate);
      const meta = [
        [fmtDate(job.startDate), end].filter(Boolean).join(' - '),
      ].filter(Boolean).join(' | ');

      guard(lh(BODY_PT) * 2 + 5);
      y += 5; // space above entry
      writeLine(title, 'helvetica', 'bold', BODY_PT, DARK, ML, CW);
      if (meta) writeLine(meta, 'helvetica', 'italic', BODY_PT, GRAY, ML, CW);

      const duties = splitDuties(job.responsibilities);
      for (const d of duties) writeBullet(d);
    }
    y += 2;
  }

  // ---- 4. EDUCATION ----
  const edus = data.education.filter((e) => e.qualificationName.trim() || e.institutionName.trim());
  if (edus.length) {
    writeHeading('EDUCATION');
    for (const edu of edus) {
      guard(lh(BODY_PT) * 2 + 5);
      y += 5;
      writeLine(edu.qualificationName.trim(), 'helvetica', 'bold', BODY_PT, DARK, ML, CW);
      const metaParts = [edu.institutionName, fmtDate(edu.yearCompleted)].filter(Boolean);
      if (metaParts.length) writeLine(metaParts.join(' | '), 'helvetica', 'italic', BODY_PT, GRAY, ML, CW);
      if (edu.achievements.trim()) {
        const achItems = splitDuties(edu.achievements);
        for (const a of achItems) writeBullet(a);
      }
    }
    y += 2;
  }

  // ---- 5. CERTIFICATIONS AND ACHIEVEMENTS ----
  const certs = data.certifications.filter((c) => c.name.trim() || c.issuingOrganisation.trim());
  if (certs.length) {
    writeHeading('CERTIFICATIONS AND ACHIEVEMENTS');
    for (const cert of certs) {
      guard(lh(BODY_PT) * 2 + 5);
      y += 5;
      writeLine(cert.name.trim(), 'helvetica', 'bold', BODY_PT, DARK, ML, CW);
      const metaParts = [cert.issuingOrganisation, fmtDate(cert.dateObtained)].filter(Boolean);
      if (metaParts.length) writeLine(metaParts.join(' | '), 'helvetica', 'italic', BODY_PT, GRAY, ML, CW);
    }
    y += 2;
  }

  // ---- 6. REFERENCES ----
  const refs = data.references.filter((r) => r.name.trim() || r.relationship.trim() || r.contactNumber.trim());
  writeHeading('REFERENCES');
  if (refs.length) {
    for (const ref of refs) {
      guard(lh(BODY_PT) * 2 + 5);
      y += 5;
      if (ref.name.trim()) writeLine(ref.name.trim(), 'helvetica', 'bold', BODY_PT, DARK, ML, CW);
      if (ref.relationship.trim()) writeLine(ref.relationship.trim(), 'helvetica', 'normal', BODY_PT, DARK, ML, CW);
      if (ref.contactNumber.trim()) writeLine(ref.contactNumber.trim(), 'helvetica', 'normal', BODY_PT, DARK, ML, CW);
    }
  } else {
    writeLine('Available on request', 'helvetica', 'normal', BODY_PT, DARK, ML, CW);
  }

  doc.save(`${safeFilePart(fileNameBase)}.pdf`);
}

// ---------------------------------------------------------------------------
// Word export — docx, Paragraphs only, no Tables
// ---------------------------------------------------------------------------

export async function downloadATSReadableCVAsWord(data: CVBuilderData, fileNameBase: string): Promise<void> {
  const FONT = 'Arial';
  const COLOR_DARK = '222222';
  const COLOR_GRAY = '444444';

  // Half-points
  const NAME_SZ    = 36; // 18 pt
  const TITLE_SZ   = 22; // 11 pt
  const CONTACT_SZ = 19; // 9.5 pt
  const HEAD_SZ    = 22; // 11 pt
  const BODY_SZ    = 20; // 10 pt

  const LINE_RULE = 312; // ~1.3 × 240 (single spacing = 240)

  const headingBorder = {
    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_DARK, space: 1 },
  };

  const bulletNumbering = {
    config: [{
      reference: 'cv-bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '\u2022',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 180 } } },
      }],
    }],
  };

  const children: Paragraph[] = [];

  const mkRun = (text: string, opts: {
    bold?: boolean; italics?: boolean; size?: number; color?: string;
  } = {}) =>
    new TextRun({
      text,
      font: FONT,
      size: opts.size ?? BODY_SZ,
      color: opts.color ?? COLOR_DARK,
      bold: opts.bold,
      italics: opts.italics,
    });

  const addPara = (runs: TextRun[], spacing: { before?: number; after?: number; line?: number } = {}, extra: object = {}) =>
    children.push(new Paragraph({ children: runs, spacing: { after: 40, line: LINE_RULE, ...spacing }, ...extra }));

  const addHeading = (text: string) =>
    children.push(new Paragraph({
      children: [mkRun(text.toUpperCase(), { bold: true, size: HEAD_SZ })],
      spacing: { before: 200, after: 120, line: LINE_RULE },
      keepNext: true,
      border: headingBorder,
    }));

  const addBullet = (text: string) =>
    children.push(new Paragraph({
      children: [mkRun(text)],
      numbering: { reference: 'cv-bullets', level: 0 },
      spacing: { after: 20, line: LINE_RULE },
    }));

  const p = data.personalDetails;

  // ---- Header ----
  addPara([mkRun(toTitleCase(p.fullName) || 'Your Name', { bold: true, size: NAME_SZ })], { after: 40 });
  if (p.targetJobTitle.trim())
    addPara([mkRun(p.targetJobTitle.trim(), { bold: true, size: TITLE_SZ })], { after: 40 });

  const contactParts = [p.phoneNumber, p.emailAddress, p.cityProvince].filter(Boolean);
  if (contactParts.length)
    addPara([mkRun(contactParts.join(' | '), { size: CONTACT_SZ })], { after: 160 });

  // ---- 1. SUMMARY ----
  if (data.personalSummary.trim()) {
    addHeading('SUMMARY');
    addPara([mkRun(data.personalSummary.trim())], { after: 60 });
  }

  // ---- 2. SKILLS ----
  const hasSkills = data.skills.technical.trim() || data.skills.soft.trim();
  if (hasSkills) {
    addHeading('SKILLS');
    const renderSkillGroups = (groups: { groupName: string; items: string[] }[]) => {
      for (const g of groups) {
        if (g.groupName) {
          children.push(new Paragraph({
            children: [mkRun(g.groupName, { bold: true })],
            spacing: { before: 80, after: 40, line: LINE_RULE },
          }));
        }
        for (const item of g.items) addBullet(item);
      }
    };
    if (data.skills.technical.trim()) renderSkillGroups(parseSkillsText(data.skills.technical));
    if (data.skills.soft.trim()) renderSkillGroups(parseSkillsText(data.skills.soft));
  }

  // ---- 3. WORK EXPERIENCE ----
  const jobs = [...data.workExperience]
    .filter((e) => e.jobTitle.trim() || e.companyName.trim())
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  if (jobs.length) {
    addHeading('WORK EXPERIENCE');
    for (const job of jobs) {
      const title = [job.jobTitle, job.companyName].filter(Boolean).join(', ');
      const end = job.currentlyWorking ? 'Present' : fmtDate(job.endDate);
      const meta = [fmtDate(job.startDate), end].filter(Boolean).join(' - ');

      addPara([mkRun(title, { bold: true })], { before: 100, after: 40 }, { keepNext: true });
      if (meta) addPara([mkRun(meta, { italics: true, color: COLOR_GRAY })], { after: 40 });
      for (const d of splitDuties(job.responsibilities)) addBullet(d);
    }
  }

  // ---- 4. EDUCATION ----
  const edus = data.education.filter((e) => e.qualificationName.trim() || e.institutionName.trim());
  if (edus.length) {
    addHeading('EDUCATION');
    for (const edu of edus) {
      addPara([mkRun(edu.qualificationName.trim(), { bold: true })], { before: 100, after: 40 }, { keepNext: true });
      const metaParts = [edu.institutionName, fmtDate(edu.yearCompleted)].filter(Boolean);
      if (metaParts.length)
        addPara([mkRun(metaParts.join(' | '), { italics: true, color: COLOR_GRAY })], { after: 40 });
      if (edu.achievements.trim())
        for (const a of splitDuties(edu.achievements)) addBullet(a);
    }
  }

  // ---- 5. CERTIFICATIONS AND ACHIEVEMENTS ----
  const certs = data.certifications.filter((c) => c.name.trim() || c.issuingOrganisation.trim());
  if (certs.length) {
    addHeading('CERTIFICATIONS AND ACHIEVEMENTS');
    for (const cert of certs) {
      addPara([mkRun(cert.name.trim(), { bold: true })], { before: 100, after: 40 }, { keepNext: true });
      const metaParts = [cert.issuingOrganisation, fmtDate(cert.dateObtained)].filter(Boolean);
      if (metaParts.length)
        addPara([mkRun(metaParts.join(' | '), { italics: true, color: COLOR_GRAY })], { after: 40 });
    }
  }

  // ---- 6. REFERENCES ----
  const refs = data.references.filter((r) => r.name.trim() || r.relationship.trim() || r.contactNumber.trim());
  addHeading('REFERENCES');
  if (refs.length) {
    for (const ref of refs) {
      if (ref.name.trim()) addPara([mkRun(ref.name.trim(), { bold: true })], { before: 100, after: 20 });
      if (ref.relationship.trim()) addPara([mkRun(ref.relationship.trim())], { after: 20 });
      if (ref.contactNumber.trim()) addPara([mkRun(ref.contactNumber.trim())], { after: 40 });
    }
  } else {
    addPara([mkRun('Available on request')], { after: 40 });
  }

  // Word margins: 15 mm top/bottom ≈ 851 twips, 18 mm left/right ≈ 1021 twips
  const wordDoc = new Document({
    numbering: bulletNumbering,
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SZ, color: COLOR_DARK } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 851, right: 1021, bottom: 851, left: 1021 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilePart(fileNameBase)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
