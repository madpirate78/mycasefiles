#!/usr/bin/env node
/**
 * Generates FICTIONAL sample court documents into samples/ so reviewers
 * can try the app without real case papers.
 *
 * Every person, court, address and case number below is invented.
 * Run: node scripts/generate-samples.js
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUT = path.join(__dirname, '..', 'samples');
const CASE_NO = 'AB12C34567';
const COURT = 'the Family Court sitting at Exampleton';
const CHILD = 'Child A (a girl, born 2017)';

const PAGE = { w: 595.28, h: 841.89 }; // A4 in points
const MARGIN = 64;

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

async function makePdf(filename, { title, heading, paragraphs }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} (FICTIONAL SAMPLE)`);
  doc.setAuthor('MyCaseFiles sample generator');
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  let page;
  let y;
  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - MARGIN;
    page.drawText(`Case No: ${CASE_NO}`, { x: PAGE.w - MARGIN - 130, y, size: 10, font });
    y -= 28;
  };
  const write = (text, { f = font, size = 11.5, gap = 6, center = false } = {}) => {
    for (const line of wrap(text, f, size, PAGE.w - MARGIN * 2)) {
      if (y < MARGIN + 40) newPage();
      const x = center ? (PAGE.w - f.widthOfTextAtSize(line, size)) / 2 : MARGIN;
      page.drawText(line, { x, y, size, font: f });
      y -= size + 4;
    }
    y -= gap;
  };

  newPage();
  for (const h of heading) write(h, { f: bold, size: 13, gap: 2, center: true });
  y -= 14;
  write(title.toUpperCase(), { f: bold, size: 14, gap: 16, center: true });
  for (const p of paragraphs) write(p);

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText('FICTIONAL SAMPLE DOCUMENT - NOT A REAL CASE', {
      x: MARGIN, y: 28, size: 9, font: bold, color: rgb(0.75, 0.1, 0.1),
    });
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE.w - MARGIN - 60, y: 28, size: 9, font });
  });

  fs.writeFileSync(path.join(OUT, filename), await doc.save({ useObjectStreams: false }));
  console.log(`✅ ${filename} (${pages.length} page${pages.length > 1 ? 's' : ''})`);
}

const header = [`IN ${COURT.toUpperCase()}`, 'THE CHILDREN ACT 1989', `IN THE MATTER OF ${CHILD.toUpperCase()}`];

const filler = (topic, n) => Array.from({ length: n }, (_, i) =>
  `${i + 1}. This paragraph is placeholder text about ${topic}. It exists only so that the document has realistic length ` +
  'for testing page counts, OCR, bundle pagination and the hyperlinked index. None of it describes real people or events.');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  await makePdf(`C100_Application_${CASE_NO}_2025-01-15.pdf`, {
    title: 'C100 Application (summary)',
    heading: header,
    paragraphs: [
      'Applicant: John Smith. Respondent: Jane Doe.',
      'Orders sought: Child Arrangements Order (live with / spend time with).',
      'Date of application: 15 January 2025.',
      ...filler('the application', 4),
    ],
  });

  await makePdf(`Statement_of_John_Smith_${CASE_NO}.pdf`, {
    title: 'Witness Statement',
    heading: header,
    paragraphs: [
      'I, John Smith, of 1 Example Street, Exampleton, EX1 1AA, make this statement in support of my application.',
      ...filler('the background', 22),
      'Statement of truth: I believe that the facts stated in this witness statement are true.',
    ],
  });

  await makePdf(`Position_Statement_Applicant_${CASE_NO}.pdf`, {
    title: 'Position Statement on behalf of the Applicant',
    heading: header,
    paragraphs: ['Hearing: First Hearing Dispute Resolution Appointment.', ...filler('the applicant\'s position', 5)],
  });

  await makePdf(`Order_${CASE_NO}_12.03.2025.pdf`, {
    title: 'Case Management Order',
    heading: header,
    paragraphs: [
      'Before District Judge Hartley sitting at Exampleton on 12 March 2025.',
      'Upon hearing the Applicant in person and the Respondent in person, IT IS ORDERED THAT:',
      '1. The Applicant shall file and serve a statement by 4pm on 9 April 2025.',
      '2. Cafcass shall file a section 7 report by 4pm on 4 June 2025.',
      '3. The matter is listed for a Dispute Resolution Appointment with a time estimate of 2 hours.',
    ],
  });

  await makePdf(`Cafcass_Safeguarding_Letter_${CASE_NO}.pdf`, {
    title: 'Cafcass Safeguarding Letter',
    heading: header,
    paragraphs: ['Family Court Adviser: A. N. Adviser (fictional).', ...filler('safeguarding enquiries', 6)],
  });

  await makePdf(`Chronology_${CASE_NO}.pdf`, {
    title: 'Chronology',
    heading: header,
    paragraphs: [
      '2017 - Child A born.',
      '15.01.2025 - C100 application issued.',
      '12.03.2025 - Case management hearing before District Judge Hartley.',
      '09.04.2025 - Applicant\'s statement due.',
    ],
  });
}

main().catch(err => {
  console.error('❌ Sample generation failed:', err);
  process.exit(1);
});
