# Resume Engine — Quick Start Guide

## Location
```
C:\Users\v-rdammala\OneDrive - Microsoft\Desktop\Personal\Resumes\2026\resume-engine\
```

## Your Profile
- **Profile Name**: Rajesh
- **Profile JSON**: `profiles/Rajesh/profile.json`
- **Source Docs**: `profiles/Rajesh/source-docs/`
- **Output**: Configured to: `C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/`
- **Portfolio Repos**: `C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/Repos/`
- **GitHub Username**: `rdammala`
- **GitHub Pages Base**: `https://rdammala.github.io/`

## Prerequisites (One-Time Setup)

### 1. LLM Setup (Choose ONE)

**Option A: Free Offline (Recommended for bulk)**
```powershell
# Download Ollama from https://ollama.com
# Then run:
ollama pull llama3
```

**Option B: OpenAI (Best quality)**
```powershell
# Set API key (Windows - permanent)
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY","sk-...","User")

# Verify
$env:OPENAI_API_KEY
```

**Option C: Anthropic / Gemini / Groq (Alternative)**
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","sk-...","User")
# Similar for GEMINI_API_KEY, GROQ_API_KEY
```

### 2. GitHub Authentication
```powershell
# Already configured in profile.json
# Verify gh CLI is installed and authenticated
gh auth status
```

---

## Quick Commands

### 1. Generate for a Single Application

```powershell
cd "C:\Users\v-rdammala\OneDrive - Microsoft\Desktop\Personal\Resumes\2026\resume-engine"

# Example: Generate for Amazon SRE role
node run.js \
  --profile Rajesh \
  --title "Senior Manager, Site Reliability Engineering" \
  --company Amazon \
  --role-short "Senior-Manager-SRE" \
  --jd ./jd.txt
```

**What this does**:
1. ✅ Parses source resume + JD
2. ✅ Uses LLM to tailor resume content
3. ✅ Generates Resume.docx + Resume.pdf
4. ✅ Generates CoverLetter.docx + CoverLetter.pdf
5. ✅ Creates portfolio HTML/CSS/JS
6. ✅ Publishes to GitHub Pages
7. ✅ Updates Job_Application_Tracker.html

**Files created** (in `Resumes/2026/`):
```
Amazon/
  Rajesh_Dammala_Amazon_Senior-Manager-SRE_v1.docx
  Rajesh_Dammala_Amazon_Senior-Manager-SRE_v1.pdf
  Rajesh_Dammala_CoverLetter_Amazon_v1.docx
  Rajesh_Dammala_CoverLetter_Amazon_v1.pdf

Repos/
  Senior-Manager-SRE/
    index.html, style.css, script.js, favicon.svg, Rajesh_Dammala_Resume.pdf
```

### 2. Generate WITHOUT GitHub Publish
```powershell
node run.js \
  --profile Rajesh \
  --title "..." \
  --company Amazon \
  --role-short "..." \
  --jd ./jd.txt \
  --no-publish
```

### 3. Generate WITHOUT Tracker Update
```powershell
node run.js \
  --profile Rajesh \
  --title "..." \
  --company Amazon \
  --role-short "..." \
  --jd ./jd.txt \
  --no-tracker
```

### 4. Use Different LLM for This Run
```powershell
node run.js \
  --profile Rajesh \
  --title "..." \
  --company Amazon \
  --role-short "..." \
  --jd ./jd.txt \
  --llm openai       # or: anthropic, gemini, groq, ollama
```

### 5. Bulk Processing (Multiple Jobs)
```powershell
# Create jd-list.txt
# Line 1: company1|role1|jd1.txt
# Line 2: company2|role2|jd2.txt

# Then:
foreach ($line in Get-Content jd-list.txt) {
  $parts = $line.Split('|')
  node run.js --profile Rajesh --company $parts[0] --role-short $parts[1] --jd $parts[2]
}
```

---

## LLM Comparison

| Provider | Cost | Quality | Speed | Command |
|----------|------|---------|-------|---------|
| **ollama** | Free | Good | Slow (local) | `--llm ollama` |
| **openai** | $0.02–$0.08 | Best | Fast | `--llm openai` |
| **anthropic** | ~$0.03 | Excellent | Fast | `--llm anthropic` |
| **gemini** | Free tier | Very good | Fast | `--llm gemini` |
| **groq** | Low-cost | Good | Very fast | `--llm groq` |

**Recommendation for bulk applications**:
- **Budget-conscious**: Ollama (free, offline)
- **Quality-focused**: OpenAI (best writing)
- **Speed-focused**: Groq (fastest)
- **Balanced**: Anthropic (excellent + reasonable cost)

---

## Post-Generation Manual Steps

**IMPORTANT**: These quality gates are intentional — do NOT automate:

1. ✅ **Review .docx files** for content accuracy
2. ✅ **Rename files**: 
   - `Rajesh_Dammala_Amazon_Senior-Manager-SRE_v1.docx` → `Rajesh_Dammala.docx`
   - `Rajesh_Dammala_CoverLetter_Amazon_v1.docx` → `Rajesh_Dammala_CoverLetter.docx`
3. ✅ **Change file sensitivity**: Confidential-Internal → Public (in Word)
4. ✅ **Test portfolio link** on live GitHub Pages URL
5. ✅ **Verify tracker entry** was added correctly

---

## Workflow: From JD to Submission

### Step 1: Prepare JD File
```powershell
# Save job description to: jd.txt
# Make sure it includes: role title, company, requirements, responsibilities
```

### Step 2: Generate All Artifacts (2-3 minutes)
```powershell
cd "C:\Users\v-rdammala\OneDrive - Microsoft\Desktop\Personal\Resumes\2026\resume-engine"

