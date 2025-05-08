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
    
    chrome.storage.local.set({ resume: resumeData }, () => {
      // Status is already set in the calling function
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
  const awardsPreview = document.getElementById('awards-preview');
  const projectsPreview = document.getElementById('projects-preview');
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
    
    // Validate resume content exists and is not empty
    if (!data.resume.content || data.resume.content.trim().length < 50) {
      updateStatus('Resume content is too short or could not be extracted. Please upload a different file.', 'error');
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
      awards: document.getElementById('generate-awards').checked,
      projects: document.getElementById('generate-projects').checked,
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
        options: options,
        resumeContentLength: data.resume.content ? data.resume.content.length : 0
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
                        results.education || results.skills || 
                        results.awards || results.projects ||
                        results.coverLetter;
      
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
        // Format experience as bullet points
        if (results.experience) {
          formatContentAsBulletPoints(experiencePreview, results.experience);
        } else {
          experiencePreview.textContent = 'No experience bullets generated';
        }
      }
      
      if (options.education) {
        formatEducationContent(educationPreview, results.education);
      }
      
      if (options.skills) {
        skillsPreview.textContent = results.skills || 'No skills generated';
      }
      
      if (options.awards) {
        // Format awards with structured content
        if (results.awards) {
          formatAwardsContent(awardsPreview, results.awards);
        } else {
          awardsPreview.textContent = 'No awards/achievements generated';
        }
      }
      
      if (options.projects) {
        formatProjectsContent(projectsPreview, results.projects);
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
      // Handle different error types with more user-friendly messages
      if (error.message.includes('resume content is not available') || 
          error.message.includes('provide the resume text')) {
        updateStatus('Error: Could not process your resume. Please try uploading a different file format or check if the resume content is extractable.', 'error');
        console.error('Resume content error:', error.message);
      } else if (error.message.includes('Ollama API error: Forbidden') || 
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
      const awardsPreview = document.getElementById('awards-preview');
      const projectsPreview = document.getElementById('projects-preview');
      const coverLetterPreview = document.getElementById('cover-letter-preview');
      
      if (data.generatedContent.summary) {
        summaryPreview.textContent = data.generatedContent.summary;
      }
      
      if (data.generatedContent.experience) {
        formatContentAsBulletPoints(experiencePreview, data.generatedContent.experience);
      }
      
      if (data.generatedContent.education) {
        formatEducationContent(educationPreview, data.generatedContent.education);
      }
      
      if (data.generatedContent.skills) {
        skillsPreview.textContent = data.generatedContent.skills;
      }
      
      if (data.generatedContent.awards) {
        formatAwardsContent(awardsPreview, data.generatedContent.awards);
      }
      
      if (data.generatedContent.projects) {
        formatProjectsContent(projectsPreview, data.generatedContent.projects);
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

// Helper function to format content as bullet points
function formatContentAsBulletPoints(element, content) {
  // Clear any existing content
  element.innerHTML = '';
  
  // Check if content is structured as organization objects
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && content[0].hasOwnProperty('bullets')) {
    // This is the new organization format for experiences
    content.forEach(org => {
      // Create organization header
      const orgHeader = document.createElement('div');
      orgHeader.className = 'org-header';
      
      // Company/Organization name
      const orgName = document.createElement('div');
      orgName.className = 'org-name';
      orgName.textContent = org.organization_name || 'Unknown Organization';
      orgName.style.fontWeight = 'bold';
      orgHeader.appendChild(orgName);
      
      // Position and date
      if (org.position || org.date) {
        const details = document.createElement('div');
        details.className = 'org-details';
        details.textContent = [org.position, org.date].filter(Boolean).join(' • ');
        details.style.fontSize = '0.9em';
        details.style.color = 'var(--light-text)';
        details.style.marginBottom = '6px';
        orgHeader.appendChild(details);
      }
      
      element.appendChild(orgHeader);
      
      // Create bullet points for this organization
      const ul = document.createElement('ul');
      ul.style.paddingLeft = '20px';
      ul.style.margin = '0 0 10px 0';
      ul.style.listStyleType = 'disc';
      
      // Add bullets
      if (Array.isArray(org.bullets) && org.bullets.length > 0) {
        org.bullets.forEach(bullet => {
          if (bullet && bullet.trim()) {
            const li = document.createElement('li');
            li.textContent = bullet.trim().replace(/^[-•*]\s*/, '');
            li.style.marginBottom = '4px';
            ul.appendChild(li);
          }
        });
      } else if (typeof org.bullets === 'string' && org.bullets.trim()) {
        // If bullets is a string, split by newlines
        const items = org.bullets.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
          
        items.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item.replace(/^[-•*]\s*/, '');
          li.style.marginBottom = '4px';
          ul.appendChild(li);
        });
      }
      
      if (ul.children.length > 0) {
        element.appendChild(ul);
      } else {
        const emptyNote = document.createElement('p');
        emptyNote.textContent = 'No bullet points available';
        emptyNote.style.fontStyle = 'italic';
        emptyNote.style.marginLeft = '20px';
        element.appendChild(emptyNote);
      }
    });
    
    return;
  }
  
  // Handle simple array or string content (for backward compatibility)
  // Create a bullet point list
  const ul = document.createElement('ul');
  ul.style.paddingLeft = '20px';
  ul.style.margin = '0';
  ul.style.listStyleType = 'disc'; // Explicitly set bullet style
  
  // Handle different content formats (string or array)
  let items = [];
  
  if (Array.isArray(content)) {
    // If content is already an array, use it directly
    items = content;
  } else if (typeof content === 'string') {
    // Split the string content by newlines to get individual points
    items = content.split('\n').filter(line => line.trim() !== '');
  } else {
    // If content is neither array nor string, just show a message
    element.textContent = "No content available";
    return;
  }
  
  // Add each item as a bullet point
  items.forEach(item => {
    // Trim any existing bullet points or dashes at the beginning
    let cleanItem = (typeof item === 'string') ? item.trim().replace(/^[-•*]\s*/, '') : String(item).trim();
    
    // Create a list item
    const li = document.createElement('li');
    li.textContent = cleanItem;
    li.style.marginBottom = '4px'; // Add spacing between items
    ul.appendChild(li);
  });
  
  // Add the list to the container
  element.appendChild(ul);
  
  // If no items were added, show a message
  if (items.length === 0) {
    element.textContent = "No content available";
  }
}

// Helper function to format education content
function formatEducationContent(element, content) {
  // Clear any existing content
  element.innerHTML = '';
  
  // Check if content is structured as education objects array
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
    // This is the new education format
    content.forEach(edu => {
      // Create education header
      const eduHeader = document.createElement('div');
      eduHeader.className = 'edu-header';
      
      // Institution name
      const institutionName = document.createElement('div');
      institutionName.className = 'institution-name';
      institutionName.textContent = edu.institution || 'Unknown Institution';
      institutionName.style.fontWeight = 'bold';
      eduHeader.appendChild(institutionName);
      
      // Degree, field and date
      if (edu.degree || edu.field || edu.date) {
        const degreeField = document.createElement('div');
        degreeField.className = 'degree-field';
        
        let degreeFieldText = '';
        if (edu.degree && edu.field) {
          degreeFieldText = `${edu.degree} in ${edu.field}`;
        } else if (edu.degree) {
          degreeFieldText = edu.degree;
        } else if (edu.field) {
          degreeFieldText = edu.field;
        }
        
        if (degreeFieldText && edu.date) {
          degreeFieldText += ` • ${edu.date}`;
        } else if (edu.date) {
          degreeFieldText = edu.date;
        }
        
        degreeField.textContent = degreeFieldText;
        degreeField.style.fontSize = '0.9em';
        degreeField.style.marginBottom = '6px';
        eduHeader.appendChild(degreeField);
      }
      
      element.appendChild(eduHeader);
      
      // Add achievements if present
      if (edu.achievements && edu.achievements.trim()) {
        const achievementsContainer = document.createElement('div');
        achievementsContainer.className = 'achievements';
        achievementsContainer.style.marginBottom = '10px';
        achievementsContainer.style.marginLeft = '20px';
        achievementsContainer.style.fontSize = '0.9em';
        
        // If achievements is a string, display it directly
        if (typeof edu.achievements === 'string') {
          // Check if it's a bullet list
          if (edu.achievements.includes('•') || edu.achievements.includes('-') || edu.achievements.includes('*')) {
            const ul = document.createElement('ul');
            ul.style.paddingLeft = '20px';
            ul.style.margin = '0';
            
            const items = edu.achievements.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);
              
            items.forEach(item => {
              const li = document.createElement('li');
              li.textContent = item.replace(/^[-•*]\s*/, '');
              li.style.marginBottom = '4px';
              ul.appendChild(li);
            });
            
            achievementsContainer.appendChild(ul);
          } else {
            // Simple text
            achievementsContainer.textContent = edu.achievements;
          }
        } else if (Array.isArray(edu.achievements)) {
          // If it's an array, create bullet list
          const ul = document.createElement('ul');
          ul.style.paddingLeft = '20px';
          ul.style.margin = '0';
          
          edu.achievements.forEach(item => {
            if (item && item.trim()) {
              const li = document.createElement('li');
              li.textContent = item.trim().replace(/^[-•*]\s*/, '');
              li.style.marginBottom = '4px';
              ul.appendChild(li);
            }
          });
          
          achievementsContainer.appendChild(ul);
        }
        
        element.appendChild(achievementsContainer);
      }
    });
    
    return;
  }
  
  // Fallback for string content (backward compatibility)
  if (typeof content === 'string') {
    element.textContent = content;
  } else {
    element.textContent = 'No education information available';
  }
}

