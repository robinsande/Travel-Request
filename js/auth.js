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
  window.location.replace('./');
}

function requireAuth(allowedRoles) {
  const token = getToken();
  if (!token) {
    window.location.replace('login.html');
    return false;
  }

  const user = getUser();
  const isProfilePage = window.location.pathname.endsWith('/profile.html') || window.location.pathname.endsWith('profile.html');
  if (user?.mustSetPassword && !isProfilePage) {
    window.location.replace('profile.html');
    return false;
  }

  if (allowedRoles && allowedRoles.length) {
    if (!user || !allowedRoles.includes(user.role)) {
      window.location.replace('dashboard.html');
      return false;
    }
  }

  return true;
}

function redirectIfAuthenticated() {
  if (getToken()) {
    window.location.replace(getUser()?.mustSetPassword ? 'profile.html' : 'dashboard.html');
  }
}

async function login(email, password) {
  const data = await loginRequest(email, password);
  setAuth(data.token, data.user);
  return data;
}

async function register(name, email, password) {
  return registerRequest(name, email, password);
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
