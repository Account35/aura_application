# Slide Page Types

Classify **every slide** as exactly one of the following **5 types** — none may be omitted:

## 1. Cover Page

- **Purpose**: Opening + setting the tone
- **Content**: Main title, subtitle/presenter, date/occasion, strong background/visual motif

### Layout Options

**Asymmetric left-right layout**
- Text concentrated on one side, image on the other
- Best for: corporate presentations, product launches, professional reports
```
|  Title & Subtitle  |    Visual/Image    |
|  Description       |                    |
```

**Center-aligned layout**
- Content centered, background image fills the slide
- Best for: motivational talks, event showcases, creative pitches
```
|                                        |
|           [Background Image]           |
|              Main Title                |
|              Subtitle                  |
|                                        |
```

### Font Hierarchy

| Element | Recommended Size | Ratio to Base |
|---------|-----------------|---------------|
| Main title | 72-120px | 3x-5x |
| Subtitle | 28-40px | 1.5x-2x |
| Supporting text | 18-24px | 1x (base) |
| Meta info (date, name) | 14-18px | 0.7x-1x |

**Key principles:**
1. **Dramatic contrast**: Main title should be at least 2-3x larger than subtitle
2. **Visual anchor**: The largest text becomes the focal point
3. **Clear hierarchy**: Audience should instantly identify what's most important
4. **Avoid similarity**: Adjacent text elements must differ by at least 20% in size

### Content Elements

1. **Main title** — required, largest font size
2. **Subtitle** — when supplementary context is needed (noticeably smaller than main title)
3. **Icon** — use when it reinforces the theme
4. **Date/event info** — use when relevant (smallest text)
5. **Company/brand logo** — use when representing an organization
6. **Presenter name** — use for keynote presentations (small, understated)

### Design Decisions

Consider: purpose (corporate/educational/creative), audience, tone, content volume, required visual assets.

### Workflow

1. **Analyze**: understand theme, audience, purpose
2. **Choose layout**: based on content
3. **Write slide**: use PptxGenJS, add visual interest with shapes and SVG elements
4. **Validate**: generate preview as `slide-XX-preview.pptx`, extract text with `python -m markitdown`, confirm content is complete and free of placeholders

---

## 2. Table of Contents

- **Purpose**: Navigation + setting expectations (3-5 sections)
- **Content**: Section list (optional icons/page numbers)

### Layout Options

**Numbered vertical list** — best for 3-5 sections, simple and direct
```
|  Contents                      |
|                                |
|  01  First Section Title       |
|  02  Second Section Title      |
|  03  Third Section Title       |
```

**Two-column grid** — best for 4-6 sections, content-rich presentations
```
|  Contents                              |
|                                        |
|  01  First Section   02  Second        |
|      Description         Description  |
|  03  Third Section   04  Fourth        |
```

**Sidebar navigation** — best for 3-5 sections, modern/corporate style
```
| ▌01 |  First Section Title         |
| ▌02 |  Second Section Title        |
| ▌03 |  Third Section Title         |
```

**Card style** — best for 3-4 sections, creative/modern style
```
|  Contents                                     |
|  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐           |
|  │ 01  │  │ 02  │  │ 03  │  │ 04  │           |
|  │Title│  │Title│  │Title│  │Title│           |
|  └─────┘  └─────┘  └─────┘  └─────┘           |
```

### Font Hierarchy

| Element | Recommended Size | Ratio to Base |
|---------|-----------------|---------------|
| Page title ("Contents"/"Agenda") | 36-44px | 2.5x-3x |
| Section number | 28-36px | 2x-2.5x |
| Section title | 20-28px | 1.5x-2x |
| Section description | 14-16px | 1x (base) |

**Key principles:**
1. **Clear numbering**: Section numbers should be visually prominent — bold, accent color, or larger
2. **Scannable structure**: Audience should scan all sections within 2-3 seconds
3. **Consistent spacing**: Equal spacing between sections
4. **Visual markers**: Colored dots, lines, numbers, or icons anchor each section
5. **Avoid clutter**: Descriptions max one line, or omit entirely

### Content Elements

1. **Page title** — required ("Contents", "Agenda", "Overview")
2. **Section numbers** — consistent format (01, 02... or I, II...)
3. **Section titles** — clear and concise
4. **Section descriptions** — optional one-line summary
5. **Visual separators** — SVG divider lines or spacing
6. **Decorative elements** — understated accent shapes
7. **Page number badge** — **required**

### Design Decisions

1. **Section count**: 3 → vertical list; 4-6 → grid or compact; 7+ → multi-column
2. **Description length**: long → vertical list; no descriptions → compact grid/cards
3. **Tone**: corporate → numbered list; creative → card style; academic → Roman numerals
4. **Consistency**: match the visual style of the cover page

