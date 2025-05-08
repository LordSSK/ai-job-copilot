// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateContent') {
    console.log('Received generateContent request:', request.data);
    console.log('API type from request:', request.data.settings?.apiType);
    console.log('Settings object:', request.data.settings);
    
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
 * Generate application content based on resume and job description using AI
 */
async function generateContent(data) {
  try {
    console.log('Starting generateContent with data:', data);
    const { resume, jobDescription, options, settings } = data;
    
    if (!settings) {
      console.error('Settings object is missing or undefined');
      throw new Error('Settings not found. Please configure the AI provider in settings.');
    }
    
    console.log('Settings object details:', {
      apiType: settings.apiType,
      aiModel: settings.aiModel,
      hasApiKey: !!settings.apiKey,
      hasOllamaUrl: !!settings.ollamaUrl
    });
    
    // CRITICAL FIX: Make a copy and ensure apiType is a string and normalized
    const apiTypeRaw = settings.apiType;
    // Default to 'openai' if apiType is missing or invalid
    let apiType = 'openai';
    
    // Normalize the API type
    if (typeof apiTypeRaw === 'string') {
      const normalizedType = apiTypeRaw.toLowerCase().trim();
      if (normalizedType === 'ollama' || normalizedType === 'openai') {
        apiType = normalizedType;
      } else {
        console.warn(`Unknown API type "${apiTypeRaw}", defaulting to "openai"`);
      }
    } else {
      console.warn(`API type is not a string (${typeof apiTypeRaw}), defaulting to "openai"`);
    }
    
    console.log('Using normalized API type:', apiType);
    
    const aiModel = settings.aiModel || (apiType === 'openai' ? 'gpt-3.5-turbo' : 'llama2');
    console.log('Selected AI model:', aiModel);
    
    // Validate settings based on API type
    console.log('Validating settings for API type:', apiType);
    
    if (apiType === 'openai') {
      console.log('OpenAI API selected, checking for API key');
      if (!settings.apiKey) {
        console.error('OpenAI API key is missing');
        throw new Error('API key not found. Please add your OpenAI API key in settings.');
      }
    } else if (apiType === 'ollama') {
      console.log('Ollama API selected, checking for Ollama URL');
      if (!settings.ollamaUrl) {
        console.error('Ollama URL is missing');
        throw new Error('Ollama URL not found. Please add your Ollama server URL in settings.');
      }
      console.log('Ollama URL is present:', settings.ollamaUrl);
    } else {
      console.error('Unknown API type after normalization:', apiType);
      throw new Error(`Unsupported API type: ${apiType}`);
    }
    
    // Construct the desired outputs based on the selected options
    const outputs = [];
    if (options.summary) outputs.push('professional_summary');
    if (options.experience) outputs.push('experience_bullets');
    if (options.education) outputs.push('education');
    if (options.skills) outputs.push('skills');
    if (options.coverLetter) outputs.push('cover_letter');
    console.log('Requested outputs:', outputs);
    
    // Extract the actual resume content
    let resumeContent = resume.content;
    
    // Prepare prompt for AI
    const prompt = constructPrompt(resumeContent, jobDescription.content, outputs);
    console.log('Constructed prompt (first 100 chars):', prompt.substring(0, 100) + '...');
    
    // Call the appropriate AI API
    let response;
    console.log('Calling AI API for type:', apiType);
    
    if (apiType === 'openai') {
      console.log('Calling OpenAI API with model:', aiModel);
      response = await callOpenAI(settings.apiKey, prompt, aiModel);
    } else if (apiType === 'ollama') {
      const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
      console.log('Calling Ollama API at URL:', ollamaUrl, 'with model:', aiModel);
      response = await callOllama(ollamaUrl, prompt, aiModel);
    } else {
      console.error('Unknown API type at call time:', apiType);
      throw new Error(`Unsupported API type: ${apiType}`);
    }
    
    console.log('Got response from AI API (first 100 chars):', (response || '').substring(0, 100) + '...');
    
    // Parse the response into the expected format
    const parsedResponse = parseAIResponse(response, outputs);
    console.log('Parsed response:', parsedResponse);
    return parsedResponse;
  } catch (error) {
    console.error('Error in generateContent:', error);
    throw error;
  }
}

/**
 * Construct the prompt for the AI model
 */
