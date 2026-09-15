function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(CONFIG.USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(CONFIG.TOKEN_KEY, token);
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
}

function logout() {
  clearAuth();
  window.location.href = 'login.html';
}

function requireAuth(allowedRoles) {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }

  if (allowedRoles && allowedRoles.length) {
    const user = getUser();
    if (!user || !allowedRoles.includes(user.role)) {
      window.location.href = 'dashboard.html';
      return false;
    }
  }

  return true;
}

function redirectIfAuthenticated() {
  if (getToken()) {
    window.location.href = 'dashboard.html';
  }
}

async function login(email, password) {
  const data = await loginRequest(email, password);
  setAuth(data.token, data.user);
  return data;
}

async function activateAccount(email, token, newPassword) {
  const data = await activateAccountRequest(email, token, newPassword);
  if (data.token) setAuth(data.token, data.user);
  return data;
}

async function setPassword(email, currentPassword, newPassword) {
  const data = await setPasswordRequest(email, currentPassword, newPassword);
  if (data.token) setAuth(data.token, data.user);
  return data;
}

function isAdmin() {
  const user = getUser();
  return user && user.role === 'admin';
}

function isSuperadmin() {
  const user = getUser();
  return user && user.role === 'superadmin';
}

function isUserOrAdmin() {
  const user = getUser();
  return user && (user.role === 'user' || user.role === 'admin' || user.role === 'superadmin');
}

function canCreateRequests() {
  return isUserOrAdmin();
}
