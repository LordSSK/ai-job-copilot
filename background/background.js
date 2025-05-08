// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateContent') {
    generateContent(request.data)
      .then(sendResponse)
      .catch(error => {
        console.error('Error generating content:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates async response
  } else if (request.action === 'extractJobDescription') {
    // Execute content script function through scripting API
    executeContentScript(sender.tab.id, { function: 'extractJobDescription' })
      .then(result => sendResponse({ jobDescription: result }))
      .catch(error => {
        console.error('Error extracting job description:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates async response
  } else if (request.action === 'autofillApplication') {
    // Execute content script function through scripting API
    executeContentScript(sender.tab.id, { 
      function: 'autofillApplication',
      args: [request.data]
    })
    .then(result => sendResponse(result))
    .catch(error => {
      console.error('Error autofilling application:', error);
      sendResponse({ error: error.message, success: false });
    });
    return true; // Indicates async response
  }
});

/**
 * Execute a function in the content script context
 */
async function executeContentScript(tabId, details) {
  // Ensure content script is injected if not already present
  await ensureContentScriptsInjected(tabId);
  
  // Execute the function in the content script context
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: executeInPage,
    args: [details]
  });
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result.result;
}

/**
 * Ensure required content scripts are injected
 */
async function ensureContentScriptsInjected(tabId) {
  try {
    // Check if we need to inject the main content script functions
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => typeof extractJobDescription !== 'undefined'
    }).then(([result]) => {
      // If content script functions aren't available, inject them
      if (!result.result) {
        return chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/jobfill-functions.js']
        });
      }
    });
    
    // Add CSS for styling elements
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/jobfill-styles.css']
    });
  } catch (error) {
    console.error('Error injecting content scripts:', error);
    throw error;
  }
}

/**
 * Function to execute in the content script context
 */