node run.js \
  --profile Rajesh \
  --title "Senior Manager, Site Reliability Engineering" \
  --company Amazon \
  --role-short "Senior-Manager-SRE" \
  --jd ./jd.txt \
  --llm openai    # or your chosen provider
```

### Step 3: Quality Review (5 min)
- Open generated .docx resume & cover letter
- Review LLM-generated content
- Make any tweaks needed
- Test portfolio link on GitHub Pages

### Step 4: Submit
- Upload renamed files to job portal
- Note portfolio URL for application
- Update Job_Application_Tracker manually if not auto-updated

---

## Troubleshooting

### LLM Not Found Error
```
Error: OPENAI_API_KEY not set
```
**Fix**: 
```powershell
$env:OPENAI_API_KEY = "sk-your-key-here"
# Or set permanently:
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY","sk-...","User")
```

### GitHub Publish Failed
```
Error: gh auth failed
```
**Fix**:
```powershell
gh auth logout
gh auth login    # Re-authenticate
```

### Portfolio Not Showing on GitHub Pages
- Wait 2-3 minutes for GitHub Pages rebuild
- Verify repo was created: `gh repo list rdammala`
- Check Pages is enabled: `gh api repos/rdammala/<RepoName>/pages`

### Tracker Update Failed
- Verify tracker file exists at: `C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/career-focus-pages/Job_Application_Tracker.html`
- Run with `--no-tracker` and update manually if needed

---

## Integration with Your Existing Workflow

### Job_Application_Tracker.html
- Engine **auto-injects** new entries into your tracker
- Location: `Resumes/2026/Repos/career-focus-pages/Job_Application_Tracker.html`
- After running engine, verify entry was added (refresh tracker page)

### Portfolio Repos
- Engine creates repo: `Repos/<RoleName>/`
- Publishes to: `https://rdammala.github.io/<RoleName>/`
- Includes Resume download button

### Company Folders
- Engine creates: `Resumes/2026/<CompanyName>/`
- Stores: Resume, Cover Letter, Job_Details.md (auto-generated)

---

## Configuration Deep Dive

### Changing LLM Provider (Global)
Edit `config.json`:
```json
{
  "llm": {
    "provider": "openai",    // or: anthropic, gemini, groq, ollama
    "model": "gpt-4-turbo"   // provider-specific
  }
}
```

### Adding New Source Documents
Drop files into: `profiles/Rajesh/source-docs/`
Supported formats:
- `.pdf` (text + OCR if needed)
- `.docx` (via mammoth)
- `.txt` / `.md` (native)
- `.png` / `.jpg` (OCR via Tesseract)

### Changing Output Paths
Edit `profiles/Rajesh/profile.json`:
```json
{
  "outputBase": "C:/New/Path/",
  "portfolioReposBase": "C:/New/Path/Repos/"
}
```

---

## Next Steps

1. ✅ **Test with Ollama** (free, offline):
   ```powershell
   # Install Ollama, then:
   ollama pull llama3
   node run.js --profile Rajesh --company TestCo --role-short Test-Role --jd test.txt --llm ollama
   ```

2. ✅ **Set up OpenAI API key** (for production quality):
   ```powershell
   [System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY","sk-...","User")
   ```

3. ✅ **Prepare JD files** for your next 5 applications

4. ✅ **Run bulk generation** for 5 roles (10-15 minutes total)

5. ✅ **Monitor GitHub Pages** for portfolio deployment

---

## Help & Documentation

- **Engine Help**: `node run.js --help`
- **GitHub Repo**: https://github.com/rdammala/resume-engine
- **Ollama Download**: https://ollama.com
- **OpenAI API**: https://platform.openai.com/api-keys
