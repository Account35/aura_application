# PptxGenJS Reference

> This file is an API quick reference. For layout pitfalls, overlap/overflow fixes, and chart bugs, see [pitfalls.md](pitfalls.md) — required reading before writing any JavaScript.

## Basic Setup & Structure

```javascript
const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';  // or 'LAYOUT_16x10', 'LAYOUT_4x3', 'LAYOUT_WIDE'
pres.author = 'Author Name';
pres.title = 'Presentation Title';

let slide = pres.addSlide();
slide.addText("Hello World!", { x: 0.5, y: 0.5, fontSize: 36, color: "363636" });

pres.writeFile({ fileName: "Presentation.pptx" });
```

## Layout Dimensions

Slide dimensions (coordinates in inches):
- `LAYOUT_16x9`: 10" × 5.625" (default)
- `LAYOUT_16x10`: 10" × 6.25"
- `LAYOUT_4x3`: 10" × 7.5"
- `LAYOUT_WIDE`: 13.3" × 7.5"

---

## Text & Formatting

```javascript
// Basic text
slide.addText("Simple text", {
  x: 1, y: 1, w: 8, h: 2, fontSize: 24, fontFace: "Arial",
  color: "363636", bold: true, align: "center", valign: "middle"
});

// Character spacing (use charSpacing — letterSpacing is silently ignored)
slide.addText("Spaced text", { x: 1, y: 1, w: 8, h: 1, charSpacing: 6 });

// Rich text array
slide.addText([
  { text: "Bold ", options: { bold: true } },
  { text: "Italic ", options: { italic: true } }
], { x: 1, y: 3, w: 8, h: 1 });

// Multi-line text (requires breakLine: true)
slide.addText([
  { text: "Line one", options: { breakLine: true } },
  { text: "Line two", options: { breakLine: true } },
  { text: "Line three" }
], { x: 0.5, y: 0.5, w: 8, h: 2 });

// Text box padding
slide.addText("Heading", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  margin: 0  // Set to 0 when precise alignment with shapes or icons is needed
});

// Prevent text wrapping: use shrinkText for fixed labels, autoFit for paragraphs (see pitfalls.md)
slide.addText("Label", { x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12, shrinkText: true });
```

**Tip:** Text boxes have default padding. Set `margin: 0` when you need text to align precisely with shapes, lines, or icons at the same x position.

---

## Lists & Bullets

```javascript
// ✅ Correct: multiple bullets
slide.addText([
  { text: "First item", options: { bullet: true, breakLine: true } },
  { text: "Second item", options: { bullet: true, breakLine: true } },
  { text: "Third item", options: { bullet: true } }
], { x: 0.5, y: 0.5, w: 8, h: 3 });

// ❌ Wrong: don't use Unicode bullets
slide.addText("• First item", { ... });  // produces double bullets

// Sub-items and numbered lists
{ text: "Sub-item", options: { bullet: true, indentLevel: 1 } }
{ text: "First", options: { bullet: { type: "number" }, breakLine: true } }
```

---

## Shapes

```javascript
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 0.8, w: 1.5, h: 3.0,
  fill: { color: "FF0000" }, line: { color: "000000", width: 2 }
});

slide.addShape(pres.shapes.OVAL, { x: 4, y: 1, w: 2, h: 2, fill: { color: "0000FF" } });

slide.addShape(pres.shapes.LINE, {
  x: 1, y: 3, w: 5, h: 0, line: { color: "FF0000", width: 3, dashType: "dash" }
});

// With transparency
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "0088CC", transparency: 50 }
});

// Rounded rectangle (⚠️ don't stack with accent borders, see pitfalls.md)
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" }, rectRadius: 0.1
});

// With shadow (offset must be non-negative, otherwise corrupts file)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" },
  shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.15 }
});
```

Shadow parameter reference:

| Property | Type | Range | Notes |
|----------|------|-------|-------|
| `type` | string | `"outer"`, `"inner"` | |
| `color` | string | 6-digit hex (e.g. `"000000"`) | No `#` prefix, no 8-digit hex — see common pitfalls |
| `blur` | number | 0-100 pt | |
| `offset` | number | 0-200 pt | **Must be non-negative** — negative values corrupt the file |
| `angle` | number | 0-359 degrees | Shadow cast direction (135 = bottom-right, 270 = upward) |
| `opacity` | number | 0.0-1.0 | Use this property to control opacity, not encoded in the color string |

