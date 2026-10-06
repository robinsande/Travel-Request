const LAST_AUTHENTICATED_PAGE_KEY = 'tar_last_authenticated_page';

function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY);
}

function getLastAuthenticatedPage() {
  const savedPage = localStorage.getItem(LAST_AUTHENTICATED_PAGE_KEY);
  if (!savedPage) return null;

  try {
    const pageUrl = new URL(savedPage, window.location.origin);
    if (
      pageUrl.origin !== window.location.origin ||
      !pageUrl.pathname.endsWith('.html') ||
      ['/index.html', '/login.html', '/activate.html'].includes(pageUrl.pathname)
    ) {
      return null;
    }

    return `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`;
  } catch {
    return null;
  }
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
  localStorage.removeItem(LAST_AUTHENTICATED_PAGE_KEY);
}

function logout() {
  document.dispatchEvent(new CustomEvent('before-app-logout'));
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

  const currentPage = new URL(window.location.href);
  if (currentPage.pathname.endsWith('.html')) {
    localStorage.setItem(
      LAST_AUTHENTICATED_PAGE_KEY,
      `${currentPage.pathname}${currentPage.search}${currentPage.hash}`
    );
  }

  return true;
}

function redirectIfAuthenticated() {
  if (getToken()) {
    const destination = getUser()?.mustSetPassword
      ? 'profile.html'
      : getLastAuthenticatedPage() || 'dashboard.html';
    window.location.replace(destination);
  }
}

async function login(email, password) {
  const data = await loginRequest(email, password);
  if (data.token) setAuth(data.token, data.user);
  return data;
}

async function verifyMfaLogin(challengeToken, code) {
  const data = await verifyMfaRequest(challengeToken, code);
  setAuth(data.token, data.user);
  return data;
}

async function activateAccount(email, token, newPassword) {
  const data = await activateAccountRequest(email, token, newPassword);
  if (data.token) setAuth(data.token, data.user);
  return data;
}

async function setPassword(currentPassword, newPassword) {
  const data = await setPasswordRequest(currentPassword, newPassword);
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

function isSuperSuperadmin() {
  const user = getUser();
  return user && user.role === 'super_superadmin';
}

function canViewAllRequests() {
  const user = getUser();
  return Boolean(user && ['superadmin', 'super_superadmin'].includes(user.role));
}

function isUserOrAdmin() {
  const user = getUser();
  return user && ['user', 'admin', 'approver_budget_holder', 'superadmin'].includes(user.role);
}

function canCreateRequests() {
  return isUserOrAdmin();
}
