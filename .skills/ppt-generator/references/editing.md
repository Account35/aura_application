# Editing Presentations

## Template-Based Workflow

When using an existing presentation as a template:

1. **Analyze the existing slides**:
   ```bash
   python -m markitdown template.pptx
   ```
   Review the markitdown output to understand placeholder text and slide structure.

2. **Plan slide mapping**: Choose a template slide for each content section.

   ⚠️ **Use varied layouts** — monotony is a common failure mode. Actively look for:
   - Multi-column layouts (two-column, three-column)
   - Image + text combinations
   - Full-bleed images with text overlay
   - Pull quote or callout slides
   - Section divider slides
   - Stat callout slides
   - Icon grids or icon + text rows

3. **Unpack**: `python scripts/office/unpack.py template.pptx ./unpacked/`

4. **Inventory tables and charts** (do this **before** editing text):
   ```bash
   grep -rl "a:tbl" ./unpacked/ppt/slides/
   ls ./unpacked/ppt/charts/ 2>/dev/null
   ```
   Record which slides contain tables and which chart files exist — these all need data replacement.

5. **Build the presentation structure** (do this yourself, not with subagents):
   - Delete unwanted slides (remove from `<p:sldIdLst>`)
   - Duplicate slides to reuse: `python scripts/add_slide.py ./unpacked/ slide2.xml`
   - Reorder slides in `<p:sldIdLst>`
   - **Complete all structural changes before Step 6**

6. **Edit text content** — if subagents are available, use them here (slides are independent XML files, parallelizable):
   - Read the slide's XML
   - Identify **all** placeholder content — text, images, charts, icons, captions
   - Replace every placeholder with final content
   - **Use the Edit tool — not sed or Python scripts**

