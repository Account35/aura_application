# Layout Pitfalls & Fix Guide

PptxGenJS has no collision detection. Overlapping elements produce no errors, no repositioning, and no warnings. This file documents all known layout issues, causes, and fixes.

---

## ⚠️ Frequent Issues (Check Every Generation)

These issues appear in nearly every generation — **you must build defensive habits before writing any slide code**.

### 1. Text Wrapping

**Root cause**: `h` is a hard-coded number, but the actual number of text lines is determined by font size × content length × text box width — all of which vary at runtime. PptxGenJS does not auto-expand text boxes — text that exceeds `h` is either clipped or forces line breaks.

**⚠️ Single-line text box size warning**: Any text box expected to show only one line (**cover titles, numeric callouts `01`/`02`, card titles, icon labels, regardless of font size**) is extremely prone to unexpected wrapping when `w` or `h` is too small. **The most common error is `w = h` (square) — a square is almost always too narrow for two-digit characters, causing `0` and `1` to wrap onto separate lines. Another common error is forgetting `margin: 0` and `shrinkText: true` on large cover/section titles — default padding consumes ~0.2" of effective width, very likely to wrap at large font sizes.**

**⚠️ `shrinkText: true` does not prevent wrapping**: `shrinkText` only shrinks the font size to fit the **height (h)**, not the **width (w)**. If `w` is too narrow, text wraps first ("0"/"2" each on their own line), then both lines get crammed into `h`, and `shrinkText` stops shrinking since the height fits — result: normal font size but already wrapped. **The only way to prevent wrapping is to ensure `w` is wide enough.**

All single-line text boxes must satisfy both:

