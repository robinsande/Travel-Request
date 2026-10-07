/** Reimbursement API endpoints */

function buildReimbursementQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

async function fetchExpenseCategories() {
  return api.get('/reimbursements/expense-categories');
}

async function previewEmptyTerTemplate(target) {
  return viewFile('/reimbursements/template/ter.pdf', target);
}

async function fetchMyReimbursements(params = {}) {
  return api.get(`/reimbursements/my-requests${buildReimbursementQuery(params)}`);
}

async function fetchPendingReimbursementApprovals() {
  return api.get('/reimbursements/pending-approvals');
}

async function fetchTeamReimbursements(params = {}) {
  return api.get(`/reimbursements/team${buildReimbursementQuery(params)}`);
}

async function fetchReimbursement(id) {
  return api.get(`/reimbursements/${id}`);
}

async function createReimbursement(payload) {
  return api.post('/reimbursements', payload);
}

async function previewReimbursementPdf(payload, previewWindow) {
  const token = typeof getToken === 'function' ? getToken() : null;
  const response = await fetch(buildApiUrl('/reimbursements/preview'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Unable to prepare reimbursement preview (${response.status})`;
    try {
      const result = await response.json();
      message = result.message || message;
    } catch {
      // Keep the status-based message when the server response is not JSON.
    }
    throw new Error(message);
  }

  const previewUrl = URL.createObjectURL(await response.blob());
  if (previewWindow) previewWindow.location = previewUrl;
  else window.open(previewUrl, '_blank');
  return previewUrl;
}

async function updateReimbursement(id, payload) {
  return api.patch(`/reimbursements/${id}`, payload);
}

async function updateReimbursementStatus(id, payload) {
  return api.patch(`/reimbursements/${id}/status`, payload);
}

async function uploadReimbursementAttachment(id, file, category, documentType = 'other') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('documentType', documentType);
  return api.upload(`/reimbursements/${id}/attachments`, formData);
}

async function downloadReimbursementAttachment(id, attachmentId, filename) {
  return downloadFile(
    `/reimbursements/${id}/attachments/${attachmentId}`,
    filename || `reimbursement-attachment-${attachmentId}`
  );
}

async function previewReimbursementAttachment(id, attachmentId) {
  return viewFile(`/reimbursements/${id}/attachments/${attachmentId}?view=true`);
}

async function fetchReimbursementPdf(id) {
  return downloadFile(`/reimbursements/${id}/pdf`, `reimbursement-${id}.pdf`);
}

async function fetchPaymentVoucherPdf(id) {
  return downloadFile(
    `/reimbursements/${id}/payment-voucher.pdf`,
    `payment-voucher-${id}.pdf`
  );
}

async function previewPaymentVoucherPdf(id) {
  return viewFile(`/reimbursements/${id}/payment-voucher.pdf`);
}
