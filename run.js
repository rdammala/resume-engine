/**
 * run.js  — CLI entry point for the Resume Engine
 *
 * Usage:
 *   node run.js --profile rajesh --jd "path/to/jd.txt or raw text" --title "Platform Monitoring Engineer" --company "Adyen" --role-short "PlatformMonitoringEngineer"
 *
 * Flags:
 *   --profile    <name>     Profile folder name under profiles/ (required)
 *   --title      <text>     Exact job title from JD (required)
 *   --company    <text>     Company name (required)
 *   --role-short <text>     Short role identifier for file names (required)
 *   --jd         <path|text> Path to JD file OR raw JD text (required)
 *   --llm        <provider> Override config.json llm.provider (optional)
 *   --no-publish            Skip GitHub publish step
 *   --no-tracker            Skip tracker update step
 *   --help                  Show this message
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { ingest }            = require('./engine/ingest');
const { generateResume }    = require('./engine/generate-resume');
const { generateCover }     = require('./engine/generate-cover');
const { generatePortfolio } = require('./engine/generate-portfolio');
const { publishToGitHub, printSetupGuide } = require('./engine/publish-github');
const { updateTracker }     = require('./engine/update-tracker');

const ROOT = __dirname;

// ---------------------------------------------------------------------------
// CLI ARG PARSING
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { printHelp(); process.exit(0); }
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Resume Engine — Local-first AI resume and portfolio generator
─────────────────────────────────────────────────────────────
Usage:
  node run.js --profile <name> --title "<Job Title>" --company "<Company>" --role-short "<Short>" --jd "<path or text>"

Required:
  --profile     Profile folder name under profiles/  (e.g. rajesh)
  --title       Exact job title from JD
  --company     Company name
  --role-short  Short identifier for file names (no spaces, e.g. PlatformMonitoringEngineer)
  --jd          Path to a .txt/.md file containing the JD, or paste the JD directly as a quoted string

Optional:
  --llm         Override LLM provider: ollama | openai | anthropic | gemini
  --no-publish  Skip GitHub publish
  --no-tracker  Skip tracker update
  --help        Show this message

Examples:
  node run.js --profile rajesh --title "Platform Monitoring Engineer" --company Adyen --role-short PlatformMonitoringEngineer --jd ./jd.txt
  node run.js --profile wife   --title "Product Manager" --company Stripe --role-short ProductManager --jd "Looking for a PM with 5+ years..."
  node run.js --profile brother --title "SRE Lead" --company Google --role-short SRELead --jd ./google-jd.txt --llm openai
`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  const required = ['profile', 'title', 'company', 'roleShort', 'jd'];
  const missing = required.filter(k => !args[k]);
  if (missing.length) {
    console.error(`[run] Missing required args: ${missing.map(k => '--' + k.replace(/([A-Z])/g, '-$1').toLowerCase()).join(', ')}`);
    printHelp();
    process.exit(1);
  }

  // Load config
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
  if (args.llm) config.llm.provider = args.llm;

  // Load profile
  const profileDir = path.join(ROOT, 'profiles', args.profile);
  if (!fs.existsSync(profileDir)) {
    console.error(`[run] Profile folder not found: ${profileDir}`);
    process.exit(1);
  }
  const profile = JSON.parse(fs.readFileSync(path.join(profileDir, 'profile.json'), 'utf8'));

  // Check GitHub setup
  if (!args.noPublish && !profile.github?.username) {
    printSetupGuide(profile);
    process.exit(1);
  }

  // Load JD
  let jdText = args.jd;
  if (fs.existsSync(jdText)) {
    jdText = fs.readFileSync(jdText, 'utf8');
  }

  // Output directory
  const companyDir = path.join(profile.outputBase || profileDir, args.company);
  fs.mkdirSync(companyDir, { recursive: true });

  // Portfolio repo name = role-short as kebab-case
  const repoName = toKebab(args.roleShort);
  const portfolioDir = path.join(profile.portfolioReposBase || path.join(ROOT, 'output'), repoName);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` Resume Engine starting...`);
  console.log(` Profile : ${args.profile}`);
  console.log(` Role    : ${args.title}`);
  console.log(` Company : ${args.company}`);
  console.log(` LLM     : ${config.llm.provider}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1 — Ingest
  console.log('[1/6] Ingesting source documents...');
  const profileData = await ingest(profile, profileDir);

  // Step 2 — Resume
  console.log('[2/6] Generating resume...');
  const job = {
    title: args.title,
    company: args.company,
    roleShort: args.roleShort,
    repoName,
    description: jdText,
    profileData,
    profile,
    portfolioUrl: `https://${profile.github?.username || 'yourname'}.github.io/${repoName}/`,
    portfolioLinkText: `${profile.name} — ${args.title}`,
    resumePdfPath: null, // filled after resume generation
  };
  const { pdfPath: resumePdfPath } = await generateResume(profileData, job, companyDir, config);
  job.resumePdfPath = resumePdfPath;

  // Step 3 — Cover letter
  console.log('[3/6] Generating cover letter...');
  await generateCover(profileData, job, companyDir, config);

  // Step 4 — Portfolio site
  console.log('[4/6] Generating portfolio website...');
  await generatePortfolio(profileData, job, portfolioDir, config);

  // Increment nextColorIndex in profile so next portfolio uses a different theme
  profile.stylePrefs = profile.stylePrefs || {};
  const colors = config.portfolio.accentColors;
  profile.stylePrefs.nextColorIndex = ((profile.stylePrefs.nextColorIndex || 0) + 1) % colors.length;
  fs.writeFileSync(path.join(profileDir, 'profile.json'), JSON.stringify(profile, null, 2));

  // Step 5 — Publish to GitHub
  let pagesUrl = job.portfolioUrl;
  if (!args.noPublish) {
    console.log('[5/6] Publishing to GitHub...');
    try {
      pagesUrl = await publishToGitHub(portfolioDir, repoName, profile);
    } catch (e) {
      console.warn(`[run] GitHub publish failed: ${e.message}`);
      console.warn('[run] Continuing without publish; re-run with --no-publish skipped.');
    }
  } else {
    console.log('[5/6] Skipping GitHub publish (--no-publish).');
  }

  // Step 6 — Update tracker
  if (!args.noTracker) {
    console.log('[6/6] Updating job tracker...');
    await updateTracker(job, pagesUrl, profile);
  } else {
    console.log('[6/6] Skipping tracker update (--no-tracker).');
  }

  // Done
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` ✅  All done!`);
  console.log(` Company folder : ${companyDir}`);
  console.log(` Portfolio dir  : ${portfolioDir}`);
  console.log(` Portfolio URL  : ${pagesUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Manual steps remaining:');
  console.log('  1. Review .docx files for content accuracy');
  console.log('  2. Rename files to Rajesh_Dammala.docx / Rajesh_Dammala_CoverLetter.docx');
  console.log('  3. Change file sensitivity label to Public before submitting\n');
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function toKebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .trim();
}

main().catch(err => {
  console.error(`\n[run] Fatal error: ${err.message}`);
  process.exit(1);
});
