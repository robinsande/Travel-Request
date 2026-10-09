/** Auth API endpoints */

const LOGIN_RETRY_DELAYS_MS = [250, 750, 1500];

function isTransientLoginError(error) {
  return [0, 408, 429, 500, 502, 503, 504].includes(error?.status);
}

async function loginRequest(email, password) {
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await api.post('/auth/login', { email, password });
    } catch (error) {
      if (!isTransientLoginError(error) || attempt === LOGIN_RETRY_DELAYS_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, LOGIN_RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function setupMfaRequest(challengeToken) {
  return api.post('/auth/mfa/setup', {}, {
    headers: { Authorization: `Bearer ${challengeToken}` },
  });
}

async function verifyMfaRequest(challengeToken, code) {
  return api.post('/auth/mfa/verify', { code }, {
    headers: { Authorization: `Bearer ${challengeToken}` },
  });
}

async function resetMfaSetupRequest(currentPassword) {
  return api.post('/auth/mfa/reset/setup', { currentPassword });
}

async function activateAccountRequest(email, token, newPassword) {
  return api.post('/auth/activate', { email, token, newPassword });
}

async function setPasswordRequest(currentPassword, newPassword) {
  return api.post('/auth/set-password', { currentPassword, newPassword });
}
