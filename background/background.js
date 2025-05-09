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
      hasGeminiApiKey: !!settings.geminiApiKey,
      hasOllamaUrl: !!settings.ollamaUrl
    });
    
    // Validate resume and job description data
    if (!resume) {
      throw new Error('Resume data is missing. Please upload your resume.');
    }

    if (!resume.content || typeof resume.content !== 'string') {
      throw new Error('The resume content is not available. Please upload your resume again.');
    }

    // Check if resume content is too short or empty
    if (resume.content.trim().length < 100) {
      throw new Error('The resume content is too short or could not be properly extracted. Please try uploading a different format or file.');
    }
    
    if (!jobDescription || !jobDescription.content) {
      throw new Error('Job description is missing. Please add a job description.');
    }
    
    console.log(`Resume content length: ${resume.content.length} characters`);
    console.log(`Job description length: ${jobDescription.content.length} characters`);
    
    // CRITICAL FIX: Make a copy and ensure apiType is a string and normalized
    const apiTypeRaw = settings.apiType;
    // Default to 'openai' if apiType is missing or invalid
    let apiType = 'openai';
    
    // Normalize the API type
    if (typeof apiTypeRaw === 'string') {
      const normalizedType = apiTypeRaw.toLowerCase().trim();
      if (['ollama', 'openai', 'gemini'].includes(normalizedType)) {
        apiType = normalizedType;
      } else {
        console.warn(`Unknown API type "${apiTypeRaw}", defaulting to "openai"`);
      }
    } else {
      console.warn(`API type is not a string (${typeof apiTypeRaw}), defaulting to "openai"`);
    }
    
    console.log('Using normalized API type:', apiType);
    
    const aiModel = settings.aiModel || (
      apiType === 'openai' ? 'gpt-3.5-turbo' : 
      apiType === 'gemini' ? 'gemini-1.5-pro' : 
      'llama2'
    );
    console.log('Selected AI model:', aiModel);
    
    // Validate settings based on API type
    console.log('Validating settings for API type:', apiType);
    
    if (apiType === 'openai') {
      console.log('OpenAI API selected, checking for API key');
      if (!settings.apiKey) {
        console.error('OpenAI API key is missing');
        throw new Error('API key not found. Please add your OpenAI API key in settings.');
      }
    } else if (apiType === 'gemini') {
      console.log('Gemini API selected, checking for API key');
      if (!settings.geminiApiKey) {
        console.error('Gemini API key is missing');
        throw new Error('Gemini API key not found. Please add your Google Gemini API key in settings.');
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
    if (options.awards) outputs.push('awards');
    if (options.projects) outputs.push('projects');
    if (options.coverLetter) outputs.push('cover_letter');
    console.log('Requested outputs:', outputs);
    
    // Extract the actual resume content
    let resumeContent = resume.content;
    
    // Catch issues with resume content before sending to AI
    if (!resumeContent || resumeContent.includes('Error extracting PDF content')) {
      throw new Error('There was a problem with the resume content. Please try uploading a different file or format.');
    }
    
    // Prepare prompt for AI
    const prompt = constructPrompt(resumeContent, jobDescription.content, outputs);
    console.log('Constructed prompt (first 100 chars):', prompt.substring(0, 100) + '...');
    
    // Call the appropriate AI API
    let response;
    console.log('Calling AI API for type:', apiType);
    
    if (apiType === 'openai') {
      console.log('Calling OpenAI API with model:', aiModel);
      response = await callOpenAI(settings.apiKey, prompt, aiModel);
    } else if (apiType === 'gemini') {
      console.log('Calling Gemini API with model:', aiModel);
      response = await callGemini(settings.geminiApiKey, prompt, aiModel);
    } else if (apiType === 'ollama') {
      const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
      console.log('Calling Ollama API at URL:', ollamaUrl, 'with model:', aiModel);
      response = await callOllama(ollamaUrl, prompt, aiModel);
    } else {
      console.error('Unknown API type at call time:', apiType);
      throw new Error(`Unsupported API type: ${apiType}`);
    }
    
    // Check if the response indicates an issue with resume content
    if (response && (
        response.toLowerCase().includes('cannot parse the resume') ||
        response.toLowerCase().includes('resume content is missing') ||
        response.toLowerCase().includes('unable to extract information') ||
        response.toLowerCase().includes('please provide the resume')
      )) {
      throw new Error('The AI could not properly analyze your resume. Please try uploading a clearer or better-formatted resume.');
    }
    
    console.log('Got response from AI API (first 100 chars):', (response || '').substring(0, 100) + '...');
    
    // Parse the response into the expected format
    const parsedResponse = parseAIResponse(response, outputs);
    console.log('Parsed response:', parsedResponse);
    
    // Make sure we got at least some content back
    const hasAnyContent = Object.values(parsedResponse).some(val => val && val.trim().length > 0);
    if (!hasAnyContent) {
      throw new Error('The AI generated empty responses. Please try a different model or check your resume format.');
    }
    
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
  const resume = resumeContent
  const job = jobDescription
  
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
EXPERIENCE_BULLETS: For each organization/company in the resume, provide 5-6 achievement-oriented bullet points that showcase the candidate's most relevant experience for this job. Structure the output as an array of organization objects, each containing:
- organization_name: The name of the company/organization
- position: The candidate's position/title
- date: The employment period (if available)
- bullets: Array of 5-6 bullet points that follow the STAR format (Situation, Task, Action, Result) and include quantifiable achievements where possible

IMPORTANT: Each bullet point should be a complete, well-formatted statement following the STAR format. DO NOT use "Situation:", "Task:", "Action:", "Result:" prefixes in the bullets. Instead, craft each bullet as a cohesive professional statement that incorporates these elements naturally. For example:
- "Redesigned the customer dashboard using React and Material UI, reducing page load time by 40% and increasing user engagement by 25%"
- "Led a team of 5 developers to implement a new payment processing system that reduced transaction errors by 30% and improved checkout completion rate by 15%"
`;
  }
  
  if (outputs.includes('education')) {
    prompt += `
EDUCATION: Structure the candidate's educational background as an array of education objects. For each education entry, include:
- institution: The name of the educational institution
- degree: The degree or certification obtained
- field: The field of study or major
- date: The graduation year or attendance period
- achievements: Any notable achievements, honors, or relevant details (optional)
`;
  }
  
  if (outputs.includes('skills')) {
    prompt += `
SKILLS: A list of 8-10 relevant skills the candidate possesses that match the job requirements. Format as a comma-separated list.
`;
  }
  
  if (outputs.includes('awards')) {
    prompt += `
AWARDS: Structure notable achievements, honors, or awards as an array of award objects. For each award/achievement, include:
- title: The title or name of the award/achievement
- date: Year or date when received
- organization: The organization that granted the award (if applicable)
- description: Brief description of the significance or what it was awarded for
`;
  }
  
  if (outputs.includes('projects')) {
    prompt += `
PROJECTS: Structure relevant projects as an array of project objects. For each project, include:
- project_name: Name of the project
- date: Timeline of the project
- role: The candidate's role in the project
- technologies: Technologies, tools or skills used
- description: Brief description of the project
- achievements: 2-3 bullet points highlighting key contributions or outcomes
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
- Company/Organization 1: [Position] [Date Range]
  - Developed a cloud-based architecture using AWS services, resulting in 99.9% uptime and 30% cost reduction compared to previous on-premises solution
  - Led migration of legacy systems to microservices architecture, improving deployment frequency from monthly to daily releases
  - Created comprehensive API documentation and developer portal, reducing onboarding time for new team members by 50%
  - Implemented automated CI/CD pipeline using Jenkins and Docker, decreasing deployment failures by 75%
  - Optimized database queries and implemented caching strategies, reducing average response time from 2.5s to 0.8s
  
- Company/Organization 2: [Position] [Date Range]
  - Redesigned mobile app UI/UX based on user feedback, increasing user retention by 35% and app store ratings from 3.2 to 4.7
  - Developed cross-platform functionality using React Native, reducing codebase size by 40% while maintaining feature parity
  - Implemented analytics tracking that identified key drop-off points, leading to targeted improvements that increased conversion by 28%
  - Created automated testing suite covering 85% of code, reducing reported bugs by 62% in first three months after deployment
  - Collaborated with marketing team to implement A/B testing framework, enabling data-driven decisions that improved click-through rates by 45%

EDUCATION:
- Institution 1: [Degree] in [Field], [Date]
  - Achievement/Honor 1 (if applicable)
- Institution 2: [Degree] in [Field], [Date]

SKILLS:
(Your skills list here...)

AWARDS:
- Award Title 1, [Date], [Organization]
  - Description of significance
- Award Title 2, [Date], [Organization]
  - Description of significance

PROJECTS:
- Project Name 1: [Date]
  - Role: [Your Role]
  - Technologies: [Technologies used]
  - Description: Brief description
  - Achievements:
    - Achievement 1
    - Achievement 2
- Project Name 2: [Date]
  - Role: [Your Role]
  - Technologies: [Technologies used]
  - Description: Brief description
  - Achievements:
    - Achievement 1
    - Achievement 2

COVER_LETTER:
(Your cover letter here...)

Try to format your response strictly as JSON, like this:
{
  "professional_summary": "The generated summary text...",
  "experience_bullets": [
    {
      "organization_name": "Company/Organization 1",
      "position": "Job Title",
      "date": "Jan 2020 - Present",
      "bullets": [
        "Achievement bullet point 1",
        "Achievement bullet point 2",
        "Achievement bullet point 3"
      ]
    },
    {
      "organization_name": "Company/Organization 2",
      "position": "Job Title",
      "date": "Jan 2018 - Dec 2019",
      "bullets": [
        "Achievement bullet point 1",
        "Achievement bullet point 2"
      ]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "date": "2014-2018",
      "achievements": "Graduated with honors, Dean's List all semesters"
    },
    {
      "institution": "Another University",
      "degree": "Master's Degree",
      "field": "Data Science",
      "date": "2019-2021",
      "achievements": "Research assistant, Published paper on ML"
    }
  ],
  "skills": "The generated skills list...",
  "awards": [
    {
      "title": "Employee of the Year",
      "date": "2021",
      "organization": "ABC Company",
      "description": "Awarded for exceptional performance and leadership"
    },
    {
      "title": "Innovation Award",
      "date": "2019",
      "organization": "Industry Association",
      "description": "Recognized for developing a novel solution that improved efficiency by 35%"
    }
  ],
  "projects": [
    {
      "project_name": "Project Name 1",
      "date": "Jan 2021 - Mar 2021",
      "role": "Lead Developer",
      "technologies": "React, Node.js, MongoDB",
      "description": "Brief description of the project and its purpose",
      "achievements": [
        "Increased performance by 40%",
        "Implemented CI/CD pipeline"
      ]
    },
    {
      "project_name": "Project Name 2",
      "date": "Jun 2020 - Dec 2020",
      "role": "Backend Developer",
      "technologies": "Python, Django, PostgreSQL",
      "description": "Brief description of the project",
      "achievements": [
        "Designed scalable database architecture",
        "Implemented automated testing"
      ]
    }
  ],
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
    // Determine if we need to use the vision endpoint
    const isVisionModel = model.includes('vision');
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    
    // Set model-specific parameters
    const maxTokens = getMaxTokensForModel(model);
    
    // Prepare the request payload
    const payload = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at matching candidate profiles to job descriptions and creating optimized job application content. Respond in clean JSON with keys matching section names. If any data is missing, infer based on experience level and resume context.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    };
    
    console.log(`Calling OpenAI API with model ${model}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const statusCode = response.status;
      let errorMessage = response.statusText;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
          errorDetails = JSON.stringify(errorData.error);
        }
      } catch (e) {
        // Try to get text if JSON parsing failed
        try {
          errorDetails = await response.text();
        } catch (textError) {
          errorDetails = 'Could not parse error response';
        }
      }
      
      console.error(`OpenAI API error (${statusCode}):`, errorMessage, errorDetails);
      
      // Provide more helpful messages for common errors
      if (statusCode === 401) {
        throw new Error('OpenAI API error: Invalid API key. Please check your API key in settings.');
      } else if (statusCode === 429) {
        throw new Error('OpenAI API error: Rate limit exceeded or insufficient quota. Check your billing and usage limits.');
      } else if (statusCode === 404) {
        throw new Error(`OpenAI API error: Model "${model}" not found. The selected model may no longer be available or you may not have access.`);
      }
      
      throw new Error(`OpenAI API error (${statusCode}): ${errorMessage}. ${errorDetails ? `Details: ${errorDetails}` : ''}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Call the Gemini API
 */
async function callGemini(apiKey, prompt, model = 'gemini-1.5-pro') {
  try {
    // Determine the API endpoint based on the model
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    console.log(`Calling Gemini API with model ${model}`);
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: "You are an expert at matching candidate profiles to job descriptions and creating optimized job application content. Respond in clean JSON with keys matching section names. If any data is missing, infer based on experience level and resume context."
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generation_config: {
        temperature: 0.7,
        max_output_tokens: 5000,
        response_mime_type: "application/json"
      }
    };
    
    console.log('Sending request to Gemini API');
    
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
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
          errorDetails = JSON.stringify(errorData.error);
        }
      } catch (e) {
        // Ignore parse errors on error response
        try {
          // Try to get the text response if JSON parsing failed
          errorDetails = await response.text();
        } catch (textError) {
          errorDetails = 'Could not parse error response';
        }
      }
      
      console.error(`Gemini API error (${statusCode}):`, errorMessage, errorDetails);
      throw new Error(`Gemini API error (${statusCode}): ${errorMessage}. ${errorDetails ? `Details: ${errorDetails}` : ''}`);
    }
    
    const data = await response.json();
    
    // Extract the text content from the response
    if (data.candidates && data.candidates.length > 0 && 
        data.candidates[0].content && data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Unexpected response format from Gemini API');
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
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
    
    
    // Create the request payload
    const payload = {
      model: model,
      prompt: prompt,
      system: "You are an expert at matching candidate profiles to job descriptions and creating optimized job application content. Respond in clean JSON with keys matching section names. If any data is missing, infer based on experience level and resume context.",
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
  const defaultTokens = 5000;
  
  // Model-specific token limits
  const tokenLimits = {
    'llama2': 2048,
    'llama3': 4096,
    'mistral': 2048,
    'mixtral': 4096,
    'phi': 1024,
    'gemma': 2048,
    'gemini-1.5-pro': 8192,
    'gemini-1.5-flash': 8192,
    'gemini-1.0-pro': 4096,
    'gpt-4': 8192,
    'gpt-4-turbo': 16384,
    'gpt-4o': 16384,
    'gpt-4o-mini': 16384,
    'gpt-3.5-turbo': 4096
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
 * Parse the AI's response text into structured sections
 */
function parseAIResponse(responseText, requestedOutputs) {
  if (!responseText) {
    console.error('Empty response from AI');
    return {
      error: 'No response was generated by the AI. Please try again.'
    };
  }
  
  console.log('Parsing AI response with length:', responseText.length);
  
  // Check for error messages in the response
  if (responseText.toLowerCase().includes('error') && 
      (responseText.toLowerCase().includes('resume') || responseText.toLowerCase().includes('parse'))) {
    console.error('AI indicated an error with resume content');
    return {
      error: 'The AI could not properly process your resume. Please try uploading a different file or format.'
    };
  }
  
  // First, try to parse the response as JSON
  try {
    // Look for JSON-like structure in the response - try to extract JSON between curly braces
    const jsonMatch = responseText.match(/{[\s\S]*}/);
    if (jsonMatch) {
      const jsonText = jsonMatch[0];
      let jsonData;
      
      try {
        // First attempt - direct parsing
        jsonData = JSON.parse(jsonText);
      } catch (initialError) {
        console.log('Initial JSON parse failed, trying to fix malformed JSON:', initialError.message);
        
        try {
          // Second attempt - try to fix common JSON issues
          // Replace escaped quotes within the JSON
          const fixedJson = jsonText.replace(/\\"/g, '"');
          jsonData = JSON.parse(fixedJson);
        } catch (fixError) {
          console.log('Fixed JSON parse failed:', fixError.message);
          
          // Third attempt - handle case where JSON values are strings that contain stringified JSON
          try {
            const partialJsonData = {};
            // Extract key-value pairs using regex
            const keyValuePairs = jsonText.match(/"([^"]+)":\s*("[^"]*"|{[^}]*}|\[[^\]]*\]|[^,}]+)/g);
            
            if (keyValuePairs) {
              keyValuePairs.forEach(pair => {
                // Extract key and value
                const keyMatch = pair.match(/"([^"]+)":/);
                if (keyMatch && keyMatch[1]) {
                  const key = keyMatch[1];
                  // Extract the value portion (everything after the first colon)
                  const valueStr = pair.substring(pair.indexOf(':') + 1).trim();
                  
                  // Try to parse the value if it looks like JSON
                  if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
                      valueStr.startsWith('{') || valueStr.startsWith('[')) {
                    try {
                      let parsedValue;
                      // If it's a string that might contain JSON
                      if (valueStr.startsWith('"')) {
                        // Remove surrounding quotes and try to parse
                        const innerStr = valueStr.substring(1, valueStr.length - 1);
                        // Check if it looks like stringified JSON
                        if (innerStr.includes('{') && innerStr.includes('}')) {
                          try {
                            // Replace escaped quotes and backslashes
                            const unescapedStr = innerStr
                              .replace(/\\"/g, '"')
                              .replace(/\\\\/g, '\\');
                            parsedValue = unescapedStr;
                          } catch (e) {
                            // If that fails, just use the string as is
                            parsedValue = innerStr;
                          }
                        } else {
                          // Not stringified JSON, use as is
                          parsedValue = innerStr;
                        }
                      } else {
                        // Try to parse as JSON
                        parsedValue = JSON.parse(valueStr);
                      }
                      partialJsonData[key] = parsedValue;
                    } catch (parseValueError) {
                      // If parsing fails, use the raw string
                      partialJsonData[key] = valueStr.replace(/^"(.*)"$/, '$1'); // Remove quotes if present
                    }
                  } else {
                    // For non-JSON values, just clean and add
                    partialJsonData[key] = valueStr.replace(/,$/, ''); // Remove trailing comma if present
                  }
                }
              });
              
              jsonData = partialJsonData;
            } else {
              throw new Error('No key-value pairs found in JSON');
            }
          } catch (fallbackError) {
            console.log('Fallback JSON parsing failed:', fallbackError.message);
            throw fixError; // Re-throw previous error
          }
        }
      }
      
      console.log('Successfully parsed JSON response:', Object.keys(jsonData));
      
      // Prepare the result from JSON data
      const result = {};
      
      // Map JSON fields to expected output format
      if (requestedOutputs.includes('professional_summary') && jsonData.professional_summary) {
        result.summary = jsonData.professional_summary;
      }
      
      if (requestedOutputs.includes('experience_bullets') && jsonData.experience_bullets) {
        result.experience = jsonData.experience_bullets;
      }
      
      if (requestedOutputs.includes('education') && jsonData.education) {
        result.education = jsonData.education;
      }
      
      if (requestedOutputs.includes('skills') && jsonData.skills) {
        result.skills = jsonData.skills;
      }
      
      if (requestedOutputs.includes('awards') && jsonData.awards) {
        result.awards = jsonData.awards;
      }
      
      if (requestedOutputs.includes('projects') && jsonData.projects) {
        result.projects = jsonData.projects;
      }
      
      if (requestedOutputs.includes('cover_letter') && jsonData.cover_letter) {
        result.coverLetter = jsonData.cover_letter;
      }
      
      // Check if we have any content
      const hasContent = Object.values(result).some(val => val && val.trim().length > 0);
      if (hasContent) {
        return result;
      }
      
      // If we reach here, JSON parsing succeeded but didn't provide the required fields
      console.log('JSON parsing succeeded but did not provide all required fields');
    }
  } catch (error) {
    console.log('Failed to parse response as JSON, falling back to regex extraction:', error.message);
  }
  
  // If JSON parsing failed or didn't provide required fields, fall back to regex extraction
  // First, try to parse using markdown section headers
  let sections = extractSectionsFromText(responseText);
  console.log('Extracted sections using primary method:', Object.keys(sections));
  
  // If we don't have any sections or missing requested outputs, try fallback method
  const hasAllRequestedOutputs = requestedOutputs.every(output => {
    // Convert output names to match the expected response format
    const sectionKey = output.replace(/_/g, '').toLowerCase();
    return sections[sectionKey] && sections[sectionKey].trim().length > 0;
  });
  
  if (Object.keys(sections).length === 0 || !hasAllRequestedOutputs) {
    console.log('Using fallback method to parse AI response');
    const fallbackSections = extractContentUsingFallbackMethod(responseText, requestedOutputs);
    
    // Merge any missing sections from fallback method
    sections = { ...sections, ...fallbackSections };
    console.log('Sections after fallback method:', Object.keys(sections));
  }
  
  // If we still don't have all sections, try to divide the text by keywords
  const stillMissingOutputs = requestedOutputs.some(output => {
    const sectionKey = output.replace(/_/g, '').toLowerCase();
    return !sections[sectionKey] || sections[sectionKey].trim().length === 0;
  });
  
  if (stillMissingOutputs) {
    console.log('Using section division method to parse AI response');
    const dividedSections = divideLongTextIntoSections(responseText, requestedOutputs);
    
    // Merge any missing sections from division method
    sections = { ...sections, ...dividedSections };
    console.log('Sections after division method:', Object.keys(sections));
  }
  
  // Prepare the final response object with the requested outputs
  const result = {};
  
  // Map the outputs from section names to the expected response format
  if (requestedOutputs.includes('professional_summary')) {
    result.summary = sections.professionalsummary || sections.summary || '';
  }
  
  if (requestedOutputs.includes('experience_bullets')) {
    const experience = sections.experiencebullets || sections.experience || '';
    
    // Check if the experience is already an array of organization objects
    if (Array.isArray(experience) && experience.length > 0 && typeof experience[0] === 'object') {
      // Fix any STAR format issues in the bullets
      const fixedExperience = experience.map(org => {
        // Clone the organization object
        const newOrg = { ...org };
        
        // Check if bullets need fixing
        if (Array.isArray(newOrg.bullets)) {
          newOrg.bullets = newOrg.bullets.map(bullet => {
            // Check if the bullet has STAR prefixes
            if (typeof bullet === 'string' && 
                (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                 bullet.includes('Action:') || bullet.includes('Result:'))) {
              
              // Handle combined STAR format (all elements in one bullet)
              if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                  bullet.includes('Action:') && bullet.includes('Result:')) {
                
                // Extract the components
                const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                
                // Combine into a proper bullet
                let situation = situationMatch ? situationMatch[1].trim() : '';
                let task = taskMatch ? taskMatch[1].trim() : '';
                let action = actionMatch ? actionMatch[1].trim() : '';
                let result = resultMatch ? resultMatch[1].trim() : '';
                
                // Construct a proper bullet point
                return `While ${situation}, ${task}. ${action}, ${result}`.replace(/\s{2,}/g, ' ');
              }
              
              // Remove the prefixes and format as a coherent statement
              return bullet.replace(/Situation:\s*/i, '')
                           .replace(/Task:\s*/i, '')
                           .replace(/Action:\s*/i, '')
                           .replace(/Result:\s*/i, '')
                           .replace(/\s{2,}/g, ' ');
            }
            
            return bullet;
          });
        }
        
        return newOrg;
      });
      
      result.experience = fixedExperience;
    } else if (Array.isArray(experience) && experience.length > 0 && typeof experience[0] === 'string') {
      // Handle old-style array of strings by converting to organizational format
      // Extract STAR elements if present and combine them
      const fixedBullets = experience.map(bullet => {
        if (typeof bullet === 'string' && 
            (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
             bullet.includes('Action:') || bullet.includes('Result:'))) {
          
          // Handle combined STAR format
          if (bullet.includes('Situation:') && bullet.includes('Task:') && 
              bullet.includes('Action:') && bullet.includes('Result:')) {
            
            // Extract the components
            const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
            const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
            const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
            const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
            
            // Combine into a proper bullet
            let situation = situationMatch ? situationMatch[1].trim() : '';
            let task = taskMatch ? taskMatch[1].trim() : '';
            let action = actionMatch ? actionMatch[1].trim() : '';
            let result = resultMatch ? resultMatch[1].trim() : '';
            
            return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
          }
          
          // Remove the prefixes and format as a coherent statement
          return bullet.replace(/Situation:\s*/i, '')
                       .replace(/Task:\s*/i, '')
                       .replace(/Action:\s*/i, '')
                       .replace(/Result:\s*/i, '')
                       .replace(/\s{2,}/g, ' ');
        }
        
        return bullet;
      });
      
      // Try to organize by company using pattern recognition
      const companies = new Map();
      let currentCompany = "Experience";
      
      // Look for company patterns
      experience.forEach(line => {
        const companyMatch = line.match(/^(?:At|While at|Working at|For)\s+([^,]+)/i);
        if (companyMatch) {
          currentCompany = companyMatch[1].trim();
          if (!companies.has(currentCompany)) {
            companies.set(currentCompany, []);
          }
        } else if (companies.has(currentCompany)) {
          companies.get(currentCompany).push(line);
        }
      });
      
      // If we found companies, create organization objects
      if (companies.size > 0) {
        result.experience = Array.from(companies.entries()).map(([company, bullets]) => {
          return {
            organization_name: company,
            position: "",
            date: "",
            bullets: bullets
          };
        });
      } else {
        result.experience = [{
          organization_name: "Experience",
          position: "",
          date: "",
          bullets: fixedBullets
        }];
      }
    } else if (typeof experience === 'string') {
      // Parse the string to extract company/organization structures
      try {
        // Check if the text has STAR format elements that need fixing
        const starFormatRegex = /Situation:\s*([^,;.]*),?\s*Task:\s*([^,;.]*),?\s*Action:\s*([^,;.]*),?\s*Result:\s*([^,;.]*)/gi;
        let fixedExperience = experience;
        let match;
        
        while ((match = starFormatRegex.exec(experience)) !== null) {
          const [fullMatch, situation, task, action, result] = match;
          const replacement = `While working ${situation.trim()}, ${task.trim()}. ${action.trim()}, resulting in ${result.trim()}`;
          fixedExperience = fixedExperience.replace(fullMatch, replacement);
        }
        
        // Continue with regular parsing...
        // Check for company/organization pattern
        const companyRegex = /(?:^|\n)[-•*]?\s*([^:]+):\s*(?:\[([^\]]+)\])?\s*(?:\[([^\]]+)\])?\s*\n((?:\s*[-•*]\s*.+\n?)+)/gm;
        let matches = Array.from(fixedExperience.matchAll(companyRegex));
        
        if (matches && matches.length > 0) {
          // We found structured company entries
          result.experience = matches.map(match => {
            const orgName = match[1].trim();
            let position = match[2] ? match[2].trim() : "";
            let date = match[3] ? match[3].trim() : "";
            
            // If position is empty but date is not, they might be switched
            if (!position && date) {
              // Check if "date" looks more like a position
              if (!date.match(/\d{4}/) && !date.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
                position = date;
                date = "";
              }
            }
            
            // Extract bullets
            const bulletsText = match[4].trim();
            const bullets = bulletsText.split('\n')
              .map(line => line.trim().replace(/^[-•*]\s*/, ''))
              .filter(line => line.length > 0)
              .map(bullet => {
                // Fix STAR format issues
                if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                    bullet.includes('Action:') || bullet.includes('Result:')) {
                  
                  // Extract components if all are present
                  if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                      bullet.includes('Action:') && bullet.includes('Result:')) {
                    
                    const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                    const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                    const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                    const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                    
                    let situation = situationMatch ? situationMatch[1].trim() : '';
                    let task = taskMatch ? taskMatch[1].trim() : '';
                    let action = actionMatch ? actionMatch[1].trim() : '';
                    let result = resultMatch ? resultMatch[1].trim() : '';
                    
                    return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                  }
                  
                  // Remove prefixes
                  return bullet.replace(/Situation:\s*/i, '')
                               .replace(/Task:\s*/i, '')
                               .replace(/Action:\s*/i, '')
                               .replace(/Result:\s*/i, '')
                               .replace(/\s{2,}/g, ' ');
                }
                
                return bullet;
              });
            
            return {
              organization_name: orgName,
              position: position,
              date: date,
              bullets: bullets
            };
          });
        } else {
          // Try extracting companies from the text
          const companyMentionRegex = /(?:^|\n)(?:At|While at|Working at|For)\s+([^,]+)/gim;
          const companyMatches = Array.from(fixedExperience.matchAll(companyMentionRegex));
          
          if (companyMatches && companyMatches.length > 0) {
            // Split content by company mentions
            let lastIndex = 0;
            const companyContents = [];
            
            companyMatches.forEach((match, index) => {
              const companyName = match[1].trim();
              const startIndex = match.index;
              
              // For all but the first company, add the previous company's content
              if (index > 0) {
                const previousCompany = companyMatches[index - 1][1].trim();
                const content = fixedExperience.substring(lastIndex, startIndex).trim();
                companyContents.push({ company: previousCompany, content });
              }
              
              lastIndex = startIndex;
              
              // For the last company, add its content
              if (index === companyMatches.length - 1) {
                const content = fixedExperience.substring(startIndex).trim();
                companyContents.push({ company: companyName, content });
              }
            });
            
            // Process each company's content into bullets
            result.experience = companyContents.map(item => {
              // Extract bullets from content
              const bullets = item.content.split(/\n|(?:\.)\s+/)
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.match(/^(?:At|While at|Working at|For)\s+/i))
                .map(bullet => {
                  // Fix STAR format issues
                  if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                      bullet.includes('Action:') || bullet.includes('Result:')) {
                    
                    // Same STAR fixing logic as above
                    // ...
                    
                    // Extract components if all are present
                    if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                        bullet.includes('Action:') && bullet.includes('Result:')) {
                      
                      const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                      const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                      const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                      const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                      
                      let situation = situationMatch ? situationMatch[1].trim() : '';
                      let task = taskMatch ? taskMatch[1].trim() : '';
                      let action = actionMatch ? actionMatch[1].trim() : '';
                      let result = resultMatch ? resultMatch[1].trim() : '';
                      
                      return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                    }
                    
                    // Remove prefixes
                    return bullet.replace(/Situation:\s*/i, '')
                                 .replace(/Task:\s*/i, '')
                                 .replace(/Action:\s*/i, '')
                                 .replace(/Result:\s*/i, '')
                                 .replace(/\s{2,}/g, ' ');
                  }
                  
                  return bullet;
                });
              
              return {
                organization_name: item.company,
                position: "",
                date: "",
                bullets: bullets
              };
            });
          } else {
            // Try another regex pattern for different formats
            const altCompanyRegex = /(?:^|\n)(.*?)\n(.*?)\n((?:\s*[-•*].*\n?)+)/gm;
            matches = Array.from(fixedExperience.matchAll(altCompanyRegex));
            
            if (matches && matches.length > 0) {
              result.experience = matches.map(match => {
                // Processing similar to earlier code...
                // ...
                
                const line1 = match[1].trim();
                const line2 = match[2].trim();
                
                // Try to determine if line1 is company and line2 is position/date
                // or if line1 is position and line2 is date
                let orgName, position, date;
                
                // If line2 contains date-like patterns, treat line1 as organization + position
                if (line2.match(/\d{4}/) || line2.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i) || 
                    line2.match(/present|current|ongoing/i)) {
                  // Line2 is likely a date
                  date = line2;
                  
                  // Try to extract company and position from line1
                  const positionMatch = line1.match(/(.*?)\s*[-–|,]\s*(.*)/);
                  if (positionMatch) {
                    orgName = positionMatch[1].trim();
                    position = positionMatch[2].trim();
                  } else {
                    orgName = line1;
                    position = "";
                  }
                } else {
                  // Assume line1 is organization and line2 is position
                  orgName = line1;
                  position = line2;
                  date = "";
                }
                
                // Extract bullets with STAR format fixing
                const bulletsText = match[3].trim();
                const bullets = bulletsText.split('\n')
                  .map(line => line.trim().replace(/^[-•*]\s*/, ''))
                  .filter(line => line.length > 0)
                  .map(bullet => {
                    // Fix STAR format issues (same logic as above)
                    if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                        bullet.includes('Action:') || bullet.includes('Result:')) {
                      
                      // Extract components if all are present
                      if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                          bullet.includes('Action:') && bullet.includes('Result:')) {
                        
                        const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                        const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                        const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                        const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                        
                        let situation = situationMatch ? situationMatch[1].trim() : '';
                        let task = taskMatch ? taskMatch[1].trim() : '';
                        let action = actionMatch ? actionMatch[1].trim() : '';
                        let result = resultMatch ? resultMatch[1].trim() : '';
                        
                        return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                      }
                      
                      // Remove prefixes
                      return bullet.replace(/Situation:\s*/i, '')
                                   .replace(/Task:\s*/i, '')
                                   .replace(/Action:\s*/i, '')
                                   .replace(/Result:\s*/i, '')
                                   .replace(/\s{2,}/g, ' ');
                    }
                    
                    return bullet;
                  });
                
                return {
                  organization_name: orgName,
                  position: position,
                  date: date,
                  bullets: bullets
                };
              });
            } else {
              // If no company structure detected, try to identify companies based on mentions
              const bulletsWithCompany = fixedExperience.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => line.replace(/^[-•*]\s*/, ''));
              
              // Group by company if possible
              const companyMap = new Map();
              let currentCompany = 'Experience';
              
              bulletsWithCompany.forEach(bullet => {
                const companyMatch = bullet.match(/^(?:At|While at|Working at|For)\s+([^,]+)/i);
                
                if (companyMatch) {
                  currentCompany = companyMatch[1].trim();
                  if (!companyMap.has(currentCompany)) {
                    companyMap.set(currentCompany, []);
                  }
                } else if (companyMap.has(currentCompany)) {
                  // Check for and fix STAR format issues
                  let processedBullet = bullet;
                  
                  if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                      bullet.includes('Action:') || bullet.includes('Result:')) {
                    
                    // Extract components if all are present
                    if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                        bullet.includes('Action:') && bullet.includes('Result:')) {
                      
                      const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                      const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                      const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                      const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                      
                      let situation = situationMatch ? situationMatch[1].trim() : '';
                      let task = taskMatch ? taskMatch[1].trim() : '';
                      let action = actionMatch ? actionMatch[1].trim() : '';
                      let result = resultMatch ? resultMatch[1].trim() : '';
                      
                      processedBullet = `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                    } else {
                      // Remove prefixes
                      processedBullet = bullet.replace(/Situation:\s*/i, '')
                                               .replace(/Task:\s*/i, '')
                                               .replace(/Action:\s*/i, '')
                                               .replace(/Result:\s*/i, '')
                                               .replace(/\s{2,}/g, ' ');
                    }
                  }
                  
                  companyMap.get(currentCompany).push(processedBullet);
                } else {
                  // Default company if none found
                  if (!companyMap.has('Experience')) {
                    companyMap.set('Experience', []);
                  }
                  
                  // Check for and fix STAR format issues (same logic as above)
                  let processedBullet = bullet;
                  
                  if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                      bullet.includes('Action:') || bullet.includes('Result:')) {
                    
                    // Extract components if all are present
                    if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                        bullet.includes('Action:') && bullet.includes('Result:')) {
                      
                      const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                      const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                      const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                      const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                      
                      let situation = situationMatch ? situationMatch[1].trim() : '';
                      let task = taskMatch ? taskMatch[1].trim() : '';
                      let action = actionMatch ? actionMatch[1].trim() : '';
                      let result = resultMatch ? resultMatch[1].trim() : '';
                      
                      processedBullet = `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                    } else {
                      // Remove prefixes
                      processedBullet = bullet.replace(/Situation:\s*/i, '')
                                               .replace(/Task:\s*/i, '')
                                               .replace(/Action:\s*/i, '')
                                               .replace(/Result:\s*/i, '')
                                               .replace(/\s{2,}/g, ' ');
                    }
                  }
                  
                  companyMap.get('Experience').push(processedBullet);
                }
              });
              
              if (companyMap.size > 0) {
                result.experience = Array.from(companyMap.entries()).map(([company, bullets]) => {
                  return {
                    organization_name: company,
                    position: "",
                    date: "",
                    bullets: bullets
                  };
                });
              } else {
                // Simple bullet point list as fallback
                const bullets = experience.split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0)
                  .map(line => line.replace(/^[-•*]\s*/, ''))
                  .map(bullet => {
                    // Fix STAR format issues (same logic as above)
                    if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                        bullet.includes('Action:') || bullet.includes('Result:')) {
                      
                      // Extract components if all are present
                      if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                          bullet.includes('Action:') && bullet.includes('Result:')) {
                        
                        const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                        const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                        const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                        const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                        
                        let situation = situationMatch ? situationMatch[1].trim() : '';
                        let task = taskMatch ? taskMatch[1].trim() : '';
                        let action = actionMatch ? actionMatch[1].trim() : '';
                        let result = resultMatch ? resultMatch[1].trim() : '';
                        
                        return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
                      }
                      
                      // Remove prefixes
                      return bullet.replace(/Situation:\s*/i, '')
                                   .replace(/Task:\s*/i, '')
                                   .replace(/Action:\s*/i, '')
                                   .replace(/Result:\s*/i, '')
                                   .replace(/\s{2,}/g, ' ');
                    }
                    
                    return bullet;
                  });
                
                if (bullets.length > 0) {
                  result.experience = [{
                    organization_name: "Experience",
                    position: "",
                    date: "",
                    bullets: bullets
                  }];
                } else {
                  result.experience = [{
                    organization_name: "Experience",
                    position: "",
                    date: "",
                    bullets: [experience]
                  }];
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing experience structure:', e);
        // Fallback to simple format with STAR issues fixed
        const bullets = experience.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => line.replace(/^[-•*]\s*/, ''))
          .map(bullet => {
            // Fix STAR format issues (same logic as above)
            if (bullet.startsWith('Situation:') || bullet.includes('Task:') || 
                bullet.includes('Action:') || bullet.includes('Result:')) {
              
              // Extract components if all are present
              if (bullet.includes('Situation:') && bullet.includes('Task:') && 
                  bullet.includes('Action:') && bullet.includes('Result:')) {
                
                const situationMatch = bullet.match(/Situation:\s*([^,;.]*)/i);
                const taskMatch = bullet.match(/Task:\s*([^,;.]*)/i);
                const actionMatch = bullet.match(/Action:\s*([^,;.]*)/i);
                const resultMatch = bullet.match(/Result:\s*([^,;.]*)/i);
                
                let situation = situationMatch ? situationMatch[1].trim() : '';
                let task = taskMatch ? taskMatch[1].trim() : '';
                let action = actionMatch ? actionMatch[1].trim() : '';
                let result = resultMatch ? resultMatch[1].trim() : '';
                
                return `While working ${situation}, ${task}. ${action}, resulting in ${result}`.replace(/\s{2,}/g, ' ');
              }
              
              // Remove prefixes
              return bullet.replace(/Situation:\s*/i, '')
                           .replace(/Task:\s*/i, '')
                           .replace(/Action:\s*/i, '')
                           .replace(/Result:\s*/i, '')
                           .replace(/\s{2,}/g, ' ');
            }
            
            return bullet;
          });
        
        result.experience = [{
          organization_name: "Experience",
          position: "",
          date: "",
          bullets: bullets
        }];
      }
    } else {
      // Empty or invalid format
      result.experience = [{
        organization_name: "Experience",
        position: "",
        date: "",
        bullets: ["No experience data available"]
      }];
    }
  }
  
  if (requestedOutputs.includes('education')) {
    const education = sections.education || '';
    
    // Check if education is already an array of objects
    if (Array.isArray(education) && education.length > 0 && typeof education[0] === 'object') {
      // Already in the right format, use as is
      result.education = education;
    } else if (typeof education === 'string') {
      // Try to parse the string into structured education objects
      try {
        // Check for education pattern like "Institution: Degree in Field, Date"
        const educationRegex = /(?:^|\n)[-•*]?\s*([^:]+):\s*([^,]+),\s*([^\n]+)(?:\n(?:\s*[-•*]\s*(.+)\n?)?)?/gm;
        let matches = Array.from(education.matchAll(educationRegex));
        
        if (matches && matches.length > 0) {
          // We found structured education entries
          result.education = matches.map(match => {
            const institution = match[1].trim();
            const degreeField = match[2].trim();
            const date = match[3].trim();
            const achievements = match[4] ? match[4].trim() : '';
            
            // Try to split degree and field if possible
            let degree = '', field = '';
            const degreeFieldMatch = degreeField.match(/([^i]+)\s+in\s+(.+)/i);
            if (degreeFieldMatch) {
              degree = degreeFieldMatch[1].trim();
              field = degreeFieldMatch[2].trim();
            } else {
              degree = degreeField;
            }
            
            return {
              institution: institution,
              degree: degree,
              field: field,
              date: date,
              achievements: achievements
            };
          });
        } else {
          // Try an alternative format
          const altEducationRegex = /(?:^|\n)(.*?)(?:\n(.*?))(?:\n(.*?))?(?:\n((?:\s*[-•*].*\n?)+))?/gm;
          matches = Array.from(education.matchAll(altEducationRegex));
          
          if (matches && matches.length > 0) {
            result.education = matches.map(match => {
              // Try to identify the pieces
              const lines = [match[1], match[2], match[3]].filter(Boolean).map(l => l.trim());
              
              let institution = '', degree = '', field = '', date = '', achievements = '';
              
              // Look for date patterns
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/\d{4}/) || lines[i].match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
                  date = lines[i];
                  lines.splice(i, 1);
                  break;
                }
              }
              
              // Look for degree patterns
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/bachelor|master|phd|doctor|certificate|diploma/i)) {
                  const parts = lines[i].split(/\s+in\s+/i);
                  if (parts.length > 1) {
                    degree = parts[0].trim();
                    field = parts[1].trim();
                  } else {
                    degree = lines[i];
                  }
                  lines.splice(i, 1);
                  break;
                }
              }
              
              // Assume first remaining line is institution
              if (lines.length > 0) {
                institution = lines[0];
              }
              
              // Look for achievements in remaining text
              if (match[4]) {
                achievements = match[4].trim();
              }
              
              return {
                institution: institution,
                degree: degree,
                field: field,
                date: date,
                achievements: achievements
              };
            });
          } else {
            // If no structure is detected, use the text as is
            result.education = [{
              institution: "Education",
              degree: "",
              field: "",
              date: "",
              achievements: education
            }];
          }
        }
      } catch (e) {
        console.error('Error parsing education structure:', e);
        // Fallback to simple format
        result.education = [{
          institution: "Education",
          degree: "",
          field: "",
          date: "",
          achievements: education
        }];
      }
    } else {
      // Empty or invalid format
      result.education = [{
        institution: "Education",
        degree: "",
        field: "",
        date: "",
        achievements: "No education data available"
      }];
    }
  }
  
  if (requestedOutputs.includes('skills')) {
    result.skills = sections.skills || '';
  }
  
  if (requestedOutputs.includes('awards')) {
    const awards = sections.awards || sections.achievements || '';
    
    // Check if awards is already an array of objects
    if (Array.isArray(awards) && awards.length > 0 && typeof awards[0] === 'object') {
      // Already in the right format, use as is
      result.awards = awards;
    } else if (Array.isArray(awards) && awards.length > 0 && typeof awards[0] === 'string') {
      // Simple array of strings - convert to structured format
      result.awards = awards.map(award => {
        // Try to parse into components (title, date, org, description)
        const parts = award.split(/,\s*/);
        let title = award;
        let date = '';
        let organization = '';
        let description = '';
        
        if (parts.length >= 2) {
          title = parts[0].trim();
          // Check if second part is a date (contains numbers)
          if (parts[1].match(/\d+/)) {
            date = parts[1].trim();
            if (parts.length >= 3) {
              organization = parts[2].trim();
              if (parts.length >= 4) {
                description = parts.slice(3).join(', ').trim();
              }
            }
          } else {
            // If second part isn't a date, assume it's organization
            organization = parts[1].trim();
            if (parts.length >= 3) {
              description = parts.slice(2).join(', ').trim();
            }
          }
        }
        
        return {
          title: title,
          date: date,
          organization: organization,
          description: description
        };
      });
    } else if (typeof awards === 'string') {
      // Try to parse the string into structured awards
      try {
        // Check for award pattern
        const awardRegex = /(?:^|\n)[-•*]?\s*([^,]+),\s*([^,]+)(?:,\s*([^,]+))?(?:,\s*(.+))?/gm;
        let matches = Array.from(awards.matchAll(awardRegex));
        
        if (matches && matches.length > 0) {
          // We found structured award entries
          result.awards = matches.map(match => {
            return {
              title: match[1]?.trim() || '',
              date: match[2]?.trim() || '',
              organization: match[3]?.trim() || '',
              description: match[4]?.trim() || ''
            };
          });
        } else {
          // If no clear structure, split by lines and treat each line as a title
          const awardLines = awards.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[-•*]\s*/, ''));
          
          if (awardLines.length > 0) {
            result.awards = awardLines.map(line => ({
              title: line,
              date: '',
              organization: '',
              description: ''
            }));
          } else {
            result.awards = [{
              title: awards,
              date: '',
              organization: '',
              description: ''
            }];
          }
        }
      } catch (e) {
        console.error('Error parsing awards structure:', e);
        // Fallback to simple format
        result.awards = [{
          title: awards,
          date: '',
          organization: '',
          description: ''
        }];
      }
    } else {
      // Empty or invalid format
      result.awards = [{
        title: 'No awards data available',
        date: '',
        organization: '',
        description: ''
      }];
    }
  }
  
  if (requestedOutputs.includes('projects')) {
    const projects = sections.projects || '';
    
    // Check if projects is already an array of objects
    if (Array.isArray(projects) && projects.length > 0 && typeof projects[0] === 'object') {
      // Already in the right format, use as is
      result.projects = projects;
    } else if (typeof projects === 'string') {
      // Try to parse the string into structured project objects
      try {
        // Check for project pattern like "Project Name: [Date]" followed by details
        const projectRegex = /(?:^|\n)[-•*]?\s*([^:]+):\s*([^\n]+)(?:\n(?:\s*[-•*]\s*(?:Role|Technologies|Description|Achievements):\s*(.+)\n?)+)?/gm;
        let matches = Array.from(projects.matchAll(projectRegex));
        
        if (matches && matches.length > 0) {
          // We found project headers, now extract details for each
          result.projects = matches.map(match => {
            const projectName = match[1].trim();
            const date = match[2].trim();
            
            // Initialize the project object
            const projectObj = {
              project_name: projectName,
              date: date,
              role: "",
              technologies: "",
              description: "",
              achievements: []
            };
            
            // If there are details, extract them
            if (match[0]) {
              const fullMatch = match[0];
              
              // Extract role
              const roleMatch = fullMatch.match(/Role:\s*([^\n]+)/);
              if (roleMatch) projectObj.role = roleMatch[1].trim();
              
              // Extract technologies
              const techMatch = fullMatch.match(/Technologies:\s*([^\n]+)/);
              if (techMatch) projectObj.technologies = techMatch[1].trim();
              
              // Extract description
              const descMatch = fullMatch.match(/Description:\s*([^\n]+)/);
              if (descMatch) projectObj.description = descMatch[1].trim();
              
              // Extract achievements
              const achievementsMatch = fullMatch.match(/Achievements:\s*([\s\S]*?)(?=\n\s*[-•*]|$)/);
              if (achievementsMatch) {
                // Split achievements into bullet points
                const achievementsText = achievementsMatch[1].trim();
                projectObj.achievements = achievementsText.split('\n')
                  .map(line => line.trim().replace(/^[-•*]\s*/, ''))
                  .filter(line => line.length > 0);
              }
            }
            
            return projectObj;
          });
        } else {
          // Try an alternative format with project sections
          const altProjectRegex = /(?:^|\n)(.*?)\n((?:.*\n)+?(?:\s*[-•*].*\n?)+)/gm;
          matches = Array.from(projects.matchAll(altProjectRegex));
          
          if (matches && matches.length > 0) {
            result.projects = matches.map(match => {
              const header = match[1].trim();
              const details = match[2].trim();
              
              // Try to extract project name and date from header
              let projectName = header;
              let date = "";
              
              const headerMatch = header.match(/(.*?)(?:\s*\[([^\]]+)\])?$/);
              if (headerMatch) {
                projectName = headerMatch[1].trim();
                date = headerMatch[2] ? headerMatch[2].trim() : "";
              }
              
              // Initialize project object
              const projectObj = {
                project_name: projectName,
                date: date,
                role: "",
                technologies: "",
                description: "",
                achievements: []
              };
              
              // Extract details from the content
              const lines = details.split('\n').map(l => l.trim()).filter(l => l.length > 0);
              
              // Process each line
              lines.forEach(line => {
                // Clean up bullets
                const cleanLine = line.replace(/^[-•*]\s*/, '');
                
                // Check for labeled details
                if (cleanLine.match(/^Role:/i)) {
                  projectObj.role = cleanLine.replace(/^Role:\s*/i, '').trim();
                } else if (cleanLine.match(/^Tech|Technologies:/i)) {
                  projectObj.technologies = cleanLine.replace(/^(?:Tech|Technologies):\s*/i, '').trim();
                } else if (cleanLine.match(/^Description:/i)) {
                  projectObj.description = cleanLine.replace(/^Description:\s*/i, '').trim();
                } else if (cleanLine.match(/^Achievements:/i)) {
                  // Skip the label line, achievements are captured below
                } else {
                  // If no specific label, assume it's an achievement/detail
                  projectObj.achievements.push(cleanLine);
                }
              });
              
              // If no description but we have achievements, use first achievement as description
              if (!projectObj.description && projectObj.achievements.length > 0) {
                projectObj.description = projectObj.achievements[0];
                projectObj.achievements = projectObj.achievements.slice(1);
              }
              
              return projectObj;
            });
          } else {
            // If no structured format is detected, return as simple object
            result.projects = [{
              project_name: "Project",
              date: "",
              role: "",
              technologies: "",
              description: projects,
              achievements: []
            }];
          }
        }
      } catch (e) {
        console.error('Error parsing projects structure:', e);
        // Fallback to simple format
        result.projects = [{
          project_name: "Project",
          date: "",
          role: "",
          technologies: "",
          description: projects,
          achievements: []
        }];
      }
    } else {
      // Empty or invalid format
      result.projects = [{
        project_name: "Project",
        date: "",
        role: "",
        technologies: "",
        description: "No project data available",
        achievements: []
      }];
    }
  }
  
  if (requestedOutputs.includes('cover_letter')) {
    result.coverLetter = sections.coverletter || sections.coverLetter || '';
  }
  
  // Check if any of the requested outputs are missing or empty
  const missingOutputs = requestedOutputs.filter(output => {
    const key = output === 'professional_summary' ? 'summary' :
                 output === 'experience_bullets' ? 'experience' :
                 output === 'cover_letter' ? 'coverLetter' : output;
    return !result[key] || (typeof result[key] === 'string' && result[key].trim().length === 0);
  });
  
  if (missingOutputs.length > 0) {
    console.warn('Missing outputs after all parsing attempts:', missingOutputs);
    
    // Add placeholders for missing sections with helpful error messages
    missingOutputs.forEach(output => {
      const key = output === 'professional_summary' ? 'summary' :
                   output === 'experience_bullets' ? 'experience' :
                   output === 'cover_letter' ? 'coverLetter' : output;
      
      result[key] = `No ${output.replace(/_/g, ' ')} generated. The AI couldn't extract this information from your resume.`;
    });
  }
  
  return result;
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
    awards: '',
    projects: '',
    cover_letter: ''
  };
  
  // Define regex patterns for each section
  const patterns = {
    professional_summary: /PROFESSIONAL_SUMMARY:?([\s\S]*?)(?=EXPERIENCE_BULLETS:|EDUCATION:|SKILLS:|COVER_LETTER:|$)/i,
    experience_bullets: /EXPERIENCE_BULLETS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EDUCATION:|SKILLS:|COVER_LETTER:|$)/i,
    education: /EDUCATION:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|SKILLS:|COVER_LETTER:|$)/i,
    skills: /SKILLS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|EDUCATION:|COVER_LETTER:|$)/i,
    awards: /AWARDS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|EDUCATION:|SKILLS:|$)/i,
    projects: /PROJECTS:?([\s\S]*?)(?=PROFESSIONAL_SUMMARY:|EXPERIENCE_BULLETS:|EDUCATION:|SKILLS:|$)/i,
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
  
  // For awards, look for the word "awards" and text following it
  if (requestedOutputs.includes('awards')) {
    const awardsMatch = text.match(/(?:awards)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (awardsMatch && awardsMatch[1]) {
      result.awards = awardsMatch[1].trim();
    }
  }
  
  // For projects, look for the word "projects" and text following it
  if (requestedOutputs.includes('projects')) {
    const projectsMatch = text.match(/(?:projects)(?:[:.\s-]+)([\s\S]*?)(?:\n\s*\n|\n\s*[A-Z]|$)/i);
    if (projectsMatch && projectsMatch[1]) {
      result.projects = projectsMatch[1].trim();
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
    } else if (output === 'awards') {
      result.awards = section;
    } else if (output === 'projects') {
      result.projects = section;
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