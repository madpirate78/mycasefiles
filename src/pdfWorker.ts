import { pdfjs } from 'react-pdf';
import { configurePDFJS } from './pdfConfig';

// Configure PDF.js for complete offline functionality
configurePDFJS({
  // Enable verbose logging in development
  verbosity: process.env.NODE_ENV === 'development' ? pdfjs.VerbosityLevel.INFOS : undefined
});

export default pdfjs;