// Helper function to format projects content
function formatProjectsContent(element, content) {
  // Clear any existing content
  element.innerHTML = '';
  
  // Check if content is structured as project objects array
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
    // Handle case where array is empty or has empty objects
    if (content.every(proj => !proj.project_name && !proj.description && 
                      (!proj.achievements || proj.achievements.length === 0))) {
      element.textContent = 'No project information available';
      return;
    }
    
    // This is the new project format
    content.forEach((project, index) => {
      // Create project section
      const projectSection = document.createElement('div');
      projectSection.className = 'project-section';
      projectSection.style.marginBottom = '15px';
      
      // Project name and date header
      const projectHeader = document.createElement('div');
      projectHeader.className = 'project-header';
      
      // Project name - set a default if unnamed
      const projectName = document.createElement('div');
      projectName.className = 'project-name';
      let nameText = project.project_name;
      
      // Generate a project name if not specified
      if (!nameText || nameText === 'Project' || nameText === 'Unnamed Project') {
        nameText = `Project ${index + 1}`;
        // Try to derive a better name from the description or role if possible
        if (project.description && project.description.length > 5) {
          // Extract a name from the first few words of description
          const desc = project.description.trim();
          const firstSentence = desc.split(/[.!?]\s/)[0];
          const words = firstSentence.split(' ').slice(0, 3).join(' ');
          if (words.length > 3) {
            nameText = words + '...';
          }
        } else if (project.role) {
          nameText = `${project.role} Project`;
        } else if (project.technologies) {
          nameText = `${project.technologies.split(',')[0]} Project`;
        }
      }
      
      projectName.textContent = nameText;
      projectName.style.fontWeight = 'bold';
      projectHeader.appendChild(projectName);
      
      // Date
      if (project.date) {
        const projectDate = document.createElement('div');
        projectDate.className = 'project-date';
        projectDate.textContent = project.date;
        projectDate.style.fontSize = '0.9em';
        projectDate.style.color = 'var(--light-text)';
        projectHeader.appendChild(projectDate);
      }
      
      projectSection.appendChild(projectHeader);
      
      // Role and technologies
      if (project.role || project.technologies) {
        const details = document.createElement('div');
        details.className = 'project-details';
        details.style.marginTop = '4px';
        details.style.marginBottom = '6px';
        details.style.fontSize = '0.9em';
        
        if (project.role) {
          const roleSpan = document.createElement('span');
          roleSpan.className = 'project-role';
          roleSpan.textContent = `Role: ${project.role}`;
          details.appendChild(roleSpan);
          
          if (project.technologies) {
            details.appendChild(document.createTextNode(' • '));
          }
        }
        
        if (project.technologies) {
          const techSpan = document.createElement('span');
          techSpan.className = 'project-tech';
          techSpan.textContent = `Technologies: ${project.technologies}`;
          details.appendChild(techSpan);
        }
        
        projectSection.appendChild(details);
      }
      
      // Description
      if (project.description) {
        const description = document.createElement('div');
        description.className = 'project-description';
        description.textContent = project.description;
        description.style.marginTop = '4px';
        description.style.marginBottom = '6px';
        description.style.fontSize = '0.9em';
        projectSection.appendChild(description);
      }
      
      // Achievements/bullet points
      let hasAchievements = false;
      
      if (Array.isArray(project.achievements) && project.achievements.length > 0) {
        const achievementsUl = document.createElement('ul');
        achievementsUl.style.paddingLeft = '20px';
        achievementsUl.style.margin = '4px 0';
        achievementsUl.style.fontSize = '0.9em';
        
        // Filter out empty achievements
        const validAchievements = project.achievements
          .filter(achievement => achievement && typeof achievement === 'string' && achievement.trim());
        
        if (validAchievements.length > 0) {
          hasAchievements = true;
          
          // Add achievement label
          const achievementLabel = document.createElement('div');
          achievementLabel.textContent = 'Key achievements:';
          achievementLabel.style.fontWeight = 'bold';
          achievementLabel.style.fontSize = '0.9em';
          achievementLabel.style.marginTop = '6px';
          projectSection.appendChild(achievementLabel);
          
          validAchievements.forEach(achievement => {
            const li = document.createElement('li');
            li.textContent = achievement.trim().replace(/^[-•*]\s*/, '');
            li.style.marginBottom = '4px';
            achievementsUl.appendChild(li);
          });
          
          projectSection.appendChild(achievementsUl);
        }
      }
      
      // Add a visual separator if there's content
      if (project.description || project.role || project.technologies || hasAchievements) {
        element.appendChild(projectSection);
      }
    });
    
    // If we didn't add any projects, show a message
    if (element.children.length === 0) {
      element.textContent = 'No project details available';
    }
    
    return;
  }
  
  // Fallback for string content (backward compatibility)
  if (typeof content === 'string') {
    element.textContent = content;
  } else {
    element.textContent = 'No project information available';
  }
}

