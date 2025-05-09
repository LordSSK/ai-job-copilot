/**
 * Resume upload and processing functionality
 */

import { updateStatus } from './ui-helpers.js';
import { pdfJsLoaded } from '../../utils/pdf-loader.js';
import { storageUtils } from '../../utils/storage.js';

// Resume upload handling
function initResumeUpload() {
  const uploadArea = document.getElementById('resume-upload-area');
  const fileInput = document.getElementById('resume-file');
  const resumePreview = document.getElementById('resume-preview');
  const resumeFilename = document.getElementById('resume-filename');
  const resumeContent = document.getElementById('resume-content');
  const resumeRemove = document.getElementById('resume-remove');

  // Click on upload area triggers file input
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragging');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragging');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragging');
    
    if (e.dataTransfer.files.length) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Remove resume
  resumeRemove.addEventListener('click', () => {
    fileInput.value = '';
    resumePreview.hidden = true;
    uploadArea.hidden = false;
    
    // Clear from storage
    storageUtils.remove('resume').then(() => {
      updateStatus('Resume removed');
    });
  });

  function handleFileUpload(file) {
    if (!file) return;
    
    // Check file type (PDF or TXT)
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      updateStatus('Only PDF or TXT files are supported', 'error');
      return;
    }

    resumeFilename.textContent = file.name;
    
    // Show preview and hide upload area
    resumePreview.hidden = false;
    uploadArea.hidden = true;
    
    // Read file content
    const reader = new FileReader();
    
    reader.onload = (e) => {
      let content = '';
      
      if (file.type === 'application/pdf') {
        // Show loading status while parsing PDF
        resumeContent.textContent = 'Parsing PDF content...';
        updateStatus('Processing PDF content...', 'progress');
        
        // Use PDF.js to extract text from PDF
        extractPDFText(e.target.result).then(extractedText => {
          content = extractedText || 'No text content could be extracted from this PDF.';
          
          // Validate that we actually got useful content
          if (!content || content.trim().length < 50) {
            resumeContent.textContent = 'Warning: Limited text was extracted from this PDF. The content may not be sufficient for AI processing.';
            updateStatus('Limited text extracted from PDF. Try another file format.', 'warning');
          } else {
            resumeContent.textContent = content;
            updateStatus('Resume saved');
          }
          
          // Save to storage
          saveResume(file, content);
        }).catch(error => {
          console.error('Error extracting PDF text:', error);
          content = 'Error extracting PDF content. Please try another file or convert to text format.';
          resumeContent.textContent = content;
          updateStatus('Error processing PDF', 'error');
          
          // Still save the file reference with error message
          saveResume(file, content);
        });
      } else {
        // For text files, display the content
        content = e.target.result;
        
        // Validate content length
        if (!content || content.trim().length < 50) {
          resumeContent.textContent = 'Warning: This text file contains very little content. It may not be sufficient for AI processing.';
          updateStatus('Limited text in file. Check file content.', 'warning');
        } else {
          resumeContent.textContent = content;
          updateStatus('Resume saved');
        }
        
        // Save to storage
        saveResume(file, content);
      }
    };
    
    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  // PDF.js text extraction function
  async function extractPDFText(arrayBuffer) {
    try {
      // Wait for PDF.js to load using our global promise
      await pdfJsLoaded;
      
      // Make sure PDF.js loaded properly
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not available');
      }
      
      // Load the PDF using PDF.js
      const pdfData = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      
      const pdf = await loadingTask.promise;
      let extractedText = '';
      
      // Get the total number of pages
      const numPages = pdf.numPages;
      
      // Process each page
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text from the page
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        extractedText += pageText + '\n\n';
      }
      
      const text = extractedText.trim();
      
      // Check if we got meaningful text content
      if (text.length < 50) {
        console.warn('Extracted text is very short, may indicate a scanned PDF without OCR');
        updateStatus('Warning: Limited text extracted, PDF may be scanned without OCR', 'warning');
      }
      
      return text;
    } catch (error) {
      console.error('PDF.js extraction error:', error);
      throw error;
    }
  }

  function saveResume(file, content) {
    const resumeData = {
      filename: file.name,
      type: file.type,
      content: content,
      lastUpdated: new Date().toISOString()
    };
    
    // Add content length for debugging
    console.log(`Saving resume with content length: ${content.length} characters`);
    
    storageUtils.save({ resume: resumeData });
  }
}

export { initResumeUpload };