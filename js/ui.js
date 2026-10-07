const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  DRAFT: 'Draft',
  SUBMITTED_TO_SUPERVISOR: 'Awaiting Supervisor',
  SUPERVISOR_REVIEW: 'Supervisor reviewing',
  SUPERVISOR_APPROVED: 'Supervisor approved',
  SUPERVISOR_DECLINED: 'Supervisor declined',
  SUBMITTED_TO_LINE_MANAGER: 'Awaiting Line Manager',
  LINE_MANAGER_REVIEW: 'Line Manager reviewing',
  LINE_MANAGER_APPROVED: 'Line Manager approved',
  LINE_MANAGER_DECLINED: 'Line Manager declined',
  SUBMITTED_TO_FINANCE: 'Awaiting Finance',
  FINANCE_REVIEW: 'Finance reviewing',
  FINANCE_APPROVED: 'Finance approved',
  FINANCE_DECLINED: 'Finance declined',
  PAYMENT_PROCESSING: 'Payment processing',
  COMPLETED: 'Completed',
};

function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--fade');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

let activeSyncRequests = 0;
let syncStatusTimer = null;

function renderSyncStatus(state = 'ready', label = '') {
  const indicator = document.getElementById('sync-status');
  if (!indicator) return;

  const labelElement = indicator.querySelector('.sync-status__label');
  indicator.className = `sync-status sync-status--${state}`;
  indicator.setAttribute('aria-busy', state === 'syncing' ? 'true' : 'false');
  if (labelElement) labelElement.textContent = label || (state === 'syncing' ? 'Syncing' : 'Up to date');
}

function beginSync(label = 'Syncing') {
  activeSyncRequests += 1;
  if (syncStatusTimer) clearTimeout(syncStatusTimer);
  renderSyncStatus('syncing', label);
}

function endSync() {
  activeSyncRequests = Math.max(0, activeSyncRequests - 1);
  if (activeSyncRequests > 0) return;

  renderSyncStatus('ready');
  syncStatusTimer = setTimeout(() => renderSyncStatus('idle'), 1800);
}

function showValidationToast(message) {
  showToast(message, 'error', 5000);
}

