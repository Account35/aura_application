import type { ReactNode } from 'react';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Inline markdown stripping
// ---------------------------------------------------------------------------

function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // _italic_ / __bold__
    .replace(/`(.+?)`/g, '$1')          // `code`
    .replace(/<[^>]+>/g, '')            // <html tags>
    .trim();
}

function stripHeadingMarker(raw: string): string {
  return raw.replace(/^#{1,6}\s*/, '').trim();
}

// ---------------------------------------------------------------------------
// Plain-text version — used for clipboard copy and file download
// ---------------------------------------------------------------------------

export function stripCoverLetterMarkdown(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      // Markdown heading → plain text
      if (/^#{1,6}\s/.test(trimmed)) {
        return stripInline(stripHeadingMarker(trimmed));
      }

      // Horizontal rule → empty line
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        return '';
      }

      // Bullet / list item → plain paragraph (cover letters don't use bullets)
      if (/^[-*]\s/.test(trimmed)) {
        return stripInline(trimmed.replace(/^[-*]\s*/, ''));
      }

      return stripInline(trimmed);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// React render — used for on-screen preview
// ---------------------------------------------------------------------------

export function renderCoverLetterPreview(raw: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let keyIndex = 0;

  const flushParagraph = () => {
    const text = paragraphBuffer.join(' ').trim();
    paragraphBuffer = [];
    if (!text) return;
    elements.push(
      createElement(
        'p',
        {
          key: `p-${keyIndex++}`,
          style: {
            fontSize: 15,
            color: '#000',
            lineHeight: 1.8,
            margin: '0 0 14px',
            fontWeight: 400,
          },
        },
        text
      )
    );
  };

  const lines = raw.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line → flush current paragraph
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Horizontal rule → flush + render divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      elements.push(
        createElement('hr', {
          key: `hr-${keyIndex++}`,
          style: {
            border: 'none',
            borderTop: '1px solid #ccc',
            margin: '12px 0',
          },
        })
      );
      continue;
    }

    // Markdown heading → flush + render as bold paragraph
    if (/^#{1,6}\s/.test(trimmed)) {
      flushParagraph();
      const headingText = stripInline(stripHeadingMarker(trimmed));
      elements.push(
        createElement(
          'p',
          {
            key: `h-${keyIndex++}`,
            style: {
              fontSize: 15,
              color: '#000',
              lineHeight: 1.8,
              margin: '0 0 14px',
              fontWeight: 700,
            },
          },
          headingText
        )
      );
      continue;
    }

    // Bullet / list item → flush + render as plain paragraph (no bullet symbol)
    if (/^[-*]\s/.test(trimmed)) {
      flushParagraph();
      const bulletText = stripInline(trimmed.replace(/^[-*]\s*/, ''));
      elements.push(
        createElement(
          'p',
          {
            key: `b-${keyIndex++}`,
            style: {
              fontSize: 15,
              color: '#000',
              lineHeight: 1.8,
              margin: '0 0 14px',
              fontWeight: 400,
            },
          },
          bulletText
        )
      );
      continue;
    }

    // Regular line — accumulate into paragraph buffer
    paragraphBuffer.push(stripInline(trimmed));
  }

  // Flush any remaining buffered lines
  flushParagraph();

  return elements;
}

// ---------------------------------------------------------------------------
// Word-document HTML — used for .doc download
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCoverLetterWordHtml(raw: string): string {
  const clean = stripCoverLetterMarkdown(raw);
  const paragraphs = clean
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; color: #000000; font-size: 15px; line-height: 1.8; margin: 40px; }
p { margin: 0 0 14px; }
</style>
</head>
<body>${paragraphs}</body>
</html>`;
}
