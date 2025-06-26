const https = require('https');

class GitHubClient {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;
  }

  async makeRequest(path) {
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
    return this.makeRequest(path);
  }

  async getWorkflowRuns(owner, repo, workflowId, page = 1) {
    const path = `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?page=${page}&per_page=10`;
    return this.makeRequest(path);
  }

  async getWorkflowRunLogs(owner, repo, runId) {
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