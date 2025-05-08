document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI and tab handling
  initTabs();
  initResumeUpload();
  initJobDescription();
  initGenerateContent();
  initSettings();
  loadUserData();
});

// Tab navigation
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked tab
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

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
    chrome.storage.local.remove('resume', () => {
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
        // For PDFs, we'll just show a placeholder and process it in background
        content = 'PDF content loaded. Ready for processing.';
        
        // In a real extension, you would use a PDF parsing library
        // or send the PDF to your backend/API for processing
      } else {
        // For text files, display the content
        content = e.target.result;
      }
      
      resumeContent.textContent = content;
      
      // Save to storage
      saveResume(file, content);
    };
    
    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  function saveResume(file, content) {
    const resumeData = {
      filename: file.name,
      type: file.type,
      content: content,
      lastUpdated: new Date().toISOString()
    };
    
    chrome.storage.local.set({ resume: resumeData }, () => {
      updateStatus('Resume saved');
    });
  }
}

// Job Description handling
function initJobDescription() {
  const extractBtn = document.getElementById('extract-jd-btn');
  const manualBtn = document.getElementById('manual-jd-btn');
  const jobDescription = document.getElementById('job-description');
  
  // Extract job description from current page
  extractBtn.addEventListener('click', () => {
    updateStatus('Extracting job description...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id, 
        { action: 'extractJobDescription' }, 
        (response) => {
          if (chrome.runtime.lastError) {
            updateStatus('Error: Could not connect to page', 'error');
            return;
          }
          
          if (response && response.jobDescription) {
            jobDescription.value = response.jobDescription;
            saveJobDescription(response.jobDescription);
            updateStatus('Job description extracted');
          } else {
            updateStatus('Could not find job description', 'warning');
          }
        }
      );
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
  chrome.storage.local.get('jobDescription', (data) => {
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
    
    chrome.storage.local.set({ jobDescription: jdData });
  }
}

// Generate content using AI
function initGenerateContent() {
  const generateBtn = document.getElementById('generate-btn');
  const autofillBtn = document.getElementById('autofill-btn');
  const generatedContent = document.getElementById('generated-content-container');
  
  const summaryPreview = document.getElementById('summary-preview');
  const experiencePreview = document.getElementById('experience-preview');
  const skillsPreview = document.getElementById('skills-preview');
  const coverLetterPreview = document.getElementById('cover-letter-preview');
  
  // Generate content button handler
  generateBtn.addEventListener('click', async () => {
    // Check if we have resume and job description
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['resume', 'jobDescription', 'apiKey'], resolve);
    });
    
    if (!data.resume) {
      updateStatus('Please upload your resume first', 'error');
      return;
    }
    
    if (!data.jobDescription || !data.jobDescription.content) {
      updateStatus('Please add a job description first', 'error');
      return;
    }
    
    if (!data.apiKey) {
      updateStatus('Please add your API key in settings', 'error');
      return;
    }
    
    // Get selected options
    const options = {
      summary: document.getElementById('generate-summary').checked,
      experience: document.getElementById('generate-experience').checked,
      skills: document.getElementById('generate-skills').checked,
      coverLetter: document.getElementById('generate-cover-letter').checked
    };
    
    if (!Object.values(options).some(Boolean)) {
      updateStatus('Please select at least one option to generate', 'warning');
      return;
    }
    
    updateStatus('Generating content...', 'progress');
    showProgress(true);
    
    try {
      // Call background script to handle API request
      const results = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'generateContent',
          data: {
            resume: data.resume,
            jobDescription: data.jobDescription,
            options: options
          }
        }, resolve);
      });
      
      if (results) {
        // Update UI with generated content
        if (options.summary) {
          summaryPreview.textContent = results.summary || 'No summary generated';
        }
        
        if (options.experience) {
          experiencePreview.textContent = results.experience || 'No experience bullets generated';
        }
        
        if (options.skills) {
          skillsPreview.textContent = results.skills || 'No skills generated';
        }
        
        if (options.coverLetter) {
          coverLetterPreview.textContent = results.coverLetter || 'No cover letter generated';
        }
        
        // Save generated content
        chrome.storage.local.set({ generatedContent: results });
        
        // Show the content
        generatedContent.hidden = false;
        updateStatus('Content generated successfully');
      } else {
        updateStatus('Failed to generate content', 'error');
      }
    } catch (error) {
      updateStatus('Error: ' + error.message, 'error');
    } finally {
      showProgress(false);
    }
  });
  
  // Autofill button handler
  autofillBtn.addEventListener('click', () => {
    chrome.storage.local.get('generatedContent', (data) => {
      if (!data.generatedContent) {
        updateStatus('No content to autofill. Please generate content first.', 'error');
        return;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { 
            action: 'autofillApplication',
            data: data.generatedContent
          }, 
          (response) => {
            if (chrome.runtime.lastError) {
              updateStatus('Error: Could not connect to page', 'error');
              return;
            }
            
            if (response && response.success) {
              updateStatus(`Autofilled ${response.filled} fields`);
            } else {
              updateStatus('Autofill failed or no fields found', 'warning');
            }
          }
        );
      });
    });
  });
}

