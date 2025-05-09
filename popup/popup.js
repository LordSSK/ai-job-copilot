/**
 * JobFill - Main popup script
 * Handles initialization and coordination of all popup functionality
 */

import { initTabs } from './modules/tabs.js';
import { initResumeUpload } from './modules/resume.js';
import { initJobDescription } from './modules/job-description.js';
import { initGenerateContent } from './modules/content-generator.js';
import { initSettings } from './modules/settings.js';
import { loadUserData } from './modules/user-data.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI and tab handling
  initTabs();
  initResumeUpload();
  initJobDescription();
  initGenerateContent();
  initSettings();
  loadUserData();
});