function constructPrompt(resumeContent, jobDescription, outputs) {
  // Get a shorter version of the resume and job description to stay within token limits
  const resume = resumeContent.substring(0, 3000);
  const job = jobDescription.substring(0, 3000);
  
  let prompt = `
You are an expert at matching candidate profiles to job descriptions and generating optimized job application content.

CANDIDATE'S RESUME:
${resume}

JOB DESCRIPTION:
${job}

Based on the candidate's resume and the job description above, please generate the following sections:
`;

  // Add instructions for each requested output
  if (outputs.includes('professional_summary')) {
    prompt += `
PROFESSIONAL_SUMMARY: A concise, compelling summary (3-4 sentences) that highlights the candidate's relevant experience and qualifications for this specific job. Focus on matching the candidate's background to the job requirements.
`;
  }
  
  if (outputs.includes('experience_bullets')) {
    prompt += `
EXPERIENCE_BULLETS: 4-5 achievement-oriented bullet points that showcase the candidate's most relevant experience for this job. Each bullet should follow the STAR format (Situation, Task, Action, Result) and include quantifiable achievements where possible.
`;
  }
  
  if (outputs.includes('education')) {
    prompt += `
EDUCATION: Format the candidate's educational background in a clear, concise way. Include degree(s), institution(s), graduation year(s), and any relevant honors or achievements. If the resume lacks education details, create a professional format based on the candidate's apparent experience level.
`;
  }
  
  if (outputs.includes('skills')) {
    prompt += `
SKILLS: A list of 8-10 relevant skills the candidate possesses that match the job requirements. Format as a comma-separated list.
`;
  }
  
  if (outputs.includes('cover_letter')) {
    prompt += `
COVER_LETTER: A personalized, professional cover letter (250-350 words) that introduces the candidate, highlights their relevant experience and skills, explains why they are interested in the position, and includes a call to action. The letter should be specifically tailored to the job description.
`;
  }
  
  prompt += `
IMPORTANT: Format your response with clear section headings. For each section requested above, start with the exact section name (e.g., "PROFESSIONAL_SUMMARY:") followed by the content.

PREFERRED FORMAT:
PROFESSIONAL_SUMMARY:
(Your summary content here...)

EXPERIENCE_BULLETS:
(Your experience bullets here...)

EDUCATION:
(Your education details here...)

SKILLS:
(Your skills list here...)

COVER_LETTER:
(Your cover letter here...)

Try to format your response as JSON if possible, like this:
{
  "professional_summary": "The generated summary text...",
  "experience_bullets": "The generated bullet points...",
  "education": "The generated education details...",
  "skills": "The generated skills list...",
  "cover_letter": "The generated cover letter..."
}
`;

  return prompt;
}

/**
 * Call the OpenAI API
 */
async function callOpenAI(apiKey, prompt, model = 'gpt-3.5-turbo') {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
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
 * Call the Ollama API
 */
async function callOllama(ollamaUrl, prompt, model = 'llama2') {
  try {
    // First check if the model exists
    const modelExists = await checkOllamaModelExists(ollamaUrl, model);
    
    if (!modelExists) {
      throw new Error(`Model '${model}' not found on the Ollama server. Please check available models and try again.`);
    }
    
    const endpoint = `${ollamaUrl}/api/generate`;
    console.log(`Calling Ollama API at ${endpoint} with model ${model}`);
    
    // Create a system prompt that emphasizes the response format
    const systemPrompt = `You are an expert at matching candidate profiles to job descriptions and creating optimized job application content. 
Format your response with clear section headings as requested.
Structure your response with the exact section names provided in the prompt.
Example: "PROFESSIONAL_SUMMARY: (content here)"`;
    
    // Create the request payload
    const payload = {
      model: model,
      prompt: prompt,
      system: systemPrompt,
      stream: false,
      // Adjust parameters based on model capabilities
      temperature: 0.7,
      max_tokens: getMaxTokensForModel(model),
      // Add format guidance for models that support it
      format: 'json'
    };
    
    console.log('Sending request payload:', payload);
    
    try {
      // Try the direct API call first
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const statusCode = response.status;
        let errorMessage = response.statusText;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = JSON.stringify(errorData);
        } catch (e) {
          // Ignore parse errors on error response
          try {
            // Try to get the text response if JSON parsing failed
            errorDetails = await response.text();
          } catch (textError) {
            errorDetails = 'Could not parse error response';
          }
        }
        
        console.error(`Ollama API error (${statusCode}):`, errorMessage, errorDetails);
        
        // For forbidden errors, provide more helpful guidance
        if (statusCode === 403) {
          throw new Error(`Ollama API error: Forbidden. Your browser is blocked from accessing the Ollama server. Try running Ollama with OLLAMA_ORIGINS=* environment variable or check your firewall settings.`);
        }
        
        throw new Error(`Ollama API error (${statusCode}): ${errorMessage}. ${errorDetails ? `Details: ${errorDetails}` : ''}`);
      }
      
      const data = await response.json();
      return data.response;
    } catch (fetchError) {
      // If fetch failed, it might be a CORS issue or network problem
      if (fetchError.message.includes('Failed to fetch') || 
          fetchError.message.includes('NetworkError') ||
          fetchError.message.includes('CORS')) {
        throw new Error(`Could not connect to Ollama server at ${ollamaUrl}. This may be due to CORS restrictions. Try running Ollama with OLLAMA_ORIGINS=* environment variable set. Error: ${fetchError.message}`);
      }
      
      // Rethrow other errors
      throw fetchError;
    }
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
}

