/* Minimal ATS-friendly DOCX generator (OOXML, zipped with fflate).
 * Mirrors the Python build.py style: single column, standard headings,
 * real bullet text, Calibri, 0.5" margins. Exposes: buildDocx(structured).
 *
 * Units: twips (1 inch = 1440), half-points for font size (10pt -> 20).
 */

const FONT = "Calibri";
const INLINE_HEADINGS = new Set(["Languages", "Interests"]);
const PARAGRAPH_HEADINGS = new Set(["Professional Summary"]);
// Sections that hurt ATS parsing / waste space — dropped from the output.
const SKIP_HEADINGS = new Set(["References", "Declaration", "Personal Details"]);

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// runs: [{ text, bold, size }] (size in points). Tabs in text -> <w:tab/>.
function _runXml(run) {
  const sizeHalf = Math.round((run.size || 10) * 2);
  let rPr = `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>`;
  if (run.bold) rPr += "<w:b/>";
  rPr += `<w:sz w:val="${sizeHalf}"/><w:szCs w:val="${sizeHalf}"/></w:rPr>`;
  const parts = String(run.text).split("\t");
  let content = "";
  parts.forEach((p, i) => {
    if (i > 0) content += "<w:tab/>";
    if (p !== "") content += `<w:t xml:space="preserve">${_esc(p)}</w:t>`;
  });
  return `<w:r>${rPr}${content}</w:r>`;
}

function _para(runs, opts = {}) {
  let pPr = "<w:pPr>";
  if (opts.border) {
    pPr +=
      '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>';
  }
  if (opts.indentLeft != null) {
    let ind = `<w:ind w:left="${opts.indentLeft}"`;
    if (opts.indentHanging != null) ind += ` w:hanging="${opts.indentHanging}"`;
    ind += "/>";
    pPr += ind;
  }
  if (opts.tabRight != null) {
    pPr += `<w:tabs><w:tab w:val="right" w:pos="${opts.tabRight}"/></w:tabs>`;
  }
  const before = opts.spaceBefore != null ? opts.spaceBefore : 0;
  const after = opts.spaceAfter != null ? opts.spaceAfter : 20;
  pPr += `<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>`;
  if (opts.align) pPr += `<w:jc w:val="${opts.align}"/>`;
  pPr += "</w:pPr>";
  return `<w:p>${pPr}${runs.map(_runXml).join("")}</w:p>`;
}

function _heading(text) {
  return _para([{ text: text.toUpperCase(), bold: true, size: 11 }], {
    spaceBefore: 80,
    spaceAfter: 40,
    border: true,
  });
}

function _bullet(runs) {
  return _para(runs, {
    indentLeft: 288,
    indentHanging: 144,
    spaceBefore: 0,
    spaceAfter: 20,
  });
}

function _contactLine(contact) {
  const order = ["location", "phone", "email", "linkedin", "github", "website"];
  const parts = order.filter((k) => contact && contact[k]).map((k) => contact[k]);
  return parts.join("  |  ");
}

function _renderSkills(entries) {
  const out = [];
  for (const entry of entries) {
    const items = (entry.title ? [entry.title] : []).concat(entry.bullets || []);
    for (const item of items) {
      const idx = item.indexOf(":");
      if (idx !== -1) {
        const label = item.slice(0, idx).trim();
        const value = item.slice(idx + 1).trim();
        out.push(
          _bullet([
            { text: "\u2022 " + label + ": ", bold: true, size: 10 },
            { text: value, size: 10 },
          ])
        );
      } else {
        out.push(_bullet([{ text: "\u2022 " + item, size: 10 }]));
      }
    }
  }
  return out;
}

function _renderInline(entries) {
  const items = [];
  for (const entry of entries) {
    if (entry.title) items.push(entry.title);
    items.push(...(entry.bullets || []));
  }
  if (!items.length) return [];
  return [_para([{ text: items.join(", "), size: 10 }], { spaceAfter: 20 })];
}

function _renderParagraph(entries) {
  const chunks = [];
  for (const entry of entries) {
    if (entry.title) chunks.push(entry.title);
    chunks.push(...(entry.bullets || []));
  }
  const text = chunks.join(" ").trim();
  if (!text) return [];
  return [_para([{ text, size: 10 }], { align: "both", spaceAfter: 40 })];
}

function _renderDefault(entries) {
  const out = [];
  for (const entry of entries) {
    const { title, date, bullets } = entry;
    if (title && date) {
      out.push(
        _para(
          [
            { text: title, bold: true, size: 10 },
            { text: "\t" + date, bold: true, size: 10 },
          ],
          { tabRight: 10800, spaceAfter: 20 }
        )
      );
    } else if (title) {
      out.push(_para([{ text: title, bold: true, size: 10 }], { spaceAfter: 20 }));
    }
    for (const b of bullets || []) {
      out.push(_bullet([{ text: "\u2022 " + b, size: 10 }]));
    }
  }
  return out;
}

function _documentXml(structured) {
  const body = [];

  body.push(
    _para([{ text: (structured.name || "Your Name").toUpperCase(), bold: true, size: 18 }], {
      align: "center",
      spaceAfter: 0,
    })
  );

  const contactLine = _contactLine(structured.contact || {});
  if (contactLine) {
    body.push(
      _para([{ text: contactLine, size: 10 }], { align: "center", spaceAfter: 40 })
    );
  }

  for (const section of structured.sections || []) {
    const entries = section.entries || [];
    if (!entries.length) continue;
    if (SKIP_HEADINGS.has(section.heading)) continue;
    body.push(_heading(section.heading));
    if (section.heading === "Technical Skills") {
      body.push(..._renderSkills(entries));
    } else if (INLINE_HEADINGS.has(section.heading)) {
      body.push(..._renderInline(entries));
    } else if (PARAGRAPH_HEADINGS.has(section.heading)) {
      body.push(..._renderParagraph(entries));
    } else {
      body.push(..._renderDefault(entries));
    }
  }

  const sectPr =
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" ' +
    'w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:body>" +
    body.join("") +
    sectPr +
    "</w:body></w:document>"
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:docDefaults><w:rPrDefault><w:rPr>" +
  `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` +
  '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault>' +
  "<w:pPrDefault><w:pPr>" +
  '<w:spacing w:after="20" w:line="240" w:lineRule="auto"/>' +
  "</w:pPr></w:pPrDefault></w:docDefaults>" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
  '<w:name w:val="Normal"/></w:style></w:styles>';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOC_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

function _safeName(name) {
  const base = (name || "resume").trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (base || "resume") + "_ATS.docx";
}

// Returns { bytes: Uint8Array, filename: string }
function buildDocx(structured) {
  const strToU8 = fflate.strToU8;
  const archive = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES_XML),
    "_rels/.rels": strToU8(ROOT_RELS_XML),
    "word/document.xml": strToU8(_documentXml(structured)),
    "word/styles.xml": strToU8(STYLES_XML),
    "word/_rels/document.xml.rels": strToU8(DOC_RELS_XML),
  };
  const bytes = fflate.zipSync(archive, { level: 6 });
  return { bytes, filename: _safeName(structured.name) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildDocx };
}
