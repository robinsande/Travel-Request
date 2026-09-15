/** Admin API endpoints */

async function importEmployees(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/admin/import-employees', {
    method: 'POST',
    body: formData,
  });
}