/**
 * Check if a model exists on the Ollama server
 */
async function checkOllamaModelExists(ollamaUrl, modelName) {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    
    if (!response.ok) {
      console.warn(`Could not verify model existence: ${response.statusText}`);
      // If we can't check, we'll assume it exists and let the generate call fail if needed
      return true;
    }
    
    const data = await response.json();
    
    // Check if the model exists
    if (data.models && Array.isArray(data.models)) {
      return data.models.some(model => model.name === modelName);
    }
    
    return false;
  } catch (error) {
    console.warn(`Error checking model existence: ${error.message}`);
    // If check fails, assume model exists and let the generate call handle any issues
    return true;
  }
}

/**
 * Get appropriate max_tokens for different models
 */
function getMaxTokensForModel(model) {
  // Default to 2000 for most models
  const defaultTokens = 2000;
  
  // Model-specific token limits
  const tokenLimits = {
    'llama2': 2048,
    'llama3': 4096,
    'mistral': 2048,
    'mixtral': 4096,
    'phi': 1024,
    'gemma': 2048
  };
  
  // Check if we have a specific limit for this model
  for (const [modelPrefix, limit] of Object.entries(tokenLimits)) {
    if (model.startsWith(modelPrefix)) {
      return limit;
    }
  }
  
  return defaultTokens;
}

/**
 * Parse the AI response into the expected format
 */
function parseAIResponse(responseText, requestedOutputs) {
  try {
    console.log('Raw AI response:', responseText);
    let parsedResponse;
    
    try {
      // Extract JSON from the response text (in case the AI included additional text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed JSON response:', parsedResponse);
      } else {
        console.log('No JSON found in response, using text extraction method');
        throw new Error('No JSON found in response');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      
      // Fallback: try to extract sections based on headers
      parsedResponse = extractSectionsFromText(responseText);
      console.log('Extracted sections from text:', parsedResponse);
    }
    
    // Create the result object with only the requested outputs
    const result = {};
    
    if (requestedOutputs.includes('professional_summary') && parsedResponse.professional_summary) {
      result.summary = parsedResponse.professional_summary;
    }
    
    if (requestedOutputs.includes('experience_bullets') && parsedResponse.experience_bullets) {
      result.experience = parsedResponse.experience_bullets;
    }
    
    if (requestedOutputs.includes('education') && parsedResponse.education) {
      result.education = parsedResponse.education;
    }
    
    if (requestedOutputs.includes('skills') && parsedResponse.skills) {
      result.skills = parsedResponse.skills;
    }
    
    if (requestedOutputs.includes('cover_letter') && parsedResponse.cover_letter) {
      result.coverLetter = parsedResponse.cover_letter;
    }
    
    // Check if we got any content from the structured approach
    const hasContent = Object.keys(result).length > 0;
    
    // If no content was extracted using structured approach, use a more lenient approach
    if (!hasContent) {
      console.log('No content found in structured response, using fallback extraction method');
      return extractContentUsingFallbackMethod(responseText, requestedOutputs);
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Even if parsing fails, try to extract something
    return extractContentUsingFallbackMethod(responseText, requestedOutputs);
  }
}

/**
 * Extract sections from AI response text using pattern matching as a fallback
 */
function extractSectionsFromText(text) {
  const sections = {
    professional_summary: '',
    experience_bullets: '',
    education: '',
    skills: '',
    cover_letter: ''
  };
  
  // Define regex patterns for each section
  const patterns = {
    professional_summary: /PROFESSIONAL_SUMMARY:?([\s\S]*?)(?=EXPERIENCE_BULLETS:|EDUCATION:|SKILLS:|COVER_LETTER:|$)/i,
    experience_bullets: /EXPERIENCE_BULLETS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EDUCATION:|SKILLS:|COVER_LETTER:|$)/i,
    education: /EDUCATION:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|SKILLS:|COVER_LETTER:|$)/i,
    skills: /SKILLS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|EDUCATION:|COVER_LETTER:|$)/i,
    cover_letter: /COVER_LETTER:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|EDUCATION:|SKILLS:|$)/i
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

