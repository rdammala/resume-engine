/**
 * engine/generate-resume.js
 *
 * Generates resume.docx + resume.pdf for a given application.
 * Tailors content to the JD using the configured LLM.
 * Output files: <outputDir>/<CandidateSlug>_Resume_<Company>_<RoleShort>_v<N>.docx/.pdf
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, ExternalHyperlink,
} = require('docx');
const PDFDocument = require('pdfkit');
const llm = require('./llm');

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

async function generateResume(profileData, job, outputDir, config) {
  // LLM: tailor content to JD
  const tailored = await tailorContent(profileData, job, config);

  const versionSuffix = nextVersion(outputDir, job);
  const candidateSlug = safeName((job.profileData?.name || 'Candidate').replace(/\s+/g, '_'));
  const baseName = safeName(`${candidateSlug}_Resume_${job.company}_${job.roleShort}_${versionSuffix}`);
  const docxPath = path.join(outputDir, `${baseName}.docx`);
  const pdfPath  = path.join(outputDir, `${baseName}.pdf`);

  await buildDocx(tailored, job, docxPath, config);
  buildPdf(tailored, job, pdfPath, config);

  console.log(`[resume] ✓ DOCX: ${docxPath}`);
  console.log(`[resume] ✓ PDF:  ${pdfPath}`);

  return { docxPath, pdfPath };
}

// ---------------------------------------------------------------------------
// LLM TAILORING
// ---------------------------------------------------------------------------

async function tailorContent(profileData, job, config) {
  const system = `You are an expert resume writer. 
Output ONLY a JSON object with these keys: summary, competencies (array of strings), 
selectedImpact (array of strings), experienceBlurbs (array of {title, company, period, bullets: string[]}),
technicalSkills (array of strings).
Be concise. Max 2 pages. Tailor to the JD. Use first-person implied voice (no "I").`;

  const user = `CANDIDATE PROFILE:\n${profileData.rawText.slice(0, 6000)}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:\n${job.description.slice(0, 3000)}

Produce a tailored JSON resume matching this JD. Keep each experience bullet under 20 words.`;

  try {
    const raw = await llm.call(system, user, config);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.warn(`[resume] LLM tailoring failed (${e.message}), using raw profile data.`);
  }

  // Fallback: build minimal structure from raw sections
  return buildFallback(profileData);
}

function buildFallback(profileData) {
  return {
    summary: profileData.sections.summary ||
      'Engineering leader with 14+ years of operations and incident management experience.',
    competencies: [
      'Incident Command and Major Incident Coordination',
      'Platform Monitoring and Alert Quality Engineering',
      'Problem Management and Root Cause Analysis',
      'Observability: KQL, Power BI, AppInsights',
      'Automation and AIOps',
      'Cross-functional Leadership and Executive Communication',
    ],
    selectedImpact: [
      'Drove operational efficiency from 85% to 98% across 20+ mission-critical services.',
      'Removed 25,000+ stale/false incidents and rationalized 500+ alerts.',
      'Architected Azure SRE Agent delivering 30–35% automated incident resolution.',
      'Authored 175+ troubleshooting guides in 5 months.',
    ],
    experienceBlurbs: [
      {
        title: 'Lead Escalations Manager — Xbox CXT SRE',
        company: 'Microsoft Corporation (via TechMahindra/Allyis)',
        period: 'May 2021 – Present',
        bullets: [
          'Central incident authority for high-severity disruptions across global Xbox support platform.',
          'Built AIOps detection automation with Azure AppInsights and Logic Apps.',
          'Delivered telemetry-driven dashboards and trend reports via KQL and Power BI.',
        ],
      },
      {
        title: 'Azure Support Technical Lead',
        company: 'Microsoft Corporation (via Mindtree)',
        period: 'Nov 2016 – May 2021',
        bullets: [
          'Led 15-member support team for enterprise Azure subscription operations.',
          'Coordinated cross-team service reliability and customer escalation programs.',
        ],
      },
      {
        title: 'Operations Lead — Azure LiveSite',
        company: 'Microsoft Corporation (via Mindtree)',
        period: 'May 2012 – Nov 2016',
        bullets: [
          'Managed global distributed operations team for production health investigations.',
          'Automated recurring operational tasks with PowerShell, reducing manual effort.',
        ],
      },
    ],
    technicalSkills: [
      'Azure (AppInsights, Logic Apps, KeyVault, ADO)',
      'Kusto/KQL, Power BI, Dashboarding',
      'Incident Management: ICM, SLAs, SLOs, SLIs',
      'PowerShell, Git, CI/CD Pipelines',
    ],
  };
}

// ---------------------------------------------------------------------------
// DOCX BUILDER
// ---------------------------------------------------------------------------

async function buildDocx(data, job, outPath, config) {
  const contactLine =
    `${job.profileData?.contact?.location || 'Morrisville, NC'} | ` +
    `${job.profileData?.contact?.email || ''} | ` +
    `${job.profileData?.contact?.phone || ''} | ` +
    `${job.profileData?.contact?.linkedin || ''}`;

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        centerBold(job.profileData?.name || 'Candidate', 30),
        centerText(contactLine, 20),
        centerHyperlink(job.portfolioLinkText, job.portfolioUrl),
        spacer(),

        sectionHeading('Professional Summary'),
        para(data.summary),
        spacer(),

        sectionHeading('Core Competencies'),
        ...data.competencies.map(b => bullet(b)),
        spacer(),

        sectionHeading('Selected Impact'),
        ...data.selectedImpact.map(b => bullet(b)),
        spacer(),

        sectionHeading('Professional Experience'),
        ...data.experienceBlurbs.flatMap(exp => [
          boldPara(`${exp.title} | ${exp.company} | ${exp.period}`),
          ...exp.bullets.map(b => bullet(b)),
          spacer(),
        ]),

        sectionHeading('Education'),
        para('Bachelor of Engineering in Computer Science Engineering — JNTU Hyderabad'),
        spacer(),

        sectionHeading('Technical Skills'),
        ...data.technicalSkills.map(b => bullet(b)),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
}

// ---------------------------------------------------------------------------
// PDF BUILDER
// ---------------------------------------------------------------------------

function buildPdf(data, job, outPath, config) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, bottom: 36, left: 36, right: 36 } });
  doc.pipe(fs.createWriteStream(outPath));

  const name = job.profileData?.name || 'Candidate';
  const contact = job.profileData?.contact || {};

  doc.font('Helvetica-Bold').fontSize(18).text(name, { align: 'center' });
  doc.font('Helvetica').fontSize(10).text(
    `${contact.location || ''} | ${contact.email || ''} | ${contact.phone || ''} | ${contact.linkedin || ''}`,
    { align: 'center' }
  );
  doc.fillColor('#0b5fff').text(job.portfolioLinkText || '', { align: 'center', link: job.portfolioUrl, underline: true });
  doc.fillColor('black').moveDown(0.8);

  const head = (t) => { doc.font('Helvetica-Bold').fontSize(11).text(t); doc.font('Helvetica').fontSize(10); doc.moveDown(0.2); };
  const bul  = (t) => { doc.text(`- ${t}`); };

  head('Professional Summary');
  doc.text(data.summary);
  doc.moveDown(0.5);

  head('Core Competencies');
  data.competencies.forEach(bul);
  doc.moveDown(0.4);

  head('Selected Impact');
  data.selectedImpact.forEach(bul);
  doc.moveDown(0.4);

  head('Professional Experience');
  data.experienceBlurbs.forEach(exp => {
    doc.font('Helvetica-Bold').text(`${exp.title} | ${exp.company} | ${exp.period}`);
    doc.font('Helvetica');
    exp.bullets.forEach(bul);
    doc.moveDown(0.3);
  });

  head('Education');
  doc.text('Bachelor of Engineering in Computer Science Engineering — JNTU Hyderabad');
  doc.moveDown(0.4);

  head('Technical Skills');
  data.technicalSkills.forEach(bul);

  doc.end();
}

// ---------------------------------------------------------------------------
// DOCX HELPERS
// ---------------------------------------------------------------------------

function centerBold(text, size) {
  return new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size })] });
}
function centerText(text, size) {
  return new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size })], spacing: { after: 40 } });
}
function centerHyperlink(text, url) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [
    new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: 'Hyperlink' })] }),
  ]});
}
function sectionHeading(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } });
}
function para(text) { return new Paragraph({ children: [new TextRun(text || '')], spacing: { after: 80 } }); }
function boldPara(text) { return new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { before: 100, after: 60 } }); }
function bullet(text) { return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } }); }
function spacer() { return new Paragraph({ text: '', spacing: { after: 60 } }); }

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function safeName(str) {
  return str.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function nextVersion(outputDir, job) {
  const candidateSlug = safeName((job.profileData?.name || 'Candidate').replace(/\s+/g, '_'));
  const base = safeName(`${candidateSlug}_Resume_${job.company}_${job.roleShort}`);
  let v = 1;
  while (fs.existsSync(path.join(outputDir, `${base}_v${v}.docx`))) v++;
  return `v${v}`;
}

module.exports = { generateResume };
