const PDFDocument = require("pdfkit");
const fs = require("fs");

const portfolioUrl = "https://rdammala.github.io/Senior-Platform-Reliability-Engineer/";
const pdfPath = "C:/Users/v-rdammala/OneDrive - Microsoft/Desktop/Personal/Resumes/2026/GrowTherapy/Rajesh_Dammala_CoverLetter_GrowTherapy_v2.pdf";

function createCoverLetterPDF() {
  try {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    
    doc.pipe(stream);
    
    // Header
    doc.fontSize(16).font('Helvetica-Bold').text("Rajesh Dammala", { align: "center" });
    doc.fontSize(10).font('Helvetica').text("rajesh.dammala@gmail.com | +1-425-229-0060 | linkedin.com/in/rajesh-dammala", { align: "center" });
    doc.moveDown(0.5);
    
    // Portfolio link
    doc.fontSize(9).fillColor("blue").text("Senior Platform Reliability Engineer", { link: portfolioUrl, align: "center", underline: true });
    doc.moveDown(1);
    
    // Salutation
    doc.fontSize(11).fillColor("black").font('Helvetica').text("Dear Hiring Manager,");
    doc.moveDown(0.5);
    
    // Body
    const bodyText = `I am writing to express my strong interest in the Senior Platform Reliability Engineer position at GrowTherapy. With 14+ years of experience building and scaling reliability practices across mission-critical systems, I am confident that my expertise in SRE, observability, and incident management aligns perfectly with your team's needs.

At Microsoft's Xbox and Azure organizations, I have defined SLOs/SLAs for 20+ mission-critical services, architected observability platforms enabling 32 engineers to work independently, and engineered automation that reduced alert noise by 500+ while improving resolution efficiency from 85% to 98%. These accomplishments demonstrate my ability to transform reliability from a reactive afterthought into a proactive, measurement-driven practice—exactly what GrowTherapy needs as you scale.

What excites me about this role is the opportunity to build reliable systems that directly impact therapist and patient outcomes. I am passionate about creating golden paths and self-service platforms that make it intuitive for engineers to operate reliably without friction.

I would welcome the opportunity to discuss how my experience leading global SRE teams and architecting observable, resilient systems can contribute to GrowTherapy's mission. Thank you for considering my application.

Best regards,`;
    
    doc.fontSize(10).text(bodyText);
    doc.moveDown(1);
    
    // Signature
    doc.fontSize(11).font('Helvetica-Bold').text("Rajesh Dammala");
    doc.fontSize(9).font('Helvetica').fillColor("blue").text("Senior Platform Reliability Engineer", { link: portfolioUrl, underline: true });
    
    doc.end();
    
    stream.on("finish", () => {
      console.log(`✓ Cover letter PDF created: ${pdfPath}`);
    });
  } catch (error) {
    console.error(`✗ Error creating PDF: ${error.message}`);
  }
}

createCoverLetterPDF();