function setLoading(button, loading, loadingText = 'Please wait…') {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.classList.add('is-loading');
    button.textContent = loadingText;
    return;
  }

  button.disabled = false;
  button.classList.remove('is-loading');
  button.textContent = button.dataset.originalText || button.textContent;
}

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge badge--${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  if (value == null) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return escapeHtml(dateStr);

  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return escapeHtml(dateStr);

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount, currency = 'KSH') {
  const value = Number(amount || 0);
  if (Number.isNaN(value)) return `${currency} 0.00`;

  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderApiErrors(container, error) {
  if (!container) return;

  clearPageLoading(container);
  container.hidden = true;
  container.innerHTML = '';

  const messages = [];

  if (error instanceof ApiError) {
    messages.push(error.message);

    const body = error.body;
    if (body?.network) {
      messages.push('Ensure the backend is running on port 5000.');
    }
    if (body?.details?.code === 'ACCOUNT_NOT_ACTIVATED') {
      messages.push('Please check your email for the activation link.');
    }
    if (body?.errors && Array.isArray(body.errors)) {
      body.errors.forEach((item) => {
        if (typeof item === 'string') {
          messages.push(item);
        } else if (item.msg) {
          messages.push(item.path ? `${item.path}: ${item.msg}` : item.msg);
        } else if (item.message) {
          messages.push(item.message);
        } else if (item.field && item.msg) {
          messages.push(`${item.field}: ${item.msg}`);
        } else {
          messages.push(JSON.stringify(item));
        }
      });
    }
    if (body?.details && typeof body.details === 'string') {
      messages.push(body.details);
    }
  } else if (error?.message) {
    messages.push(error.message);
  } else {
    messages.push('An unexpected error occurred.');
  }

  if (!messages.length) return;

  container.hidden = false;
  container.innerHTML = `<ul>${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
  showValidationToast(messages[0]);
}

function debounce(fn, delay = 300) {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function buildSearchableSelect(container, options, config = {}) {
  const {
    placeholder = 'Search and select…',
    hiddenInputName = 'selectedValue',
    selectedValue = '',
    selectedLabel = '',
    onChange,
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-select';

  const inputId = `searchable-select-${Math.random().toString(36).slice(2, 10)}`;
  const menuId = `${inputId}-menu`;

  wrapper.innerHTML = `
    <input type="hidden" name="${escapeHtml(hiddenInputName)}" value="${escapeHtml(selectedValue)}" />
    <input
      type="text"
      id="${inputId}"
      class="searchable-select__input"
      placeholder="${escapeHtml(placeholder)}"
      value="${escapeHtml(selectedLabel)}"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="false"
      aria-controls="${menuId}"
    />
    <div class="searchable-select__menu" id="${menuId}" role="listbox" hidden></div>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  const hidden = wrapper.querySelector('input[type="hidden"]');
  const input = wrapper.querySelector('.searchable-select__input');
  const menu = wrapper.querySelector('.searchable-select__menu');

  function renderMenu(filter = '') {
    const phrase = filter.trim().toLowerCase();
    const filtered = options.filter((option) => option.label.toLowerCase().includes(phrase));

    if (!filtered.length) {
      menu.innerHTML = '<div class="searchable-select__empty" role="status">No matches found</div>';
    } else {
      menu.innerHTML = filtered
        .map(
          (option) =>
            `<button type="button" class="searchable-select__option" role="option" data-value="${escapeHtml(option.value)}" data-label="${escapeHtml(option.label)}">${escapeHtml(option.label)}</button>`
        )
        .join('');
    }

    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');

    menu.querySelectorAll('.searchable-select__option').forEach((button) => {
      let committed = false;
      const selectOption = () => {
        if (committed) return;
        committed = true;
        hidden.value = String(button.dataset.value || '');
        input.value = button.dataset.label || '';
        menu.hidden = true;
        input.setAttribute('aria-expanded', 'false');

        if (typeof onChange === 'function') {
          onChange(button.dataset.value, button.dataset.label);
        }
      };

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        selectOption();
      });
      button.addEventListener('click', selectOption);
    });
  }

  input.addEventListener('focus', () => renderMenu(input.value));

  input.addEventListener('input', () => {
    hidden.value = '';
    renderMenu(input.value);

    if (typeof onChange === 'function') {
      onChange('', input.value);
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const firstOption = menu.querySelector('.searchable-select__option');
    if (!menu.hidden && firstOption) {
      event.preventDefault();
      firstOption.click();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      menu.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }, 150);
  });

  return {
    setOptions(nextOptions) {
      options = nextOptions;
      renderMenu(input.value);
    },
    setValue(value, label) {
      hidden.value = value || '';
      input.value = label || '';
    },
    getValue() {
      return hidden.value;
    },
    getInput() {
      return input;
    },
  };
}

async function showBackendConnectionStatus(containerId) {
  const container = document.getElementById(containerId);
  if (!container || typeof checkBackendConnection !== 'function') return;

  const result = await checkBackendConnection();

  if (result.ok && !result.frontendUrlMismatch) {
    container.hidden = true;
    return;
  }

  if (result.ok && result.frontendUrlMismatch) {
    container.hidden = false;
    container.className = 'alert alert--warning';
    container.innerHTML = `
      <strong>Backend connected, but activation links may be wrong.</strong>
      <ul>
        <li>You are on: <code>${escapeHtml(result.frontendOrigin)}</code></li>
        <li>Backend FRONTEND_URL: <code>${escapeHtml(result.backendFrontendUrl)}</code></li>
        <li>Update the backend .env value and restart the service.</li>
      </ul>
    `;
    return;
  }

  container.hidden = false;
  container.className = 'alert alert--error';
  container.innerHTML = `
    <strong>Backend connection failed.</strong>
    <ul>
      <li>Expected API: <code>${escapeHtml(result.url)}</code></li>
      <li>Confirm the Render service is running and that its health endpoint returns OK.</li>
      <li>Check the browser console for a CORS or blocked-network message.</li>
      <li>For local development, add ?apiBase=http://127.0.0.1:5000/api to this page.</li>
    </ul>
  `;
}

