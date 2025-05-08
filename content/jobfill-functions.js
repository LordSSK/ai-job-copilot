/**
 * Extract job description from the current page
 * Supports common job boards: Workday, Greenhouse, Lever, and generic job boards
 */
function extractJobDescription() {
  // Detect which job board we're on
  const hostname = window.location.hostname;
  let jobDescription = '';
  
  if (hostname.includes('workday.com')) {
    jobDescription = extractWorkdayJobDescription();
  } else if (hostname.includes('greenhouse.io')) {
    jobDescription = extractGreenhouseJobDescription();
  } else if (hostname.includes('lever.co')) {
    jobDescription = extractLeverJobDescription();
  } else {
    // Generic extraction for other job boards
    jobDescription = extractGenericJobDescription();
  }
  
  return cleanupJobDescription(jobDescription);
}

// Platform-specific extractors
function extractWorkdayJobDescription() {
  // Workday often has the job description in a div with specific classes
  const jobPostingElements = document.querySelectorAll('.job-description, .job-posting-brief, .GWTCKEditor-Disabled');
  
  if (jobPostingElements.length > 0) {
    return Array.from(jobPostingElements)
      .map(el => el.textContent)
      .join('\n\n');
  }
  
  // Fallback to generic method if specific elements aren't found
  return extractGenericJobDescription();
}

function extractGreenhouseJobDescription() {
  // Greenhouse usually has a "content" section
  const contentElement = document.querySelector('#content, .content, .job-description');
  
  if (contentElement) {
    return contentElement.textContent;
  }
  
  return extractGenericJobDescription();
}

function extractLeverJobDescription() {
  // Log for debugging
  console.log('Extracting Lever job description');

  // Try multiple approaches to extract content
  
  // APPROACH 1: Get the entire content wrapper and process
  const contentWrapper = document.querySelector('.content-wrapper.posting-page');
  if (contentWrapper) {
    console.log('Found content-wrapper.posting-page');
    
    // Get all sections in the job posting
    const allSections = contentWrapper.querySelectorAll('.section');
    if (allSections && allSections.length > 0) {
      console.log(`Found ${allSections.length} sections`);
      
      // Extract text from all relevant sections
      let fullText = '';
      
      // Get job title
      const jobTitle = contentWrapper.querySelector('.posting-headline h2');
      if (jobTitle) {
        fullText += `${jobTitle.textContent.trim()}\n\n`;
      }
      
      // Get all section content
      Array.from(allSections).forEach(section => {
        // Skip apply button sections
        if (section.querySelector('.postings-btn')) {
          return;
        }
        
        const sectionText = section.textContent.trim();
        if (sectionText && sectionText.length > 0) {
          fullText += `${sectionText}\n\n`;
        }
      });
      
      if (fullText.length > 0) {
        console.log('Successfully extracted job description using approach 1');
        return fullText.trim();
      }
    }
  }
  
  // APPROACH 2: Target specific data-qa attributes
  console.log('Trying approach 2 with data-qa attributes');
  const jobDescriptionSection = document.querySelector('[data-qa="job-description"]');
  const closingSection = document.querySelector('[data-qa="closing-description"]');
  
  if (jobDescriptionSection || closingSection) {
    console.log('Found job sections with data-qa attributes');
    let description = '';
    
    // Try to get the job title first
    const jobTitle = document.querySelector('.posting-headline h2');
    if (jobTitle) {
      description += `${jobTitle.textContent.trim()}\n\n`;
    }
    
    // Add job description content
    if (jobDescriptionSection) {
      description += `${jobDescriptionSection.textContent.trim()}\n\n`;
    }
    
    // Add any other section content
    const otherSections = document.querySelectorAll('.section.page-centered');
    if (otherSections && otherSections.length > 0) {
      Array.from(otherSections).forEach(section => {
        // Skip sections we've already included and button sections
        if (section !== jobDescriptionSection && 
            section !== closingSection && 
            !section.classList.contains('last-section-apply')) {
          const sectionText = section.textContent.trim();
          if (sectionText.length > 0) {
            description += `${sectionText}\n\n`;
          }
        }
      });
    }
    
    // Add closing description
    if (closingSection) {
      description += `${closingSection.textContent.trim()}`;
    }
    
    if (description.length > 0) {
      console.log('Successfully extracted job description using approach 2');
      return description.trim();
    }
  }
  
  // APPROACH 3: Get the content div directly
  console.log('Trying approach 3 with content div');
  const contentDiv = document.querySelector('.content');
  if (contentDiv) {
    console.log('Found .content div');
    return contentDiv.textContent.trim();
  }
  
  // APPROACH 4: Fallback to previous implementation
  console.log('Falling back to previous approach');
  const descriptionElement = document.querySelector('.posting-page, .posting-category-content, .section-wrapper');
  if (descriptionElement) {
    return descriptionElement.textContent.trim();
  }
  
  // Last resort - use generic extraction
  console.log('No Lever-specific structure found, using generic extraction');
  return extractGenericJobDescription();
}

