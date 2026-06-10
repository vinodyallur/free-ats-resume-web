/* Orchestrator: file in -> { blob, filename } out. Exposes: convertResume(file, opts). */

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function convertResume(file, opts) {
  opts = opts || {};
  const text = await extractText(file);
  if (!text || !text.trim()) {
    throw new Error("No readable text found in this file. If it's a scanned PDF, it has no selectable text.");
  }

  let structured;
  if (opts.apiKey && typeof structureWithAI === "function") {
    structured = await structureWithAI(text, {
      apiKey: opts.apiKey,
      model: opts.model,
      onWarn: opts.onWarn,
    });
  } else {
    structured = parseResume(text);
  }

  const { bytes, filename } = buildDocx(structured);
  const blob = new Blob([bytes], { type: DOCX_MIME });
  return { blob, filename, structured };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { convertResume };
}