function showEmptyState(container, message, actionHtml = '') {
  clearPageLoading(container);
  container.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(message)}</p>
      ${actionHtml}
    </div>
  `;
}

const PAGE_LOADING_TIMEOUT_MS = 20_000;
const pageLoadingTimers = new WeakMap();

function clearPageLoadingTimer(container) {
  const existing = pageLoadingTimers.get(container);
  if (existing) {
    clearTimeout(existing);
    pageLoadingTimers.delete(container);
  }
}

function showPageLoading(container, message = 'Loading…', options = {}) {
  clearPageLoadingTimer(container);
  const slowAfterMs = options.slowAfterMs || PAGE_LOADING_TIMEOUT_MS;
  const retryAction = options.retryAction;
  const retryLabel = options.retryLabel || 'Try again';

  container.innerHTML = `
    <div class="page-loading" role="status" aria-live="polite" data-loading-state="loading">
      <span class="page-loading__orb" aria-hidden="true"><span></span></span>
      <div class="page-loading__copy">
        <strong class="page-loading__title">${escapeHtml(message)}</strong>
        <span class="page-loading__subtitle">Securing the latest information</span>
        <div class="page-loading__slow" hidden>
          <p>This is taking longer than expected. The service may be waking up from idle.</p>
          ${retryAction ? `<button type="button" class="btn btn--secondary btn--sm page-loading__retry" style="margin-top:0.75rem;">${escapeHtml(retryLabel)}</button>` : ''}
        </div>
      </div>
    </div>`;

  const slowEl = container.querySelector('.page-loading__slow');
  const retryBtn = container.querySelector('.page-loading__retry');
  if (retryBtn && typeof retryAction === 'function') {
    retryBtn.addEventListener('click', () => {
      clearPageLoadingTimer(container);
      try { retryAction(); } catch (e) { console.error(e); }
    });
  }

  const timer = setTimeout(() => {
    if (slowEl) {
      slowEl.hidden = false;
      const titleEl = container.querySelector('.page-loading__title');
      if (titleEl) titleEl.textContent = `${message} (still loading…)`;
      const stateEl = container.querySelector('[data-loading-state]');
      if (stateEl) stateEl.setAttribute('data-loading-state', 'slow');
    }
  }, slowAfterMs);
  pageLoadingTimers.set(container, timer);
}

function clearPageLoading(container) {
  clearPageLoadingTimer(container);
}

function initProtectedPage(activeNav, contentSelector = '#page-content') {
  rememberAndMaskPageUrl();
  renderAppShell(activeNav);
  mountPageContent(contentSelector);
}

function rememberAndMaskPageUrl() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!currentPath || currentPath === '/' || currentPath === '/index.html') return;

  sessionStorage.setItem('tar_resume_path', currentPath);
  window.history.replaceState({}, document.title, '/');
}

function unwrapListResult(result, fallbackKeys = []) {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== 'object') return [];

  const keys = Array.isArray(fallbackKeys) ? fallbackKeys : [fallbackKeys];
  for (const key of ['data', ...keys]) {
    if (Array.isArray(result[key])) {
      return result[key];
    }
  }

  return [];
}

function getEntityId(entity) {
  return entity?.id || entity?._id || '';
}

function formatManagerLabel(user) {
  if (user?.manager?.name) return user.manager.name;
  if (user?.manager?.email) return user.manager.email;
  if (user?.managerEmail) return user.managerEmail;
  return null;
}

function isUserPassengerOnRequest(request, userId) {
  const uid = String(userId || '');
  if (!uid) return false;

  return (request.passengers || []).some((pass) => {
    const passengerId = getEntityId(pass.user) || (typeof pass.user === 'string' ? pass.user : '');
    return String(passengerId) === uid;
  });
}

function getSelectedApproverId(entity) {
  const value = entity?.selected_approver_id || entity?.approver;
  if (!value) return '';
  if (typeof value === 'string') return value;
  return getEntityId(value);
}

function mapApproverOption(person) {
  return {
    value: getEntityId(person),
    label: `${person.name} (${person.email})`,
  };
}

function mapPassengerOption(person) {
  const emp = person.employeeNumber ? ` · ${person.employeeNumber}` : '';
  return {
    value: getEntityId(person),
    label: `${person.name} (${person.email})${emp}`,
    name: person.name || '',
    employeeNumber: person.employeeNumber || '',
  };
}

async function loadApproverSelect(container, config = {}) {
  const {
    selectedId = '',
    hiddenInputName = 'selected_approver_id',
    placeholder = 'Search approvers…',
    errorContainer = null,
    excludeIds = [],
    onLoaded = null,
    multiple = false,
    autoSelectFirst = false,
  } = config;

  try {
    const approvers = await fetchApprovers();
    const excluded = new Set((excludeIds || []).map(String).filter(Boolean));
    const options = unwrapListResult(approvers)
      .map(mapApproverOption)
      .filter((option) => !excluded.has(String(option.value)));
    if (multiple) {
      const selectedIds = new Set((Array.isArray(selectedId) ? selectedId : [selectedId]).map(String));
      container.innerHTML = `<select class="form-control" name="${escapeHtml(hiddenInputName)}" multiple size="${Math.min(Math.max(options.length, 3), 8)}" aria-label="${escapeHtml(placeholder)}">${options.map((option) => `<option value="${escapeHtml(option.value)}"${selectedIds.has(String(option.value)) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select><p class="form-hint">Hold Ctrl (Windows) or Command (Mac) to select more than one approver.</p>`;
      return container.querySelector('select');
    }
    const selected = options.find((option) => String(option.value) === String(selectedId)) || (autoSelectFirst ? options[0] : null);

    const select = buildSearchableSelect(container, options, {
      hiddenInputName,
      placeholder,
      selectedValue: selected?.value || '',
      selectedLabel: selected?.label || '',
    });

    if (typeof onLoaded === 'function') {
      onLoaded(select, options);
    }

    return select;
  } catch (err) {
    if (errorContainer) {
      renderApiErrors(errorContainer, err);
      return null;
    }

    showToast(err.message || 'Failed to load approvers.', 'error');
    throw err;
  }
}