// Settings handling
function initSettings() {
  const apiKeyInput = document.getElementById('api-key-input');
  const aiModelSelect = document.getElementById('ai-model-select');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const loginBtn = document.getElementById('login-btn');
  
  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      aiModel: aiModelSelect.value
    };
    
    chrome.storage.local.set({ settings }, () => {
      updateStatus('Settings saved');
    });
  });
  
  // Load settings
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      apiKeyInput.value = data.settings.apiKey || '';
      aiModelSelect.value = data.settings.aiModel || 'gpt-3.5-turbo';
    }
  });
  
  // Upgrade to premium (placeholder)
  upgradeBtn.addEventListener('click', () => {
    // In a real extension, this would open a payment page or subscription modal
    chrome.tabs.create({ url: 'https://example.com/upgrade' });
  });
  
  // Login (placeholder)
  loginBtn.addEventListener('click', () => {
    // In a real extension, this would handle authentication
    chrome.tabs.create({ url: 'https://example.com/login' });
  });
}

// Utility function to load user data
function loadUserData() {
  chrome.storage.local.get(['resume', 'jobDescription', 'generatedContent'], (data) => {
    // Resume
    if (data.resume) {
      const resumePreview = document.getElementById('resume-preview');
      const uploadArea = document.getElementById('resume-upload-area');
      const resumeFilename = document.getElementById('resume-filename');
      const resumeContent = document.getElementById('resume-content');
      
      resumeFilename.textContent = data.resume.filename;
      resumeContent.textContent = data.resume.type === 'application/pdf' 
        ? 'PDF content loaded. Ready for processing.'
        : data.resume.content;
      
      resumePreview.hidden = false;
      uploadArea.hidden = true;
    }
    
    // Job Description
    if (data.jobDescription && data.jobDescription.content) {
      document.getElementById('job-description').value = data.jobDescription.content;
    }
    
    // Generated Content
    if (data.generatedContent) {
      const generatedContent = document.getElementById('generated-content-container');
      const summaryPreview = document.getElementById('summary-preview');
      const experiencePreview = document.getElementById('experience-preview');
      const skillsPreview = document.getElementById('skills-preview');
      const coverLetterPreview = document.getElementById('cover-letter-preview');
      
      if (data.generatedContent.summary) {
        summaryPreview.textContent = data.generatedContent.summary;
      }
      
      if (data.generatedContent.experience) {
        experiencePreview.textContent = data.generatedContent.experience;
      }
      
      if (data.generatedContent.skills) {
        skillsPreview.textContent = data.generatedContent.skills;
      }
      
      if (data.generatedContent.coverLetter) {
        coverLetterPreview.textContent = data.generatedContent.coverLetter;
      }
      
      generatedContent.hidden = false;
    }
  });
}

// UI helpers
function updateStatus(message, type = 'info') {
  const statusMessage = document.getElementById('status-message');
  statusMessage.textContent = message;
  
  // Apply color based on message type
  statusMessage.style.color = type === 'error' 
    ? 'var(--error-color)' 
    : type === 'warning' 
      ? 'var(--warning-color)' 
      : type === 'success' 
        ? 'var(--success-color)' 
        : '';
}

function showProgress(show) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.hidden = !show;
}

// Utility function for debouncing
function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
} 