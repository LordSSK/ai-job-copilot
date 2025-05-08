// Global promise that resolves when PDF.js is loaded
window.pdfJsLoaded = new Promise((resolve, reject) => {
  // Load PDF.js from local files
  try {
    // Create script element for the PDF.js library
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('lib/pdf.min.js');
    
    // Set onload handler
    script.onload = function() {
      if (typeof pdfjsLib !== 'undefined') {
        // Set the worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
        console.log('PDF.js loaded successfully');
        resolve();
      } else {
        const error = new Error('PDF.js library was not loaded properly');
        console.error(error);
        reject(error);
      }
    };
    
    // Set onerror handler
    script.onerror = function(e) {
      console.error('Error loading PDF.js script:', e);
      reject(new Error('Failed to load PDF.js script'));
    };
    
    // Add script to the document head
    document.head.appendChild(script);
  } catch (error) {
    console.error('Error setting up PDF.js:', error);
    reject(error);
  }
}); 