### Workflow

1. **Analyze**: section list, count, presentation context
2. **Choose layout**: based on section count and content
3. **Plan visual hierarchy**: numbering style, font sizes, spacing
4. **Write slide**: use PptxGenJS, use shapes for decorative elements, **must include page number badge**
5. **Validate**: generate preview, extract text with markitdown, confirm content and badge

---

## 3. Section Divider

- **Purpose**: Clear transition between major sections
- **Content**: Section number + title (optional 1-2 line introduction)

### Layout Options

**Bold centered** — best for minimal, modern presentations
```
|                  02                    |
|           Section Title                |
|         Optional intro text           |
```

**Left-aligned with accent block** — best for corporate, structured presentations
```
| ████ |  02                            |
| ████ |  Section Title                 |
| ████ |  Optional intro text           |
```

**Split background** — best for high-contrast, dramatic transitions
```
| ██████████ |     Section Title         |
| ██  02  ██ |     Optional intro        |
| ██████████ |                           |
```

**Full-bleed background with overlay** — best for creative, bold presentations
```
| ████████████████████████████████████  |
| ████       Large 02        █████████  |
| ████    Section Title       █████████  |
| ████████████████████████████████████  |
```

### Font Hierarchy

| Element | Recommended Size | Notes |
|---------|-----------------|-------|
| Section number | 72-120px | Bold, accent color or semi-transparent |
| Section title | 36-48px | Bold, clear, primary text color |
| Intro text | 16-20px | Light weight, understated color, optional |

**Key principles:**
1. **Prominent number**: Section number = most visually dominant element
2. **Strong title**: Large but clearly secondary to the number
3. **Minimal content**: Only number + title + optional one line
4. **Generous whitespace**: Leave lots of space — dividers are "pause" moments

### Content Elements

1. **Section number** — required. Format: `01`, `02`... or `I`, `II`... consistent with TOC
2. **Section title** — required, clear and concise
3. **Intro text** — optional 1-2 line description
4. **Decorative elements** — SVG accent shapes (bars, lines, geometric forms)
5. **Page number badge** — **required**

### Design Decisions

1. **Tone**: corporate → accent block; creative → full-bleed; minimal → bold centered
2. **Color**: use strong palette colors for background/accent; high-contrast text
3. **Consistency**: all divider pages in the same presentation use the same style
4. **Contrast with content pages**: visually distinct (different background color, more whitespace)

### Workflow

1. **Analyze**: section number, title, optional intro
2. **Choose layout**: based on content and tone
3. **Write slide**: use PptxGenJS, use shapes for decoration, **must include page number badge**
4. **Validate**: generate preview, extract text, confirm content and badge

---

## 4. Content Page

Choose a subtype based on content. Each content page belongs to exactly **one subtype**:

### Subtypes

**Text-based** — bullet lists, pull quotes, or short paragraphs
- Must still include icons or SVG shapes — no text-only slides
```
|  Slide Title                           |
|  * Bullet one                          |
|  * Bullet two                          |
|  * Bullet three                        |
```

**Image + text** — two-column or half-bleed image + text
```
|  Slide Title                           |
|  Text content  |  [Image/Visual]       |
|  and bullets   |                       |
```

**Data visualization** — chart (SVG bar/progress/donut) + key findings
- Must include data source
```
|  Slide Title                           |
|  [SVG Chart]   |  Key finding one      |
|                |  Key finding two      |
|                Source: xxx             |
```

**Comparison** — side-by-side columns (A vs B, pros/cons)
```
|  Slide Title                           |
|  ┌─ Option A ─┐  ┌─ Option B ─┐        |
|  │  Detail 1  │  │  Detail 1  │        |
|  └────────────┘  └────────────┘        |
```

**Timeline/process** — steps with arrows, journeys, phases
```
|  Slide Title                           |
|  [1] ──→ [2] ──→ [3] ──→ [4]          |
|  Step    Step    Step    Step          |
```

**Image showcase** — hero image, gallery, visual-first layout
```
|  Slide Title                           |
|  ┌────────────────────────────────┐   |
|  │         [Hero Image]           │   |
|  └────────────────────────────────┘   |
|  Caption or supporting text           |
```

### Font Hierarchy

| Element | Recommended Size | Notes |
|---------|-----------------|-------|
| Slide title | 36-44px | Bold, at the top |
| Section heading | 20-24px | Bold, for in-slide sections |
| Body text | 14-16px | Normal weight, left-aligned |
| Captions/sources | 10-12px | Understated color, minimum size |
| Data callout | 60-72px | Large bold numbers for key stats |