function extractGenericJobDescription() {
  // Try common patterns found in job boards
  const possibleSelectors = [
    // Common selectors for job descriptions
    '.job-description',
    '.description',
    '.job-details',
    '[data-automation="jobDescription"]',
    '[data-testid="job-description"]',
    '.job-posting-section',
    // Schema.org structured data also often contains job descriptions
    '[itemprop="description"]'
  ];
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length > 0) {
      return Array.from(elements)
        .map(el => el.textContent)
        .join('\n\n');
    }
  }
  
  // If all else fails, look for large text blocks that might be the job description
  const paragraphs = document.querySelectorAll('p');
  const textBlocks = Array.from(paragraphs)
    .filter(p => p.textContent.trim().length > 100) // Filter for substantial paragraphs
    .map(p => p.textContent);
  
  if (textBlocks.length > 0) {
    return textBlocks.join('\n\n');
  }
  
  // Last resort: try to find any div with substantial text that might be the job description
  const contentDivs = document.querySelectorAll('div, section, article');
  const largeTextDivs = Array.from(contentDivs)
    .filter(div => {
      const text = div.textContent.trim();
      return text.length > 300 && text.split(' ').length > 50;
    })
    .sort((a, b) => b.textContent.length - a.textContent.length);
  
  if (largeTextDivs.length > 0) {
    // Take the largest text block, which is likely the job description
    return largeTextDivs[0].textContent;
  }
  
  return "Could not find job description. Please copy and paste it manually.";
}

function cleanupJobDescription(text) {
  if (!text) return '';
  
  // Remove extra whitespace, normalize line breaks
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Remove common job board boilerplate text
  const boilerplatePatterns = [
    /About the company/i,
    /Equal Opportunity Employer/i,
    /Apply now/i,
    /Click to apply/i,
    /Submit your resume/i
  ];
  
  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  return cleaned.trim();
}

/**
 * Autofill application forms with AI-generated content
 */
function autofillApplication(generatedContent) {
  // Detect which job board we're on
  const hostname = window.location.hostname;
  let result = { success: false, filled: 0 };
  
  if (hostname.includes('workday.com')) {
    result = autofillWorkday(generatedContent);
  } else if (hostname.includes('greenhouse.io')) {
    result = autofillGreenhouse(generatedContent);
  } else if (hostname.includes('lever.co')) {
    result = autofillLever(generatedContent);
  } else {
    // Generic autofill for other job boards
    result = autofillGeneric(generatedContent);
  }
  
  return result;
}

// Platform-specific autofill functions
function autofillWorkday(content) {
  let filledFields = 0;
  
  // Find and fill summary/cover letter fields
  const textareaFields = document.querySelectorAll('textarea');
  const coverLetterFields = Array.from(textareaFields).filter(el => {
    const label = findLabelForElement(el);
    return label && (
      label.match(/cover letter|statement|introduction|tell us/i) ||
      el.placeholder && el.placeholder.match(/cover letter|statement|introduction|tell us/i)
    );
  });
  
  if (coverLetterFields.length > 0 && content.coverLetter) {
    coverLetterFields.forEach(field => {
      field.value = content.coverLetter;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    });
  }
  
  // Find and fill skills fields
  const skillsFields = Array.from(textareaFields).filter(el => {
    const label = findLabelForElement(el);
    return label && (
      label.match(/skills|qualifications|competencies/i) ||
      el.placeholder && el.placeholder.match(/skills|qualifications|competencies/i)
    );
  });
  
  if (skillsFields.length > 0 && content.skills) {
    skillsFields.forEach(field => {
      field.value = content.skills;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    });
  }
  
  return { success: filledFields > 0, filled: filledFields };
}

