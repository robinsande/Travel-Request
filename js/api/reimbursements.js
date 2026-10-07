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

async function downloadEmptyTerTemplate() {
  return downloadFile('/reimbursements/template/ter.pdf', 'travel-expense-report-template.pdf');
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

async function updateReimbursement(id, payload) {
  return api.patch(`/reimbursements/${id}`, payload);
}

async function updateReimbursementStatus(id, payload) {
  return api.patch(`/reimbursements/${id}/status`, payload);
}

async function uploadReimbursementAttachment(id, file, category) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  return api.upload(`/reimbursements/${id}/attachments`, formData);
}

async function downloadReimbursementAttachment(id, attachmentId, filename) {
  return downloadFile(
    `/reimbursements/${id}/attachments/${attachmentId}`,
    filename || `reimbursement-attachment-${attachmentId}`
  );
}

async function fetchReimbursementPdf(id) {
  return downloadFile(`/reimbursements/${id}/pdf`, `reimbursement-${id}.pdf`);
}