/**
 * Fallback method to extract content from unstructured AI responses
 */
function extractContentUsingFallbackMethod(text, requestedOutputs) {
  console.log('Using fallback content extraction method');
  const result = {};
  
  // For professional summary, look for the word "summary" or "professional summary" 
  // and take the paragraph following it
  if (requestedOutputs.includes('professional_summary')) {
    const summaryMatch = text.match(/(?:professional\s*summary|summary)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (summaryMatch && summaryMatch[1]) {
      result.summary = summaryMatch[1].trim();
    }
  }
  
  // For experience, look for the word "experience" and bullets or paragraphs following it
  if (requestedOutputs.includes('experience_bullets')) {
    const expMatch = text.match(/(?:experience\s*bullets|experience)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (expMatch && expMatch[1]) {
      result.experience = expMatch[1].trim();
    }
  }
  
  // For education, look for the word "education" and text following it
  if (requestedOutputs.includes('education')) {
    const educationMatch = text.match(/(?:education)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (educationMatch && educationMatch[1]) {
      result.education = educationMatch[1].trim();
    }
  }
  
  // For skills, look for the word "skills" and comma-separated list or bullet points
  if (requestedOutputs.includes('skills')) {
    const skillsMatch = text.match(/(?:skills)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (skillsMatch && skillsMatch[1]) {
      result.skills = skillsMatch[1].trim();
    }
  }
  
  // For cover letter, look for the phrase "cover letter" and take all text following it
  if (requestedOutputs.includes('cover_letter')) {
    const coverMatch = text.match(/(?:cover\s*letter)(?:[:.\s-]+)([\s\S]*?)(?:$)/i);
    if (coverMatch && coverMatch[1]) {
      result.coverLetter = coverMatch[1].trim();
    }
  }
  
  // If still no results, split the text into roughly equal parts based on requested outputs
  if (Object.keys(result).length === 0 && text.length > 0 && requestedOutputs.length > 0) {
    console.log('No structured content found, dividing text into sections');
    const sections = divideLongTextIntoSections(text, requestedOutputs);
    return sections;
  }
  
  return result;
}

/**
 * Divide a long text into sections if no structure is detected
 */
function divideLongTextIntoSections(text, requestedOutputs) {
  const result = {};
  const totalLength = text.length;
  let currentPosition = 0;
  
  requestedOutputs.forEach((output, index) => {
    // Calculate how much text to allocate to this section
    const sectionSize = Math.floor(totalLength / requestedOutputs.length);
    const start = currentPosition;
    let end = start + sectionSize;
    
    // Find a good break point (newline or period)
    if (index < requestedOutputs.length - 1 && end < totalLength) {
      const nextNewline = text.indexOf('\n', end);
      const nextPeriod = text.indexOf('.', end);
      
      if (nextNewline > -1 && nextNewline < end + 100) {
        end = nextNewline;
      } else if (nextPeriod > -1 && nextPeriod < end + 100) {
        end = nextPeriod + 1; // Include the period
      }
    } else {
      end = totalLength;
    }
    
    // Extract the section
    const section = text.substring(start, end).trim();
    currentPosition = end;
    
    // Add to result
    if (output === 'professional_summary') {
      result.summary = section;
    } else if (output === 'experience_bullets') {
      result.experience = section;
    } else if (output === 'education') {
      result.education = section;
    } else if (output === 'skills') {
      result.skills = section;
    } else if (output === 'cover_letter') {
      result.coverLetter = section;
    }
  });
  
  return result;
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