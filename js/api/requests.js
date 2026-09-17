/** Travel request API endpoints */

async function fetchMyRequests(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });
  const qs = query.toString();
  return api.get(`/requests${qs ? `?${qs}` : ''}`);
}

async function fetchPendingApprovals() {
  return api.get('/requests/pending-my-approval');
}

async function fetchRequest(id) {
  return api.get(`/requests/${id}`);
}

async function createRequest(payload) {
  return api.post('/requests', payload);
}

async function updateRequest(id, payload) {
  return api.patch(`/requests/${id}`, payload);
}

async function approveRequest(id, payload = {}) {
  return api.patch(`/requests/${id}/approve`, payload);
}

async function rejectRequest(id, commentOrPayload) {
  const payload =
    typeof commentOrPayload === 'string'
      ? { comment: commentOrPayload }
      : commentOrPayload || {};
  return api.patch(`/requests/${id}/reject`, payload);
}

async function remindApprover(id) {
  return api.post(`/requests/${id}/remind-approver`, {});
}

async function fetchTravelRequestPdf(id, { preview = false } = {}) {
  const query = preview ? '?preview=true' : '';
  const filename = preview ? `travel-request-${id}-preview.pdf` : `travel-request-${id}.pdf`;
  return downloadFile(`/travel-requests/${id}/pdf${query}`, filename);
}

async function fetchTravelRequestTemplatePdf() {
  return downloadFile('/travel-requests/template/pdf', 'care-travel-authority-request-template.pdf');
}
