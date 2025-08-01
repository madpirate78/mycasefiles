// AI Summarizer for Court Document Descriptions
const { pipeline, env } = require("@xenova/transformers");

// Configure model cache location
env.cacheDir = "./models";
env.allowLocalModels = true;
env.allowRemoteModels = true;

class LegalDocumentAI {
  constructor() {
    this.summarizer = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🤖 Initializing Local LLM for document descriptions...');
    
    try {
      // Use a small, fast model for description generation
      this.summarizer = await pipeline(
        "summarization",
        "Xenova/distilbart-cnn-6-6"
      );

      this.initialized = true;
      console.log('✅ Local LLM initialized successfully');
    } catch (error) {
      console.error('❌ LLM initialization failed:', error);
      throw error;
    }
  }

  async generateDescription(text, filename = '', maxLength = 100) {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    try {
      console.log('🧠 Generating description for document...');
      
      // Prepare text for summarization
      const processedText = this.preprocessText(text, filename);
      
      if (processedText.length < 50) {
        // For very short text, return a basic description
        return this.generateBasicDescription(filename, text);
      }

      // Split into chunks if text is too long
      const chunks = this.chunkText(processedText, 1024);
      
      const summaries = await Promise.all(
        chunks.map((chunk) =>
          this.summarizer(chunk, {
            max_length: Math.min(maxLength, 100),
            min_length: 20,
            do_sample: false,
            no_repeat_ngram_size: 3
          })
        )
      );

      let description = summaries.map((s) => s[0].summary_text).join(" ");
      
      // Clean up and format for legal context
      description = this.postprocessDescription(description, filename);
      
      console.log('✅ Description generated:', description.substring(0, 50) + '...');
      return description;

    } catch (error) {
      console.error('❌ Description generation failed:', error);
      // Fallback to basic description
      return this.generateBasicDescription(filename, text);
    }
  }

  preprocessText(text, filename) {
    // Add context from filename
    let contextualText = '';
    
    if (filename) {
      contextualText += `Document: ${filename}. `;
    }
    
    contextualText += text;

    // Clean up common PDF extraction artifacts
    return contextualText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,;:!?()-]/g, ' ') // Remove special chars
      .trim()
      .substring(0, 2000); // Limit length for processing
  }

  postprocessDescription(description, filename) {
    // Make description more appropriate for legal documents
    description = description
      .replace(/^(This document|The document|This)/i, 'Court document')
      .replace(/\b(summarizes?|summary)\b/gi, 'contains')
      .trim();

    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(description)) {
      description += '.';
    }

    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);

    return description;
  }

  generateBasicDescription(filename, text) {
    // Fallback description based on filename and basic text analysis
    let description = 'Legal document';
    
    if (filename) {
      if (filename.toLowerCase().includes('order')) {
        description = 'Court order document';
      } else if (filename.toLowerCase().includes('application')) {
        description = 'Court application document';
      } else if (filename.toLowerCase().includes('statement')) {
        description = 'Statement document';
      }
    }

    // Add date if found in text
    const dateMatch = text.match(/\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}/);
    if (dateMatch) {
      description += ` dated ${dateMatch[0]}`;
    }

    return description + '.';
  }

  chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

module.exports = { LegalDocumentAI };