function executeInPage({ function: funcName, args = [] }) {
  try {
    // Ensure the function exists in the content script context
    if (typeof window[funcName] !== 'function') {
      return { error: `Function ${funcName} not found in content script` };
    }
    
    // Execute the function with the provided arguments
    const result = window[funcName](...args);
    return result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Generate application content based on resume and job description using OpenAI API
 */
async function generateContent(data) {
  try {
    // Get the stored API key from settings
    const storage = await chrome.storage.local.get('settings');
    const apiKey = storage.settings?.apiKey;
    
    if (!apiKey) {
      throw new Error('API key not found. Please add your OpenAI API key in settings.');
    }
    
    const { resume, jobDescription, options } = data;
    
    // Construct the desired outputs based on the selected options
    const outputs = [];
    if (options.summary) outputs.push('professional_summary');
    if (options.experience) outputs.push('experience_bullets');
    if (options.skills) outputs.push('skills');
    if (options.coverLetter) outputs.push('cover_letter');
    
    // Extract the actual resume content
    let resumeContent = resume.content;
    if (resume.type === 'application/pdf') {
      // In a real implementation, you would use a PDF parser library
      // For simplicity, we'll just use a placeholder message
      resumeContent = "PDF EXTRACTION NOT IMPLEMENTED IN THIS DEMO";
    }
    
    // Prepare prompt for OpenAI
    const prompt = constructPrompt(resumeContent, jobDescription.content, outputs);
    
    // Call OpenAI API
    const response = await callOpenAI(apiKey, prompt);
    
    // Parse the response into the expected format
    return parseAIResponse(response, outputs);
  } catch (error) {
    console.error('Error in generateContent:', error);
    throw error;
  }
}

/**
 * Construct the prompt for the AI model
 */
function constructPrompt(resumeContent, jobDescription, outputs) {
  let prompt = `
You are an expert at matching candidate profiles to job descriptions and generating optimized job application content.

CANDIDATE'S RESUME:
${resumeContent.substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

Based on the candidate's resume and the job description above, please generate the following:
`;

  // Add instructions for each requested output
  if (outputs.includes('professional_summary')) {
    prompt += `
- PROFESSIONAL_SUMMARY: A concise, compelling summary (3-4 sentences) that highlights the candidate's relevant experience and qualifications for this specific job. Focus on matching the candidate's background to the job requirements.
`;
  }
  
  if (outputs.includes('experience_bullets')) {
    prompt += `
- EXPERIENCE_BULLETS: 4-5 achievement-oriented bullet points that showcase the candidate's most relevant experience for this job. Each bullet should follow the STAR format (Situation, Task, Action, Result) and include quantifiable achievements where possible.
`;
  }
  
  if (outputs.includes('skills')) {
    prompt += `
- SKILLS: A list of 8-10 relevant skills the candidate possesses that match the job requirements. Format as a comma-separated list.
`;
  }
  
  if (outputs.includes('cover_letter')) {
    prompt += `
- COVER_LETTER: A personalized, professional cover letter (250-350 words) that introduces the candidate, highlights their relevant experience and skills, explains why they are interested in the position, and includes a call to action. The letter should be specifically tailored to the job description.
`;
  }
  
  prompt += `
Format your response as JSON with the following structure:
{
  "professional_summary": "The generated summary text...",
  "experience_bullets": "The generated bullet points...",
  "skills": "The generated skills list...",
  "cover_letter": "The generated cover letter..."
}

Include ONLY the sections I asked for above. Ensure the response is valid JSON.
`;

  return prompt;
}

/**
 * Call the OpenAI API
 */
async function callOpenAI(apiKey, prompt) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at matching candidate profiles to job descriptions and creating optimized job application content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Parse the AI response into the expected format
 */
function parseAIResponse(responseText, requestedOutputs) {
  try {
    // Try to parse the response as JSON
    let parsedResponse;
    
    try {
      // Extract JSON from the response text (in case the AI included additional text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      
      // Fallback: try to extract sections based on headers
      parsedResponse = extractSectionsFromText(responseText);
    }
    
    // Create the result object with only the requested outputs
    const result = {};
    
    if (requestedOutputs.includes('professional_summary') && parsedResponse.professional_summary) {
      result.summary = parsedResponse.professional_summary;
    }
    
    if (requestedOutputs.includes('experience_bullets') && parsedResponse.experience_bullets) {
      result.experience = parsedResponse.experience_bullets;
    }
    
    if (requestedOutputs.includes('skills') && parsedResponse.skills) {
      result.skills = parsedResponse.skills;
    }
    
    if (requestedOutputs.includes('cover_letter') && parsedResponse.cover_letter) {
      result.coverLetter = parsedResponse.cover_letter;
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    throw new Error('Failed to parse the AI-generated content');
  }
}

/**
 * Extract sections from AI response text using pattern matching as a fallback
 */
function extractSectionsFromText(text) {
  const sections = {
    professional_summary: '',
    experience_bullets: '',
    skills: '',
    cover_letter: ''
  };
  
  // Define regex patterns for each section
  const patterns = {
    professional_summary: /PROFESSIONAL_SUMMARY:?([\s\S]*?)(?=EXPERIENCE_BULLETS:|SKILLS:|COVER_LETTER:|$)/i,
    experience_bullets: /EXPERIENCE_BULLETS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|SKILLS:|COVER_LETTER:|$)/i,
    skills: /SKILLS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|COVER_LETTER:|$)/i,
    cover_letter: /COVER_LETTER:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|SKILLS:|$)/i
  };
  
  // Extract each section
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      sections[key] = match[1].trim();
    }
  }
  
  return sections;
}

// Register service worker activation event (Manifest V3)
chrome.runtime.onInstalled.addListener(() => {
  console.log("JobFill extension installed");
});

// Handle auth status changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    // API key or other settings have changed
    console.log('Settings updated');
  }
});

// Handle tab updates - initialize content scripts when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If the page has completed loading and URL is a job board
  if (changeInfo.status === 'complete' && isJobBoard(tab.url)) {
    // Ensure content scripts are injected
    ensureContentScriptsInjected(tabId)
      .catch(error => console.error('Error injecting content scripts on tab update:', error));
  }
});

/**
 * Check if the URL is a known job board
 */
function isJobBoard(url) {
  if (!url) return false;
  
  const jobBoardDomains = [
    'workday.com',
    'greenhouse.io',
    'lever.co',
    'indeed.com',
    'linkedin.com/jobs',
    'glassdoor.com/job',
    'monster.com',
    'ziprecruiter.com',
    'simplyhired.com',
    'careerbuilder.com',
    'dice.com',
    'jobs.apple.com',
    'careers.google.com',
    'careers.microsoft.com',
    'amazon.jobs'
  ];
  
  return jobBoardDomains.some(domain => url.includes(domain));
} 