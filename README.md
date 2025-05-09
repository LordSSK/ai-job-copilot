# ResumeAI Tailor

A browser extension that uses AI to tailor your resume and cover letter based on job descriptions. This tool helps you create customized application content for job applications on platforms like Workday, Greenhouse, and Lever.

## Features

- Upload and parse your resume (PDF or TXT)
- Extract job descriptions from job posting websites
- Generate personalized application content:
  - Professional summary
  - Experience bullets
  - Education details
  - Skills section
  - Awards/achievements
  - Projects
  - Cover letter
- Auto-fill application forms on supported job platforms
- Support for both OpenAI API and local Ollama models

## Installation

### Development Setup

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/resumeai-tailor.git
   cd resumeai-tailor
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the extension in development mode:
   ```
   npm run dev
   ```

### Manual Installation in Chrome

1. Build the extension:
   ```
   npm run build
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right corner)
4. Click "Load unpacked" and select the `web-ext-artifacts` directory

## Usage

1. Click on the extension icon in your browser toolbar
2. Upload your resume in the "Resume" tab
3. Navigate to a job posting and use "Extract from Current Page" in the "Job Description" tab
4. Go to the "Generate" tab and select the content you want to generate
5. Click "Generate Content" to create personalized application materials
6. Use "Autofill Application" to automatically fill out application forms

## Configuration

In the "Settings" tab:
- Choose between OpenAI API or local Ollama for AI generation
- Enter your OpenAI API key or configure Ollama server URL
- Select the AI model to use for content generation

## Development

- `npm run dev`: Run the extension in development mode
- `npm run build`: Build the extension for production
- `npm run lint`: Lint the codebase
- `npm run test`: Run tests

## License

MIT 