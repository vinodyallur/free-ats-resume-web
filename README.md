# 📄 Free ATS Resume Builder — Web App

A **static website** that converts any resume (PDF, DOCX, or TXT) into a clean,
single-column, **ATS-friendly** one-page `.docx`. Everything runs **in the visitor's
browser** — there is no backend, so you can host it **free** on Netlify, GitHub Pages,
Cloudflare Pages, Vercel, or any static host.

> Sibling projects:
> [Chrome extension](https://github.com/vinodyallur/free-ats-resume-extension) ·
> [Python CLI/Streamlit](https://github.com/vinodyallur/free-ats-resume-builder).

---

## Two ways it builds your resume

- **Offline formatter (default, instant, no key):** a robust parser detects your name,
  contact details (incl. location & website), and sections, then rebuilds a clean
  ATS-safe DOCX. Drops ATS-noise sections (References, Declaration, Personal Details).
- **AI enhance (optional, near-perfect):** paste a **free Google Gemini API key** in the
  "AI enhance" panel. The text is sent — *from your browser, with your own key* — to
  Gemini, which rewrites weak bullets and structures everything perfectly, then the DOCX
  is built locally. If the AI call fails for any reason, it silently falls back to the
  offline formatter. Get a free key at
  <https://aistudio.google.com/app/apikey>.

---

## Run it locally

Because browsers block ES features over `file://`, serve the folder over HTTP:

```bash
# any one of these from inside this folder:
python -m http.server 8000      # then open http://localhost:8000
# or
npx serve .
```

---

## Deploy to Netlify (free)

There is **no build step** — Netlify just serves the files.

### Option 1 — Drag & drop (fastest)
1. Go to <https://app.netlify.com/drop>.
2. Drag this whole `free-ats-resume-web` folder onto the page.
3. Netlify gives you a live `https://<random>.netlify.app` URL instantly. Done.

### Option 2 — Connect a Git repo (auto-deploys on every push)
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project → pick the repo**.
3. Settings: **Build command:** _(leave empty)_ · **Publish directory:** `.`
4. Deploy. Every `git push` now redeploys automatically.

### Option 3 — Netlify CLI
```bash
npm install -g netlify-cli
netlify deploy --dir . --prod
```

The included [`netlify.toml`](netlify.toml) sets the publish directory and adds
caching headers for the bundled libraries.

---

## Deploy elsewhere (also free)

- **GitHub Pages:** push to a repo, then Settings → Pages → deploy from `main` / root.
- **Cloudflare Pages / Vercel:** import the repo, framework preset “None”, output dir `.`.

All work because this is just HTML/CSS/JS with no server.

---

## How it works

```text
free-ats-resume-web/
├── index.html        # landing page + uploader UI
├── styles.css
├── app.js            # file in -> DOCX download (glue)
├── src/
│   ├── extract.js    # PDF/DOCX/TXT -> text (pdf.js + fflate)
│   ├── parse.js      # heuristic section parser
│   ├── docx.js       # ATS-friendly DOCX generator (OOXML + fflate)
│   └── convert.js    # orchestrator
├── lib/              # vendored: fflate (MIT), pdf.js (Apache-2.0)
├── icons/
└── netlify.toml
```

## Privacy

No uploads, no analytics, no cookies. The resume is read, parsed, and rebuilt entirely
in the browser; the only “download” is the generated file saved to your own device.

## License

[MIT](LICENSE). Bundled libraries keep their own licenses: pdf.js (Apache-2.0),
fflate (MIT).
