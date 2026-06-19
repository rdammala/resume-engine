const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const docxPath = "C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/GrowTherapy/Rajesh_Dammala_CoverLetter_GrowTherapy_v2.docx";
const pdfPath = "C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/GrowTherapy/Rajesh_Dammala_CoverLetter_GrowTherapy_v2.pdf";

async function convertDocxToPdf() {
  try {
    // Read DOCX and extract text
    const docArrayBuffer = fs.readFileSync(docxPath);
    const result = await mammoth.extractRawText({ buffer: docArrayBuffer });
    const text = result.value;
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    
    doc.pipe(stream);
    
    // Add title/header
    doc.fontSize(11);
    doc.text(text);
    
    doc.end();
    
    stream.on("finish", () => {
      console.log(`✓ Cover letter PDF created: ${pdfPath}`);
    });
  } catch (error) {
    console.error(`✗ Error converting DOCX to PDF: ${error.message}`);
  }
}

convertDocxToPdf();
