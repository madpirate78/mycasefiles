/**
 * Court bundle generation service.
 *
 * Creates professional court bundles with:
 *  - Cover page with case details
 *  - Hyperlinked index with dotted leaders
 *  - Section dividers
 *  - Page numbering
 *  - PDF bookmarks/outline
 *
 * IPC handlers:
 *  - create-pdf-bundle: Full bundle creation from document data
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ─── Bundle index creation ───────────────────────────────────────

/** Create professional court bundle cover page and index. */
async function createBundleIndex(pdfDoc, bundleData) {
  const indexPages = [];
  const pageReferences = new Map();

  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Create cover page
  let coverPage = pdfDoc.addPage([595.28, 841.89]); // A4 size

  const { width, height } = coverPage.getSize();
  const margin = 72; // 1 inch margins
  let yPosition = height - 100;

  const drawCenteredText = (text, font, size, y, page = coverPage) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  const drawLeftText = (text, font, size, y, x = margin, page = coverPage) => {
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  // FAMILY COURT BUNDLE
  drawCenteredText('FAMILY COURT BUNDLE', timesRomanBold, 18, yPosition);
  yPosition -= 30;

  // Bundle type
  drawCenteredText(bundleData.bundleName.toUpperCase(), timesRomanBold, 16, yPosition);
  yPosition -= 40;

  // Case reference
  if (bundleData.caseReference) {
    drawCenteredText(`Case No: ${bundleData.caseReference}`, timesRoman, 14, yPosition);
    yPosition -= 30;
  }

  // Court location
  if (bundleData.court) {
    drawCenteredText(`In the Family Court at ${bundleData.court}`, timesRoman, 14, yPosition);
    yPosition -= 20;
  }

  // Act/Rules
  drawCenteredText('Children Act 1989', timesRoman, 14, yPosition);
  yPosition -= 40;

  // Re: Children (if applicable)
  if (bundleData.children && bundleData.children.length > 0) {
    const childNames = bundleData.children.map(child => {
      const dob = child.dob ? ` (DOB: ${new Date(child.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})` : '';
      return `${child.name}${dob}`;
    }).join(', ');
    drawCenteredText(`Re: ${childNames}`, timesRoman, 12, yPosition);
    yPosition -= 30;
  }

  // Parties
  yPosition -= 10;
  const applicantLabel = bundleData.applicantName || '[Applicant Name]';
  const respondentLabel = bundleData.respondentName || '[Respondent Name]';

  drawLeftText(applicantLabel, timesRoman, 12, yPosition, width / 2 - 100);
  drawLeftText('Applicant', timesRomanBold, 12, yPosition, width / 2 + 50);
  yPosition -= 20;

  drawCenteredText('and', timesRoman, 12, yPosition);
  yPosition -= 20;

  drawLeftText(respondentLabel, timesRoman, 12, yPosition, width / 2 - 100);
  drawLeftText('Respondent', timesRomanBold, 12, yPosition, width / 2 + 50);
  yPosition -= 60;

  // Hearing details
  if (bundleData.hearingDate) {
    const hearingDate = new Date(bundleData.hearingDate);
    const formattedDate = hearingDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = '10:00';
    drawCenteredText(`First Directions Hearing: ${formattedDate} at ${formattedTime}`, timesRoman, 14, yPosition);
    yPosition -= 30;
  }

  // Bundle prepared date
  const preparedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  drawCenteredText(`Bundle prepared: ${preparedDate}`, timesRoman, 12, yPosition);

  // Create index page (page 2)
  let indexPage = pdfDoc.addPage([595.28, 841.89]);
  indexPages.push(indexPage);
  yPosition = height - margin;

  drawCenteredText('INDEX TO BUNDLE', timesRomanBold, 16, yPosition, indexPage);
  yPosition -= 40;

  let pageNumber = 2;

  // Helper function to draw dotted line
  const drawDottedLine = (startX, endX, y, page = indexPage) => {
    const dotSpacing = 3;
    const dotSize = 0.5;
    let x = startX;

    while (x < endX) {
      page.drawCircle({
        x: x,
        y: y,
        size: dotSize,
        color: rgb(0, 0, 0),
      });
      x += dotSpacing;
    }
  };

  console.log('\n📊 ELECTRON: Bundle Index Generation Debug');
  console.log('='.repeat(80));
  console.log('Sections received from React:');
  bundleData.sections.forEach(section => {
    if (section.documentCount > 0) {
      console.log(`  Section ${section.letter}: startPage=${section.startPage}, endPage=${section.endPage}`);
    }
  });

  for (const section of bundleData.sections) {
    if (!section.documentCount) continue;

    const sectionPageRef = section.startPage;
    pageReferences.set(`section_${section.id}`, sectionPageRef);
    console.log(`  📂 Section ${section.letter} will show page: ${sectionPageRef}`);

    // Section header
    yPosition -= 5;
    const sectionLabel = `${section.letter}. ${section.label}`;

    // Create hyperlink annotation for section
    const labelWidth = helveticaBold.widthOfTextAtSize(sectionLabel, 12);
    const sectionLinkAnnotation = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [margin, yPosition - 2, margin + labelWidth, yPosition + 12],
        Border: [0, 0, 0],
        Dest: [sectionPageRef - 2, 'XYZ', null, null, null],
        H: 'I',
      })
    );

    indexPage.node.addAnnot(sectionLinkAnnotation);

    drawLeftText(sectionLabel, helveticaBold, 12, yPosition, margin, indexPage);

    // Draw dotted line from section label to page number
    const pageNumStr = sectionPageRef.toString();
    const pageNumWidth = helvetica.widthOfTextAtSize(pageNumStr, 12);
    const pageNumX = width - margin - pageNumWidth;

    drawDottedLine(margin + labelWidth + 10, pageNumX - 10, yPosition + 3, indexPage);
    drawLeftText(pageNumStr, helvetica, 12, yPosition, pageNumX, indexPage);

    yPosition -= 20;

    // Get documents for this section
    const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
    let docIndex = 1;

    for (const doc of sectionDocs) {
      // Check if we need a new page
      if (yPosition < 100) {
        const newIndexPage = pdfDoc.addPage([595.28, 841.89]);
        indexPages.push(newIndexPage);
        indexPage = newIndexPage;
        yPosition = height - margin;

        drawCenteredText('INDEX TO BUNDLE (continued)', helvetica, 12, yPosition, indexPage);
        yPosition -= 30;
      }

      const docPageRef = doc.bundleStartPage;
      pageReferences.set(`doc_${doc.id}`, docPageRef);

      console.log(`    📄 Doc ${docIndex}: "${doc.name}"`);
      console.log(`       - bundleStartPage: ${doc.bundleStartPage}`);
      console.log(`       - bundlePageCount: ${doc.bundlePageCount}`);
      console.log(`       - totalPages: ${doc.totalPages}`);
      console.log(`       - INDEX will show page: ${docPageRef}`);

      // Document entry with subsection numbering
      const docLabel = `${section.letter}.${docIndex} ${doc.name}`;
      const indentX = margin + 20;

      // Truncate if too long
      let displayLabel = docLabel;
      const maxLabelWidth = width - margin * 2 - 100;
      if (helvetica.widthOfTextAtSize(displayLabel, 11) > maxLabelWidth) {
        while (helvetica.widthOfTextAtSize(displayLabel + '...', 11) > maxLabelWidth && displayLabel.length > 10) {
          displayLabel = displayLabel.substring(0, displayLabel.length - 1);
        }
        displayLabel += '...';
      }

      // Create hyperlink annotation for document
      const docLabelWidth = helvetica.widthOfTextAtSize(displayLabel, 11);
      const docLinkAnnotation = pdfDoc.context.register(
        pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [indentX, yPosition - 2, indentX + docLabelWidth, yPosition + 11],
          Border: [0, 0, 0],
          Dest: [docPageRef - 2, 'XYZ', null, null, null],
          H: 'I',
        })
      );

      indexPage.node.addAnnot(docLinkAnnotation);

      drawLeftText(displayLabel, helvetica, 11, yPosition, indentX, indexPage);

      // Page number with dotted line
      const docPageStr = docPageRef.toString();
      const docPageWidth = helvetica.widthOfTextAtSize(docPageStr, 11);
      const docPageX = width - margin - docPageWidth;

      drawDottedLine(indentX + docLabelWidth + 10, docPageX - 10, yPosition + 3, indexPage);
      drawLeftText(docPageStr, helvetica, 11, yPosition, docPageX, indexPage);

      yPosition -= 18;
      docIndex++;
    }

    yPosition -= 10; // Extra space between sections
  }

  // Add page number to index page(s)
  let pageNum = 2;
  for (const page of indexPages) {
    const pageText = pageNum.toString();
    const pageTextWidth = helvetica.widthOfTextAtSize(pageText, 10);

    page.drawText(pageText, {
      x: (width - pageTextWidth) / 2,
      y: 30,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    pageNum++;
  }

  const frontMatterPageCount = indexPages.length + 1;
  console.log(`📚 Front matter pages: ${frontMatterPageCount} (cover + ${indexPages.length} index)`);
  console.log(`📚 React service provided pages already account for front matter`);

  return {
    pages: [coverPage, ...indexPages],
    pageReferences: pageReferences
  };
}

// ─── IPC registration ─────────────────────────────────────────────

function init(deps) {
  const { ipcMain, shell } = deps;

  ipcMain.handle('create-pdf-bundle', async (event, bundleData) => {
    try {
      console.log('📁 Starting PDF bundle creation for:', bundleData.bundleName);
      console.log('📄 Documents to process:', bundleData.documents.length);

      event.sender.send('bundle-progress', {
        stage: 'initializing',
        progress: 0,
        message: 'Initializing bundle creation...'
      });

      const bundlePdf = await PDFDocument.create();

      bundlePdf.setTitle(bundleData.bundleName);
      bundlePdf.setSubject(`Court Bundle - ${bundleData.caseReference || 'Case'}`);
      bundlePdf.setCreator('My Case Files');
      bundlePdf.setProducer('My Case Files Legal Document Management');
      bundlePdf.setCreationDate(new Date());

      event.sender.send('bundle-progress', {
        stage: 'processing',
        progress: 10,
        message: 'Creating bundle index...'
      });

      const indexResult = await createBundleIndex(bundlePdf, bundleData);
      const frontPages = indexResult.pages;
      const pageReferences = indexResult.pageReferences;
      let currentPageNumber = frontPages.length + 1;

      event.sender.send('bundle-progress', {
        stage: 'processing',
        progress: 20,
        message: 'Processing documents...'
      });

      const helveticaBold = await bundlePdf.embedFont(StandardFonts.HelveticaBold);
      let processedDocs = 0;
      const totalDocs = bundleData.documents.length;

      for (const section of bundleData.sections) {
        if (!section.documentCount) continue;

        // Add section divider page
        const dividerPage = bundlePdf.addPage([595.28, 841.89]);
        const { width, height } = dividerPage.getSize();

        const sectionTitle = `SECTION ${section.letter}`;
        const sectionLabel = section.label.toUpperCase();

        const titleWidth = helveticaBold.widthOfTextAtSize(sectionTitle, 36);
        const labelWidth = helveticaBold.widthOfTextAtSize(sectionLabel, 24);

        dividerPage.drawText(sectionTitle, {
          x: (width - titleWidth) / 2,
          y: height / 2 + 50,
          size: 36,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        dividerPage.drawText(sectionLabel, {
          x: (width - labelWidth) / 2,
          y: height / 2 - 20,
          size: 24,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        // Add page number to divider
        const pageNumText = currentPageNumber.toString();
        const fontSize = 16;
        const pageNumWidth = helveticaBold.widthOfTextAtSize(pageNumText, fontSize);
        const padding = 6;

        dividerPage.drawRectangle({
          x: width - pageNumWidth - 20 - padding,
          y: 20 - padding,
          width: pageNumWidth + (padding * 2),
          height: fontSize + (padding * 2),
          color: rgb(1, 1, 1),
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 0.5,
        });

        dividerPage.drawText(pageNumText, {
          x: width - pageNumWidth - 20,
          y: 20,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0, 0.4, 0.8),
        });

        currentPageNumber++;

        // Get documents for this section
        const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);

        for (const doc of sectionDocs) {
          try {
            processedDocs++;
            const progress = 20 + Math.floor((processedDocs / totalDocs) * 60);

            event.sender.send('bundle-progress', {
              stage: 'processing',
              progress: progress,
              message: `Processing document ${processedDocs} of ${totalDocs}: ${doc.name}`
            });

            console.log(`📄 Processing document: ${doc.name}`);

            const pdfBytes = new Uint8Array(doc.arrayBuffer);
            const srcPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

            let pagesToCopy = [];
            if (doc.selectedPages && doc.selectedPages.length > 0) {
              pagesToCopy = doc.selectedPages.map(pageNum => pageNum - 1);
            } else {
              pagesToCopy = srcPdf.getPageIndices();
            }

            const copiedPages = await bundlePdf.copyPages(srcPdf, pagesToCopy);

            for (const page of copiedPages) {
              bundlePdf.addPage(page);

              const { width } = page.getSize();
              const pageNumText = currentPageNumber.toString();
              const fontSize = 16;
              const pageNumWidth = helveticaBold.widthOfTextAtSize(pageNumText, fontSize);
              const padding = 6;

              page.drawRectangle({
                x: width - pageNumWidth - 20 - padding,
                y: 20 - padding,
                width: pageNumWidth + (padding * 2),
                height: fontSize + (padding * 2),
                color: rgb(1, 1, 1),
                borderColor: rgb(0.8, 0.8, 0.8),
                borderWidth: 0.5,
              });

              page.drawText(pageNumText, {
                x: width - pageNumWidth - 20,
                y: 20,
                size: fontSize,
                font: helveticaBold,
                color: rgb(0, 0.4, 0.8),
              });

              currentPageNumber++;
            }

            console.log(`✅ Added ${copiedPages.length} pages from ${doc.name}`);

          } catch (error) {
            console.error(`❌ Error processing document ${doc.name}:`, error);
          }
        }
      }

      event.sender.send('bundle-progress', {
        stage: 'finalizing',
        progress: 90,
        message: 'Creating bookmarks and finalizing bundle...'
      });

      // Create PDF bookmarks/outline
      console.log('📑 Creating PDF bookmarks...');

      const pages = bundlePdf.getPages();

      const outlineRef = bundlePdf.context.nextRef();
      const outlineDict = bundlePdf.context.obj({
        Type: 'Outlines',
        Count: 0,
      });
      bundlePdf.context.assign(outlineRef, outlineDict);
      bundlePdf.catalog.set(bundlePdf.context.obj('Outlines'), outlineRef);

      let bookmarkCount = 0;
      let prevBookmarkRef = null;
      let firstBookmarkRef = null;

      for (const section of bundleData.sections) {
        if (!section.documentCount) continue;

        const sectionPageRef = pageReferences.get(`section_${section.id}`);
        if (!sectionPageRef) continue;

        const sectionBookmarkRef = bundlePdf.context.nextRef();
        const sectionBookmarkDict = bundlePdf.context.obj({
          Title: bundlePdf.context.obj(`Section ${section.letter}: ${section.label}`),
          Dest: bundlePdf.context.obj([pages[sectionPageRef - 1].ref, 'XYZ', null, null, null]),
          Parent: outlineRef,
        });

        if (prevBookmarkRef) {
          sectionBookmarkDict.set(bundlePdf.context.obj('Prev'), prevBookmarkRef);
          const prevDict = bundlePdf.context.lookup(prevBookmarkRef);
          prevDict.set(bundlePdf.context.obj('Next'), sectionBookmarkRef);
        } else {
          firstBookmarkRef = sectionBookmarkRef;
        }

        bundlePdf.context.assign(sectionBookmarkRef, sectionBookmarkDict);
        prevBookmarkRef = sectionBookmarkRef;
        bookmarkCount++;

        // Create bookmarks for documents in this section
        const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
        let docIndex = 1;
        let prevDocBookmarkRef = null;
        let firstDocBookmarkRef = null;
        let docBookmarkCount = 0;

        for (const doc of sectionDocs) {
          const docPageRef = pageReferences.get(`doc_${doc.id}`);
          if (!docPageRef) continue;

          const docBookmarkRef = bundlePdf.context.nextRef();
          const docBookmarkDict = bundlePdf.context.obj({
            Title: bundlePdf.context.obj(`${section.letter}.${docIndex} ${doc.name}`),
            Dest: bundlePdf.context.obj([pages[docPageRef - 1].ref, 'XYZ', null, null, null]),
            Parent: sectionBookmarkRef,
          });

          if (prevDocBookmarkRef) {
            docBookmarkDict.set(bundlePdf.context.obj('Prev'), prevDocBookmarkRef);
            const prevDocDict = bundlePdf.context.lookup(prevDocBookmarkRef);
            prevDocDict.set(bundlePdf.context.obj('Next'), docBookmarkRef);
          } else {
            firstDocBookmarkRef = docBookmarkRef;
          }

          bundlePdf.context.assign(docBookmarkRef, docBookmarkDict);
          prevDocBookmarkRef = docBookmarkRef;
          docIndex++;
          docBookmarkCount++;
        }

        if (firstDocBookmarkRef) {
          sectionBookmarkDict.set(bundlePdf.context.obj('First'), firstDocBookmarkRef);
          sectionBookmarkDict.set(bundlePdf.context.obj('Last'), prevDocBookmarkRef);
          sectionBookmarkDict.set(bundlePdf.context.obj('Count'), bundlePdf.context.obj(docBookmarkCount));
        }
      }

      if (firstBookmarkRef) {
        outlineDict.set(bundlePdf.context.obj('First'), firstBookmarkRef);
        outlineDict.set(bundlePdf.context.obj('Last'), prevBookmarkRef);
        outlineDict.set(bundlePdf.context.obj('Count'), bundlePdf.context.obj(bookmarkCount));
      }

      console.log(`✅ Created ${bookmarkCount} section bookmarks with document sub-bookmarks`);

      const pdfBytes = await bundlePdf.save();

      // Save to temp directory
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${bundleData.bundleName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;

      const tempDir = path.join(os.tmpdir(), 'mycasefiles-bundles');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, filename);
      fs.writeFileSync(tempFilePath, pdfBytes);

      console.log('✅ PDF bundle saved to:', tempFilePath);

      shell.openPath(tempFilePath).then((error) => {
        if (error) {
          console.error('Error opening PDF:', error);
          shell.showItemInFolder(tempFilePath);
          console.log('Showing PDF in folder instead');
        } else {
          console.log('PDF opened successfully');
        }
      });

      event.sender.send('bundle-progress', {
        stage: 'complete',
        progress: 100,
        message: 'Bundle created and opened!'
      });

      return {
        success: true,
        filename: filename,
        size: pdfBytes.length,
        filePath: tempFilePath
      };

    } catch (error) {
      console.error('💥 Bundle creation failed:', error);
      event.sender.send('bundle-progress', {
        stage: 'error',
        progress: 0,
        message: `Error: ${error.message}`
      });

      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = { init };
