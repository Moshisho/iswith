# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JavaScript project that analyzes GitHub workflow logs to discover what inputs are being used in workflows. The tool helps developers understand input usage patterns for testing workflows with real-world data.

## Technology Stack

- **Language**: JavaScript with latest Node.js and npm
- **API**: GitHub REST API for fetching workflow data
- **Output**: Simple CLI table displaying input usage

## Development Commands

Since this is a new JavaScript project, these commands will need to be set up:

```bash
# Install dependencies
npm install

# Run the CLI tool
npm start

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Architecture Notes

The project should be structured to:

1. **GitHub API Integration**: Use GitHub REST API to fetch workflow runs and logs (assumes user authentication)
2. **Log Parsing**: Parse workflow logs to extract input usage patterns
3. **CLI Interface**: Simple command-line tool with table output
4. **Error Handling**: Display unauthenticated message if user lacks repo access

## Key Components to Implement

- GitHub API calls using fetch or axios (no auth client needed - assumes user is authenticated)
- Log parser to extract input references from workflow logs
- CLI argument handling for repository specification
- Simple table formatter for displaying input usage results
- Error handling for unauthenticated users

## API Considerations

- Assumes user has GitHub authentication already configured
- Will display clear error message if authentication fails
- Rate limiting considerations for GitHub API calls
- Pagination handling for workflows with many runs