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

async function fetchReimbursementPdf(id) {
  return downloadFile(`/reimbursements/${id}/pdf`, `reimbursement-${id}.pdf`);
}