function autofillGreenhouse(content) {
  let filledFields = 0;
  
  // Find and fill cover letter field
  const coverLetterField = document.querySelector('#cover_letter, [name="cover_letter"]');
  if (coverLetterField && content.coverLetter) {
    coverLetterField.value = content.coverLetter;
    coverLetterField.dispatchEvent(new Event('input', { bubbles: true }));
    coverLetterField.dispatchEvent(new Event('change', { bubbles: true }));
    highlightElement(coverLetterField);
    filledFields++;
  }
  
  // Check for custom questions
  const customFields = document.querySelectorAll('.custom-field textarea');
  customFields.forEach(field => {
    const label = findLabelForElement(field);
    if (!label) return;
    
    if (label.match(/summary|profile|about you/i) && content.summary) {
      field.value = content.summary;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    } else if (label.match(/experience|accomplishments/i) && content.experience) {
      field.value = content.experience;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    } else if (label.match(/skills|qualifications/i) && content.skills) {
      field.value = content.skills;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    }
  });
  
  return { success: filledFields > 0, filled: filledFields };
}

function autofillLever(content) {
  let filledFields = 0;
  
  // Find and fill cover letter field
  const coverLetterField = document.querySelector('#cover_letter, [name="cover_letter"], textarea[name*="cover"], textarea[name*="letter"]');
  if (coverLetterField && content.coverLetter) {
    coverLetterField.value = content.coverLetter;
    coverLetterField.dispatchEvent(new Event('input', { bubbles: true }));
    coverLetterField.dispatchEvent(new Event('change', { bubbles: true }));
    highlightElement(coverLetterField);
    filledFields++;
  }
  
  // Find additional text areas for other content
  const textareas = document.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    if (textarea === coverLetterField) return; // Skip already filled fields
    
    const label = findLabelForElement(textarea);
    if (!label) return;
    
    if (label.match(/experience|accomplishments/i) && content.experience) {
      textarea.value = content.experience;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(textarea);
      filledFields++;
    } else if (label.match(/skills|qualifications/i) && content.skills) {
      textarea.value = content.skills;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(textarea);
      filledFields++;
    } else if (label.match(/summary|profile|about you/i) && content.summary) {
      textarea.value = content.summary;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(textarea);
      filledFields++;
    }
  });
  
  return { success: filledFields > 0, filled: filledFields };
}

