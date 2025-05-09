# JobFill - AI-Powered Job Application Assistant

JobFill is a Chrome extension that helps job seekers automatically generate tailored application content and fill out job applications on platforms like Workday, Greenhouse, and Lever.

## Features

- **Resume Upload**: Upload your resume (PDF or TXT format)
- **Job Description Extraction**: Automatically extract job descriptions from job boards
- **AI-Generated Content**: Generate tailored application content using OpenAI's API:
  - Professional summaries
  - Experience bullets aligned with job requirements
  - Relevant skills lists
  - Custom cover letters
- **Autofill Applications (WIP)**: Automatically fill in form fields on job application websites
- **Multiple Job Board Support**: Works with Workday, Greenhouse, Lever, and other job boards

## Setup and Installation

### Prerequisites

- Chrome browser
- OpenAI API key for content generation

### Installation (Development Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the `job-fill` directory

### Configuration

1. Open the extension popup
2. Go to the Settings tab
3. Enter your OpenAI API key
4. (Optional) Adjust other settings as needed

## Usage

### Step 1: Upload Your Resume

1. Open the extension popup
2. On the Resume tab, upload your resume (PDF or TXT)

### Step 2: Extract Job Description

1. Navigate to a job posting page
2. Open the extension popup
3. Go to the Job Description tab
4. Click "Extract from Current Page"
5. Review and edit the extracted job description if needed

### Step 3: Generate Application Content

1. Go to the Generate tab
2. Select which content to generate (summary, experience, skills, cover letter)
3. Click "Generate Content"
4. Review the generated content

### Step 4: Autofill Application

1. Navigate to the application form on the job site
2. Click "Autofill Application" in the extension
3. The extension will attempt to fill relevant fields with your generated content

## Development

### Project Structure

```
job-fill/
├── manifest.json          # Extension manifest
├── assets/                # Icons and other static assets
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.js           # Main popup entry point (imports modules)
│   └── modules/           # Modular popup components
│       ├── tabs.js        # Tab navigation functionality
│       ├── resume.js      # Resume upload handling
│       ├── job-description.js # Job description handling
│       ├── content-generator.js # Content generation
│       ├── settings.js    # Settings management
│       ├── ui-helpers.js  # UI utility functions
│       ├── formatters.js  # Content formatting functions
│       └── user-data.js   # User data loading functionality
├── content/               # Content scripts
│   └── jobfill-functions.js
├── background/            # Background scripts
│   └── background.js
├── utils/                 # Utility modules
│   ├── storage.js         # Chrome storage operations as ES module
│   └── pdf-loader.js      # PDF parsing functionality as ES module
├── styles/                # CSS files
│   ├── popup.css
│   └── jobfill-styles.css
└── README.md
```

### Project Architecture

The JobFill Chrome extension is built with a modern modular architecture optimized for Chrome Extensions Manifest V3. Here's a detailed breakdown of each component:

#### Core Components

1. **User Interface (Popup)** 
   - **Location**: `popup/` directory
   - **Key Files**: 
     - `popup.html`, `popup.js` (main entry point)
     - Modular components in `popup/modules/`
   - **Module Organization**:
     - `tabs.js`: Tab navigation functionality
     - `resume.js`: Resume upload and processing
     - `job-description.js`: Job description extraction
     - `content-generator.js`: AI content generation
     - `settings.js`: Settings management
     - `ui-helpers.js`: UI utility functions
     - `formatters.js`: Content formatting functions
     - `user-data.js`: User data loading
   - **Functionality**: Provides the main user interface with tabs for:
     - Resume upload and parsing
     - Job description extraction and editing
     - Content generation with customizable options
     - Settings configuration
   - **Technologies**: HTML, CSS, ES Modules JavaScript

2. **Content Scripts**
   - **Location**: `content/` directory
   - **Key Files**: `jobfill-functions.js`, `jobfill-styles.css`
   - **Functionality**: 
     - Interacts directly with job board websites
     - Extracts job descriptions with specialized handlers for:
       - Workday (`extractWorkdayJobDescription()`)
       - Greenhouse (`extractGreenhouseJobDescription()`)
       - Lever (`extractLeverJobDescription()`)
       - Generic job boards (`extractGenericJobDescription()`)
     - Implements autofill functionality for application forms
     - Handles DOM manipulation and form field identification

3. **Background Service**
   - **Location**: `background/` directory
   - **Key File**: `background.js`
   - **Functionality**:
     - Orchestrates communication between popup and content scripts
     - Processes job data and resume content
     - Manages AI API calls (OpenAI or Ollama)
     - Constructs prompts and parses AI responses
     - Handles error management and API validation

4. **Utilities**
   - **Location**: `utils/` directory
   - **Key Files**:
     - `storage.js`: Chrome storage operations
     - `pdf-loader.js`: PDF parsing functionality
   - **Functionality**: Provides reusable utility functions for core extension features

5. **External Libraries**
   - **Location**: `lib/` directory
   - **Key Files**: `pdf.min.js`, `pdf.worker.min.js`
   - **Functionality**: Third-party libraries for PDF processing

#### Data Flow

The extension follows a clear data flow pattern:

1. **User Input Collection**:
   - Resume upload in popup UI → Parsed by PDF library → Stored in Chrome storage
   - Job description extraction via content scripts → Displayed in popup UI → Editable by user

2. **Content Generation**:
   - User requests content generation in popup
   - Popup sends message to background script
   - Background script:
     - Constructs AI prompt with resume and job data
     - Makes API call to selected AI provider (OpenAI/Ollama)
     - Parses structured response
     - Returns formatted content to popup

3. **Application Autofill**:
   - User triggers autofill in popup
   - Popup sends message with generated content to background
   - Background script executes content script functions
   - Content script:
     - Identifies form fields using intelligent matching
     - Populates fields with appropriate content
     - Provides visual feedback to user

#### AI Integration

The extension supports two AI backends:

1. **OpenAI API**:
   - Default provider using models like GPT-3.5 Turbo
   - Requires user-provided API key
   - Handles structured prompting and response parsing

2. **Ollama (Local LLM)**:
   - Alternative for privacy-focused users
   - Runs locally with models like Llama2
   - Requires local Ollama server with CORS settings

#### Security & Privacy Features

- Resume data stored locally in Chrome storage
- API keys securely managed
- Minimal data transmission to third parties

#### Future Architecture Extensions

The codebase is structured to support:

- Additional job board integrations
- New AI providers
- Enhanced form field detection algorithms
- Custom prompt templates
- Additional content types for different application formats

This architecture provides a robust foundation for an AI-powered job application assistant while maintaining performance, security, and extensibility.

## Custom Development

- **Modify API Integration**: Edit `background/background.js` to change API prompts or switch providers
- **Support Additional Job Boards**: Extend `content/jobfill-functions.js` with new job board-specific extractors
- **Enhance UI**: Modify files in the `popup/` directory

## Privacy

- Resume data is stored locally in your browser
- API calls to OpenAI contain only necessary data for content generation
- No data is shared with third parties other than OpenAI for content generation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is a development tool and may not work on all job boards or with all application forms. It is designed to assist with job applications but may require manual adjustments for optimal results. 