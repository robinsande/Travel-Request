/**
 * HTTP client for the CARE API.
 * All network I/O goes through here — pages and UI helpers must not call fetch directly.
 */

const ApiError = class extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
};

function buildApiUrl(path) {
  const base = CONFIG.API_BASE_URL.replace(/\/+$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

function isPublicAuthPath(path) {
  return PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`));
}

/** Detect if we're in a flat HTML page context */
function pathIncludesHtml() {
  return window.location.pathname.endsWith('.html') || !window.location.pathname.includes('/frontend/');
}

function redirectToLogin() {
  if (typeof clearAuth === 'function') clearAuth();
  const loginPath = pathIncludesHtml() ? 'login.html' : '/frontend/login.html';
  window.location.href = loginPath;
}

async function performApiRequest(path, options = {}) {
  const requestStartedAt = performance.now();
  console.info(`[timing] ${path} start`);
  const url = buildApiUrl(path);
  const headers = { ...(options.headers || {}) };

  const token = typeof getToken === 'function' ? getToken() : null;
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    console.info(`[timing] ${path} network failed after ${(performance.now() - requestStartedAt).toFixed(1)}ms`);
    throw new ApiError(
      `Cannot reach the API at ${CONFIG.API_BASE_URL}. Start the backend (npm start in care-travel-request-backend) and refresh.`,
      0,
      { network: true }
    );
  }

  if (response.status === 401 && !isPublicAuthPath(path)) {
    redirectToLogin();
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else if (response.status !== 204) {
    body = await response.text();
  }

  if (!response.ok) {
    const message =
      (body && body.message) ||
      (typeof body === 'string' ? body : null) ||
      `Request failed (${response.status})`;

    if (response.status === 404 && message === 'Route not found') {
      throw new ApiError(
        `${message} — requested ${url}. Check that API_BASE_URL in js/config.js ends with /api and the backend is running.`,
        response.status,
        body
      );
    }

    throw new ApiError(message, response.status, body);
  }

  const serverTiming = response.headers.get('server-timing');
  console.info(
    `[timing] ${path} client=${(performance.now() - requestStartedAt).toFixed(1)}ms${serverTiming ? ` server=${serverTiming}` : ''}`
  );

  return body;
}

async function apiRequest(path, options = {}) {
  if (typeof beginSync === 'function') beginSync();

  try {
    return await performApiRequest(path, options);
  } finally {
    if (typeof endSync === 'function') endSync();
  }
}

/** Treat localhost and 127.0.0.1 as the same host for FRONTEND_URL checks */
function normalizeOriginForCompare(origin) {
  try {
    const url = new URL(origin);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      url.hostname = 'localhost';
    }
    return url.origin;
  } catch {
    return origin;
  }
}

/** Verify backend is reachable (GET /api/health) */
async function checkBackendConnection(timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildApiUrl('/health'), { method: 'GET', signal: controller.signal });
    if (!response.ok) return { ok: false, url: CONFIG.API_BASE_URL };
    const data = await response.json();
    const frontendOrigin = window.location.origin;
    const backendFrontendOrigin = data.frontendUrl
      ? new URL(data.frontendUrl).origin
      : null;
    const frontendUrlMismatch =
      backendFrontendOrigin &&
      normalizeOriginForCompare(backendFrontendOrigin) !== normalizeOriginForCompare(frontendOrigin);

    return {
      ok: data.status === 'ok',
      url: CONFIG.API_BASE_URL,
      data,
      frontendOrigin,
      backendFrontendUrl: data.frontendUrl || null,
      frontendUrlMismatch,
    };
  } catch {
    return { ok: false, url: CONFIG.API_BASE_URL };
  } finally {
    clearTimeout(timeoutId);
  }
}

const BACKEND_KEEP_ALIVE_MS = 4 * 60 * 1000;
let backendKeepAliveTimer;

function pingBackendKeepAlive() {
  if (document.visibilityState !== 'visible') return;
  checkBackendConnection().catch(() => {});
}

function startBackendKeepAlive() {
  pingBackendKeepAlive();
  backendKeepAliveTimer = setInterval(pingBackendKeepAlive, BACKEND_KEEP_ALIVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pingBackendKeepAlive();
  });
}

if (typeof document !== 'undefined') startBackendKeepAlive();

const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};

async function performDownloadFile(path, filenameFallback = 'download.pdf') {
  const url = buildApiUrl(path);
  const headers = {};
  const token = typeof getToken === 'function' ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${CONFIG.API_BASE_URL}. Start the backend and refresh.`,
      0,
      { network: true }
    );
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    const message = body?.message || (typeof body === 'string' ? body : 'Download failed');
    throw new ApiError(message, response.status, body);
  }

  const blob = await response.blob();
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || filenameFallback;

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadFile(path, filenameFallback = 'download.pdf') {
  if (typeof beginSync === 'function') beginSync('Downloading');

  try {
    return await performDownloadFile(path, filenameFallback);
  } finally {
    if (typeof endSync === 'function') endSync();
  }
}

async function viewFile(path) {
  const viewer = window.open('', '_blank');
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    const response = await fetch(buildApiUrl(path), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Unable to open document (${response.status})`);
    const blobUrl = URL.createObjectURL(await response.blob());
    if (viewer) viewer.location = blobUrl;
    else window.open(blobUrl, '_blank');
  } catch (error) {
    viewer?.close();
    throw error;
  }
}
