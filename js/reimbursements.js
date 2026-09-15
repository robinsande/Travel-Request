/**
 * Reimbursement form helpers and list/detail renderers.
 * Network calls live in js/api/reimbursements.js.
 */

/** Cached from GET /reimbursements/expense-categories */
let expenseCategoriesCache = null;

async function ensureExpenseCategories() {
  if (expenseCategoriesCache?.length) return expenseCategoriesCache;
  const response = await fetchExpenseCategories();
  expenseCategoriesCache = response.categories || response || [];
  if (!Array.isArray(expenseCategoriesCache) || !expenseCategoriesCache.length) {
    throw new Error('Expense categories are unavailable. Refresh and try again.');
  }
  return expenseCategoriesCache;
}

function formatExpenseCategoryLabel(category) {
  return String(category || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveExpenseCategory(value = '', categories = expenseCategoriesCache || []) {
  const text = String(value || '').trim();
  if (!text) return '';

  const exact = categories.find((category) => category.toLowerCase() === text.toLowerCase());
  if (exact) return exact;

  const lower = text.toLowerCase();
  const keywordMatchers = [
    { test: (s) => s.includes('breakfast'), value: 'BREAKFAST' },
    { test: (s) => s.includes('lunch'), value: 'LUNCH' },
    { test: (s) => s.includes('dinner'), value: 'DINNER' },
    { test: (s) => s.includes('incident'), value: 'INCIDENTALS' },
    {
      test: (s) => s.includes('hotel') || s.includes('accommodation') || s.includes('lodging'),
      value: 'HOTEL ROOM & TAXES',
    },
    { test: (s) => s.includes('airport') || s.includes('visa'), value: 'AIRPORT TAXES & VISA FEES' },
    {
      test: (s) =>
        s.includes('taxi') ||
        s.includes('transport') ||
        s.includes('fare') ||
        s.includes('matatu') ||
        s.includes('boda'),
      value: 'TAXI/LOCAL TRANSPORTATION',
    },
    {
      test: (s) => s.includes('fuel') || s.includes('petrol') || s.includes('diesel'),
      value: 'VEHICLE FUEL',
    },
    {
      test: (s) => s.includes('perdiem') || s.includes('per diem') || s.includes('per-diem'),
      value: 'PER DIEM (M&I)',
    },
  ];

  for (const matcher of keywordMatchers) {
    if (matcher.test(lower) && categories.includes(matcher.value)) {
      return matcher.value;
    }
  }

  return categories.includes('OTHER EXPENSES') ? 'OTHER EXPENSES' : categories[0] || '';
}

function buildExpenseCategoryOptions(selected = '', categories = expenseCategoriesCache || []) {
  const selectedValue = resolveExpenseCategory(selected, categories);
  const placeholder = `<option value="" ${selectedValue ? '' : 'selected'} disabled>Select category</option>`;
  const options = categories
    .map((category) => {
      const isSelected = category === selectedValue ? ' selected' : '';
      return `<option value="${escapeHtml(category)}"${isSelected}>${escapeHtml(
        formatExpenseCategoryLabel(category)
      )}</option>`;
    })
    .join('');
  return `${placeholder}${options}`;
}

function getReimbursementId(report) {
  return getEntityId(report);
}

function getLinkedTravelId(request) {
  return getEntityId(request);
}

function getTravelRequestLabel(report) {
  const request = report.travelRequest || {};
  return request.itinerary?.destination || request.project?.name || getLinkedTravelId(request) || 'Linked trip';
}

function getReimbursementRequesterLabel(report) {
  return report.submittedBy?.name || report.submittedBy?.email || getUser()?.name || '—';
}

function getReimbursementApproverLabel(report) {
  return (
    report.selected_approver_id?.name ||
    report.selected_approver_id?.email ||
    report.approver?.name ||
    '—'
  );
}

function getReimbursementSubmittedLabel(report) {
  return formatDate(report.submittedAt || report.createdAt);
}

function calculateLineItemTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getSelectedTravelDestination(form) {
  const select = form?.querySelector('#travelRequestId');
  const option = select?.selectedOptions?.[0];
  return option?.dataset?.destination?.trim() || option?.textContent?.trim() || '';
}

function buildReimbursementPayload(form) {
  const fd = new FormData(form);
  const rows = form.querySelectorAll('[data-line-item-row]');
  const tripLocation = getSelectedTravelDestination(form);
  const lineItems = [];

  rows.forEach((row) => {
    const expenseDate = row.querySelector('[data-line-item="expenseDate"]')?.value || '';
    const category = row.querySelector('[data-line-item="category"]')?.value?.trim() || '';
    const amount = row.querySelector('[data-line-item="amount"]')?.value || '';

    if (expenseDate || category || amount) {
      lineItems.push({
        expenseDate,
        location: tripLocation,
        category,
        description: category,
        amount: Number(amount || 0),
      });
    }
  });

  return {
    travelRequestId: fd.get('travelRequestId')?.trim() || '',
    selected_approver_id: fd.get('selected_approver_id')?.trim() || '',
    employeeNumber: fd.get('employeeNumber')?.trim() || '',
    department: fd.get('department')?.trim() || '',
    position: fd.get('position')?.trim() || '',
    baseLocation: fd.get('baseLocation')?.trim() || '',
    lineItems,
  };
}

let reimbursementLineItemIndex = 0;

function addReimbursementLineItemRow(container, item = {}, categories = expenseCategoriesCache || []) {
  const idx = reimbursementLineItemIndex++;
  const selectedCategory = item.category || item.description || '';
  const row = document.createElement('tr');
  row.dataset.lineItemRow = String(idx);
  row.innerHTML = `
    <td data-label="Date">
      <div class="form-group">
        <label class="mobile-only-label" for="expense-date-${idx}">Date</label>
        <input type="date" id="expense-date-${idx}" data-line-item="expenseDate" value="${escapeHtml(
          item.expenseDate ? String(item.expenseDate).slice(0, 10) : ''
        )}" required />
      </div>
    </td>
    <td data-label="Category">
      <div class="form-group">
        <label class="mobile-only-label" for="expense-category-${idx}">Category</label>
        <select id="expense-category-${idx}" data-line-item="category" required>
          ${buildExpenseCategoryOptions(selectedCategory, categories)}
        </select>
      </div>
    </td>
    <td data-label="Amount (KSH)">
      <div class="form-group">
        <label class="mobile-only-label" for="expense-amount-${idx}">Amount (KSH)</label>
        <input type="number" id="expense-amount-${idx}" min="0.01" step="0.01" data-line-item="amount" value="${escapeHtml(
          item.amount ?? ''
        )}" placeholder="0.00" inputmode="decimal" required />
      </div>
    </td>
    <td data-label="">
      <button type="button" class="btn btn--ghost btn--sm" data-remove-line-item>Remove</button>
    </td>`;

  const bindUpdate = () => updateReimbursementTotal(container.closest('form'));
  row.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', bindUpdate);
    el.addEventListener('change', bindUpdate);
  });
  row.querySelector('[data-remove-line-item]').addEventListener('click', () => {
    const allRows = container.querySelectorAll('[data-line-item-row]');
    if (allRows.length <= 1) {
      showToast('At least one line item is required.', 'warning');
      return;
    }
    row.remove();
    updateReimbursementTotal(container.closest('form'));
  });

  container.appendChild(row);
}

