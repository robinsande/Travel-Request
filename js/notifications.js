/**
 * Notifications badge polling and list renderers.
 * Network calls live in js/api/notifications.js.
 * Approval nav badges use pending-approvals endpoints when available.
 */

let notificationPollTimer = null;

async function getUnreadCount() {
  try {
    const data = await fetchNotifications();
    const list = Array.isArray(data) ? data : data.data || data.notifications || [];
    return list.filter((n) => !n.read && !n.isRead).length;
  } catch {
    return 0;
  }
}

function updateCountBadge(badge, count) {
  if (!badge) return;
  if (count > 0) {
    badge.hidden = false;
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.hidden = true;
  }
}

function updateBadgeElement(count) {
  updateCountBadge(document.getElementById('notifications-badge'), count);
}

async function getPendingApprovalCounts() {
  try {
    const user = getUser() || {};
    const role = user.role;
    const isTravelApprover = ['admin', 'approver_budget_holder'].includes(role);
    const canReviewBudget = ['user', 'admin', 'approver_budget_holder'].includes(role);
    const canReviewReimbursements =
      ['admin', 'approver_budget_holder'].includes(role) ||
      (user.roles || []).some((item) => ['supervisor', 'finance_admin'].includes(item));
    const [travelResult, reimbursementResult, budgetResult] = await Promise.all([
      isTravelApprover ? api.get('/requests/pending-my-approval') : Promise.resolve({ requests: [] }),
      canReviewReimbursements ? api.get('/reimbursements/pending-approvals') : Promise.resolve({ reports: [] }),
      canReviewBudget ? api.get('/requests/pending-my-budget-approval') : Promise.resolve({ requests: [] }),
    ]);
    return {
      travel: unwrapListResult(travelResult, ['requests']).length,
      reimbursement: unwrapListResult(reimbursementResult, ['reports']).length,
      budget: unwrapListResult(budgetResult, ['requests']).length,
    };
  } catch {
    return { travel: 0, reimbursement: 0, budget: 0 };
  }
}

async function refreshApprovalBadges() {
  const counts = await getPendingApprovalCounts();
  updateCountBadge(document.getElementById('approvals-badge'), counts.travel + counts.budget);
  updateCountBadge(
    document.getElementById('reimbursement-approvals-badge'),
    counts.reimbursement
  );
}

async function refreshNotificationBadge() {
  const count = await getUnreadCount();
  updateBadgeElement(count);
}

async function refreshAllBadges() {
  await Promise.all([refreshNotificationBadge(), refreshApprovalBadges()]);
}

function initNotificationBadge() {
  refreshAllBadges();
  if (notificationPollTimer) clearInterval(notificationPollTimer);
  notificationPollTimer = setInterval(refreshAllBadges, CONFIG.NOTIFICATION_POLL_MS);
}

function renderNotificationItem(notification) {
  const isRead = notification.read || notification.isRead;
  const title = notification.title || notification.message || 'Notification';
  const body = notification.body || notification.details || '';
  const date = formatDateTime(notification.createdAt);
  const targetHref = notification.reimbursement
    ? `reimbursement-detail.html?id=${encodeURIComponent(notification.reimbursement.id || notification.reimbursement._id || notification.reimbursement)}`
    : notification.request
      ? `request-detail.html?id=${encodeURIComponent(notification.request.id || notification.request._id || notification.request)}`
      : '';
  const typeClass = notification.type?.startsWith('reimbursement_') ? ' notification-item--reimbursement' : '';

  return `
    <article class="notification-item${isRead ? ' notification-item--read' : ''}${typeClass}" data-id="${escapeHtml(notification.id || notification._id)}" data-target-href="${escapeHtml(targetHref)}">
      <div class="notification-item__content">
        <h3 class="notification-item__title">${escapeHtml(title)}</h3>
        ${body ? `<p class="notification-item__body">${escapeHtml(body)}</p>` : ''}
        <time class="notification-item__time">${date}</time>
      </div>
      ${!isRead ? `<button type="button" class="btn btn--secondary btn--sm mark-read-btn">Mark read</button>` : ''}
    </article>`;
}