async function withLoading(button, loadingText, action) {
  setLoading(button, true, loadingText);

  try {
    return await action();
  } finally {
    setLoading(button, false);
  }
}

async function runDecisionAction(button, options) {
  const { confirmMessage, loadingText, action, successMessage, errorMessage, onSuccess } = options;

  if (!confirmAction(confirmMessage)) return;

  try {
    await withLoading(button, loadingText, action);
    showToast(successMessage, 'success');

    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  } catch (err) {
    showToast(err.message || errorMessage, 'error');
  }
}

function requireSelectedApprover(errorContainer, selectedApproverId) {
  if (Array.isArray(selectedApproverId) ? selectedApproverId.length : selectedApproverId) return true;
  renderApiErrors(errorContainer, { message: 'Please select an approver.' });
  return false;
}

function hasSelectedTravelMode(modeOfTravel) {
  return !!(
    modeOfTravel?.careVehicle ||
    modeOfTravel?.publicTransport ||
    modeOfTravel?.aircraft
  );
}

function requireSelectedTravelMode(errorContainer, modeOfTravel) {
  if (hasSelectedTravelMode(modeOfTravel)) return true;
  renderApiErrors(errorContainer, { message: 'Please select at least one mode of travel.' });
  return false;
}

function buildManagerAssignmentError(error) {
  if (!(error instanceof ApiError)) return null;

  const message = error.message || '';
  const bodyMessage = error.body?.message || '';
  const combinedMessage = `${message} ${bodyMessage}`.toLowerCase();

  if (!combinedMessage.includes('manager')) return null;

  return {
    message: `${message} Please contact HR to have your manager assigned in the system.`,
  };
}

