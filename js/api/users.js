/** Users API endpoints */

async function fetchCurrentUser() {
  return api.get('/users/me');
}

async function updateCurrentUser(profile) {
  return api.patch('/users/me', profile);
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

async function fetchApprovers() {
  return api.get('/users/approvers');
}

async function fetchPassengers() {
  return api.get('/users/passengers');
}
