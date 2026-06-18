/**
 * engine/generate-portfolio.js
 *
 * Generates a full role-specific portfolio website:
 *   index.html, style.css, script.js, README.md, favicon.svg, Candidate_Resume.pdf
 *
 * Theme is auto-selected from config.json accentColors using profile.stylePrefs.nextColorIndex.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const llm  = require('./llm');

async function generatePortfolio(profileData, job, portfolioDir, config) {
  fs.mkdirSync(portfolioDir, { recursive: true });

  const theme = pickTheme(config, job.profile);
  const copy  = await buildCopy(profileData, job, config);

  writeFile(portfolioDir, 'index.html',  buildHtml(copy, job, theme));
  writeFile(portfolioDir, 'style.css',   buildCss(theme));
  writeFile(portfolioDir, 'script.js',   buildJs());
  writeFile(portfolioDir, 'README.md',   buildReadme(job));
  writeFavicon(portfolioDir, job.profile);
  copyResumePdf(portfolioDir, job);

  console.log(`[portfolio] ✓ Generated in: ${portfolioDir}`);
  return portfolioDir;
}

// ---------------------------------------------------------------------------
// LLM COPY GENERATION
// ---------------------------------------------------------------------------

async function buildCopy(profileData, job, config) {
  const system = `You are a portfolio copywriter. Output ONLY valid JSON:
{
  "tagline": "<20 word hero tagline>",
  "about": "<60-80 word about paragraph — generic, no company names>",
  "competencies": [{"title":"...","description":"..."}],
  "impactCards": [{"title":"...","description":"..."}],
  "philosophy": "<one sentence that defines your work philosophy>"
}
Generic and reusable — suitable for multiple applications to similar roles.`;

  const user = `ROLE CATEGORY: ${job.title}
PROFILE SUMMARY:\n${profileData.rawText.slice(0, 3000)}`;

  try {
    const raw = await llm.call(system, user, config);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.warn(`[portfolio] LLM copy failed (${e.message}), using defaults.`);
  }

  return {
    tagline: 'Engineering leader focused on reliability, incident excellence, and scalable operations.',
    about: 'I lead high-severity incident operations and monitoring programs for globally scaled platforms. My focus: detect earlier, communicate clearly, recover faster, and prevent recurrence through disciplined problem management.',
    competencies: [
      { title: 'Incident Leadership',   description: 'Commanding high-impact incidents with structured coordination and executive-ready updates.' },
      { title: 'Monitoring Strategy',   description: 'Designing detection frameworks that improve signal quality and reduce alert fatigue.' },
      { title: 'Problem Management',    description: 'Turning incident trends into prioritized engineering actions and long-term reliability wins.' },
    ],
    impactCards: [
      { title: 'Alert Quality Overhaul', description: 'Rationalized 500+ alerts and removed 25,000+ stale incidents to restore focus on true platform risk.' },
      { title: 'Resolution Velocity',    description: 'Redesigned escalation framework reducing issue resolution time by 32%.' },
      { title: 'Automation Program',     description: 'Architected AI-driven SRE platform enabling 30-35% auto-resolution for repeat scenarios.' },
      { title: 'Knowledge System',       description: 'Produced 175+ operational playbooks in 5 months to standardize on-call readiness.' },
    ],
    philosophy: 'The best incident is the one detected early, communicated clearly, and never repeated.',
  };
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function buildHtml(copy, job, theme) {
  const name    = job.profileData?.name || 'Candidate';
  const contact = job.profileData?.contact || {};
  const metrics = [
    ['20+', 'mission-critical services'],
    ['25,000+', 'false/stale incidents removed'],
    ['32%', 'faster issue resolution'],
    ['175+', 'playbooks authored'],
  ];

  const metricHtml = metrics.map(([v, l]) =>
    `<div class="metric"><span>${v}</span><small>${l}</small></div>`
  ).join('\n      ');

  const compHtml = (copy.competencies || []).map(c =>
    `<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p></article>`
  ).join('\n        ');

  const impactHtml = (copy.impactCards || []).map(c =>
    `<article class="feature-card"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p></article>`
  ).join('\n        ');

  const expHtml = (job.profileData?.experienceBlurbs || defaultExperience()).map(exp =>
    `<div class="timeline-item">
          <h3>${esc(exp.title)}</h3>
          <p class="meta">${esc(exp.company)} | ${esc(exp.period)}</p>
          <p>${esc(exp.bullets?.[0] || '')}</p>
        </div>`
  ).join('\n        ');

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(name)} | ${esc(job.title)}</title>
  <meta name="description" content="${esc(copy.tagline)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <button class="theme-toggle" id="theme-toggle" aria-label="Toggle light and dark mode">
    <span class="theme-icon" id="theme-icon">🌙</span>
  </button>

  <div class="bg-orb orb-a"></div>
  <div class="bg-orb orb-b"></div>

  <header class="hero">
    <div class="hero-copy reveal">
      <p class="eyebrow">${esc(job.title)}</p>
      <h1>${esc(name)}</h1>
      <p class="subtitle">${esc(copy.tagline)}</p>
      <div class="hero-cta">
        <a href="#impact" class="btn btn-primary">View Impact</a>
        <a href="mailto:${esc(contact.email || '')}" class="btn btn-ghost">Contact</a>
        <a href="Candidate_Resume.pdf" download class="btn btn-ghost">Download Resume</a>
      </div>
    </div>
    <aside class="hero-stats reveal-delay">
      ${metricHtml}
    </aside>
  </header>

  <main>
    <section class="section reveal" id="about">
      <h2>About</h2>
      <p>${esc(copy.about)}</p>
    </section>

    <section class="section reveal" id="competencies">
      <h2>Leadership Competencies</h2>
      <div class="grid three">
        ${compHtml}
      </div>
    </section>

    <section class="section reveal" id="experience">
      <h2>Experience</h2>
      <div class="timeline">
        ${expHtml}
      </div>
    </section>

    <section class="section reveal" id="impact">
      <h2>Operational Impact</h2>
      <div class="grid two">
        ${impactHtml}
      </div>
    </section>

    <section class="section reveal" id="philosophy">
      <h2>Philosophy</h2>
      <blockquote>${esc(copy.philosophy)}</blockquote>
    </section>

    <section class="section reveal" id="education">
      <h2>Education</h2>
      <p>Bachelor of Engineering in Computer Science Engineering — JNTU Hyderabad</p>
    </section>

    <section class="section reveal" id="contact">
      <h2>Contact</h2>
      <p>Email: <a href="mailto:${esc(contact.email || '')}">${esc(contact.email || '')}</a></p>
      <p>LinkedIn: <a href="https://${esc(contact.linkedin || '')}" target="_blank" rel="noreferrer">${esc(contact.linkedin || '')}</a></p>
    </section>
  </main>

  <footer class="footer">Built for ${esc(job.title)} roles.</footer>
  <script src="script.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function buildCss(theme) {
  return `:root {
  --bg: #090d14; --bg-soft: #111928; --surface: #151f30;
  --text: #eaf0f8; --muted: #9eb0c5;
  --accent: ${theme.a}; --accent-2: ${theme.b}; --line: #223149;
  --grad-a: rgba(${hexToRgb(theme.a)},0.12); --grad-b: rgba(${hexToRgb(theme.b)},0.12);
}
[data-theme="light"] {
  --bg: #f3f7fc; --bg-soft: #ffffff; --surface: #edf3fb;
  --text: #122236; --muted: #4f6179; --line: #cfdceb;
  --grad-a: rgba(${hexToRgb(theme.a)},0.2); --grad-b: rgba(${hexToRgb(theme.b)},0.15);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Inter, sans-serif; color: var(--text); background: radial-gradient(circle at 10% 10%, var(--grad-a), transparent 34%), radial-gradient(circle at 90% 15%, var(--grad-b), transparent 38%), var(--bg); line-height: 1.55; }
.bg-orb { position: fixed; width: 340px; height: 340px; border-radius: 50%; filter: blur(70px); opacity: .22; pointer-events: none; }
.orb-a { background: var(--accent); top: -120px; left: -120px; }
.orb-b { background: var(--accent-2); right: -130px; top: 18vh; }
.theme-toggle { position: fixed; top: 1rem; right: 1rem; width: 42px; height: 42px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg-soft); color: var(--text); display: grid; place-items: center; cursor: pointer; z-index: 50; }
.hero { max-width: 1120px; margin: 0 auto; padding: 4.5rem 1.2rem 2rem; display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 1rem; align-items: center; }
.eyebrow { color: var(--accent); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: .75rem; }
h1 { margin: .2rem 0 .5rem; font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.1; }
.subtitle { color: var(--muted); max-width: 62ch; }
.hero-cta { margin-top: 1.2rem; display: flex; gap: .75rem; flex-wrap: wrap; }
.btn { border-radius: 999px; padding: .58rem 1rem; text-decoration: none; font-weight: 700; }
.btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #131313; }
.btn-ghost { border: 1px solid var(--line); color: var(--text); }
.hero-stats { background: linear-gradient(155deg, rgba(${hexToRgb(theme.a)},0.14), rgba(${hexToRgb(theme.b)},0.14)); border: 1px solid var(--line); border-radius: 18px; padding: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
.metric { background: rgba(9,13,20,.78); border: 1px solid var(--line); border-radius: 12px; padding: .7rem; }
.metric span { display: block; font-size: 1.25rem; font-weight: 800; color: var(--accent); }
.metric small { color: var(--muted); }
main { max-width: 1120px; margin: 0 auto; padding: 0 1.2rem 3rem; }
.section { margin-top: 1.4rem; padding: 1rem 1rem 1.1rem; background: rgba(21,31,48,.68); border: 1px solid var(--line); border-radius: 14px; }
.section h2 { margin: 0 0 .7rem; }
.grid { display: grid; gap: .8rem; }
.grid.three { grid-template-columns: repeat(3, minmax(0,1fr)); }
.grid.two { grid-template-columns: repeat(2, minmax(0,1fr)); }
.card, .feature-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 12px; padding: .8rem; }
.timeline { border-left: 2px solid var(--line); padding-left: .9rem; }
.timeline-item { margin-bottom: 1rem; }
.timeline-item .meta { color: var(--muted); margin-top: -.3rem; }
blockquote { margin: 0; padding: .85rem; border-left: 4px solid var(--accent); background: rgba(255,107,61,.08); }
a { color: var(--accent); }
.footer { max-width: 1120px; margin: 0 auto; padding: 1rem 1.2rem 2.2rem; color: var(--muted); }
.reveal { opacity: 0; transform: translateY(16px); animation: rise .75s ease forwards; }
.reveal-delay { opacity: 0; transform: translateY(16px); animation: rise .75s ease .2s forwards; }
@keyframes rise { to { opacity: 1; transform: translateY(0); } }
@media (max-width: 860px) { .hero { grid-template-columns: 1fr; } .grid.three, .grid.two { grid-template-columns: 1fr; } .hero-stats { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .hero { padding-top: 3rem; } .hero-stats { grid-template-columns: 1fr; } }`;
}

// ---------------------------------------------------------------------------
// SCRIPT.JS
// ---------------------------------------------------------------------------

function buildJs() {
  return `(() => {
  const btn = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  const SK = 'rd-portfolio-theme';
  const apply = (t) => { document.documentElement.setAttribute('data-theme', t); icon.textContent = t === 'light' ? '☀️' : '🌙'; };
  apply(localStorage.getItem(SK) || 'dark');
  btn.addEventListener('click', () => { const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; apply(n); localStorage.setItem(SK, n); });

  const obs = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('reveal'); }), { threshold: .18 });
  document.querySelectorAll('.section').forEach(s => obs.observe(s));
})();`;
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function buildReadme(job) {
  return `# ${job.repoName}

Role-specific portfolio for **${job.title}** applications.

## Live Site
https://${job.profileData?.github?.username || 'your-github-username'}.github.io/${job.repoName}/

## Stack
- Pure HTML / CSS / Vanilla JavaScript
- Google Fonts (Inter)
- No frameworks

## Local Preview
Open \`index.html\` in any browser.
`;
}

// ---------------------------------------------------------------------------
// FAVICON
// ---------------------------------------------------------------------------

function writeFavicon(dir, profile) {
  // Try to copy from RD-Profile first; if not found write a generic SVG
  const rdFavicon = path.resolve(
    profile?.portfolioReposBase || '',
    'RD-Profile', 'favicon.svg'
  );
  const dest = path.join(dir, 'favicon.svg');
  if (profile?.portfolioReposBase && fs.existsSync(rdFavicon)) {
    fs.copyFileSync(rdFavicon, dest);
  } else {
    fs.writeFileSync(dest,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><text x="32" y="44" text-anchor="middle" font-family="Arial" font-weight="800" font-size="30" fill="white">RD</text></svg>`
    );
  }
}

function copyResumePdf(dir, job) {
  // Copy the generated resume PDF into the portfolio folder as Candidate_Resume.pdf
  if (job.resumePdfPath && fs.existsSync(job.resumePdfPath)) {
    fs.copyFileSync(job.resumePdfPath, path.join(dir, 'Candidate_Resume.pdf'));
    console.log(`[portfolio] ✓ Resume PDF copied.`);
  } else {
    console.warn(`[portfolio] ⚠ resumePdfPath not found; Download Resume button will 404 until you add the file.`);
  }
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function pickTheme(config, profile) {
  const colors = config.portfolio.accentColors;
  const idx = (profile?.stylePrefs?.nextColorIndex || 0) % colors.length;
  return colors[idx];
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function defaultExperience() {
  return [
    { title: 'Lead Escalations Manager', company: 'Microsoft (via TechMahindra)', period: '2021–Present', bullets: ['Central incident authority across 20+ mission-critical support services.'] },
    { title: 'Azure Support Technical Lead', company: 'Microsoft (via Mindtree)', period: '2016–2021', bullets: ['Led 15-member support team for enterprise Azure platform.'] },
    { title: 'Operations Lead', company: 'Microsoft (via Mindtree)', period: '2012–2016', bullets: ['Managed distributed ops team for Azure LiveSite production health.'] },
  ];
}

module.exports = { generatePortfolio };
