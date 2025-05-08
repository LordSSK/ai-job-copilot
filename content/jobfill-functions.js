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
  console.log('Extracting Workday job description with improved handling');
  
  // First try to extract from Workday's newer UI with specific data-automation IDs
  const jobDescriptionSection = document.querySelector('[data-automation-id="jobPostingDescription"]');
  if (jobDescriptionSection) {
    console.log('Found Workday job posting description with data-automation-id');
    let fullText = '';
    
    // Get the job title
    const jobTitle = document.querySelector('[data-automation-id="jobPostingHeader"]');
    if (jobTitle) {
      fullText += `${jobTitle.textContent.trim()}\n\n`;
    }
    
    // Process paragraphs, preserving their structure
    const paragraphs = jobDescriptionSection.querySelectorAll('p');
    paragraphs.forEach(paragraph => {
      const text = paragraph.textContent.trim();
      if (text && text !== '&nbsp;') {
        // Check if it's a heading (bold text)
        const boldText = paragraph.querySelector('b, strong');
        if (boldText && boldText.textContent.trim() === paragraph.textContent.trim()) {
          fullText += `${text}\n`;
        } else {
          fullText += `${text}\n\n`;
        }
      }
    });
    
    // Process lists and bullet points specifically
    const lists = jobDescriptionSection.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      items.forEach(item => {
        // Extract paragraph text from list items
        const itemParagraph = item.querySelector('p');
        const text = itemParagraph ? itemParagraph.textContent.trim() : item.textContent.trim();
        if (text) {
          fullText += `• ${text}\n`;
        }
      });
      fullText += '\n';
    });
    
    return fullText.trim();
  }
  
  // Try Workday's older UI pattern with specific classes
  const jobPostingElements = document.querySelectorAll('.job-description, .job-posting-brief, .GWTCKEditor-Disabled');
  
  if (jobPostingElements.length > 0) {
    let fullText = '';
    
    // Process each element, preserving the structure
    jobPostingElements.forEach(element => {
      // Get bullet points specifically
      const bulletPoints = element.querySelectorAll('ul li, ol li');
      if (bulletPoints.length > 0) {
        // Process and preserve bullet points
        const bulletSection = Array.from(bulletPoints)
          .map(li => `• ${li.textContent.trim()}`)
          .join('\n');
        
        fullText += bulletSection + '\n\n';
      }
      
      // Get headings - often used for sections like "Responsibilities", "Requirements"
      const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        fullText += `${heading.textContent.trim()}\n`;
        
        // Get the content that follows this heading until the next heading
        let currentNode = heading.nextElementSibling;
        while (currentNode && !currentNode.matches('h1, h2, h3, h4, h5, h6')) {
          if (currentNode.tagName === 'UL' || currentNode.tagName === 'OL') {
            // Skip lists that we've already processed
          } else if (currentNode.textContent.trim()) {
            fullText += `${currentNode.textContent.trim()}\n`;
          }
          currentNode = currentNode.nextElementSibling;
        }
        fullText += '\n';
      });
    });
    
    // If our structured extraction didn't yield much, fall back to getting all text
    if (fullText.trim().length < 100) {
      fullText = Array.from(jobPostingElements)
        .map(el => el.textContent.trim())
        .join('\n\n');
    }
    
    return fullText;
  }
  
  // Try Workday's newer UI pattern with specific data attributes
  const jobDetails = document.querySelector('[data-automation-id="job-detail-content"]');
  if (jobDetails) {
    // Try to get specific sections from the job details
    const sections = jobDetails.querySelectorAll('[data-automation-id="jobReqDescription"], [data-automation-id="jobReqQualifications"]');
    
    if (sections.length > 0) {
      return Array.from(sections)
        .map(section => {
          const sectionTitle = section.querySelector('[data-automation-id="section-Title"]');
          const sectionContent = section.querySelector('[data-automation-id="section-content"]');
          
          let text = '';
          if (sectionTitle) {
            text += `${sectionTitle.textContent.trim()}\n\n`;
          }
          
          if (sectionContent) {
            // Extract bullet points
            const bullets = sectionContent.querySelectorAll('li');
            if (bullets.length > 0) {
              bullets.forEach(bullet => {
                text += `• ${bullet.textContent.trim()}\n`;
              });
            } else {
              text += sectionContent.textContent.trim();
            }
          }
          
          return text;
        })
        .join('\n\n');
    }
    
    // If we couldn't find specific sections, get the entire content
    return jobDetails.textContent.trim();
  }
  
  // Fallback to generic method if specific elements aren't found
  return extractGenericJobDescription();
}

