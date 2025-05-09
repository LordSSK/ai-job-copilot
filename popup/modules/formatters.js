/**
 * Content formatting utility functions
 */

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

export {
  formatContentAsBulletPoints,
  formatEducationContent,
  formatProjectsContent,
  formatAwardsContent
}; 