function getNavItems() {
  const user = getUser();
  if (!user) return [];

  const items = [{ href: 'dashboard.html', label: 'Dashboard', id: 'dashboard' }];

  if (user.role === 'superadmin') {
    items.push(
      { href: 'requests.html', label: 'My Travel Requests', id: 'my-requests' },
      { href: 'requests.html?scope=all', label: 'All Travel Requests', id: 'all-requests' },
      { href: 'approvals.html', label: 'All Approvals', id: 'approvals' },
      { href: 'reimbursements.html', label: 'My Reimbursements', id: 'my-reimbursements' },
      { href: 'reimbursements.html?scope=all', label: 'All Reimbursements', id: 'all-reimbursements' },
      { href: 'admin-users.html', label: 'Users', id: 'admin-users' }
    );
  } else if (user.role === 'super_superadmin') {
    items.push(
      { href: 'requests.html?scope=mine', label: 'My Travel Requests', id: 'my-requests' },
      { href: 'requests.html?scope=all&status=approved', label: 'Approved TARs', id: 'all-requests' },
      { href: 'reimbursements.html', label: 'My Reimbursements', id: 'my-reimbursements' },
      { href: 'reimbursements.html?scope=all', label: 'All Reimbursements', id: 'all-reimbursements' }
    );
  } else {
    items.push(
      { href: 'requests.html', label: 'My Travel Requests', id: 'my-requests' }
    );

    if (['admin', 'approver_budget_holder'].includes(user.role)) {
      items.push(
        { href: 'approvals.html', label: 'Approvals', id: 'approvals' },
        { href: 'requests.html?scope=team', label: 'Team TARs', id: 'team-requests' }
      );
    }

    if (
      ['admin', 'approver_budget_holder'].includes(user.role) ||
      (user.roles || []).some((role) => ['supervisor', 'finance_admin'].includes(role))
    ) {
      items.push({
        href: 'reimbursement-approvals.html',
        label: 'Reimbursement Approvals',
        id: 'reimbursement-approvals',
      });
    }

    if (user.role === 'user') {
      items.push({ href: 'approvals.html#budget-holder-approvals-section', label: 'Budget Holder Approvals', id: 'approvals' });
    }
  }

  if (
    canCreateRequests() &&
    !items.some((item) => item.id === 'my-reimbursements')
  ) {
    items.push({
      href: 'reimbursements.html',
      label: 'My Reimbursements',
      id: 'my-reimbursements',
    });
  }

  if (user.roles?.includes('auditor')) {
    const allRequestsItem = items.find((item) => item.id === 'all-requests');
    if (!allRequestsItem || allRequestsItem.href.includes('status=approved')) {
      const auditRequestsItem = {
        href: 'requests.html?scope=all',
        label: 'Audit all TARs',
        id: 'all-requests',
      };
      if (allRequestsItem) {
        items[items.indexOf(allRequestsItem)] = auditRequestsItem;
      } else {
        items.push(auditRequestsItem);
      }
    }
    if (!items.some((item) => item.id === 'all-reimbursements')) {
      items.push({
        href: 'reimbursements.html?scope=all',
        label: 'Audit all Reimbursements',
        id: 'all-reimbursements',
      });
    }
  }

  items.push({ href: 'profile.html', label: 'My Profile', id: 'profile' });
  return items;
}

