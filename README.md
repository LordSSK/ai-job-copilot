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
- **Autofill Applications**: Automatically fill in form fields on job application websites
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
│   └── popup.js
├── content/               # Content scripts
│   └── content.js
├── background/            # Background scripts
│   └── background.js
├── utils/                 # Utility modules
│   ├── storage.js
│   └── auth.js
├── styles/                # CSS files
│   ├── popup.css
│   └── content.css
└── README.md
```

### Custom Development

- **Modify API Integration**: Edit `background/background.js` to change API prompts or switch providers
- **Support Additional Job Boards**: Extend `content/content.js` with new job board-specific extractors
- **Enhance UI**: Modify files in the `popup/` directory

## Premium Features

This extension includes a basic subscription system framework:

- **Free Tier**: Basic functionality with GPT-3.5 Turbo
- **Premium Tier**: Access to advanced models, unlimited applications, more customization

To implement payment processing, integrate with Stripe or another payment provider in the background scripts.

## Privacy

- Resume data is stored locally in your browser
- API calls to OpenAI contain only necessary data for content generation
- No data is shared with third parties other than OpenAI for content generation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is a development tool and may not work on all job boards or with all application forms. It is designed to assist with job applications but may require manual adjustments for optimal results. 