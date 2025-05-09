/**
 * Content generation functionality
 */

import { updateStatus, showProgress } from './ui-helpers.js';
import { 
  formatContentAsBulletPoints, 
  formatEducationContent, 
  formatProjectsContent, 
  formatAwardsContent 
} from './formatters.js';
import { storageUtils } from '../../utils/storage.js';

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
    const data = await storageUtils.get(['resume', 'jobDescription', 'settings']);
    
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
    
    if (apiType === 'gemini' && !settings.geminiApiKey) {
      updateStatus('Please add your Google Gemini API key in settings', 'error');
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
    
    updateStatus(`Generating content using ${
      apiType === 'openai' ? 'OpenAI' : 
      apiType === 'gemini' ? 'Gemini' : 
      'Ollama'
    }...`, 'progress');
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
      await storageUtils.save({ generatedContent: results });
      
      // Show the content
      generatedContent.hidden = false;
      updateStatus('Content generated successfully');
    } catch (error) {
      // Handle different error types with more user-friendly messages
      if (error.message.includes('resume content is not available') || 
          error.message.includes('provide the resume text')) {
        updateStatus('Error: Could not process your resume. Please try uploading a different file format or check if the resume content is extractable.', 'error');
        console.error('Resume content error:', error.message);
      } else if (error.message.includes('Gemini API error')) {
        // Show specific error message for Gemini API issues
        updateStatus('Error: Gemini API error. Please check your API key and selected model.', 'error');
        console.error('Gemini API Error:', error.message);
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
  autofillBtn.addEventListener('click', async () => {
    const data = await storageUtils.get('generatedContent');
    
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
}

export { initGenerateContent }; 