const NAV_ICONS = {
  'all-requests': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8.5A2.5 2.5 0 0 1 19 7v9.5A2.5 2.5 0 0 1 16.5 19H8a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 8 4.5Z"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>',
  'all-reimbursements': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h7l4 4V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><path d="M14 4.5V9h4"/><path d="M8 13h8M8 16h6"/></svg>',
  'admin-users': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 18v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"/><circle cx="10" cy="7" r="3"/><path d="M17 9a3 3 0 1 1 0-6"/><path d="M18 18v-1a3.5 3.5 0 0 0-2.5-3.4"/></svg>',
  'my-requests': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h7l4 4V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><path d="M14 4.5V9h4"/><path d="M8 13h8M8 16h6"/></svg>',
  'my-reimbursements': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  approvals: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 3 3 5-7"/><circle cx="12" cy="12" r="8.5"/></svg>',
  'reimbursement-approvals': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17V7A2.5 2.5 0 0 1 6 4.5Z"/><path d="M8 9h8M8 13h5"/><path d="m14.5 16 1.5 1.5 3-3"/></svg>',
  'team-requests': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M4 18v-1a4 4 0 0 1 4-4h.5"/><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M12 18v-1a4 4 0 0 1 4-4h.5"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.5 12 4l7.5 6.5V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7.5Z"/><path d="M9.5 20v-6h5v6"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 18.5a7 7 0 0 1 14 0"/></svg>',
};

function renderPageSubnav(tabs, activeId, ariaLabel = 'Section') {
  return `
    <nav class="page-tabs" aria-label="${escapeHtml(ariaLabel)}">
      ${tabs
        .map((tab) => {
          const active = tab.id === activeId;
          return `<a href="${tab.href}" class="page-tabs__link${active ? ' page-tabs__link--active' : ''}"${active ? ' aria-current="page"' : ''}>${escapeHtml(tab.label)}</a>`;
        })
        .join('')}
    </nav>
  `;
}

function renderApprovalsSubnav(activeTab) {
  return renderPageSubnav(
    [{ id: 'travel', href: 'approvals.html', label: 'Travel Requests' }],
    activeTab,
    'Approval type'
  );
}

function renderTeamSubnav(activeTab) {
  return renderPageSubnav(
    [{ id: 'travel', href: 'requests.html?scope=team', label: 'Travel Requests' }],
    activeTab,
    'Team request type'
  );
}

function renderAdminUsersSubnav(activeTab) {
  return renderPageSubnav(
    [
      { id: 'users', href: 'admin-users.html', label: 'All Users' },
      { id: 'import', href: 'admin-import.html', label: 'Import Employees' },
    ],
    activeTab,
    'User administration'
  );
}

function setMobileNavOpen(open) {
  const shell = document.getElementById('app-shell');
  const toggle = document.getElementById('nav-toggle');
  const backdrop = document.getElementById('nav-backdrop');

  if (!shell || !toggle) return;

  shell.classList.toggle('nav-open', open);
  document.body.classList.toggle('nav-open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

  if (backdrop) {
    backdrop.hidden = !open;
  }
}

function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const backdrop = document.getElementById('nav-backdrop');
  const sidebar = document.getElementById('app-sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    const isOpen = document.getElementById('app-shell')?.classList.contains('nav-open');
    setMobileNavOpen(!isOpen);
  });

  backdrop?.addEventListener('click', () => setMobileNavOpen(false));

  sidebar.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => setMobileNavOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMobileNavOpen(false);
  });

  const mediaQuery = window.matchMedia('(min-width: 769px)');
  const closeOnDesktop = () => {
    if (mediaQuery.matches) setMobileNavOpen(false);
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', closeOnDesktop);
  } else {
    mediaQuery.addListener(closeOnDesktop);
  }
}