async function initReimbursementLineItems(container, items = []) {
  const categories = await ensureExpenseCategories();
  reimbursementLineItemIndex = 0;
  container.innerHTML = '';
  const rows = items.length ? items : [{}];
  rows.forEach((item) => addReimbursementLineItemRow(container, item, categories));

  const addBtn = container.closest('form')?.querySelector('#add-line-item-btn');
  if (addBtn) {
    const freshBtn = addBtn.cloneNode(true);
    addBtn.replaceWith(freshBtn);
    freshBtn.addEventListener('click', () => addReimbursementLineItemRow(container, {}, categories));
  }

  updateReimbursementTotal(container.closest('form'));
}

function updateReimbursementTotal(form) {
  if (!form) return;
  const totalEl = form.querySelector('[data-total-amount]');
  if (!totalEl) return;

  const payload = buildReimbursementPayload(form);
  totalEl.textContent = formatCurrency(calculateLineItemTotal(payload.lineItems));
}

function canApproveReimbursement(report, user = getUser()) {
  if (!user || user.role !== 'admin' || report?.status !== 'pending') return false;
  const uid = String(user.id || user._id || '');
  const approverId = String(getSelectedApproverId(report) || '');
  return Boolean(uid && approverId && uid === approverId);
}

function renderReimbursementRejectForm(reportId) {
  return `
    <div class="reject-form" hidden>
      <div class="form-group">
        <label for="reject-comment-${escapeHtml(reportId)}">Rejection comment (required)</label>
        <textarea id="reject-comment-${escapeHtml(reportId)}" class="reject-comment" rows="3" required placeholder="Explain why this reimbursement is being rejected…"></textarea>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn--danger btn--sm confirm-reject-btn">Confirm Rejection</button>
        <button type="button" class="btn btn--ghost btn--sm cancel-reject-btn">Cancel</button>
      </div>
    </div>`;
}

