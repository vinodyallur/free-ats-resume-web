/* Text extraction for PDF / DOCX / TXT — runs entirely in the browser.
 * Globals used: pdfjsLib (pdf.js UMD), fflate (UMD). Exposes: extractText(file).
 */

function _decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

async function _extractPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let line = "";
    for (const item of content.items) {
      if (item.str) line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

async function _extractDocx(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = fflate.unzipSync(buf);
  const docXml = files["word/document.xml"];
  if (!docXml) throw new Error("Could not read DOCX (missing word/document.xml).");
  const xml = fflate.strFromU8(docXml);

  const paras = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  const out = [];
  for (const p of paras) {
    const isList =
      /<w:numPr>/.test(p) ||
      /<w:pStyle[^>]*w:val="[^"]*(?:List|Bullet)[^"]*"/i.test(p);
    let t = p.replace(/<w:tab\b[^>]*\/>/g, "\t");
    t = t.replace(/<[^>]+>/g, "");
    t = _decodeEntities(t).trim();
    if (!t) {
      out.push("");
      continue;
    }
    out.push(isList ? "\u2022 " + t : t);
  }
  return out.join("\n");
}

async function extractText(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return _extractPdf(file);
  if (name.endsWith(".docx")) return _extractDocx(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
  if (name.endsWith(".doc")) {
    throw new Error(
      "Old .doc files aren't supported. Please save as .docx, PDF, or TXT and try again."
    );
  }
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { extractText };
}