- `h ≥ fontSize × 1.4 / 72 + 0.1` (rule of thumb: 14pt→0.37", 18pt→0.45", 24pt→0.57", 60pt→1.27")
- `w ≥ charCount × fontSize × 0.75 / 72 + 0.2` (rule of thumb: 2 chars 18pt→0.53", 2 chars 24pt→0.65", 2 chars 60pt→1.45"); **`w = h` is forbidden**
- Must include `shrinkText: true` (prevents clipping, but not wrapping — requires `w` to already be sufficient)
- **Number + unit combinations (`95%`, `60%`, `$3B`, etc.) must calculate `w` based on the full string length**, including the unit symbol (`95%` = 3 characters); missing the unit causes `%` to be pushed to the next line

```javascript
// ❌ Wrong: w = h = 0.5", square — "01" will break into two lines
slide.addText("01", { w: 0.5, h: 0.5, fontSize: 24, ... });

// ✅ Correct: w calculated by character formula, clearly wider than h
slide.addText("01", {
  x: 0.3, y: 1.2,
  w: 0.75,   // 2 chars × 24pt: 2×24×0.75/72+0.2 ≈ 0.70", use 0.75" for margin
  h: 0.55,   // 24pt×1.4/72+0.1 ≈ 0.57"
  fontSize: 24, bold: true, align: "center", valign: "middle",
  shrinkText: true, margin: 0,
});
```

**Three-tier defense strategy — must explicitly choose one; defaulting is not allowed**:

```javascript
// ① Fixed-position labels (numeric callouts, card titles, legends) → shrinkText
//    Auto-shrinks font when overflowing, ensures single line stays on one line
slide.addText("Potentially long label", {
  x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12,
  shrinkText: true,   // ← must be explicitly written
});

// ② Body/description paragraphs → autoFit
//    Text box height auto-expands with content, but ensure sufficient space below
slide.addText("Potentially many lines of body content...", {
  x: 0.5, y: 1.5, w: 8, h: 0.5, fontSize: 12,
  autoFit: true,      // ← must be explicitly written
});

// ③ Fixed layout with known line count → manually calculate h
// Rule of thumb: fontSize 10pt ≈ 0.19"/line, 12pt ≈ 0.22"/line, 14pt ≈ 0.26"/line
// Formula: h = line count × line height + 0.1 (padding buffer)
const lines = 3, lineH = 0.26;   // fontSize 14pt
slide.addText("Three lines of content", { x: 0.5, y: 1, w: 8, h: lines * lineH + 0.1, fontSize: 14 });
```

| Scenario | Required |
| -------- | -------- |
| Single-line labels (titles, numbers, legends, etc.) | `shrinkText: true` + `h ≥ fontSize×1.4+0.1"` |
| Body text, descriptions, dynamic content | `autoFit: true` |
| Fixed card with known line count | Manually calculate `h` |

---

### 2. Text Overflowing Background Shape

**Root cause**: In PptxGenJS, text and background shapes are two completely independent elements. There is no "parent-child containment" relationship. The background rectangle is purely visual decoration with no clipping constraint on the text box — text that overflows the text box renders directly outside the rectangle.

**Correct approach: text box dimensions must be strictly bound to the background shape**:

```javascript
// ── Define card dimensions (single source of truth) ──────────────────────────
const card = { x: 1, y: 1.5, w: 3.5, h: 1.8 };
const PADDING = 0.15;   // Text-to-border padding

// ── Background shape ─────────────────────────────────────────
slide.addShape(pres.shapes.RECTANGLE, {
  ...card,
  fill: { color: "F0F9FF" },
  line: { color: "BAE6FD", width: 1 },
});

// ── Text box: derived from card dimensions minus padding, no standalone numbers ─
slide.addText("Card content text", {
  x: card.x + PADDING,
  y: card.y + PADDING,
  w: card.w - PADDING * 2,
  h: card.h - PADDING * 2,   // ← Must be derived from card.h, not hard-coded
  fontSize: 11,
  shrinkText: true,           // ← Safety net in case content is unexpectedly long
});
```

**For batch cards (grids, timeline callouts, etc.)**:

```javascript
const cards = [
  { x: 0.5, y: 1.5, label: "Item A", value: "120%" },
  { x: 4.0, y: 1.5, label: "Item B", value: "89%" },
];
const CARD_W = 3.2, CARD_H = 1.6, PAD = 0.15;

cards.forEach(c => {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: c.x, y: c.y, w: CARD_W, h: CARD_H,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.08 },
  });
  slide.addText(c.label, {
    x: c.x + PAD, y: c.y + PAD,
    w: CARD_W - PAD * 2, h: 0.3,
    fontSize: 10, color: "64748B", shrinkText: true,
  });
  slide.addText(c.value, {
    x: c.x + PAD, y: c.y + PAD + 0.35,
    w: CARD_W - PAD * 2, h: CARD_H - PAD * 2 - 0.35,
    fontSize: 28, bold: true, color: "0F172A", shrinkText: true,
  });
});
```

**Checklist**:

- [ ] Every text box's `x/y/w/h` is derived from its corresponding background shape variable — no standalone hard-coded numbers
- [ ] All text boxes have `shrinkText: true` or `autoFit: true` as a safety net
- [ ] After generation, use `markitdown` to extract text and confirm content is complete and untruncated

---

## Layout Planning: Required Reading Before Writing Coordinates

**All element `x`/`y` coordinates must be derived from named variables — magic numbers are prohibited.**

```javascript
// ── Slide constants ──────────────────────────────────────────
const SW = 10;      // Slide width
const SH = 5.625;   // Slide height (LAYOUT_16x9)
const PAD = 0.4;    // Page margin

// ── Area layout ──────────────────────────────────────────
const TITLE_Y = PAD;
const TITLE_H = 0.6;
const BODY_Y  = TITLE_Y + TITLE_H + 0.2;       // Gap below title
const BODY_H  = SH - BODY_Y - PAD - 0.35;      // Reserve bottom space for page badge
const BODY_X  = PAD;
const BODY_W  = SW - PAD * 2;

// ── For columns ────────────────────────────────────────────
const GAP   = 0.3;
const COL_W = (BODY_W - GAP) / 2;
const COL1_X = BODY_X;
const COL2_X = BODY_X + COL_W + GAP;
```

**Boundary rule**: every element's `y + h ≤ BODY_Y + BODY_H`, `x + w ≤ SW - PAD`.

### Development-time Bounds Check

```javascript
function assertBounds(label, x, y, w = 0, h = 0) {
  if (x + w > SW - PAD + 0.01) console.warn(`[overflow-x] ${label}`);
  if (y + h > SH - 0.3  + 0.01) console.warn(`[overflow-y] ${label}`);
}
// Call once before placing each element
assertBounds('chart', 0.5, 1, 9, 4);
```

---

## Text Box Overlaps

**Root cause**: Multiple text boxes in the same area each have hard-coded coordinates with no dependencies. Adjusting one box's dimensions won't move adjacent boxes, causing them to overlap. PptxGenJS doesn't error or reposition — it renders them stacked.

**Defensive rule: within the same row or column, each subsequent box's starting coordinate must be derived from the previous box.**

```javascript
// ── Horizontal side-by-side (e.g. badge + title) ────────────────────────────
const A_X = 0.4, A_W = 0.75;   // First element
const GAP = 0.15;
const B_X = A_X + A_W + GAP;   // ← Second element x derived from first, not hard-coded
const B_W = containerW - B_X;  // Remaining width

// ── Progress bar + right label (classic right-overflow scenario) ────────────
// ❌ Wrong: barW hard-coded, no space reserved for label, barX + barW + gap + labelW exceeds SW
const barW_wrong = 4.8;  // Will overflow

// ✅ Correct: define right label width first, then derive barW
const BAR_X = 4.5, LABEL_W = 1.8, GAP2 = 0.15;
const BAR_W = SW - PAD - BAR_X - GAP2 - LABEL_W;  // All remaining space goes to bar
// Label: x = BAR_X + BAR_W + GAP2, w = LABEL_W, right edge = SW - PAD ✓

// ── Vertical stack (e.g. title + subtitle + body) ──────────────────────────
const TITLE_Y = 1.2, TITLE_H = 0.5;
const SUB_Y   = TITLE_Y + TITLE_H + 0.1;   // ← Derived from bottom of previous element
const BODY_Y2 = SUB_Y + 0.3 + 0.1;

// ── Large number card (number + label) ────────────────────────────
// ❌ Common error: h too small + label y hard-coded, causing overlap
slide.addText("3,100", { y: cardY + 0.15, h: 0.45, fontSize: 48, shrinkText: true });
slide.addText("Market Size", { y: cardY + 0.55, h: 0.3 });  // 0.15+0.45=0.60, label starts at 0.55 — overlap!

// ✅ Correct: sufficient h, label y derived from number bottom
const numY = cardY + 0.15;
const numH = 1.1;   // 48pt × 1.4/72 + 0.1 ≈ 1.03", use 1.1"
slide.addText("3,100", { y: numY, h: numH, fontSize: 48, margin: 0, shrinkText: true });
const labelY = numY + numH + 0.05;   // ← Derived from bottom, not hard-coded
slide.addText("Market Size", { y: labelY, h: cardH - (labelY - cardY) - 0.05, ... });

// ── Batch elements (cards, list rows) ────────────────────────────
// Use loop + cumulative y, don't manually list each y
let curY = BODY_Y;
items.forEach(item => {
  const itemH = 0.7;
  slide.addText(item.title, { x: BODY_X, y: curY, w: BODY_W, h: itemH, shrinkText: true });
  curY += itemH + 0.1;   // ← Increments each time, next element auto-avoids
});
```

**Checklist**:

- [ ] Horizontal side-by-side: right box `x = left box x + left box w + gap`
- [ ] Vertical stack: lower box `y = upper box y + upper box h + gap`
- [ ] Batch elements use cumulative variables `curY`/`curX`, don't manually write each coordinate
- [ ] `gap ≥ 0.08"` (minimum spacing — below this value elements appear nearly touching)

---

## Text Wrapping and Clipping

**Cause**: `h` is hard-coded, but font size and content length vary at runtime.

```javascript
// Fixed position labels (e.g. numeric callouts, legends) → shrinkText
slide.addText("Longer label", { x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12, shrinkText: true });

// Body paragraphs → autoFit (text box expands downward)
slide.addText("Longer content...", { x: 0.5, y: 1, w: 8, h: 0.5, fontSize: 12, autoFit: true });

// Fixed layout with known line count → manually calculate h
// Rule of thumb: fontSize 12pt → ~0.22"/line; 14pt → ~0.26"/line
// Formula: h = lineCount * lineHeight + 0.1
const h = 3 * 0.26 + 0.1;  // 14pt, 3 lines
slide.addText("Three lines of text", { x: 0.5, y: 1, w: 8, h, fontSize: 14 });
```

| Scenario | Approach |
| -------- | -------- |
| Single-line labels, numeric callouts | `shrinkText: true` |
| Body text, description paragraphs | `autoFit: true` |
| Fixed layout with known line count | Manually calculate `h` |

---

## Table Overflowing the Page

**⚠️ `sum(colW)` must equal `w`, otherwise the table overflows the right boundary**: PptxGenJS uses `colW` to render each column width — the `w` parameter is ignored. If they differ, the actual table width = `x + sum(colW)`, and any excess directly overflows the slide.

```javascript
// ❌ Wrong: colW sums to 10.0", but w: 9.2" — table right edge = 0.4 + 10.0 = 10.4", overflow
s6.addTable(data, { x: 0.4, w: 9.2, colW: [3.2, 1.7, 1.7, 1.7, 1.7] });  // 3.2+1.7×4=10.0

// ✅ Correct: define w first, then make colW sum equal to w
const TBL_W = SW - PAD * 2;  // 9.2"
s6.addTable(data, { x: PAD, w: TBL_W, colW: [3.0, 1.55, 1.55, 1.55, 1.55] });  // total: 9.2"
```

**Root cause**: The `h` in `addTable` is only an initial value — PptxGenJS auto-expands for many rows, regardless of page bounds.

```javascript
const ROW_H    = 0.28;   // Regular rows (fontSize 10-11pt)
const HEADER_H = 0.35;   // Header row
const startY   = 1.2;
const maxH     = SH - 0.35 - startY;   // Reserve space at bottom for page badge

// Pre-validate: truncate rows if overflow
const maxRows = Math.floor((maxH - HEADER_H) / ROW_H);
if (tableData.length - 1 > maxRows) {
  tableData = [tableData[0], ...tableData.slice(1, maxRows + 1)];
}

slide.addTable(tableData, {
  x: 0.5, y: startY, w: 9,
  rowH: ROW_H,          // Required — without this, many rows overflow the page
  colW: [3, 3, 3],      // Must sum to equal w
  fontSize: 10,
});
```

- Without `rowH`, PptxGenJS expands by content height — easily overflows with many rows
- For more than 8-10 rows, consider reducing `fontSize` (9-10pt) or splitting into two slides

---

## Generic Element Overlap Rules

| Overlap type | Root cause | Fix |
| ------------ | ---------- | --- |
| Title overlaps body | `BODY_Y` not derived from `TITLE_Y + TITLE_H` | Use area variables; don't hard-code y |
| Body overflows bottom | `BODY_H` doesn't account for bottom badge height | `BODY_H = SH - BODY_Y - PAD - 0.35` |
| Column elements overlap | Two-column x coordinates overlap | `COL2_X = COL1_X + COL_W + GAP` |
| Chart overlaps title | Chart y starts at 0 | Chart y must be ≥ `BODY_Y` |

---

## Timeline: Label Text Overlaps Axis Line

**Root cause**: Axis line position and label y coordinates are each hard-coded with no dependency. Changing one doesn't update the other.

### Correct approach: derive everything from AXIS_Y

```javascript
const N       = 5;
const AXIS_Y  = 2.8;     // Axis line y (vertically centered)
const AXIS_X1 = 0.8;
const AXIS_X2 = 9.2;
const DOT_R   = 0.12;    // Dot radius
const STEM_H  = 0.35;    // Stem length (determines gap between line and label, ≥ 0.3")
const LABEL_H = 0.5;     // Label text box height
const LABEL_W = 1.4;     // Label text box width

const step = (AXIS_X2 - AXIS_X1) / (N - 1);

// Pre-validation: label box must not be wider than node spacing
if (LABEL_W > step - 0.1) throw new Error(`LABEL_W ${LABEL_W} > step ${step}, adjacent labels will overlap`);

const nodes = Array.from({ length: N }, (_, i) => ({
  x: AXIS_X1 + i * step,
  year: `${2018 + i * 2}`,
  desc: "Description text",
  above: i % 2 === 0,   // Alternate above/below to prevent horizontal overlap
}));

// Axis line
slide.addShape(pres.shapes.LINE, {
  x: AXIS_X1, y: AXIS_Y, w: AXIS_X2 - AXIS_X1, h: 0,
  line: { color: "94A3B8", width: 2 },
});

nodes.forEach(node => {
  const dir = node.above ? -1 : 1;

  // Dot
  slide.addShape(pres.shapes.OVAL, {
    x: node.x - DOT_R, y: AXIS_Y - DOT_R, w: DOT_R * 2, h: DOT_R * 2,
    fill: { color: "2563EB" }, line: { color: "2563EB" },
  });

  // Stem: starts from dot edge, end = start + STEM_H
  const stemStart = AXIS_Y + dir * DOT_R;
  const stemEnd   = stemStart + dir * STEM_H;
  slide.addShape(pres.shapes.LINE, {
    x: node.x, y: Math.min(stemStart, stemEnd), w: 0, h: STEM_H,
    line: { color: "CBD5E1", width: 1 },
  });

  // Label: immediately after stem end, never overlaps the line
  const labelY = node.above ? stemEnd - LABEL_H : stemEnd;
  slide.addText([
    { text: node.year, options: { bold: true, breakLine: true, fontSize: 11 } },
    { text: node.desc, options: { fontSize: 9 } },
  ], {
    x: node.x - LABEL_W / 2, y: labelY, w: LABEL_W, h: LABEL_H,
    align: "center", valign: node.above ? "bottom" : "top",
    shrinkText: true,
  });
});
```

### Timeline Overlap Quick Reference

| Overlap type | Cause | Fix |
| ------------ | ----- | --- |
| Label overlaps axis line | `STEM_H` too small | `STEM_H ≥ 0.3"` |
| Adjacent labels overlap horizontally | `LABEL_W > step` | Reduce `LABEL_W` or decrease number of nodes |
| Upper label exceeds top boundary | `AXIS_Y` too high | `AXIS_Y ≥ BODY_Y + STEM_H + LABEL_H` |
| Lower label exceeds bottom boundary | `AXIS_Y` too low | `AXIS_Y + DOT_R + STEM_H + LABEL_H ≤ SH - PAD - 0.35` |

---

## Process Flow / Step Diagram: Node, Connector, and Arrow Coordinates Must Be Linked

**Root cause**: Circle nodes, horizontal connectors, and arrows each have hard-coded coordinates. Changing the number of nodes or spacing doesn't update the others, causing misaligned connectors, floating arrows, or arrows passing through circles.

**Correct approach: derive everything from the same set of named variables**:

```javascript
const N        = 5;       // Number of steps
const ROW_Y    = 1.6;     // Circle center y (horizontal flow diagram)
const START_X  = 0.9;     // First circle center x
const END_X    = 9.1;     // Last circle center x
const CIRCLE_R = 0.35;    // Circle radius
const ARROW_W  = 0.18;    // Arrow icon width (if using image/shape)

const step = (END_X - START_X) / (N - 1);   // Node spacing

// ── Connectors + arrows (must draw before circles, otherwise circles get covered) ──
for (let i = 0; i < N - 1; i++) {
  const lineX1 = START_X + i * step + CIRCLE_R;        // Start from circle edge
  const lineX2 = START_X + (i + 1) * step - CIRCLE_R; // End at next circle edge
  const lineW  = lineX2 - lineX1;
  const midX   = lineX1 + lineW / 2 - ARROW_W / 2;    // Center the arrow

  // Connector line
  slide.addShape(pres.shapes.LINE, {
    x: lineX1, y: ROW_Y, w: lineW, h: 0,
    line: { color: "94A3B8", width: 2 },
  });

  // Arrow (using triangle shape or icon)
  slide.addShape(pres.shapes.TRIANGLE, {   // Or replace with icon image
    x: midX, y: ROW_Y - 0.08, w: ARROW_W, h: 0.16,
    fill: { color: "94A3B8" }, line: { color: "94A3B8", width: 0 },
    rotate: 90,
  });
}

// ── Circle nodes (draw after connectors, covers excess line) ──
for (let i = 0; i < N; i++) {
  const cx = START_X + i * step;
  slide.addShape(pres.shapes.OVAL, {
    x: cx - CIRCLE_R, y: ROW_Y - CIRCLE_R,
    w: CIRCLE_R * 2, h: CIRCLE_R * 2,
    fill: { color: "1E3A5F" }, line: { color: "F4A300", width: 3 },
  });
  slide.addText(String(i + 1), {
    x: cx - CIRCLE_R, y: ROW_Y - CIRCLE_R,
    w: CIRCLE_R * 2, h: CIRCLE_R * 2,
    fontSize: 18, bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0,
    shrinkText: true,
  });
}
```

**Checklist**:

- [ ] Connector x start/end derived from `CIRCLE_R`, not hard-coded
- [ ] Arrow/separator x derived from connector midpoint, not written as a separate number
- [ ] Label text x below node derived from circle center x (`cx - LABEL_W / 2`)
- [ ] After changing node count (N), all coordinates auto-adjust
- [ ] Connectors and arrows drawn **before** circles (Z-order)

---

## Known Chart Bugs

### Pie Chart Missing Slice

When `values` contains `0`, PptxGenJS generates a sector with 0 area, which PowerPoint renders as a gap.

```javascript
// Filter zero values before generation
const data = rawData.filter(d => d.value > 0);
slide.addChart(pres.charts.PIE, [{
  name: "Share",
  labels: data.map(d => d.label),
  values: data.map(d => d.value),
}], { x: 2.5, y: 1, w: 4.5, h: 4.5, showPercent: true });
// Keep w:h at 1:1, otherwise circle becomes ellipse
```

### Line Chart Poor Point/Line Quality

```javascript
slide.addChart(pres.charts.LINE, chartData, {
  lineSize: 3,       // Default too thin, use 2-4
  lineSmooth: true,  // Smooth lines
  showPoint: true,   // ⚠️ Off by default — without this, lines appear to "float" with no endpoints
  valAxisMinVal: 0,  // Prevents y-axis range from being too wide, flattening the trend
});
```

### Scatter Chart Points/Lines Separated/Misaligned

`SCATTER` data format differs from other charts — the `labels` field is ignored; must use an array of `{x, y}` objects.

```javascript
// ❌ Wrong: labels+values format loses x coordinates in SCATTER, all points fall at x=0
slide.addChart(pres.charts.SCATTER, [{ labels: ["1","2"], values: [10, 20] }], {});

// ✅ Correct
slide.addChart(pres.charts.SCATTER, [{
  name: "Series 1",
  values: [{ x: 1, y: 10 }, { x: 2, y: 25 }, { x: 3, y: 18 }]
}], {
  lineSize: 0,      // 0 = scatter only; > 0 = points + line
  showPoint: true,
});
```
