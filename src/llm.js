/* Optional AI enhancement using Google Gemini, called directly from the browser.
 * The user supplies their own free API key (https://aistudio.google.com/app/apikey).
 * Nothing is sent anywhere except Google's API, with the user's own key.
 * Exposes: structureWithAI(text, { apiKey, model }) -> structured resume dict.
 * Falls back to the offline parser on any error.
 */

const AI_SCHEMA_HINT = {
  name: "Full Name",
  contact: {
    location: "City, Country",
    phone: "+00 0000000000",
    email: "name@example.com",
    linkedin: "linkedin.com/in/...",
    github: "github.com/...",
    website: "",
  },
  sections: [
    {
      heading: "Professional Summary",
      entries: [{ title: "2-3 line summary text", date: "", bullets: [] }],
    },
    {
      heading: "Technical Skills",
      entries: [{ title: "", date: "", bullets: ["Category: a, b, c"] }],
    },
    {
      heading: "Experience",
      entries: [
        { title: "Role — Company", date: "Mon YYYY – Mon YYYY", bullets: ["Achievement ..."] },
      ],
    },
  ],
};

const AI_PROMPT = `You are an expert resume writer specialising in ATS (Applicant Tracking System) optimisation.

Rewrite the resume text below into clean, structured JSON. Rules:
- Keep ALL real facts; never invent employers, dates, degrees, or numbers.
- Use standard, recognisable section headings (Professional Summary, Technical Skills,
  Experience, Projects, Education, Certifications, Achievements, Languages, etc.).
- Order sections by relevance: Summary, Skills, Experience, Projects, Education, then the rest.
- Group skills under short labelled categories like "Programming: C, C++, Python".
- Make every bullet concise, achievement-oriented, and keyword-rich; start with a strong
  past-tense verb; quantify impact when the source provides numbers.
- Write a crisp 2-3 line Professional Summary if one is missing.
- For each Experience/Project entry, put the role/title (and company) in "title" and any
  dates in "date" (format "Mon YYYY – Mon YYYY" or "YYYY – YYYY"); put details in "bullets".
- Omit references, declarations, and personal details (DOB, gender, marital status).
- Output ONLY valid JSON matching this exact shape (no markdown, no commentary):

__SCHEMA__

Resume text:
"""
__RESUME__
"""`;

function _stripFences(s) {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
  }
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  return t;
}

function _validStructured(data) {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.sections) &&
    data.sections.length > 0 &&
    data.sections.every((s) => s && s.heading && Array.isArray(s.entries))
  );
}

async function _callGemini(text, apiKey, model) {
  const prompt = AI_PROMPT.replace(
    "__SCHEMA__",
    JSON.stringify(AI_SCHEMA_HINT, null, 2)
  ).replace("__RESUME__", text);

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model || "gemini-1.5-flash") +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch (e) {
      /* ignore */
    }
    throw new Error("Gemini API error " + res.status + (detail ? ": " + detail : ""));
  }

  const data = await res.json();
  const parts =
    (data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts) ||
    [];
  const out = parts.map((p) => p.text || "").join("");
  if (!out) throw new Error("Gemini returned an empty response.");
  return JSON.parse(_stripFences(out));
}

async function structureWithAI(text, opts) {
  opts = opts || {};
  if (!opts.apiKey) {
    return parseResume(text);
  }
  try {
    const data = await _callGemini(text, opts.apiKey, opts.model);
    if (_validStructured(data)) {
      data.contact = data.contact || {};
      return data;
    }
    throw new Error("AI response was not in the expected format.");
  } catch (err) {
    if (opts.onWarn) opts.onWarn(err.message || String(err));
    // Graceful fallback: never fail the conversion just because AI was unavailable.
    return parseResume(text);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { structureWithAI };
}
