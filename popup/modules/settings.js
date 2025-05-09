/**
 * Settings management functionality
 */

import { updateStatus } from './ui-helpers.js';
import { storageUtils } from '../../utils/storage.js';

// Settings handling
function initSettings() {
  const apiKeyInput = document.getElementById('api-key-input');
  const aiModelSelect = document.getElementById('ai-model-select');
  const apiTypeSelect = document.getElementById('api-type-select');
  const ollamaUrlInput = document.getElementById('ollama-url-input');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const clearDataBtn = document.getElementById('clear-data-btn');
  
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
          storageUtils.get('settings').then(data => {
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
  
  // Clear all user data function
  clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all your data? This will remove your resume, job descriptions, and all generated content.')) {
      // Preserve settings while clearing everything else
      storageUtils.get('settings').then(settingsData => {
        const settings = settingsData.settings;
        
        // Clear all storage
        storageUtils.clear().then(() => {
          // Restore just the settings
          if (settings) {
            storageUtils.save({ settings }).then(() => {
              updateStatus('All data cleared successfully');
              
              // Reset UI elements
              const resumePreview = document.getElementById('resume-preview');
              const uploadArea = document.getElementById('resume-upload-area');
              const jobDescription = document.getElementById('job-description');
              const generatedContent = document.getElementById('generated-content-container');
              
              if (resumePreview) resumePreview.hidden = true;
              if (uploadArea) uploadArea.hidden = false;
              if (jobDescription) jobDescription.value = '';
              if (generatedContent) generatedContent.hidden = true;
            });
          } else {
            updateStatus('All data cleared successfully');
          }
        });
      });
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
    
    storageUtils.save({ settings })
      .then(() => {
        console.log('Settings saved successfully:', settings);
        updateStatus('Settings saved');
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        updateStatus('Error saving settings: ' + error.message, 'error');
      });
  });
  
  // Load settings
  storageUtils.get('settings').then(data => {
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
}

export { initSettings }; 