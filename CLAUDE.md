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

# Build cross-platform binaries
npm run build:pkg
```

## Testing GitHub Workflows Locally

This project includes GitHub Actions workflows that can be tested locally using the `act` tool:

```bash
# Install act (if not already installed)
brew install act  # macOS
# or download from: https://github.com/nektos/act

# List all available workflows and jobs
act --list

# Test the CI workflow (requires Docker)
act push                    # Run full CI workflow
act --job test             # Run only test job
act --job build            # Run only build job

# Test with specific event
act pull_request           # Test PR workflow

# Dry run to see what would execute
act --dryrun

# Use specific runner image
act --platform ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Note**: The `.actrc` file is configured for Apple Silicon Macs with `--container-architecture linux/amd64`.

## Authentication

The tool supports multiple authentication methods for accessing GitHub repositories and workflow logs:

### 1. Personal Access Token
```bash
# Environment variable
export GITHUB_TOKEN=ghp_your_token_here
iswith owner/repo

# Command line flag
iswith --token ghp_your_token_here owner/repo
```

### 2. GitHub App (Recommended for Organizations)
```bash
# Environment variables
export GITHUB_APP_ID=123456
export GITHUB_PRIVATE_KEY_PATH=/path/to/private-key.pem
iswith owner/repo

# Command line flags
iswith --app-id 123456 --private-key ./private-key.pem owner/repo
```

### 3. No Authentication
```bash
# Limited to public repositories and publicly accessible workflow data
iswith owner/repo
```

## GitHub App Setup

To create a GitHub App for enhanced authentication:

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Create a new GitHub App with these permissions:
   - Repository permissions:
     - Actions: Read
     - Metadata: Read
3. Generate and download a private key
4. Install the app on repositories or organizations
5. Use the App ID and private key path with the CLI

**Benefits of GitHub App authentication:**
- Higher rate limits (5,000 requests/hour vs 60 unauthenticated)
- Organization-level access management
- More secure than personal access tokens
- Better audit trails

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