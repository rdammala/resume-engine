/**
 * engine/generate-cover.js
 *
 * Generates CoverLetter.docx + CoverLetter.pdf tailored to the JD.
 * Max ~250 words, 4 paragraphs: hook → proof points → fit → close.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, ExternalHyperlink,
} = require('docx');
const PDFDocument = require('pdfkit');
const llm = require('./llm');

async function generateCover(profileData, job, outputDir, config) {
  const prose = await writeCoverProse(profileData, job, config);

  const v = nextVersion(outputDir, job);
  const baseName = `Rajesh_Dammala_CoverLetter_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${v}`;
  const docxPath = path.join(outputDir, `${baseName}.docx`);
  const pdfPath  = path.join(outputDir, `${baseName}.pdf`);

  await buildDocx(prose, job, docxPath);
  buildPdf(prose, job, pdfPath);

  console.log(`[cover] ✓ DOCX: ${docxPath}`);
  console.log(`[cover] ✓ PDF:  ${pdfPath}`);

  return { docxPath, pdfPath };
}

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

async function writeCoverProse(profileData, job, config) {
  const system = `You are a professional cover letter writer.
Output ONLY valid JSON: { "paragraphs": ["<p1>","<p2>","<p3>","<p4>"] }
Rules: 4 paragraphs total. Max 250 words combined. Confident, concise, no fluff.
Paragraph 1: compelling hook referencing the role.
Paragraph 2: 2-3 strongest proof points from candidate background.
Paragraph 3: genuine passion/fit for this company.
Paragraph 4: brief close + call to action.`;

  const user = `CANDIDATE: ${profileData.name}
ROLE: ${job.title} at ${job.company}
JD SUMMARY: ${job.description.slice(0, 2000)}
CANDIDATE PROFILE: ${profileData.rawText.slice(0, 3000)}`;

  try {
    const raw = await llm.call(system, user, config);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length >= 3) return parsed.paragraphs;
    }
  } catch (e) {
    console.warn(`[cover] LLM failed (${e.message}), using fallback prose.`);
  }

  return [
    `I am excited to apply for the ${job.title} role at ${job.company}. Your focus on reliability and operational excellence aligns directly with the work I have led over 14+ years in mission-critical support and SRE functions at Microsoft.`,
    `As a Lead Escalations Manager, I drove operational efficiency from 85% to 98%, reduced issue resolution time by 32%, and removed 25,000+ false/stale incidents. I also architected an Azure SRE Agent platform delivering 30–35% automated incident resolution — demonstrating the kind of proactive, scalable thinking your team values.`,
    `I am drawn to ${job.company}'s engineering culture and the emphasis on cross-functional reliability ownership. I thrive in environments where incident management is treated as a strategic function, not just reactive firefighting.`,
    `I would welcome the opportunity to discuss how my background maps to your team's needs. Thank you for your time and consideration.`,
  ];
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

async function buildDocx(paragraphs, job, outPath) {
  const contact = job.profileData?.contact || {};
  const name    = job.profileData?.name || 'Rajesh Dammala';
  const today   = new Date().toISOString().split('T')[0];

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        cp(name, true, 28, AlignmentType.CENTER),
        cp(`${contact.location || ''} | ${contact.email || ''} | ${contact.phone || ''}`, false, 20, AlignmentType.CENTER, 200),
        cp(today),
        cp(''),
        cp('Hiring Team'),
        cp(job.company),
        cp(''),
        cp(`Subject: Application for ${job.title}`, true, undefined, undefined, 200),
        cp(`Dear ${job.company} Hiring Team,`),
        cp(''),
        ...paragraphs.map(p => cp(p, false, undefined, undefined, 160)),
        cp(''),
        cp('Best regards,'),
        new Paragraph({
          children: [new ExternalHyperlink({
            link: job.portfolioUrl,
            children: [new TextRun({ text: job.portfolioLinkText || name, style: 'Hyperlink' })],
          })],
        }),
      ],
    }],
  });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
}

function cp(text, bold = false, size, align, spacingAfter = 100) {
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter },
    children: [new TextRun({ text: text || '', bold, size })],
  });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function buildPdf(paragraphs, job, outPath) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, bottom: 36, left: 36, right: 36 } });
  doc.pipe(fs.createWriteStream(outPath));

  const contact = job.profileData?.contact || {};
  const name    = job.profileData?.name || 'Rajesh Dammala';
  const today   = new Date().toISOString().split('T')[0];

  doc.font('Helvetica-Bold').fontSize(16).text(name, { align: 'center' });
  doc.font('Helvetica').fontSize(10)
    .text(`${contact.location || ''} | ${contact.email || ''} | ${contact.phone || ''}`, { align: 'center' });
  doc.moveDown(1);
  doc.text(today).text('Hiring Team').text(job.company);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').text(`Subject: Application for ${job.title}`);
  doc.font('Helvetica').moveDown(0.6);
  doc.text(`Dear ${job.company} Hiring Team,`).moveDown(0.5);

  paragraphs.forEach(p => { doc.text(p); doc.moveDown(0.5); });

  doc.text('Best regards,').moveDown(0.3);
  doc.fillColor('#0b5fff').text(job.portfolioLinkText || name, { link: job.portfolioUrl, underline: true });
  doc.fillColor('black');

  doc.end();
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function nextVersion(outputDir, job) {
  const base = `Rajesh_Dammala_CoverLetter_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}`;
  let v = 1;
  while (fs.existsSync(path.join(outputDir, `${base}_v${v}.docx`))) v++;
  return `v${v}`;
}

module.exports = { generateCover };