function renderReimbursementDecisionButtons(reportId) {
  return `
    <div class="btn-group" style="margin-top: 1rem;">
      <a href="reimbursement-detail.html?id=${encodeURIComponent(reportId)}" class="btn btn--secondary btn--sm">View Details</a>
      <button type="button" class="btn btn--success btn--sm approve-btn">Approve</button>
      <button type="button" class="btn btn--danger btn--sm reject-toggle-btn">Reject</button>
    </div>
    ${renderReimbursementRejectForm(reportId)}`;
}

function renderReimbursementRow(report, options = {}) {
  const id = getReimbursementId(report);
  const requester = getReimbursementRequesterLabel(report);
  const typeBadge = options.showType
    ? '<span class="badge badge--type">Reimbursement Request</span>'
    : '';
  const canDecide = options.showApproveActions && canApproveReimbursement(report);

  if (canDecide) {
    return `
      <article class="approval-card" data-report-id="${escapeHtml(id)}" data-item-type="reimbursement">
        <div class="approval-card__header">
          <div>
            <h3>${escapeHtml(getTravelRequestLabel(report))}</h3>
            <p class="text-muted">Submitted by ${escapeHtml(requester)} · ${getReimbursementSubmittedLabel(report)}</p>
          </div>
          <div class="request-card__badges">
            ${typeBadge}
            ${statusBadge(report.status)}
          </div>
        </div>
        <p>Total: ${escapeHtml(formatCurrency(report.totalAmountKsh))}</p>
        <p class="text-muted">Base location: ${escapeHtml(report.baseLocation || '—')}</p>
        ${renderReimbursementDecisionButtons(id)}
      </article>`;
  }

  return `
    <a href="reimbursement-detail.html?id=${encodeURIComponent(id)}" class="request-card">
      <div class="request-card__header">
        <span class="request-card__dest">${escapeHtml(getTravelRequestLabel(report))}</span>
        <div class="request-card__badges">
          ${typeBadge}
          ${statusBadge(report.status)}
        </div>
      </div>
      <div class="request-card__meta">
        <span>Submitted: ${getReimbursementSubmittedLabel(report)}</span>
        <span>Total: ${escapeHtml(formatCurrency(report.totalAmountKsh))}</span>
        <span>Submitted by: ${escapeHtml(requester)}</span>
      </div>
      <p class="request-card__purpose">${escapeHtml(report.baseLocation || 'No base location')}</p>
    </a>`;
}

function bindReimbursementApprovalCard(card, options = {}) {
  const id = card.dataset.reportId;
  const rejectForm = card.querySelector('.reject-form');
  const commentEl = card.querySelector('.reject-comment');
  const approveBtn = card.querySelector('.approve-btn');
  const rejectToggleBtn = card.querySelector('.reject-toggle-btn');
  const confirmRejectBtn = card.querySelector('.confirm-reject-btn');
  const cancelRejectBtn = card.querySelector('.cancel-reject-btn');
  if (!approveBtn || !rejectToggleBtn || !confirmRejectBtn) return;

  approveBtn.addEventListener('click', async () => {
    await runDecisionAction(approveBtn, {
      confirmMessage: 'Approve this reimbursement request?',
      loadingText: 'Approving…',
      action: () => updateReimbursementStatus(id, { status: 'approved' }),
      successMessage: 'Reimbursement request approved.',
      errorMessage: 'Failed to approve reimbursement request.',
      onSuccess: () => {
        if (typeof options.onSuccess === 'function') options.onSuccess(card);
        if (typeof refreshApprovalBadges === 'function') refreshApprovalBadges();
      },
    });
  });

  rejectToggleBtn.addEventListener('click', () => {
    rejectForm.hidden = !rejectForm.hidden;
  });

  cancelRejectBtn?.addEventListener('click', () => {
    rejectForm.hidden = true;
    if (commentEl) commentEl.value = '';
  });

  confirmRejectBtn.addEventListener('click', async () => {
    const comment = commentEl?.value.trim() || '';
    if (!comment) {
      showToast('A rejection comment is required.', 'warning');
      commentEl?.focus();
      return;
    }

    await runDecisionAction(confirmRejectBtn, {
      confirmMessage: 'Reject this reimbursement request?',
      loadingText: 'Rejecting…',
      action: () => updateReimbursementStatus(id, { status: 'rejected', comment }),
      successMessage: 'Reimbursement request rejected.',
      errorMessage: 'Failed to reject reimbursement request.',
      onSuccess: () => {
        if (typeof options.onSuccess === 'function') options.onSuccess(card);
        if (typeof refreshApprovalBadges === 'function') refreshApprovalBadges();
      },
    });
  });
}