For upward shadows (e.g. bottom bar), use `angle: 270` with a positive offset — **never** use a negative offset.

**Note**: Gradient fills are not natively supported. For gradients, use a gradient image as the background.

---

## Images

### Image Sources

```javascript
// From file path
slide.addImage({ path: "images/chart.png", x: 1, y: 1, w: 5, h: 3 });

// From URL
slide.addImage({ path: "https://example.com/image.jpg", x: 1, y: 1, w: 5, h: 3 });

// From base64 (faster, no file I/O)
slide.addImage({ data: "image/png;base64,iVBORw0KGgo...", x: 1, y: 1, w: 5, h: 3 });
```

### Image Options

```javascript
slide.addImage({
  path: "image.png",
  x: 1, y: 1, w: 5, h: 3,
  rotate: 45,              // 0-359 degrees
  rounding: true,          // Circular crop
  transparency: 50,        // 0-100
  flipH: true,             // Horizontal flip
  flipV: false,            // Vertical flip
  altText: "Descriptive text",  // Accessibility
  hyperlink: { url: "https://example.com" }
});
```

### Sizing Modes

```javascript
// Contain — fit container, preserve aspect ratio
{ sizing: { type: 'contain', w: 4, h: 3 } }

// Cover — fill area, preserve aspect ratio (may crop)
{ sizing: { type: 'cover', w: 4, h: 3 } }

// Crop — extract specific portion
{ sizing: { type: 'crop', x: 0.5, y: 0.5, w: 2, h: 2 } }
```

### Supported Formats

- **Standard formats**: PNG, JPG, GIF (animated GIF works in Microsoft 365)
- **SVG**: works in modern PowerPoint/Microsoft 365

**Preserving aspect ratio:**
```javascript
const origWidth = 1978, origHeight = 923, maxHeight = 3.0;
const calcWidth = maxHeight * (origWidth / origHeight);
slide.addImage({ path: "image.png", x: (10 - calcWidth) / 2, y: 1.2, w: calcWidth, h: maxHeight });
```

---

## Icons

Use react-icons to generate SVG icons, then rasterize to PNG for compatibility.

### Installation

```bash
npm install react-icons react react-dom sharp
```

```javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheckCircle, FaChartLine } = require("react-icons/fa");

function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}
```

### Adding Icons to Slides

```javascript
const iconData = await iconToBase64Png(FaCheckCircle, "#4472C4", 256);

slide.addImage({
  data: iconData,
  x: 1, y: 1, w: 0.5, h: 0.5  // inches
});
```

**Note**: Use a `size` of 256 or higher for crisp icons. `size` controls the rasterization resolution, not the display size on the slide (display size is controlled by the `w` and `h` inch values).

### Icon Libraries

Commonly used icon sets in react-icons:
- `react-icons/fa` — Font Awesome
- `react-icons/md` — Material Design
- `react-icons/hi` — Heroicons
- `react-icons/bi` — Bootstrap Icons

---

## Slide Backgrounds

```javascript
slide.background = { color: "F1F1F1" };
slide.background = { color: "FF3399", transparency: 50 };
slide.background = { data: "image/png;base64,iVBORw0KGgo..." };
```

---

## Tables

```javascript
slide.addTable([
  ["Header 1", "Header 2"],
  ["Cell 1", "Cell 2"]
], {
  x: 0.5, y: 1.2, w: 9,
  rowH: 0.28,           // Required — without this, many rows overflow the page (see pitfalls.md)
  colW: [4.5, 4.5],     // Must sum to equal w
  fontSize: 10,
  border: { pt: 0.5, color: "E2E8F0" },
  fill: { color: "F8FAFC" }
});

// Advanced usage (with merged cells)
let tableData = [
  [{ text: "Header", options: { fill: { color: "6699CC" }, color: "FFFFFF", bold: true } }, "Cell"],
  [{ text: "Merged", options: { colspan: 2 } }]
];
slide.addTable(tableData, { x: 1, y: 3.5, w: 8, colW: [4, 4] });
```

---

## Charts