function autofillGeneric(content) {
  let filledFields = 0;
  
  // Find all input and textarea fields
  const allFields = [...document.querySelectorAll('input[type="text"], textarea')];
  
  // Try to identify fields by their labels or placeholders
  allFields.forEach(field => {
    const label = findLabelForElement(field);
    const placeholderText = field.placeholder || '';
    const fieldId = field.id || '';
    const fieldName = field.name || '';
    
    // Check for cover letter fields
    if ((label && label.match(/cover letter|introduction|statement/i)) || 
        placeholderText.match(/cover letter|introduction|statement/i) ||
        fieldId.match(/cover_letter|coverletter/i) ||
        fieldName.match(/cover_letter|coverletter/i)) {
      
      if (content.coverLetter) {
        field.value = content.coverLetter;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
    // Check for summary/profile fields
    else if ((label && label.match(/summary|profile|about you/i)) || 
             placeholderText.match(/summary|profile|about you/i) ||
             fieldId.match(/summary|profile/i) ||
             fieldName.match(/summary|profile/i)) {
      
      if (content.summary) {
        field.value = content.summary;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
    // Check for experience fields
    else if ((label && label.match(/experience|accomplishments/i)) || 
             placeholderText.match(/experience|accomplishments/i) ||
             fieldId.match(/experience|accomplishments/i) ||
             fieldName.match(/experience|accomplishments/i)) {
      
      if (content.experience) {
        field.value = content.experience;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
    // Check for skills fields
    else if ((label && label.match(/skills|qualifications|competencies/i)) || 
             placeholderText.match(/skills|qualifications|competencies/i) ||
             fieldId.match(/skills|qualifications|competencies/i) ||
             fieldName.match(/skills|qualifications|competencies/i)) {
      
      if (content.skills) {
        field.value = content.skills;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
  });
  
  // If no fields were filled, try to detect one large textarea that might be 
  // meant for a general application or cover letter
  if (filledFields === 0) {
    const largeTextarea = findLargeTextareaField();
    
    if (largeTextarea && content.coverLetter) {
      largeTextarea.value = content.coverLetter;
      largeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      largeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(largeTextarea);
      filledFields++;
      
      // Create a notification to inform the user
      showToast('Filled a general application field with your cover letter');
    }
  }
  
  return { success: filledFields > 0, filled: filledFields };
}

// Helper functions
function findLabelForElement(element) {
  // First check for an explicitly associated label (using 'for' attribute)
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }
  
  // Check if the element is wrapped in a label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      return parent.textContent.trim().replace(element.value, '');
    }
    
    // Look for a label-like element nearby (common in forms)
    const possibleLabels = parent.querySelectorAll('label, .form-label, .field-label, .control-label');
    for (const labelElement of possibleLabels) {
      if (labelElement.textContent.trim()) {
        return labelElement.textContent.trim();
      }
    }
    
    parent = parent.parentElement;
  }
  
  // As a last resort, check for a preceding sibling that might be a label
  let previousSibling = element.previousElementSibling;
  while (previousSibling) {
    if (previousSibling.tagName === 'LABEL' || 
        previousSibling.classList.contains('form-label') || 
        previousSibling.classList.contains('field-label')) {
      return previousSibling.textContent.trim();
    }
    previousSibling = previousSibling.previousElementSibling;
  }
  
  return null;
}

function findLargeTextareaField() {
  const textareas = Array.from(document.querySelectorAll('textarea'));
  
  // Sort by size (rows * cols), preferring larger textareas
  textareas.sort((a, b) => {
    const aSize = (parseInt(a.rows) || 3) * (parseInt(a.cols) || 40);
    const bSize = (parseInt(b.rows) || 3) * (parseInt(b.cols) || 40);
    return bSize - aSize;
  });
  
  // Return the largest textarea if it exists
  return textareas.length > 0 ? textareas[0] : null;
}

function highlightElement(element) {
  element.classList.add('jobfill-highlighted');
  
  // Create and append a badge to identify the field
  const rect = element.getBoundingClientRect();
  const badge = document.createElement('div');
  badge.className = 'jobfill-badge';
  badge.textContent = 'JobFill';
  
  // Position the badge
  badge.style.top = (window.scrollY + rect.top - 20) + 'px';
  badge.style.left = (window.scrollX + rect.left) + 'px';
  
  document.body.appendChild(badge);
  
  // Remove the highlighting and badge after a few seconds
  setTimeout(() => {
    element.classList.remove('jobfill-highlighted');
    badge.remove();
  }, 5000);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'jobfill-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Remove toast after animation completes
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  if (request.action === 'extractJobDescription') {
    try {
      const jobDescription = extractJobDescription();
      console.log('Extracted job description, length:', jobDescription.length);
      sendResponse({ jobDescription });
    } catch (error) {
      console.error('Error extracting job description:', error);
      sendResponse({ error: error.message });
    }
    return true; // Required for async response
  }
  
  if (request.action === 'autofillApplication') {
    try {
      const result = autofillApplication(request.data);
      sendResponse(result);
    } catch (error) {
      console.error('Error autofilling application:', error);
      sendResponse({ error: error.message, success: false });
    }
    return true; // Required for async response
  }
});

// Log to confirm content script has loaded
console.log('JobFill content script loaded successfully'); 