function bindReimbursementApprovalActions(root, options = {}) {
  root.querySelectorAll('.approval-card[data-report-id]').forEach((card) => {
    bindReimbursementApprovalCard(card, options);
  });
}

function renderReimbursementLineItemsTable(lineItems) {
  return `
    <div class="data-table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Amount (KSH)</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems
            .map(
              (item) => `
            <tr>
              <td data-label="Date">${formatDate(item.expenseDate)}</td>
              <td data-label="Category">${escapeHtml(formatExpenseCategoryLabel(item.category || item.description))}</td>
              <td data-label="Amount (KSH)">${escapeHtml(formatCurrency(item.amount))}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function renderReimbursementDetail(report) {
  const requester = getReimbursementRequesterLabel(report);
  const approver = getReimbursementApproverLabel(report);
  const rejectionComment = report.decision?.comment;
  const lineItems = report.lineItems || [];
  const id = getReimbursementId(report);

  return `
    <div class="page-header">
      <div>
        <a href="javascript:history.back()" class="back-link">← Back</a>
        <h1>Reimbursement Request Details</h1>
      </div>
      ${statusBadge(report.status)}
    </div>

    ${
      report.status === 'rejected' && rejectionComment
        ? `
      <section class="detail-section detail-section--rejected">
        <h2>Rejection Reason</h2>
        <p>${escapeHtml(rejectionComment)}</p>
      </section>`
        : ''
    }

    <section class="detail-section">
      <h2>Report Overview</h2>
      <dl class="detail-grid">
        <dt>Report ID</dt><dd>${escapeHtml(id)}</dd>
        <dt>Linked Travel</dt><dd>${escapeHtml(getTravelRequestLabel(report))}</dd>
        <dt>Submitted By</dt><dd>${escapeHtml(requester)}</dd>
        <dt>Selected Approver</dt><dd>${escapeHtml(approver)}</dd>
        <dt>Submitted</dt><dd>${formatDateTime(report.submittedAt || report.createdAt)}</dd>
        <dt>Total</dt><dd>${escapeHtml(formatCurrency(report.totalAmountKsh))}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h2>Employee Details</h2>
      <dl class="detail-grid">
        <dt>Employee Number</dt><dd>${escapeHtml(report.employeeNumber || '—')}</dd>
        <dt>Department</dt><dd>${escapeHtml(report.department || '—')}</dd>
        <dt>Position</dt><dd>${escapeHtml(report.position || '—')}</dd>
        <dt>Base Location</dt><dd>${escapeHtml(report.baseLocation || '—')}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h2>Expense Line Items</h2>
      ${
        lineItems.length
          ? renderReimbursementLineItemsTable(lineItems)
          : '<p class="text-muted">No line items were submitted.</p>'
      }
    </section>

    <section class="detail-section">
      <h2>Workflow</h2>
      <dl class="detail-grid">
        <dt>Status</dt><dd>${statusBadge(report.status)}</dd>
        <dt>Approved At</dt><dd>${formatDateTime(report.approvedAt)}</dd>
        <dt>Decision Comment</dt><dd>${escapeHtml(rejectionComment || '—')}</dd>
      </dl>
    </section>`;
}

function renderApprovedTravelOption(request) {
  const requestId = getLinkedTravelId(request);
  const destination = request.itinerary?.destination || 'Trip';
  const dates = `${formatDate(request.itinerary?.dateFrom)} - ${formatDate(request.itinerary?.dateTo)}`;
  return `<option value="${escapeHtml(requestId)}" data-destination="${escapeHtml(destination)}">${escapeHtml(destination)} (${escapeHtml(dates)})</option>`;
}
