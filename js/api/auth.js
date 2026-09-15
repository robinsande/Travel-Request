/** Auth API endpoints */

async function loginRequest(email, password) {
  return api.post('/auth/login', { email, password });
}

async function activateAccountRequest(email, token, newPassword) {
  return api.post('/auth/activate', { email, token, newPassword });
}

async function setPasswordRequest(email, currentPassword, newPassword) {
  return api.post('/auth/set-password', { email, currentPassword, newPassword });
}
