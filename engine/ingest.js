/**
 * engine/ingest.js
 *
 * Unified document ingestion pipeline.
 * Reads all files from profile.sourceDocs folders and returns a
 * structured ProfileData object ready for resume/cover/portfolio generation.
 *
 * Supported formats:
 *   .txt  .md                  — plain text / markdown (native)
 *   .docx                      — via mammoth
 *   .pdf                       — via pdf-parse
 *   .png .jpg .jpeg .webp .bmp — OCR via tesseract.js
 *   (OneNote: export to .docx or .pdf first, then drop in source-docs)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Lazy-loaded to avoid hard dep errors when format not used
let mammoth, pdfParse, Tesseract;

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

/**
 * @param {object} profile   - parsed profile.json
 * @param {string} profileDir - absolute path to the profile folder
 * @returns {Promise<ProfileData>}
 */
async function ingest(profile, profileDir) {
  const rawChunks = [];

  for (const srcEntry of profile.sourceDocs || []) {
    const srcDir = path.isAbsolute(srcEntry)
      ? srcEntry
      : path.resolve(profileDir, srcEntry);

    if (!fs.existsSync(srcDir)) {
      console.warn(`[ingest] source-docs folder not found: ${srcDir}`);
      continue;
    }

    const files = getAllFiles(srcDir);
    for (const file of files) {
      const text = await extractText(file);
      if (text && text.trim().length > 20) {
        rawChunks.push({ file, text: text.trim() });
        console.log(`[ingest] ✓ ${path.basename(file)} (${text.length} chars)`);
      } else {
        console.warn(`[ingest] ⚠ skipped/empty: ${path.basename(file)}`);
      }
    }
  }

  if (rawChunks.length === 0) {
    throw new Error(
      '[ingest] No readable source documents found. ' +
      'Drop files into profiles/<name>/source-docs/ and retry.'
    );
  }

  return buildProfileData(profile, rawChunks);
}

// ---------------------------------------------------------------------------
// FILE DISCOVERY
// ---------------------------------------------------------------------------

function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else if (isSupportedExt(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function isSupportedExt(ext) {
  return ['.txt', '.md', '.docx', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext);
}

// ---------------------------------------------------------------------------
// TEXT EXTRACTION
// ---------------------------------------------------------------------------

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (ext === '.docx') {
    if (!mammoth) mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === '.pdf') {
    if (!pdfParse) pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) {
    if (!Tesseract) Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {}
    });
    return data.text;
  }

  return null;
}

// ---------------------------------------------------------------------------
// STRUCTURE BUILDING
// ---------------------------------------------------------------------------

/**
 * Build a clean ProfileData object from raw text chunks + profile.json.
 * The LLM will later refine this, but having structured sections up front
 * lets the generators work even without a cloud model.
 */
function buildProfileData(profile, rawChunks) {
  const allText = rawChunks.map(c => c.text).join('\n\n---\n\n');

  return {
    // identity from profile.json (authoritative)
    name:    profile.name,
    contact: profile.contact,
    github:  profile.github,

    // raw dump for LLM refinement
    rawText: allText,

    // pre-structured sections extracted by heuristic
    sections: {
      summary:      extractSection(allText, ['summary', 'objective', 'profile', 'about']),
      experience:   extractSection(allText, ['experience', 'work history', 'employment']),
      education:    extractSection(allText, ['education', 'academic', 'degree', 'university']),
      skills:       extractSection(allText, ['skills', 'technologies', 'tools', 'competencies']),
      certifications: extractSection(allText, ['certifications', 'licenses', 'credentials']),
      achievements: extractSection(allText, ['achievements', 'accomplishments', 'impact', 'highlights']),
    },

    // source file list for audit
    sources: rawChunks.map(c => path.basename(c.file)),
  };
}

/**
 * Very simple heuristic section extractor — looks for section headers
 * and captures text until the next header. Good enough for local use;
 * LLM will clean it up further.
 */
function extractSection(text, headerKeywords) {
  const lines = text.split('\n');
  const chunks = [];
  let capturing = false;
  let buf = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isHeader = /^#{1,3}\s|^[A-Z][A-Z\s]{3,}$/.test(line.trim());

    if (isHeader) {
      const matched = headerKeywords.some(k => lower.includes(k));
      if (matched) {
        if (buf.length) chunks.push(buf.join('\n'));
        buf = [line];
        capturing = true;
      } else if (capturing) {
        if (buf.length) chunks.push(buf.join('\n'));
        buf = [];
        capturing = false;
      }
    } else if (capturing) {
      buf.push(line);
    }
  }

  if (buf.length) chunks.push(buf.join('\n'));
  return chunks.join('\n\n').trim();
}

module.exports = { ingest };
