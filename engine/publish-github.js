/**
 * engine/publish-github.js
 *
 * Publishes a portfolio folder to GitHub and enables GitHub Pages.
 * Requires either:
 *   - GITHUB_TOKEN env var, OR
 *   - `gh` CLI authenticated on the machine (free, personal use)
 *
 * Also handles first-time GitHub account setup guidance.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

async function publishToGitHub(portfolioDir, repoName, profile) {
  const username = profile.github?.username;
  if (!username) throw new Error('[github] profile.github.username is required.');

  const pagesUrl = `https://${username}.github.io/${repoName}/`;

  ensureGhCli();
  ensureGitInit(portfolioDir);
  commitAll(portfolioDir, 'Initial portfolio site');

  const exists = repoExists(username, repoName);

  if (!exists) {
    console.log(`[github] Creating repo: ${username}/${repoName}`);
    refreshPath();
    run('gh', ['repo', 'create', repoName, '--public', '--source=.', '--remote=origin', '--push'], portfolioDir);
  } else {
    console.log(`[github] Repo exists, pushing to origin/main...`);
    ensureRemote(portfolioDir, username, repoName);
    run('git', ['push', '-u', 'origin', 'main'], portfolioDir);
  }

  enablePages(username, repoName);

  console.log(`[github] ✓ Live at: ${pagesUrl}`);
  return pagesUrl;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function ensureGhCli() {
  refreshPath();
  const result = spawnSync('gh', ['--version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error(`
[github] ❌ GitHub CLI (gh) not found.

To install (free):
  Windows : winget install --id GitHub.cli
  Mac     : brew install gh
  Linux   : https://github.com/cli/cli#installation

After installing, run: gh auth login
Then retry this command.
`);
    process.exit(1);
  }
}

function ensureGitInit(dir) {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    run('git', ['init'], dir);
    run('git', ['branch', '-M', 'main'], dir);
  }
}

function commitAll(dir, message) {
  run('git', ['add', '.'], dir);
  // Only commit if there are staged changes
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8', shell: true });
  if (status.stdout.trim().length > 0) {
    run('git', ['commit', '-m', message], dir);
  }
}

function repoExists(username, repoName) {
  refreshPath();
  const result = spawnSync('gh', ['repo', 'view', `${username}/${repoName}`], { encoding: 'utf8', shell: true });
  return result.status === 0;
}

function ensureRemote(dir, username, repoName) {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    run('git', ['remote', 'add', 'origin', `https://github.com/${username}/${repoName}.git`], dir);
  }
}

function enablePages(username, repoName) {
  try {
    refreshPath();
    const result = spawnSync('gh', [
      'api', `repos/${username}/${repoName}/pages`,
      '-X', 'POST',
      '-f', 'source[branch]=main',
      '-f', 'source[path]=/',
    ], { encoding: 'utf8', shell: true });
    if (result.status === 0) {
      console.log(`[github] ✓ GitHub Pages enabled.`);
    } else if (result.stderr?.includes('already enabled')) {
      console.log(`[github] Pages already enabled.`);
    } else {
      console.warn(`[github] Pages enable returned: ${result.stderr}`);
    }
  } catch (e) {
    console.warn(`[github] Could not enable Pages automatically: ${e.message}`);
  }
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    throw new Error(`[github] Command failed: ${cmd} ${args.join(' ')}\n${result.stderr}`);
  }
  return result.stdout;
}

function refreshPath() {
  const machine = execSync('powershell -Command "[System.Environment]::GetEnvironmentVariable(\'Path\',\'Machine\')"', { encoding: 'utf8' }).trim();
  const user    = execSync('powershell -Command "[System.Environment]::GetEnvironmentVariable(\'Path\',\'User\')"',    { encoding: 'utf8' }).trim();
  process.env.PATH = `${machine};${user};${process.env.PATH}`;
}

// ---------------------------------------------------------------------------
// GITHUB SETUP GUIDE (printed when no account found)
// ---------------------------------------------------------------------------

function printSetupGuide(profile) {
  const name = profile.name || 'Your Name';
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GitHub Setup Guide (one-time, free)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to https://github.com/signup (free account)
2. Choose a username (suggestion: firstname-lastname or initials)
3. Update profile.json → github.username with your new username
4. Install gh CLI:  winget install GitHub.cli
5. Run: gh auth login   (follow prompts, choose HTTPS, paste token)
6. Re-run the resume engine command.

Your portfolio will be live at:
  https://<your-username>.github.io/<role-name>/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

module.exports = { publishToGitHub, printSetupGuide };
