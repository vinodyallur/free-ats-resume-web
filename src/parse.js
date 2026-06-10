/* Robust heuristic resume parser (JS).
 * Exposes: parseResume(text) -> { name, contact, sections }.
 */

const SECTION_MAP = {
  "professional summary": "Professional Summary",
  summary: "Professional Summary",
  "summary of qualifications": "Professional Summary",
  "career summary": "Professional Summary",
  "professional profile": "Professional Summary",
  objective: "Professional Summary",
  "career objective": "Professional Summary",
  profile: "Professional Summary",
  about: "Professional Summary",
  "about me": "Professional Summary",
  overview: "Professional Summary",
  experience: "Experience",
  "work experience": "Experience",
  "work history": "Experience",
  "professional experience": "Experience",
  "relevant experience": "Experience",
  "industry experience": "Experience",
  employment: "Experience",
  "employment history": "Experience",
  internship: "Experience",
  internships: "Experience",
  "internship experience": "Experience",
  "research experience": "Experience",
  "teaching experience": "Experience",
  "work and experience": "Experience",
  education: "Education",
  academics: "Education",
  "academic background": "Education",
  "academic qualifications": "Education",
  "educational qualifications": "Education",
  "education and training": "Education",
  "technical skills": "Technical Skills",
  skills: "Technical Skills",
  "key skills": "Technical Skills",
  "core skills": "Technical Skills",
  "core competencies": "Technical Skills",
  competencies: "Technical Skills",
  "technical proficiencies": "Technical Skills",
  "technical expertise": "Technical Skills",
  "areas of expertise": "Technical Skills",
  expertise: "Technical Skills",
  "skills and abilities": "Technical Skills",
  "skills summary": "Technical Skills",
  technologies: "Technical Skills",
  "tech stack": "Technical Skills",
  tools: "Technical Skills",
  "tools and technologies": "Technical Skills",
  projects: "Projects",
  "academic projects": "Projects",
  "personal projects": "Projects",
  "key projects": "Projects",
  "selected projects": "Projects",
  "notable projects": "Projects",
  certifications: "Certifications",
  certification: "Certifications",
  "certifications and achievements": "Certifications",
  "certifications and licenses": "Certifications",
  "licenses and certifications": "Certifications",
  "licenses & certifications": "Certifications",
  courses: "Certifications",
  coursework: "Certifications",
  "relevant coursework": "Certifications",
  training: "Certifications",
  trainings: "Certifications",
  achievements: "Achievements",
  "key achievements": "Achievements",
  "career highlights": "Achievements",
  highlights: "Achievements",
  awards: "Achievements",
  "awards and honors": "Achievements",
  "awards and achievements": "Achievements",
  "honors and awards": "Achievements",
  honors: "Achievements",
  accomplishments: "Achievements",
  "positions of responsibility": "Achievements",
  languages: "Languages",
  "languages known": "Languages",
  patents: "Patents",
  patent: "Patents",
  publications: "Publications",
  "research publications": "Publications",
  interests: "Interests",
  "areas of interest": "Interests",
  hobbies: "Interests",
  "hobbies and interests": "Interests",
  "extracurricular activities": "Activities",
  "extra-curricular activities": "Activities",
  "co-curricular activities": "Activities",
  activities: "Activities",
  volunteer: "Volunteer Experience",
  volunteering: "Volunteer Experience",
  "volunteer experience": "Volunteer Experience",
  references: "References",
  reference: "References",
  declaration: "Declaration",
  "personal details": "Personal Details",
  "personal information": "Personal Details",
  "personal profile": "Personal Details",
};

