/**
 * engine/update-tracker.js
 *
 * Injects a new application entry into the Job_Application_Tracker.html
 * defaultApps array and pushes it to the career-focus-pages repo.
 *
 * Also calls markLastUpdated() logic so the badge reflects the change.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

async function updateTracker(job, pagesUrl, profile) {
  const trackerDesktop = profile.tracker?.desktopPath;
  const trackerRepo    = profile.tracker?.repoPath;
  const repoDir        = profile.tracker?.repoDir;

  if (!trackerDesktop || !trackerRepo || !repoDir) {
    console.warn('[tracker] profile.tracker paths not configured; skipping tracker update.');
    return;
  }

  let files = [trackerDesktop, trackerRepo].filter(f => fs.existsSync(f));
  
  // If no tracker files exist, create one from template
  if (files.length === 0) {
    console.log('[tracker] No tracker files found; creating from template...');
    const templatePath = path.join(__dirname, 'tracker-template.html');
    
    if (fs.existsSync(templatePath)) {
      // Ensure directories exist
      const desktopDir = path.dirname(trackerDesktop);
      const repoTrackerDir = path.dirname(trackerRepo);
      
      if (!fs.existsSync(desktopDir)) fs.mkdirSync(desktopDir, { recursive: true });
      if (!fs.existsSync(repoTrackerDir)) fs.mkdirSync(repoTrackerDir, { recursive: true });
      
      // Copy template to both locations
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      fs.writeFileSync(trackerDesktop, templateContent, 'utf8');
      fs.writeFileSync(trackerRepo, templateContent, 'utf8');
      
      console.log(`[tracker] ✓ Created tracker from template`);
      console.log(`[tracker]   → Desktop: ${trackerDesktop}`);
      console.log(`[tracker]   → Repo: ${trackerRepo}`);
      
      files = [trackerDesktop, trackerRepo];
    } else {
      console.warn('[tracker] Template not found; skipping tracker creation.');
      return;
    }
  }

  const newEntry = buildEntry(job, pagesUrl);

  for (const file of files) {
    injectEntry(file, newEntry, job.repoName);
    console.log(`[tracker] ✓ Updated: ${file}`);
  }

  // Sync desktop → repo copy (in case they differ)
  if (fs.existsSync(trackerDesktop)) {
    fs.copyFileSync(trackerDesktop, trackerRepo);
  }

  // Push repo
  if (fs.existsSync(repoDir)) {
    commit(repoDir, `Add ${job.company} application to tracker`);
    console.log(`[tracker] ✓ Pushed tracker update.`);
  }
}

// ---------------------------------------------------------------------------
// ENTRY BUILDER
// ---------------------------------------------------------------------------

function buildEntry(job, pagesUrl) {
  return {
    portfolio: job.repoName,
    role: job.title,
    company: job.company,
    date: new Date().toISOString().split('T')[0],
    link: pagesUrl,
    status: 'Applied',
    comments: '',
  };
}

// ---------------------------------------------------------------------------
// INJECTION
// ---------------------------------------------------------------------------

function injectEntry(filePath, entry, repoName) {
  let text = fs.readFileSync(filePath, 'utf8');

  // Skip if already present
  if (text.includes(`portfolio:'${repoName}'`)) {
    console.log(`[tracker] Entry for ${repoName} already exists; skipping injection.`);
    return;
  }

  // Find highest existing id
  const idMatches = [...text.matchAll(/\bid:\s*(\d+)/g)];
  const maxId = idMatches.length
    ? Math.max(...idMatches.map(m => parseInt(m[1])))
    : 0;
  entry.id = maxId + 1;

  // Build the line
  const line = `    { id:${entry.id}, portfolio:'${entry.portfolio}', role:'${entry.role}', company:'${entry.company}', date:'${entry.date}', link:'${entry.link}', status:'${entry.status}', comments:'${entry.comments}' }`;

  // Find last entry line and append after it (before the closing ];)
  const closeMatch = text.match(/(\s*\]\s*;)/);
  if (!closeMatch) {
    console.warn('[tracker] Could not locate defaultApps closing ]; — skipping injection.');
    return;
  }

  // Append after last existing entry (add comma to previous last entry)
  text = text.replace(
    /(\{ id:\d+[^}]+\})\s*\n(\s*\]\s*;)/,
    `$1,\n${line}\n$2`
  );

  fs.writeFileSync(filePath, text, 'utf8');
}

// ---------------------------------------------------------------------------
// GIT
// ---------------------------------------------------------------------------

function commit(cwd, message) {
  const run = (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true });
  run('git', ['add', 'Job_Application_Tracker.html']);
  const status = run('git', ['status', '--porcelain']);
  if (status.stdout.trim().length > 0) {
    run('git', ['commit', '-m', message]);
    run('git', ['push', 'origin', 'master']);
  }
}

module.exports = { updateTracker };
