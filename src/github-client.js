const https = require('https');
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

  async getWorkflowRunLogs(owner, repo, runId) {
    // Ensure we have auth token for log access
    if (!this.token) {
      await this.getAuthToken(owner);
    }

    const path = `/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
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
        if (res.statusCode === 302 && res.headers.location) {
          // Follow redirect to download logs
          this.downloadLogs(res.headers.location).then(resolve).catch(reject);
        } else if (res.statusCode >= 400) {
          reject(new Error(`GitHub API error: ${res.statusCode} ${res.statusMessage}`));
        } else {
          reject(new Error('Unexpected response format'));
        }
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.end();
    });
  }

  async downloadLogs(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
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
}

module.exports = { GitHubClient };