// Helper function to format awards content
function formatAwardsContent(element, content) {
  // Clear any existing content
  element.innerHTML = '';
  
  // Check if content is structured as award objects
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
    // This is the new award format
    content.forEach(award => {
      // Create award item
      const awardItem = document.createElement('div');
      awardItem.className = 'award-item';
      awardItem.style.marginBottom = '10px';
      
      // Award title
      const titleElement = document.createElement('div');
      titleElement.className = 'award-title';
      
      // Compile title with date and organization if available
      let titleText = award.title || 'Unnamed Award';
      if (award.date) {
        titleText += `, ${award.date}`;
      }
      if (award.organization) {
        titleText += `, ${award.organization}`;
      }
      
      titleElement.textContent = titleText;
      titleElement.style.fontWeight = 'bold';
      awardItem.appendChild(titleElement);
      
      // Award description
      if (award.description && award.description.trim()) {
        const descElement = document.createElement('div');
        descElement.className = 'award-description';
        descElement.textContent = award.description;
        descElement.style.marginLeft = '20px';
        descElement.style.fontSize = '0.9em';
        awardItem.appendChild(descElement);
      }
      
      element.appendChild(awardItem);
    });
    
    return;
  }
  
  // Fallback for legacy format (array of strings)
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'string') {
    // Create bullet list
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '20px';
    ul.style.margin = '0';
    ul.style.listStyleType = 'disc';
    
    content.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.trim().replace(/^[-•*]\s*/, '');
      li.style.marginBottom = '4px';
      ul.appendChild(li);
    });
    
    element.appendChild(ul);
    return;
  }
  
  // Fallback for plain string
  if (typeof content === 'string') {
    element.textContent = content;
  } else {
    element.textContent = 'No awards information available';
  }
} 