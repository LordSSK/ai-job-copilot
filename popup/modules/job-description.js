/**
 * Job description handling functionality
 */

import { updateStatus, debounce } from './ui-helpers.js';
import { storageUtils } from '../../utils/storage.js';

// Job Description handling
function initJobDescription() {
  const extractBtn = document.getElementById('extract-jd-btn');
  const manualBtn = document.getElementById('manual-jd-btn');
  const jobDescription = document.getElementById('job-description');
  
  // Extract job description from current page
  extractBtn.addEventListener('click', () => {
    updateStatus('Extracting job description...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        updateStatus('Error: No active tab found', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      // First ensure content script is loaded
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content/jobfill-functions.js']
      })
      .then(() => {
        // Check if we're on a Workday or Greenhouse site
        const url = activeTab.url.toLowerCase();
        let action = 'extractJobDescription';
        
        if (url.includes('workday.com')) {
          action = 'extractWorkdayJobDescription';
          updateStatus('Extracting Workday job description...', 'progress');
        } else if (url.includes('greenhouse.io')) {
          action = 'extractGreenhouseJobDescription';
          updateStatus('Extracting Greenhouse job description...', 'progress');
        } else {
          updateStatus('Extracting general job description...', 'progress');
        }
        
        // Now send message to extract job description
        chrome.tabs.sendMessage(
          activeTab.id, 
          { action: action }, 
          (response) => {
            if (chrome.runtime.lastError) {
              updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
              return;
            }
            
            if (response && response.jobDescription) {
              jobDescription.value = response.jobDescription;
              saveJobDescription(response.jobDescription);
              updateStatus('Job description extracted');
            } else if (response && response.error) {
              updateStatus('Error: ' + response.error, 'warning');
            } else {
              updateStatus('Could not find job description', 'warning');
            }
          }
        );
      })
      .catch(error => {
        updateStatus('Error: Could not inject content script', 'error');
        console.error('Script injection error:', error);
      });
    });
  });
  
  // Manual entry
  manualBtn.addEventListener('click', () => {
    jobDescription.value = '';
    jobDescription.focus();
  });
  
  // Save job description as user types
  jobDescription.addEventListener('input', debounce(() => {
    saveJobDescription(jobDescription.value);
  }, 1000));

  // Load saved job description
  storageUtils.get('jobDescription').then(data => {
    if (data.jobDescription) {
      jobDescription.value = data.jobDescription.content;
    }
  });
  
  function saveJobDescription(content) {
    const jdData = {
      content: content,
      source: 'manual',
      lastUpdated: new Date().toISOString()
    };
    
    storageUtils.save({ jobDescription: jdData });
  }
}

export { initJobDescription }; 