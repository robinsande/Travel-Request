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

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const AUTH_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_RETRY_DELAY_MS = 1200;
const MAX_RETRY_ATTEMPTS = 2;

function buildApiUrl(path) {
  const base = CONFIG.API_BASE_URL.replace(/\/+$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

function isPublicAuthPath(path) {
  return PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`));
}

function isRetryableError(status, attempt) {
  if (attempt >= MAX_RETRY_ATTEMPTS) return false;
  if (status === 0) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status <= 504) return true;
  return false;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const method = (options.method || 'GET').toUpperCase();
  const timeoutMs = isPublicAuthPath(path) ? AUTH_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;

  let lastError = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = performance.now();
    const attemptLabel = attempt > 0 ? ` retry#${attempt}` : '';
    console.info(`[timing] ${path}${attemptLabel} start (timeout=${timeoutMs}ms)`);

    const url = buildApiUrl(path);
    const headers = { ...(options.headers || {}) };
    const requestOptions = { ...options, headers };

    const token = typeof getToken === 'function' ? getToken() : null;
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    let wasTimeout = false;
    try {
      response = await fetch(url, { ...requestOptions, signal: controller.signal });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      wasTimeout = fetchError?.name === 'AbortError';
      const elapsedMs = (performance.now() - attemptStartedAt).toFixed(1);
      console.info(`[timing] ${path}${attemptLabel} ${wasTimeout ? 'timed out' : 'network failed'} after ${elapsedMs}ms`);

      const status = wasTimeout ? 408 : 0;
      lastStatus = status;
      lastError = wasTimeout
        ? new ApiError(
            `Request took too long (${Math.round(timeoutMs / 1000)}s). The service may be waking up — please retry in a moment.`,
            status,
            { network: true, timeout: true }
          )
        : new ApiError(
            `Cannot reach the API at ${CONFIG.API_BASE_URL}. Check that the backend is running and refresh, or retry in a moment.`,
            status,
            { network: true }
          );

      if (isRetryableError(status, attempt)) {
        const retryDelay = DEFAULT_RETRY_DELAY_MS * (attempt + 1);
        console.info(`[timing] ${path}${attemptLabel} will retry in ${retryDelay}ms`);
        await sleepMs(retryDelay);
        continue;
      }
      throw lastError;
    }

    clearTimeout(timeoutId);

    if (response.status === 401 && !isPublicAuthPath(path)) {
      redirectToLogin();
      throw new ApiError('Session expired. Please log in again.', 401);
    }

    const contentType = response.headers.get('content-type') || '';
    let body = null;
    try {
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else if (response.status !== 204) {
        body = await response.text();
      }
    } catch (parseError) {
      lastStatus = response.status;
      lastError = new ApiError(`Server returned an unreadable response (${response.status}). Please retry.`, response.status);
      if (isRetryableError(response.status, attempt)) {
        await sleepMs(DEFAULT_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      const message =
        (body && body.message) ||
        (typeof body === 'string' ? body : null) ||
        `Request failed (${response.status})`;

      lastStatus = response.status;

      if (response.status === 404 && message === 'Route not found') {
        throw new ApiError(
          `${message} — requested ${url}. Check that API_BASE_URL in js/config.js ends with /api and the backend is running.`,
          response.status,
          body
        );
      }

      lastError = new ApiError(message, response.status, body);
      if (isRetryableError(response.status, attempt) && method !== 'POST') {
        console.info(`[timing] ${path}${attemptLabel} status=${response.status}; retrying`);
        await sleepMs(DEFAULT_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    const serverTiming = response.headers.get('server-timing');
    const totalMs = (performance.now() - requestStartedAt).toFixed(1);
    const attemptMs = (performance.now() - attemptStartedAt).toFixed(1);
    console.info(
      `[timing] ${path}${attemptLabel} attempt=${attemptMs}ms total=${totalMs}ms${serverTiming ? ` server=${serverTiming}` : ''}`
    );

    return body;
  }

  throw lastError || new ApiError(`Request failed after ${MAX_RETRY_ATTEMPTS + 1} attempts`, lastStatus || 0);
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
  if (backendConnectionPromise) return backendConnectionPromise;

  backendConnectionPromise = checkBackendConnectionInternal(timeoutMs);
  return backendConnectionPromise;
}

async function checkBackendConnectionInternal(timeoutMs) {
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
    backendConnectionPromise = null;
  }
}

const BACKEND_KEEP_ALIVE_MS = 4 * 60 * 1000;
let backendKeepAliveTimer;
let backendConnectionPromise;

function pingBackendKeepAlive() {
  if (document.visibilityState !== 'visible') return;
  checkBackendConnection().catch(() => {});
}

function waitForBackendWakeUp() {
  return backendConnectionPromise || Promise.resolve();
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
  post: (path, body, options = {}) => apiRequest(path, { ...options, method: 'POST', body }),
  upload: (path, body) => apiRequest(path, { method: 'POST', body }),
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