**Key principles:**
1. **Left-align body text** — never center paragraphs or bullet lists
2. **Font size contrast** — title must be 36pt+ to stand out from 14-16pt body
3. **Visual element required** — every content page must have at least one non-text element
4. **Whitespace** — minimum 0.5" margins, 0.3-0.5" between content blocks

### Content Elements

1. **Slide title** — required, at the top
2. **Main content** — varies by subtype: text, bullets, data, or comparison
3. **Visual element** — image, chart, icon, or SVG shape — **required**
4. **Source/caption** — when displaying data or external content
5. **Page number badge** — **required**

### Design Decisions

1. **Subtype first**: determine this first — it drives the overall layout
2. **Content density**: dense → multi-column or smaller font; light → larger elements with more whitespace
3. **Data vs narrative**: data-heavy → charts + number callouts; story-driven → images + pull quotes
4. **Variety**: each content page layout should differ from the previous one
5. **Consistency**: fonts, colors, and spacing must align with the overall theme

### Workflow

1. **Analyze**: content, determine subtype, plan layout
2. **Choose layout**: best option for the subtype and content density
3. **Write slide**: use PptxGenJS, use shapes for charts, decoration, icons, **must include page number badge**
4. **Validate**: generate preview as `slide-XX-preview.pptx`, extract text with markitdown, confirm content is complete, no placeholders, badge present

---

## 5. Summary/Closing Page

- **Purpose**: Wrap up + call to action
- **Content**: Key takeaways, call to action/next steps, contact info/QR code, acknowledgments

### Layout Options

**Key takeaways** — best for educational, corporate, data-driven presentations
```
|  Key Takeaways                         |
|  ✓  Takeaway one                      |
|  ✓  Takeaway two                      |
|  ✓  Takeaway three                    |
```

**Call to action / next steps** — best for sales pitches, proposals, project kickoffs
```
|  Next Steps                           |
|  [1] Action item one                  |
|  [2] Action item two                  |
|  Contact: email@example.com           |
```

**Acknowledgments / contact info** — best for conference talks, keynotes
```
|            Thank You                  |
|         name@company.com             |
|         @handle | website.com        |
```

**Split recap** — best for presentations that need both recap and action
```
|  Summary          |  Next Steps       |
|  * Takeaway one   |  Contact us       |
|  * Takeaway two   |  email@co.com    |
|  * Takeaway three |  [QR Code]        |
```

### Font Hierarchy

| Element | Recommended Size | Notes |
|---------|-----------------|-------|
| Closing title ("Thank You"/"Summary") | 48-72px | Bold, impactful |
| Takeaways/action items | 18-24px | Clear, scannable |
| Supporting text | 14-16px | Normal weight |
| Contact info | 14-16px | Understated color |

**Key principles:**
1. **Strong closing statement**: Primary message should be the largest and most prominent
2. **Scannable items**: Takeaways/action items concise (one line each)
3. **Clear contact info**: Readable but not visually dominant
4. **Memorable ending**: Confident, polished close

### Content Elements

1. **Closing title** — required
2. **Takeaways** — 3-5 concise summaries (if applicable)
3. **Call to action** — clear next steps (if applicable)
4. **Contact info** — email, website, social handles (if provided)
5. **Decorative elements** — SVG accents, maintain visual consistency
6. **Page number badge** — **required**

### Design Decisions

1. **Closing type**: recap, call to action, acknowledgment, or combination
2. **Content volume**: multiple takeaways → list; simple close → centered acknowledgment
3. **Audience action**: needs action → call to action; information only → takeaways
4. **Consistent tone**: emotional continuity with the cover page
5. **Visual distinction**: distinctive but cohesive with the overall theme

### Workflow

1. **Analyze**: closing content — takeaways, call to action, contact info, acknowledgments
2. **Choose layout**: based on content type
3. **Write slide**: use PptxGenJS, use shapes for decoration, **must include page number badge**
4. **Validate**: generate preview, extract text, confirm content and badge

---

## Additional Layout Patterns

Use these patterns in content pages to maintain visual variety:

- **Two-column** (text left, visual right)
- **Icon + text rows** (colored circle icons, bold titles, descriptions below)
- **2×2 or 2×3 grid** (image on one side, content block grid on the other)
- **Half-bleed image** (fills left or right side) with content overlay
- **Large stat callouts** (60-72pt large numbers with small labels below)
- **Comparison columns** (before/after, pros/cons)
- **Timeline or process flow** (numbered steps, arrows)
- **Icons in small colored circles** beside section headings
- **Italic emphasis text** for key data or taglines