function renderAppShell(activeId) {
  const user = getUser();
  if (!user) return;

  const shell = document.getElementById('app-shell');
  if (!shell) return;

    rememberAndMaskPageUrl();
  const navItems = getNavItems();
  const navHtml = navItems
    .map((item) => {
      const badge = item.id === 'approvals'
        ? '<span class="nav-badge" id="approvals-badge" hidden>0</span>'
        : item.id === 'reimbursement-approvals'
          ? '<span class="nav-badge" id="reimbursement-approvals-badge" hidden>0</span>'
          : '';
      const icon = NAV_ICONS[item.id] || '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
      return `<a href="${item.href}" class="nav-link${item.id === activeId ? ' nav-link--active' : ''}" data-nav="${item.id}"${item.id === activeId ? ' aria-current="page"' : ''}><span class="nav-link__content"><span class="nav-link__icon" aria-hidden="true">${icon}</span><span class="nav-link__label">${escapeHtml(item.label)}</span></span>${badge}</a>`;
    })
    .join('');

  shell.innerHTML = `
    <header class="app-header">
      <div class="app-header__start">
        <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="app-sidebar" aria-label="Open menu">
          <span class="nav-toggle__bars" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
        </button>

        <div class="app-header__brand">
          <span class="app-header__logo">CARE</span>
          <span class="app-header__title">Travel Authorization Request</span>
        </div>
      </div>

      <div class="app-header__actions">
        <div class="sync-status sync-status--idle" id="sync-status" aria-live="polite" aria-busy="false">
          <span class="sync-status__dot" aria-hidden="true"></span>
          <span class="sync-status__label">Up to date</span>
        </div>
        <a href="notifications.html" class="notifications-link" id="notifications-badge-link" title="Notifications" aria-label="View notifications">
          <span class="notifications-icon" aria-hidden="true">🔔</span>
          <span class="notifications-badge" id="notifications-badge" hidden>0</span>
        </a>

        <div class="user-menu">
          <span class="user-menu__name">${escapeHtml(user.name)}</span>
          <span class="user-menu__role badge badge--role">${escapeHtml(user.role)}</span>
          <button type="button" class="btn btn--danger btn--sm" id="logout-btn">Log out</button>
        </div>
      </div>
    </header>

    <div class="app-body">
      <div class="nav-backdrop" id="nav-backdrop" hidden></div>

      <nav class="app-sidebar" id="app-sidebar" aria-label="Main navigation">
        <p class="app-sidebar__label">Menu</p>
        ${navHtml}
      </nav>

      <main class="app-main" id="app-main" tabindex="-1">
        <!-- page content injected by each page -->
      </main>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', logout);
  initMobileNav();

  if (typeof initNotificationBadge === 'function') {
    initNotificationBadge();
  }
}

function mountPageContent(contentSelector) {
  const main = document.getElementById('app-main');
  const content = document.querySelector(contentSelector);

  if (main && content) {
    main.appendChild(content);
    content.hidden = false;
  }
}

function confirmAction(message) {
  return window.confirm(message);
}

function formatModeOfTravel(modes) {
  if (!modes) return '—';

  const labels = [];
  if (modes.careVehicle) labels.push('CARE Vehicle');
  if (modes.publicTransport) labels.push('Public Transport');
  if (modes.aircraft) labels.push('Aircraft');

  return labels.length ? labels.join(', ') : '—';
}

function renderPagination(container, pagination, onPageChange) {
  if (!pagination || pagination.totalPages <= 1) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const { page, totalPages, total } = pagination;

  let html = `<div class="pagination">
    <span class="pagination__info">${total} total · Page ${page} of ${totalPages}</span>
    <div class="pagination__buttons">`;

  if (page > 1) {
    html += `<button type="button" class="btn btn--secondary btn--sm" data-page="${page - 1}">Previous</button>`;
  }
  if (page < totalPages) {
    html += `<button type="button" class="btn btn--secondary btn--sm" data-page="${page + 1}">Next</button>`;
  }

  html += '</div></div>';
  container.innerHTML = html;

  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}
