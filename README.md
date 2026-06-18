# Resume Engine 🚀

Local-first AI resume, cover letter, and portfolio generator.
Works **fully offline** with a local LLM (Ollama) or optionally calls cloud APIs (OpenAI, Anthropic, Gemini) for higher quality writing.

---

## Quick Start

### 1. Prerequisites (one-time setup)

```bash
# Node.js 18+ required
node --version

# Install dependencies
npm install

# For local/offline LLM (free):
# 1. Download Ollama from https://ollama.com
# 2. Run: ollama pull llama3

# For GitHub publishing (free):
# 1. Create account at https://github.com/signup
# 2. Install gh CLI: winget install GitHub.cli
# 3. Authenticate: gh auth login
```

### 2. Set up your profile

Edit `profiles/rajesh/profile.json` — or copy that folder to create a new one for another person:

```
profiles/
  rajesh/          ← your profile
  wife/            ← add a new folder for another person
  brother/
```

Drop your source documents (any format) into `profiles/<name>/source-docs/`:
```
source-docs/
  resume.pdf
  linkedin-export.docx
  notes.txt
  work-history.md
  certificate.png    ← OCR supported
```

### 3. Run for an application

```bash
node run.js \
  --profile rajesh \
  --title "Platform Monitoring Engineer / Incident Manager" \
  --company Adyen \
  --role-short Platform-Monitoring-Engineer-Incident-Manager \
  --jd ./jd.txt
```

The engine will:
1. Parse all your source documents
2. Use the LLM to tailor resume content to the JD
3. Generate `Resume.docx`, `Resume.pdf`, `CoverLetter.docx`, `CoverLetter.pdf`
4. Build a role-specific portfolio website (HTML/CSS/JS)
5. Publish to GitHub Pages automatically
6. Update your job application tracker

---

## LLM Options

Set `llm.provider` in `config.json` or pass `--llm <provider>` on the CLI:

| Provider | Cost | Quality | Requires |
|---|---|---|---|
| `ollama` | Free, offline | Good (llama3) | [Ollama](https://ollama.com) installed |
| `openai` | ~$0.02–$0.08/run | Best | `OPENAI_API_KEY` env var |
| `anthropic` | Similar to OpenAI | Excellent | `ANTHROPIC_API_KEY` env var |
| `gemini` | Has free tier | Very good | `GEMINI_API_KEY` env var |

Setting API keys (Windows):
```powershell
$env:OPENAI_API_KEY = "sk-..."      # session only
# OR permanently:
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY","sk-...","User")
```

---

## Adding a New Person

1. Copy `profiles/rajesh/` → `profiles/<name>/`
2. Edit `profile.json`:
   - Set `name`, `contact`, `github.username`
   - Set `outputBase` and `portfolioReposBase` paths
   - Clear `stylePrefs.usedThemes` and reset `nextColorIndex` to 0
3. Drop their documents into `profiles/<name>/source-docs/`
4. If they don't have a GitHub account, see the guide below

### GitHub account setup (for new users)
1. Go to https://github.com/signup — it's free
2. Choose a username (e.g., `firstname-lastname`)
3. Install gh CLI: `winget install GitHub.cli`
4. Run: `gh auth login` and follow prompts
5. Update `profile.json` → `github.username`
6. Run the engine — it will create repos and publish automatically

---

## Skip Steps

```bash
# Skip GitHub publish (generate files only)
node run.js ... --no-publish

# Skip tracker update
node run.js ... --no-tracker

# Use a specific LLM for this run only
node run.js ... --llm openai
```

---

## Folder Structure

```
resume-engine/
├── run.js                     ← CLI entry point
├── config.json                ← LLM provider settings, portfolio themes
├── package.json
├── engine/
│   ├── ingest.js              ← Parse .docx, .pdf, .txt, .md, images (OCR)
│   ├── llm.js                 ← Swappable: Ollama | OpenAI | Anthropic | Gemini
│   ├── generate-resume.js     ← Resume .docx + .pdf
│   ├── generate-cover.js      ← Cover letter .docx + .pdf
│   ├── generate-portfolio.js  ← Portfolio HTML/CSS/JS site
│   ├── publish-github.js      ← GitHub repo creation + Pages enable
│   └── update-tracker.js      ← Inject entry into Job_Application_Tracker.html
├── profiles/
│   └── rajesh/
│       ├── profile.json       ← Identity, GitHub, output paths
│       ├── source-docs/       ← Drop any files here
│       └── output/            ← (Optional local output override)
└── templates/
    └── portfolio-themes/      ← Future: custom theme overrides
```

---

## Upgrading to Cloud / Multi-User (Option B → C)

This engine is designed to scale:

- **Option B** (cloud LLM, local execution): change one line in `config.json` → `llm.provider`.
- **Option C** (hosted SaaS for many users): wrap `run.js` in an Express/FastAPI server, add auth, move `profiles/` to a database or cloud storage. The engine logic stays identical.

---

## Supported Input Formats

| Format | How |
|---|---|
| `.txt` `.md` | Native read |
| `.docx` | mammoth library |
| `.pdf` | pdf-parse library |
| `.png` `.jpg` `.jpeg` `.webp` `.bmp` | Tesseract OCR |
| OneNote | Export to `.docx` or `.pdf` first |
| Google Drive | Download as `.docx` or `.pdf`, drop in source-docs/ |

---

## Manual Steps After Generation

These are intentional quality gates — do not automate them:
1. Review `.docx` files for content accuracy
2. Rename to `Rajesh_Dammala.docx` / `Rajesh_Dammala_CoverLetter.docx`
3. Change file sensitivity from Confidential-Internal → Public