7. **Replace table data** (if tables present — see [Table Data Replacement](#table-data-replacement) below)

8. **Replace chart data** (if charts present — see [Chart Data Replacement](#chart-data-replacement) below)

9. **Clean**: `python scripts/clean.py ./unpacked/`

10. **Pack**: `python scripts/office/pack.py ./unpacked/ ./output.pptx --original template.pptx`

11. **Validate**:
    ```bash
    # XML structure validation (checks whether manual edits broke XML)
    python scripts/office/validate.py ./output.pptx

    # Content validation (checks for residual template data)
    python -m markitdown ./output.pptx | grep -iE "steaming|tapai|lorem|ipsum|xxxx|placeholder"
    ```
    XML validation errors = structural damage from editing; PowerPoint may open abnormally — fix recommended. Content validation matches = template data still present; fix before declaring success. Neither affects file generation itself.

---

## Script Reference

| Script | Purpose |
|--------|---------|
| `scripts/office/unpack.py` | Unpack and format PPTX output |
| `scripts/add_slide.py` | Duplicate a slide or create from layout |
| `scripts/clean.py` | Remove orphaned files |
| `scripts/office/pack.py` | Repack and validate |

---

## Table Data Replacement

**All previous skills failed here.** This section solves that.

### Find Tables

After unpacking, run:
```bash
grep -rl "a:tbl" ./unpacked/ppt/slides/
```

### Understanding Table Structure

Tables in PPTX XML look like this:
```xml
<a:tbl>
  <a:tr>                          <!-- Row -->
    <a:tc>                        <!-- Cell -->
      <a:txBody>
        <a:p>
          <a:r>
            <a:t>Cell text</a:t>   <!-- ← Actual content -->
          </a:r>
        </a:p>
      </a:txBody>
    </a:tc>
    <a:tc>
      <a:txBody><a:p><a:r><a:t>Another cell</a:t></a:r></a:p></a:txBody>
    </a:tc>
  </a:tr>
</a:tbl>
```

### Replacing Table Content

For each table cell, use the **Edit tool** to replace text inside `<a:t>`:

```xml
<!-- Before (template data) -->
<a:t>Steaming time</a:t>

<!-- After (actual content) -->
<a:t>Q1 Revenue</a:t>
```

**Work row by row**: read the full table XML first, plan all replacements, then execute them one by one. Don't guess — confirm the exact existing text before replacing.

### Multi-Run Cells

Some cells have text split across multiple runs:
```xml
<a:tc>
  <a:txBody><a:p>
    <a:r><a:rPr b="1"/><a:t>Bold </a:t></a:r>
    <a:r><a:t>Regular text</a:t></a:r>
  </a:p></a:txBody>
</a:tc>
```
You can replace each `<a:t>` value individually, or merge into a single run if formatting doesn't matter.

---

## Chart Data Replacement

Chart files are located at `./unpacked/ppt/charts/chartN.xml`.

### Understanding Chart Structure

```xml
<c:chartSpace>
  <c:chart>
    <c:plotArea>
      <c:barChart>
        <c:ser>                              <!-- One data series -->
          <c:tx><c:strRef>...</c:strRef></c:tx>   <!-- Series name -->
          <c:cat>                            <!-- Category labels (X axis) -->
            <c:strRef>
              <c:strCache>
                <c:ptCount val="4"/>
                <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                <c:pt idx="2"><c:v>Q3</c:v></c:pt>
                <c:pt idx="3"><c:v>Q4</c:v></c:pt>
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>                            <!-- Data values (Y axis) -->
            <c:numRef>
              <c:numCache>
                <c:ptCount val="4"/>
                <c:pt idx="0"><c:v>42</c:v></c:pt>
                <c:pt idx="1"><c:v>58</c:v></c:pt>
                <c:pt idx="2"><c:v>71</c:v></c:pt>
                <c:pt idx="3"><c:v>89</c:v></c:pt>
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>
```

### Replacing Chart Data

1. Read the chart XML
2. Replace `<c:v>` values inside `<c:cat>` (labels) and `<c:val>` (numbers)
3. If changing the number of data points, update `<c:ptCount val="N"/>` and adjust `idx` attributes

**Use the Edit tool** — replace specific `<c:v>` content rather than rewriting entire sections.

### After Replacing Chart Data

Chart XML also contains cached cell references like `<c:f>Sheet1!$A$2:$A$5</c:f>`. No need to update these — if there is no embedded workbook, PowerPoint reads directly from `<c:strCache>` / `<c:numCache>`.

---

## Editing Content (Text)

**Subagents**: Use after completing Step 5. Each slide is an independent XML file — subagents can edit them in parallel. Prompts to subagents must include:
- The file path of the slide to edit
- **"Use the Edit tool for all changes"**
- The format rules and common pitfalls below

For each slide:
1. Read the slide's XML
2. Identify **all** placeholder content — text, images, charts, icons, captions
3. Replace every placeholder with final content

**Use the Edit tool — not sed or Python scripts.**

### Format Rules

- **Bold all titles, subheadings, and inline labels**: set `b="1"` on `<a:rPr>`
- **No Unicode bullets (•)**: use `<a:buChar>` or `<a:buAutoNum>`
- **Bullet consistency**: let bullets inherit from the layout

---

## Common Pitfalls

### Template Adaptation

When source content has fewer items than the template:
- **Fully delete excess elements** (images, shapes, text boxes) — don't just clear the text
- After clearing text, check for orphaned visual elements
- Do a visual QA pass to catch count mismatches

When replacing text with content of different length:
- **Shorter replacements**: generally safe
- **Longer replacements**: may overflow — verify with visual QA

**Template slots ≠ source item count**: If the template has 4 team members but the source has only 3, delete the complete group for the 4th member (image + text box).

### Multi-Item Content

Create a separate `<a:p>` element for each item — don't concatenate into a single string.

```xml
<!-- ❌ Wrong -->
<a:p><a:r><a:t>Step one: do X. Step two: do Y.</a:t></a:r></a:p>

<!-- ✅ Correct -->
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr b="1"/><a:t>Step one</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:t>Execute X.</a:t></a:r>
</a:p>
```

### Smart Quotes

Handled automatically during unpack/pack. When adding new text containing quotes, use XML entities:

| Character | XML Entity |
|-----------|------------|
| `"` (left double quote) | `&#x201C;` |
| `"` (right double quote) | `&#x201D;` |
| `'` (left single quote) | `&#x2018;` |
| `'` (right single quote) | `&#x2019;` |

### Other Notes

- **Whitespace**: Use `xml:space="preserve"` on `<a:t>` when there are leading/trailing spaces
- **XML parsing**: Use `defusedxml.minidom`, not `xml.etree.ElementTree` (which destroys namespaces)
