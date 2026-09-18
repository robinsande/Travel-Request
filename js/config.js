/**
 * API and app configuration.
 *
 * Defaults live here (vanilla static frontend — no CRA/Vite bundler).
 * Override at runtime with ?apiBase=https://host/api (persisted in localStorage).
 * Hosted deployments can inject window.__CARE_API_BASE__ before this script runs.
 */

const CONFIG_VERSION = '5';
const CONFIG_VERSION_KEY = 'tar_config_version';
const DEFAULT_API_BASE_URL = 'https://tar-backend.onrender.com/api';

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed.endsWith('/api')) {
    return `${trimmed}/api`;
  }
  return trimmed;
}

function getDefaultApiBaseUrl() {
  if (typeof window !== 'undefined' && window.__CARE_API_BASE__) {
    return normalizeApiBaseUrl(window.__CARE_API_BASE__) || DEFAULT_API_BASE_URL;
  }
  return DEFAULT_API_BASE_URL;
}

function resolveApiBaseUrl() {
  if (localStorage.getItem(CONFIG_VERSION_KEY) !== CONFIG_VERSION) {
    localStorage.removeItem('tar_api_base_url');
    localStorage.setItem(CONFIG_VERSION_KEY, CONFIG_VERSION);
  }

  // Optional override: ?apiBase=https://example.onrender.com/api
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('apiBase');
  if (fromQuery) {
    const normalized = normalizeApiBaseUrl(fromQuery);
    if (normalized) {
      localStorage.setItem('tar_api_base_url', normalized);
      return normalized;
    }
  }

  const fromStorage = localStorage.getItem('tar_api_base_url');
  if (fromStorage) {
    const normalized = normalizeApiBaseUrl(fromStorage);
    if (normalized) return normalized;
  }

  return getDefaultApiBaseUrl();
}

const CONFIG = {
  API_BASE_URL: resolveApiBaseUrl(),
  TOKEN_KEY: 'tar_token',
  USER_KEY: 'tar_user',
  NOTIFICATION_POLL_MS: 60_000,
};

/** Public auth paths — 401 here means bad credentials, not expired session */
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/activate', '/auth/set-password'];