function extractGreenhouseJobDescription() {
  console.log('Extracting Greenhouse job description with improved handling');
  
  // Greenhouse usually has structured job sections
  const jobSections = document.querySelectorAll('.section-wrapper, .section, .description');
  if (jobSections.length > 0) {
    let fullText = '';
    
    // Get the job title first
    const jobTitle = document.querySelector('h1.app-title, h1.heading, .app-title');
    if (jobTitle) {
      fullText += `${jobTitle.textContent.trim()}\n\n`;
    }
    
    // Process each section
    jobSections.forEach(section => {
      // Get section title if available
      const sectionTitle = section.querySelector('h2, h3, h4, .section-header');
      if (sectionTitle) {
        fullText += `${sectionTitle.textContent.trim()}\n`;
      }
      
      // Get bullet points
      const bulletLists = section.querySelectorAll('ul, ol');
      if (bulletLists.length > 0) {
        bulletLists.forEach(list => {
          const listItems = list.querySelectorAll('li');
          listItems.forEach(item => {
            fullText += `• ${item.textContent.trim()}\n`;
          });
          fullText += '\n';
        });
      } else {
        // Get paragraphs if no bullet points
        const paragraphs = section.querySelectorAll('p');
        if (paragraphs.length > 0) {
          paragraphs.forEach(p => {
            if (p.textContent.trim() && !sectionTitle || !sectionTitle.contains(p)) {
              fullText += `${p.textContent.trim()}\n\n`;
            }
          });
        } else if (section.textContent.trim() && (!sectionTitle || section.textContent.trim() !== sectionTitle.textContent.trim())) {
          // Use entire section text if no paragraphs found
          fullText += `${section.textContent.trim()}\n\n`;
        }
      }
    });
    
    return fullText.trim();
  }
  
  // Greenhouse usually has a "content" section
  const contentElement = document.querySelector('#content, .content, .job-description');
  
  if (contentElement) {
    let fullText = '';
    
    // First, try to get the job title
    const jobTitle = document.querySelector('h1.app-title');
    if (jobTitle) {
      fullText += `${jobTitle.textContent.trim()}\n\n`;
    }
    
    // Get all headings to structure the content
    const headings = contentElement.querySelectorAll('h1, h2, h3');
    if (headings.length > 0) {
      headings.forEach(heading => {
        fullText += `${heading.textContent.trim()}\n`;
        
        // Get content until next heading
        let currentNode = heading.nextElementSibling;
        while (currentNode && !currentNode.matches('h1, h2, h3')) {
          if (currentNode.tagName === 'UL' || currentNode.tagName === 'OL') {
            // Process bullet points
            const bullets = currentNode.querySelectorAll('li');
            if (bullets.length > 0) {
              bullets.forEach(bullet => {
                fullText += `• ${bullet.textContent.trim()}\n`;
              });
              fullText += '\n';
            }
          } else if (currentNode.textContent.trim()) {
            fullText += `${currentNode.textContent.trim()}\n\n`;
          }
          currentNode = currentNode.nextElementSibling;
        }
      });
    } else {
      // If no headings, extract bullet points specifically
      const bulletLists = contentElement.querySelectorAll('ul, ol');
      if (bulletLists.length > 0) {
        bulletLists.forEach(list => {
          const listItems = list.querySelectorAll('li');
          listItems.forEach(item => {
            fullText += `• ${item.textContent.trim()}\n`;
          });
          fullText += '\n';
        });
      }
      
      // Extract paragraphs
      const paragraphs = contentElement.querySelectorAll('p');
      if (paragraphs.length > 0) {
        paragraphs.forEach(p => {
          if (p.textContent.trim()) {
            fullText += `${p.textContent.trim()}\n\n`;
          }
        });
      }
      
      // If we didn't get much structured content, use the plain text
      if (fullText.trim().length < 100) {
        fullText = contentElement.textContent.trim();
      }
    }
    
    return fullText;
  }
  
  // Try Greenhouse's alternative layout
  const jobInfoSection = document.querySelector('.job-info');
  if (jobInfoSection) {
    let fullText = '';
    
    // Get job title
    const jobTitle = document.querySelector('.app-title');
    if (jobTitle) {
      fullText += `${jobTitle.textContent.trim()}\n\n`;
    }
    
    // Get main job info
    fullText += jobInfoSection.textContent.trim() + '\n\n';
    
    // Get structured content
    const contentSections = document.querySelectorAll('.section-wrapper');
    if (contentSections.length > 0) {
      contentSections.forEach(section => {
        const sectionTitle = section.querySelector('h3, h2');
        if (sectionTitle) {
          fullText += `${sectionTitle.textContent.trim()}\n`;
        }
        
        // Extract bullet points
        const bullets = section.querySelectorAll('li');
        if (bullets.length > 0) {
          bullets.forEach(bullet => {
            fullText += `• ${bullet.textContent.trim()}\n`;
          });
          fullText += '\n';
        } else {
          // Get paragraphs if no bullets
          const paragraphs = section.querySelectorAll('p');
          if (paragraphs.length > 0) {
            paragraphs.forEach(p => {
              if (p.textContent.trim().length > 0) {
                fullText += `${p.textContent.trim()}\n\n`;
              }
            });
          }
        }
      });
    }
    
    return fullText;
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
  
  // Normalize line breaks first
  let cleaned = text.replace(/\r\n/g, '\n');
  
  // Remove extra blank lines (more than 2 consecutive newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Normalize spaces within lines without affecting line breaks
  cleaned = cleaned.split('\n').map(line => {
    return line.replace(/\s+/g, ' ').trim();
  }).join('\n');
  
  // Remove common job board boilerplate text
  const boilerplatePatterns = [
    /About the company\s*:/i,
    /Equal Opportunity Employer/i,
    /Apply now/i,
    /Click to apply/i,
    /Submit your resume/i,
    /Click here to apply/i
  ];
  
  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Ensure bullet points are properly formatted with a space after
  cleaned = cleaned.replace(/•(\S)/g, '• $1');
  
  // Remove any trailing/leading whitespace
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
  
  // Find and fill education fields
  const educationFields = Array.from(textareaFields).filter(el => {
    const label = findLabelForElement(el);
    return label && (
      label.match(/education|degree|university|college|academic/i) ||
      el.placeholder && el.placeholder.match(/education|degree|university|college|academic/i)
    );
  });
  
  if (educationFields.length > 0 && content.education) {
    educationFields.forEach(field => {
      field.value = content.education;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    });
  }
  
  // Find and fill awards/achievements fields
  const awardsFields = Array.from(textareaFields).filter(el => {
    const label = findLabelForElement(el);
    return label && (
      label.match(/awards|achievements|honors|recognitions/i) ||
      el.placeholder && el.placeholder.match(/awards|achievements|honors|recognitions/i)
    );
  });
  
  if (awardsFields.length > 0 && content.awards) {
    awardsFields.forEach(field => {
      field.value = content.awards;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    });
  }
  
  // Find and fill projects fields
  const projectsFields = Array.from(textareaFields).filter(el => {
    const label = findLabelForElement(el);
    return label && (
      label.match(/projects|portfolio|work samples/i) ||
      el.placeholder && el.placeholder.match(/projects|portfolio|work samples/i)
    );
  });
  
  if (projectsFields.length > 0 && content.projects) {
    projectsFields.forEach(field => {
      field.value = content.projects;
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
    } else if (label.match(/education|degree|university|college|academic/i) && content.education) {
      field.value = content.education;
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
    } else if (label.match(/awards|achievements|honors|recognitions/i) && content.awards) {
      field.value = content.awards;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(field);
      filledFields++;
    } else if (label.match(/projects|portfolio|work samples/i) && content.projects) {
      field.value = content.projects;
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
  
  // Find the cover letter field (usually with a specific pattern)
  const coverLetterField = document.querySelector('#cover_letter, textarea[name*="cover_letter"], textarea[name*="coverLetter"], textarea[placeholder*="cover letter"]');
  
  if (coverLetterField && content.coverLetter) {
    coverLetterField.value = content.coverLetter;
    coverLetterField.dispatchEvent(new Event('input', { bubbles: true }));
    coverLetterField.dispatchEvent(new Event('change', { bubbles: true }));
    highlightElement(coverLetterField);
    filledFields++;
  }
  
  // Fill in additional fields by checking their labels
  const textareas = document.querySelectorAll('textarea:not(#cover_letter)');
  
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
    } else if (label.match(/education|degree|university|college|academic/i) && content.education) {
      textarea.value = content.education;
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
    } else if (label.match(/awards|achievements|honors|recognitions/i) && content.awards) {
      textarea.value = content.awards;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      highlightElement(textarea);
      filledFields++;
    } else if (label.match(/projects|portfolio|work samples/i) && content.projects) {
      textarea.value = content.projects;
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
    // Check for education fields
    else if ((label && label.match(/education|degree|university|college|academic/i)) || 
             placeholderText.match(/education|degree|university|college|academic/i) ||
             fieldId.match(/education|degree|university|college|academic/i) ||
             fieldName.match(/education|degree|university|college|academic/i)) {
      
      if (content.education) {
        field.value = content.education;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
    // Check for awards/achievements fields
    else if ((label && label.match(/awards|achievements|honors|recognitions/i)) || 
             placeholderText.match(/awards|achievements|honors|recognitions/i) ||
             fieldId.match(/awards|achievements|honors|recognitions/i) ||
             fieldName.match(/awards|achievements|honors|recognitions/i)) {
      
      if (content.awards) {
        field.value = content.awards;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(field);
        filledFields++;
      }
    }
    // Check for projects fields
    else if ((label && label.match(/projects|portfolio|work samples/i)) || 
             placeholderText.match(/projects|portfolio|work samples/i) ||
             fieldId.match(/projects|portfolio|work samples/i) ||
             fieldName.match(/projects|portfolio|work samples/i)) {
      
      if (content.projects) {
        field.value = content.projects;
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

// Add message listener to handle content script interactions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    switch (message.action) {
      case 'extractJobDescription':
        // Use the general extraction function
        const jobDescription = extractJobDescription();
        sendResponse({ jobDescription });
        break;
        
      case 'extractWorkdayJobDescription':
        // Use Workday-specific extraction
        const workdayJobDescription = extractWorkdayJobDescription();
        sendResponse({ jobDescription: workdayJobDescription });
        break;
        
      case 'extractGreenhouseJobDescription':
        // Use Greenhouse-specific extraction
        const greenhouseJobDescription = extractGreenhouseJobDescription();
        sendResponse({ jobDescription: greenhouseJobDescription });
        break;
        
      case 'autofillApplication':
        // Handle autofill request
        if (message.data) {
          const result = autofillApplication(message.data);
          sendResponse(result);
        } else {
          sendResponse({ error: 'No content provided for autofill' });
        }
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ error: error.message });
  }
  
  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Log to confirm content script has loaded
console.log('JobFill content script loaded successfully'); 