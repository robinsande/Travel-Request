/** Users API endpoints */

async function fetchCurrentUser() {
  return api.get('/users/me');
}

async function updateCurrentUser(profile) {
  return api.patch('/users/me', profile);
}

async function fetchTarDraft() {
  return api.get('/users/me/tar-draft');
}

async function saveTarDraft(draft) {
  return api.put('/users/me/tar-draft', { draft });
}

async function deleteTarDraft() {
  return api.delete('/users/me/tar-draft');
}

async function fetchUserTarDraft(userId) {
  return api.get(`/users/${userId}/tar-draft`);
}

async function fetchAllUsers() {
  return api.get('/users');
}

async function createUser(user) {
  return api.post('/users', user);
}

async function updateUserRole(userId, role) {
  return api.patch(`/users/${userId}/role`, { role });
}

async function updateUserProfile(userId, profile) {
  return api.patch(`/users/${userId}/profile`, profile);
}

async function resetUserPassword(userId) {
  return api.post(`/users/${userId}/reset-password`, {});
}

async function sendBulkInvitations(userIds = [], all = false) {
  return api.post('/users/bulk-invite', { userIds, all });
}

async function updateUserStatus(userId, isActive) {
  return api.patch(`/users/${userId}/status`, { isActive });
}

async function deleteUser(userId) {
  return api.delete(`/users/${userId}`);
}

async function fetchApprovers() {
  return api.get('/users/approvers');
}

async function fetchPassengers() {
  return api.get('/users/passengers');
}
