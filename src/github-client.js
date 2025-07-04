const https = require('https');
const fs = require('fs');
const { GitHubAuth } = require('./auth');

class GitHubClient {
  constructor(options = {}) {
    this.baseUrl = 'https://api.github.com';
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.appId = options.appId;
    this.privateKeyPath = options.privateKeyPath;
    this.authOptions = options;
  }

  async getAuthToken(owner) {
    if (this.token) {
      return this.token;
    }

    try {
      const token = await GitHubAuth.getAuthToken(owner, this.authOptions);
      this.token = token; // Cache for subsequent requests
      return token;
    } catch (error) {
      console.warn(`Authentication failed: ${error.message}`);
      return null;
    }
  }

  async makeRequest(path, owner = null) {
    // Try to get auth token if we have owner info and no token yet
    if (!this.token && owner) {
      await this.getAuthToken(owner);
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'iswith-workflow-analyzer',
          'Accept': 'application/vnd.github.v3+json',
          ...(this.token && { 'Authorization': `token ${this.token}` })
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API error: ${res.statusCode} ${res.statusMessage}`));
            return;
          }

          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.end();
    });
  }

  async getWorkflows(owner, repo) {
    const path = `/repos/${owner}/${repo}/actions/workflows`;
    return this.makeRequest(path, owner);
  }

  async getWorkflowRuns(owner, repo, workflowId, page = 1) {
    const path = `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?page=${page}&per_page=10`;
    return this.makeRequest(path, owner);
  }

  async downloadFirstDataChunk(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';
        let counter = 0;
        
        res.on('data', (chunk) => {
          counter++;
          // fs.appendFileSync('debug.log', chunk.toString());
          // console.log(`chunk ${counter} (20 chars): ${chunk.toString().slice(0,20)}`);
          
          if (chunk.toString().includes('##[group] Inputs')) {
            // TODO: Limit to first chunck to decrease scope until we sort out 
            // a solution for more job types. The "Set up job" inputs section 
            // typically appears early in the logs.
            console.log('resolving...');
            data = chunk.toString();
            resolve(chunk.toString());
            return;
          }
        });

        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Log download failed: ${error.message}`));
      });
    });
  }

  async getWorkflowFile(owner, repo, workflowPath) {
    // Remove .github/workflows/ prefix if present and ensure .yml/.yaml extension
    const cleanPath = workflowPath.replace(/^\.github\/workflows\//, '');
    const path = `/repos/${owner}/${repo}/contents/.github/workflows/${cleanPath}`;
    
    try {
      const response = await this.makeRequest(path, owner);
      if (response.content) {
        // Decode base64 content
        return Buffer.from(response.content, 'base64').toString('utf8');
      }
      throw new Error('No content found in workflow file');
    } catch (error) {
      throw new Error(`Failed to fetch workflow file: ${error.message}`);
    }
  }

  async getWorkflowJobs(owner, repo, runId) {
    const path = `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
    return this.makeRequest(path, owner);
  }

  async getJobLogs(owner, repo, jobId) {
    const path = `/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`;
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'iswith-workflow-analyzer',
          'Accept': 'application/vnd.github.v3+json',
          ...(this.token && { 'Authorization': `token ${this.token}` })
        }
      };

      const req = https.request(options, async (res) => {
        let data = '';
        if (res.statusCode === 302 && res.headers.location) {
          data = await this.downloadFirstDataChunk(res.headers.location);
          // console.debug(`data after downloadFirstDataChunk: ${data}`);
          resolve(data);
        } else if (res.statusCode >= 400) {
          reject(new Error(`GitHub API error: ${res.statusCode} ${res.statusMessage}`));
        } else {
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }
      });

      req.on('error', (error) => {
        reject(new Error(`Job log request failed: ${error.message}`));
      });

      req.end();
    });
  }
}

module.exports = { GitHubClient };