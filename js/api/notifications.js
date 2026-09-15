/** Notifications API endpoints */

async function fetchNotifications() {
  return api.get('/notifications');
}

async function markNotificationRead(id) {
  return api.patch(`/notifications/${id}/read`);
}

async function markAllNotificationsRead() {
  return api.patch('/notifications/mark-all-read', {});
}