const NAME_BLACKLIST = new Set([
  "resume",
  "cv",
  "curriculum vitae",
  "bio data",
  "biodata",
  "personal profile",
  "profile",
]);

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w\-%./]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-%./]+/i;
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|dev|me|app|co|in|tech|site|page|xyz|portfolio|vercel\.app|netlify\.app|github\.io)(?:\/[\w\-%./?=&#]*)?/i;
const PHONE_RE = /(\+?\(?\d[\d\s().\-]{7,}\d)/g;
const LOCATION_RE =
  /^[A-Z][A-Za-z.]+(?:[ '\-][A-Z][A-Za-z.]+)*,\s*(?:[A-Z]{2}|[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*)(?:,\s*[A-Z][A-Za-z.]+)?$/;
const BULLET_RE =
  /^\s*(?:[•\-*\u2022\u25aa\u25cf\u25e6\u00b7\u2023\u2043\u25cb\u2219\u25b8\u25b9\u2756\u204c\u2767\u279c\u27a4]|\d+[.)])\s+/;
const PAGENUM_RE = /^\s*(?:page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i;

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?" +
  "|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const SEASON = "(?:Spring|Summer|Fall|Autumn|Winter)";
const YEAR = "(?:19|20)\\d{2}";
const SEPP = "\\s*(?:[-\\u2013\\u2014]|to|\\u2192)\\s*";
const MONYR = "(?:" + MONTH + "\\.?\\s*'?" + YEAR + "|" + SEASON + "\\s*" + YEAR + ")";
const ENDTOK = "(?:Present|Current|Ongoing|Now|Till\\s*Date|Date|" + MONYR + "|" + YEAR + ")";
const DATE_SRC =
  "(" +
  MONYR +
  SEPP +
  ENDTOK +
  "|" +
  YEAR +
  SEPP +
  "(?:Present|Current|Ongoing|Now|" +
  YEAR +
  ")" +
  "|" +
  MONYR +
  ")";

function _clean(s) {
  return s.replace(/\s+/g, " ").trim();
}

function _titleCase(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function _canonical(line) {
  const key = line
    .trim()
    .replace(/[:：]+$/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " and ")
    .toLowerCase();
  return SECTION_MAP[key] || null;
}

function _isHeader(line) {
  const s = line.trim().replace(/[:：]\s*$/, "");
  if (s.split(/\s+/).length > 6) return null;
  return _canonical(s);
}

// "Skills: Python, C++" -> { heading:"Technical Skills", rest:"Python, C++" }
function _inlineHeader(line) {
  const m = line.match(/^([A-Za-z][A-Za-z &/]{2,40}?)\s*[:：]\s*(\S.+)$/);
  if (!m) return null;
  const canon = _canonical(m[1]);
  if (!canon) return null;
  return { heading: canon, rest: _clean(m[2]) };
}

function _isContactLine(line) {
  const low = line.toLowerCase();
  const digits = (line.match(/\d/g) || []).length;
  return (
    EMAIL_RE.test(line) ||
    low.includes("linkedin.com") ||
    low.includes("github.com") ||
    low.includes("http") ||
    /\bwww\./.test(low) ||
    digits >= 7
  );
}

function _classifyToken(tokRaw, contact) {
  const tok = tokRaw.trim().replace(/^[|•·,\s]+|[|•·,\s]+$/g, "");
  if (!tok) return;
  let m;
  if (!contact.email && (m = tok.match(EMAIL_RE))) {
    contact.email = m[0];
    return;
  }
  if (!contact.linkedin && (m = tok.match(LINKEDIN_RE))) {
    contact.linkedin = m[0].replace(/^https?:\/\//, "");
    return;
  }
  if (!contact.github && (m = tok.match(GITHUB_RE))) {
    contact.github = m[0].replace(/^https?:\/\//, "");
    return;
  }
  const digits = (tok.match(/\d/g) || []).length;
  if (!contact.phone && digits >= 9 && (m = tok.match(PHONE_RE))) {
    const d = m[0].replace(/\D/g, "");
    if (d.length >= 9 && d.length <= 13) {
      contact.phone = m[0].trim();
      return;
    }
  }
  if (!contact.location && LOCATION_RE.test(tok)) {
    contact.location = tok;
    return;
  }
  if (!contact.website && !/linkedin|github/i.test(tok) && !tok.includes("@") && (m = tok.match(URL_RE))) {
    contact.website = m[0].replace(/^https?:\/\//, "");
  }
}

function _extractContact(text, lines) {
  const contact = {};
  let m = text.match(EMAIL_RE);
  if (m) contact.email = m[0];
  m = text.match(LINKEDIN_RE);
  if (m) contact.linkedin = m[0].replace(/^https?:\/\//, "");
  m = text.match(GITHUB_RE);
  if (m) contact.github = m[0].replace(/^https?:\/\//, "");

  const head = text.slice(0, 1400);
  PHONE_RE.lastIndex = 0;
  let pm;
  while ((pm = PHONE_RE.exec(head)) !== null) {
    const d = pm[0].replace(/\D/g, "");
    if (d.length >= 9 && d.length <= 13) {
      contact.phone = pm[0].trim();
      break;
    }
  }

  // Classify delimited tokens in the header region (location/website + fixes).
  const region = lines.slice(0, 12);
  for (const ln of region) {
    if (!ln.trim()) continue;
    const tokens = ln.split(/\s*[|•·\u2022]\s*|\s{2,}|\s+\u2013\s+/);
    for (const t of tokens) _classifyToken(t, contact);
  }
  // A line that is purely a location (e.g. "Bengaluru, India").
  if (!contact.location) {
    for (const ln of region) {
      const s = ln.trim().replace(/^[•·|]\s*/, "");
      if (LOCATION_RE.test(s)) {
        contact.location = s;
        break;
      }
    }
  }
  return contact;
}

function _extractName(lines) {
  for (const ln of lines.slice(0, 8)) {
    const s = ln.trim();
    if (!s || _isContactLine(s) || _canonical(s)) continue;
    if (NAME_BLACKLIST.has(s.toLowerCase())) continue;
    const cleaned = s
      .replace(/,\s*(?:Ph\.?D|MBA|M\.?S|B\.?E|B\.?Tech|M\.?Tech|BSc|MSc|PMP)\.?$/i, "")
      .trim();
    const words = cleaned.split(/\s+/);
    if (
      words.length >= 1 &&
      words.length <= 5 &&
      /^[A-Za-z][A-Za-z .,'\-]+$/.test(cleaned)
    ) {
      return cleaned;
    }
  }
  return lines.length ? lines[0].trim() : "Your Name";
}

function _splitDate(line) {
  const re = new RegExp(DATE_SRC, "ig");
  let best = null;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (line.length - (m.index + m[0].length) <= 6) best = m;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (best) {
    const date = _clean(best[0]);
    const title = line.slice(0, best.index).replace(/[ |\-\u2013\u2014\t,]+$/, "");
    return [_clean(title) || _clean(line), date];
  }
  // Date at the very start of the line.
  re.lastIndex = 0;
  const first = re.exec(line);
  if (first && first.index <= 2) {
    const date = _clean(first[0]);
    const title = line
      .slice(first.index + first[0].length)
      .replace(/^[ |\-\u2013\u2014\t,]+/, "");
    return [_clean(title) || _clean(line), date];
  }
  return [_clean(line), ""];
}

function _mergeSections(sections) {
  const merged = [];
  const index = {};
  for (const sec of sections) {
    if (index[sec.heading]) {
      index[sec.heading].entries.push(...sec.entries);
    } else {
      index[sec.heading] = { heading: sec.heading, entries: sec.entries.slice() };
      merged.push(index[sec.heading]);
    }
  }
  return merged;
}

function _dedupeBullets(sections) {
  for (const sec of sections) {
    for (const entry of sec.entries) {
      const seen = new Set();
      entry.bullets = entry.bullets.filter((b) => {
        const k = b.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    // Drop empty entries (no title and no bullets).
    sec.entries = sec.entries.filter(
      (e) => (e.title && e.title.trim()) || e.bullets.length
    );
  }
  return sections.filter((s) => s.entries.length);
}

function parseResume(text) {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map((ln) => ln.replace(/\s+$/, ""));
  const nonempty = lines.filter((ln) => ln.trim());

  const contact = _extractContact(text, lines);
  const name = _extractName(nonempty);

  let sections = [];
  let current = null;
  let currentEntry = null;
  let started = false;
  const preamble = [];

  for (const ln of lines) {
    const s = ln.trim();
    if (!s) continue;
    if (PAGENUM_RE.test(s)) continue;

    const head = _isHeader(s);
    if (head) {
      current = { heading: head, entries: [] };
      sections.push(current);
      currentEntry = null;
      started = true;
      continue;
    }

    // Inline header like "Skills: Python, C++" — but not for sub-labels
    // ("Languages:", "Tools:", "Cloud:") that live inside a Technical Skills block.
    const inSkills = current && current.heading === "Technical Skills";
    const inline = inSkills ? null : _inlineHeader(s);
    if (inline) {
      current = { heading: inline.heading, entries: [] };
      sections.push(current);
      currentEntry = { title: "", date: "", bullets: [inline.rest] };
      current.entries.push(currentEntry);
      started = true;
      continue;
    }

    if (!started) {
      if (s !== name && !_isContactLine(s) && !LOCATION_RE.test(s)) preamble.push(s);
      continue;
    }

    if (BULLET_RE.test(ln)) {
      const bullet = _clean(ln.replace(BULLET_RE, ""));
      if (bullet.length < 2) continue;
      if (currentEntry === null) {
        currentEntry = { title: "", date: "", bullets: [] };
        current.entries.push(currentEntry);
      }
      currentEntry.bullets.push(bullet);
    } else {
      const [title, date] = _splitDate(s);
      currentEntry = { title, date, bullets: [] };
      current.entries.push(currentEntry);
    }
  }

  sections = _dedupeBullets(_mergeSections(sections));

  const preambleText = _clean(preamble.join(" "));
  if (preambleText && preambleText.length > 40) {
    const hasSummary = sections.some((s) => s.heading === "Professional Summary");
    if (!hasSummary) {
      sections.unshift({
        heading: "Professional Summary",
        entries: [{ title: preambleText, date: "", bullets: [] }],
      });
    }
  }

  return { name, contact, sections };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseResume };
}
