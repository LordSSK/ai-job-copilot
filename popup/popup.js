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
        // Show loading status while parsing PDF
        resumeContent.textContent = 'Parsing PDF content...';
        updateStatus('Processing PDF content...', 'progress');
        
        // Use PDF.js to extract text from PDF
        extractPDFText(e.target.result).then(extractedText => {
          content = extractedText || 'No text content could be extracted from this PDF.';
          resumeContent.textContent = content;
          
          // Save to storage
          saveResume(file, content);
          updateStatus('Resume saved');
        }).catch(error => {
          console.error('Error extracting PDF text:', error);
          content = 'Error extracting PDF content. Please try another file.';
          resumeContent.textContent = content;
          updateStatus('Error processing PDF', 'error');
          
          // Still save the file reference with error message
          saveResume(file, content);
        });
      } else {
        // For text files, display the content
        content = e.target.result;
        resumeContent.textContent = content;
        
        // Save to storage
        saveResume(file, content);
        updateStatus('Resume saved');
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
      await window.pdfJsLoaded;
      
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
      
      return extractedText.trim();
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
        // Now send message to extract job description
        chrome.tabs.sendMessage(
          activeTab.id, 
          { action: 'extractJobDescription' }, 
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
  const educationPreview = document.getElementById('education-preview');
  const skillsPreview = document.getElementById('skills-preview');
  const coverLetterPreview = document.getElementById('cover-letter-preview');
  
  // Generate content button handler
  generateBtn.addEventListener('click', async () => {
    // Check if we have resume and job description
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['resume', 'jobDescription', 'settings'], resolve);
    });
    
    console.log('Retrieved data for generation:', {
      hasResume: !!data.resume,
      hasJobDescription: !!data.jobDescription,
      settings: data.settings
    });
    
    if (!data.resume) {
      updateStatus('Please upload your resume first', 'error');
      return;
    }
    
    if (!data.jobDescription || !data.jobDescription.content) {
      updateStatus('Please add a job description first', 'error');
      return;
    }
    
    if (!data.settings) {
      updateStatus('Please configure AI settings first', 'error');
      return;
    }
    
    // CRITICAL FIX: Make a copy of settings and ensure apiType is set
    const settings = { ...data.settings };
    
    // Check and ensure the API type is properly set
    // This is a workaround for potential issues with setting storage
    if (!settings.apiType) {
      console.warn('API type not found in settings, checking UI element');
      settings.apiType = document.getElementById('api-type-select').value || 'openai';
      console.log('Using API type from UI:', settings.apiType);
    }
    
    // Check API-specific requirements
    const apiType = settings.apiType;
    console.log('Using API type for generation:', apiType);
    
    if (apiType === 'openai' && !settings.apiKey) {
      updateStatus('Please add your OpenAI API key in settings', 'error');
      return;
    }
    
    if (apiType === 'ollama') {
      const ollamaUrl = settings.ollamaUrl || '';
      if (!ollamaUrl) {
        updateStatus('Please add your Ollama server URL in settings', 'error');
        return;
      }
      
      // Validate Ollama model is selected
      if (!settings.aiModel) {
        updateStatus('Please select an Ollama model in settings', 'error');
        return;
      }
      
      // Check if Ollama server is reachable
      try {
        updateStatus('Checking Ollama server...', 'progress');
        const response = await fetch(`${ollamaUrl}/api/version`, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          updateStatus(`Cannot connect to Ollama server at ${ollamaUrl}. Please check if it's running.`, 'error');
          return;
        }
      } catch (error) {
        updateStatus(`Error connecting to Ollama server: ${error.message}`, 'error');
        return;
      }
    }
    
    // Get selected options
    const options = {
      summary: document.getElementById('generate-summary').checked,
      experience: document.getElementById('generate-experience').checked,
      education: document.getElementById('generate-education').checked,
      skills: document.getElementById('generate-skills').checked,
      coverLetter: document.getElementById('generate-cover-letter').checked
    };
    
    if (!Object.values(options).some(Boolean)) {
      updateStatus('Please select at least one option to generate', 'warning');
      return;
    }
    
    updateStatus(`Generating content using ${apiType === 'openai' ? 'OpenAI' : 'Ollama'}...`, 'progress');
    showProgress(true);
    
    try {
      console.log('Sending generate content request:', {
        apiType: apiType,
        model: settings.aiModel,
        options: options
      });
      
      // Call background script to handle API request
      const results = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generateContent',
          data: {
            resume: data.resume,
            jobDescription: data.jobDescription,
            options: options,
            settings: settings  // Use our fixed settings object
          }
        }, response => {
          console.log('Received generateContent response:', response);
          
          if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      
      console.log('Results received from AI:', results);
      
      // Check if we have any content
      const hasContent = results.summary || results.experience || 
                        results.skills || results.coverLetter;
      
      if (!hasContent) {
        updateStatus('No content was generated. Please try again or check the model settings.', 'error');
        console.error('No content in results:', results);
        showProgress(false);
        return;
      }
      
      // Update UI with generated content
      if (options.summary) {
        summaryPreview.textContent = results.summary || 'No summary generated';
      }
      
      if (options.experience) {
        experiencePreview.textContent = results.experience || 'No experience bullets generated';
      }
      
      if (options.education) {
        educationPreview.textContent = results.education || 'No education generated';
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
    } catch (error) {
      // Handle specific Ollama errors with more helpful guidance
      if (error.message.includes('Ollama API error: Forbidden') || 
          error.message.includes('CORS') || 
          error.message.includes('OLLAMA_ORIGINS')) {
        
        // Show specific error message for CORS issues
        updateStatus('Error: Ollama server has CORS restrictions. See console for instructions.', 'error');
        console.error('Ollama CORS Error:', error.message);
        console.info('To fix Ollama CORS issues, run Ollama with the following environment variable:');
        console.info('   OLLAMA_ORIGINS=* ollama serve');
        console.info('On macOS/Linux, you can use:');
        console.info('   OLLAMA_ORIGINS=* ollama serve');
        console.info('On Windows, you can use:');
        console.info('   set OLLAMA_ORIGINS=*');
        console.info('   ollama serve');
        
      } else {
        // Handle other errors
        updateStatus('Error: ' + error.message, 'error');
        console.error('Error in generate content flow:', error);
      }
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
          // Now send the autofill message
          chrome.tabs.sendMessage(
            activeTab.id, 
            { 
              action: 'autofillApplication',
              data: data.generatedContent
            }, 
            (response) => {
              if (chrome.runtime.lastError) {
                updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                return;
              }
              
              if (response && response.success) {
                updateStatus(`Autofilled ${response.filled} fields`);
              } else if (response && response.error) {
                updateStatus('Error: ' + response.error, 'warning');
              } else {
                updateStatus('Autofill failed or no fields found', 'warning');
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
  });
}

// Settings handling
function initSettings() {
  const apiKeyInput = document.getElementById('api-key-input');
  const aiModelSelect = document.getElementById('ai-model-select');
  const apiTypeSelect = document.getElementById('api-type-select');
  const ollamaUrlInput = document.getElementById('ollama-url-input');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const loginBtn = document.getElementById('login-btn');
  
  // Toggle settings based on API type
  apiTypeSelect.addEventListener('change', () => {
    const isOllama = apiTypeSelect.value === 'ollama';
    document.getElementById('openai-settings').hidden = isOllama;
    document.getElementById('ollama-settings').hidden = !isOllama;
    
    // Update model options
    updateModelOptions(apiTypeSelect.value);
  });
  
  // Update model options based on API type
  function updateModelOptions(apiType) {
    // Clear current options
    aiModelSelect.innerHTML = '';
    
    // Add appropriate options
    if (apiType === 'openai') {
      const openAiModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
      openAiModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        aiModelSelect.appendChild(option);
      });
    } else if (apiType === 'ollama') {
      // Set loading state
      const loadingOption = document.createElement('option');
      loadingOption.value = '';
      loadingOption.textContent = 'Loading models...';
      aiModelSelect.appendChild(loadingOption);
      
      // Get URL (use default if empty)
      const ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
      
      // Fetch available models from Ollama server
      fetchOllamaModels(ollamaUrl)
        .then(models => {
          // Clear loading option
          aiModelSelect.innerHTML = '';
          
          if (models.length === 0) {
            const noModelsOption = document.createElement('option');
            noModelsOption.value = '';
            noModelsOption.textContent = 'No models found';
            aiModelSelect.appendChild(noModelsOption);
          } else {
            // Add all available models
            models.forEach(model => {
              const option = document.createElement('option');
              option.value = model;
              option.textContent = model;
              aiModelSelect.appendChild(option);
            });
          }
          
          // Try to set previously selected model
          chrome.storage.local.get('settings', (data) => {
            if (data.settings && data.settings.aiModel) {
              // Check if the model exists in the options
              const modelExists = Array.from(aiModelSelect.options).some(
                option => option.value === data.settings.aiModel
              );
              
              if (modelExists) {
                aiModelSelect.value = data.settings.aiModel;
              }
            }
          });
        })
        .catch(error => {
          console.error('Error fetching Ollama models:', error);
          aiModelSelect.innerHTML = '';
          
          const errorOption = document.createElement('option');
          errorOption.value = '';
          errorOption.textContent = 'Error loading models';
          aiModelSelect.appendChild(errorOption);
          
          // Add fallback models
          const fallbackModels = ['llama2', 'llama3', 'mistral', 'mixtral', 'phi', 'gemma'];
          fallbackModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model + ' (fallback)';
            aiModelSelect.appendChild(option);
          });
        });
    }
  }
  
  // Fetch available models from Ollama server
  async function fetchOllamaModels(ollamaUrl) {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract model names from the response
      if (data.models && Array.isArray(data.models)) {
        return data.models.map(model => model.name);
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      throw error;
    }
  }
  
  // URL input changes should trigger model refresh
  ollamaUrlInput.addEventListener('blur', () => {
    if (apiTypeSelect.value === 'ollama') {
      updateModelOptions('ollama');
    }
  });
  
  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const apiType = apiTypeSelect.value;
    console.log('Saving settings with API type:', apiType);
    
    const settings = {
      apiType: apiType,
      aiModel: aiModelSelect.value
    };
    
    // Add API-specific settings
    if (apiType === 'openai') {
      settings.apiKey = apiKeyInput.value.trim();
    } else if (apiType === 'ollama') {
      settings.ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
    }
    
    console.log('Full settings object being saved:', settings);
    
    chrome.storage.local.set({ settings }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
        updateStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        console.log('Settings saved successfully:', settings);
        updateStatus('Settings saved');
      }
    });
  });
  
  // Load settings
  chrome.storage.local.get('settings', (data) => {
    console.log('Loading settings from storage:', data.settings);
    
    if (data.settings) {
      // Set API type
      const apiType = data.settings.apiType || 'openai';
      apiTypeSelect.value = apiType;
      console.log('Setting API type to:', apiType);
      
      // Update visible settings sections
      document.getElementById('openai-settings').hidden = apiType === 'ollama';
      document.getElementById('ollama-settings').hidden = apiType === 'openai';
      
      // Set values
      apiKeyInput.value = data.settings.apiKey || '';
      ollamaUrlInput.value = data.settings.ollamaUrl || 'http://localhost:11434';
      console.log('Set Ollama URL to:', ollamaUrlInput.value);
      
      // Update model options after setting URL value
      updateModelOptions(apiType);
    } else {
      console.log('No settings found, initializing with defaults');
      // Initialize with default options
      updateModelOptions('openai');
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
      // Display the actual content regardless of file type
      resumeContent.textContent = data.resume.content || 'No content available';
      
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
      const educationPreview = document.getElementById('education-preview');
      const skillsPreview = document.getElementById('skills-preview');
      const coverLetterPreview = document.getElementById('cover-letter-preview');
      
      if (data.generatedContent.summary) {
        summaryPreview.textContent = data.generatedContent.summary;
      }
      
      if (data.generatedContent.experience) {
        experiencePreview.textContent = data.generatedContent.experience;
      }
      
      if (data.generatedContent.education) {
        educationPreview.textContent = data.generatedContent.education;
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