```javascript
// Bar chart
slide.addChart(pres.charts.BAR, [{
  name: "Sales", labels: ["Q1", "Q2", "Q3", "Q4"], values: [4500, 5500, 6200, 7100]
}], { x: 0.5, y: 0.6, w: 6, h: 3, barDir: 'col' });

// Line chart (showPoint is off by default, must be explicitly enabled, see pitfalls.md)
slide.addChart(pres.charts.LINE, [{
  name: "Trend", labels: ["Jan", "Feb", "Mar"], values: [32, 35, 42]
}], { x: 0.5, y: 1, w: 9, h: 3.8, lineSize: 3, lineSmooth: true, showPoint: true });

// Pie chart (no 0 values, keep w:h at 1:1, see pitfalls.md)
slide.addChart(pres.charts.PIE, [{
  name: "Share", labels: ["A", "B", "Other"], values: [35, 45, 20]
}], { x: 2.5, y: 1, w: 4.5, h: 4.5, showPercent: true });

// Scatter chart (must use {x,y} object format, see pitfalls.md)
slide.addChart(pres.charts.SCATTER, [{
  name: "Series 1", values: [{ x: 1, y: 10 }, { x: 2, y: 25 }, { x: 3, y: 18 }]
}], { x: 0.5, y: 1, w: 9, h: 4, lineSize: 0, showPoint: true });
```

### Modern Chart Styles

```javascript
slide.addChart(pres.charts.BAR, chartData, {
  x: 0.5, y: 1, w: 9, h: 4, barDir: "col",
  chartColors: ["0D9488", "14B8A6", "5EEAD4"],
  chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true },
  catAxisLabelColor: "64748B", valAxisLabelColor: "64748B",
  valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: "1E293B",
  showLegend: false,
});
```

Key style options: `chartColors`, `chartArea`, `catGridLine/valGridLine`, `lineSmooth`, `legendPos` ("b"/"t"/"l"/"r"/"tr").

---

## Slide Masters

```javascript
pres.defineSlideMaster({
  title: 'TITLE_SLIDE', background: { color: '283A5E' },
  objects: [{
    placeholder: { options: { name: 'title', type: 'title', x: 1, y: 2, w: 8, h: 2 } }
  }]
});

let titleSlide = pres.addSlide({ masterName: "TITLE_SLIDE" });
titleSlide.addText("My Title", { placeholder: "title" });
```

---

## Common Pitfalls (API Level)

For more visual/layout issues see [pitfalls.md](pitfalls.md).

1. **Colors must not have `#` prefix** — `"FF0000"` ✅ / `"#FF0000"` ❌ (corrupts file)
2. **Never encode opacity in 8-digit color values** — use the `opacity` property instead
3. **Use `bullet: true` for bullets** — not Unicode `•` (causes double bullets)
4. **Use `breakLine: true`** to separate array items for multi-line text
5. **Use `paraSpaceAfter` for bullet spacing** — `lineSpacing` produces too much space
6. **Use a fresh instance per presentation** — do not reuse the `pptxgen()` object
7. **Never reuse options objects across calls** — PptxGenJS mutates objects in place (e.g. converts shadow values to EMU). Sharing the same object across calls corrupts the second shape.
   ```javascript
   const shadow = { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 };
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // ❌ Second call gets the already-converted values
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });

   const makeShadow = () => ({ type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 });
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });  // ✅ Fresh object each time
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });
   ```
8. **`ROUNDED_RECTANGLE` must not be stacked with accent borders** — the rectangle strip cannot cover rounded corners; use `RECTANGLE` instead
   ```javascript
   // ❌ Wrong: accent strip cannot cover rounded corners
   slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });

   // ✅ Correct: use RECTANGLE for clean alignment
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });
   ```

---

## Quick Reference

- **Shapes**: RECTANGLE, OVAL, LINE, ROUNDED_RECTANGLE
- **Charts**: BAR, LINE, PIE, DOUGHNUT, SCATTER, BUBBLE, RADAR
- **Layouts**: LAYOUT_16x9 (10"×5.625"), LAYOUT_16x10, LAYOUT_4x3, LAYOUT_WIDE
- **Alignment**: "left", "center", "right"
- **Chart data label position**: "outEnd", "inEnd", "center"
