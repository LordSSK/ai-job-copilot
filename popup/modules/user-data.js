/**
 * User data loading functionality
 */

import { 
  formatContentAsBulletPoints, 
  formatEducationContent, 
  formatProjectsContent, 
  formatAwardsContent 
} from './formatters.js';
import { storageUtils } from '../../utils/storage.js';

// Utility function to load user data
function loadUserData() {
  storageUtils.get(['resume', 'jobDescription', 'generatedContent']).then(data => {
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

export { loadUserData }; 