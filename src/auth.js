const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');

class GitHubAuth {
  constructor() {
    this.installationTokenCache = new Map();
  }

  createJWT(appId, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago
      exp: now + (10 * 60), // Expires in 10 minutes
      iss: appId
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.github.com',
        path: path,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'iswith-workflow-analyzer',
          'Accept': 'application/vnd.github.v3+json',
          ...options.headers
        }
      };

      const req = https.request(requestOptions, (res) => {
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

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async getInstallationId(appId, privateKey, owner) {
    const jwtToken = this.createJWT(appId, privateKey);
    
    try {
      const installations = await this.makeRequest('/app/installations', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      for (const installation of installations) {
        if (installation.account.login === owner) {
          return installation.id;
        }
      }

      throw new Error(`No installation found for owner: ${owner}`);
    } catch (error) {
      throw new Error(`Failed to get installation ID: ${error.message}`);
    }
  }

  async getInstallationToken(appId, privateKey, installationId) {
    const cacheKey = `${appId}-${installationId}`;
    const cached = this.installationTokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const jwtToken = this.createJWT(appId, privateKey);
    
    try {
      const response = await this.makeRequest(`/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      const expiresAt = new Date(response.expires_at).getTime() - (5 * 60 * 1000); // 5 minutes buffer
      this.installationTokenCache.set(cacheKey, {
        token: response.token,
        expiresAt: expiresAt
      });

      return response.token;
    } catch (error) {
      throw new Error(`Failed to get installation token: ${error.message}`);
    }
  }

  async getAppToken(appId, privateKeyPath, owner) {
    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      const installationId = await this.getInstallationId(appId, privateKey, owner);
      const token = await this.getInstallationToken(appId, privateKey, installationId);
      return token;
    } catch (error) {
      throw new Error(`GitHub App authentication failed: ${error.message}`);
    }
  }

  static determineAuthMethod() {
    if (process.env.GITHUB_TOKEN) {
      return {
        type: 'token',
        token: process.env.GITHUB_TOKEN
      };
    }

    if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY_PATH) {
      return {
        type: 'app',
        appId: process.env.GITHUB_APP_ID,
        privateKeyPath: process.env.GITHUB_PRIVATE_KEY_PATH
      };
    }

    return {
      type: 'none'
    };
  }

  static async getAuthToken(owner, options = {}) {
    const auth = new GitHubAuth();
    
    if (options.token) {
      return options.token;
    }

    if (options.appId && options.privateKeyPath) {
      return await auth.getAppToken(options.appId, options.privateKeyPath, owner);
    }

    const autoAuth = GitHubAuth.determineAuthMethod();
    
    if (autoAuth.type === 'token') {
      return autoAuth.token;
    }

    if (autoAuth.type === 'app') {
      return await auth.getAppToken(autoAuth.appId, autoAuth.privateKeyPath, owner);
    }

    return null; // No authentication available
  }
}

module.exports = { GitHubAuth };