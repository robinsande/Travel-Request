/** Admin API endpoints */

async function importEmployees(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/admin/import-employees', {
    method: 'POST',
    body: formData,
  });
}

async function importBudgetHolders(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/admin/import-budget-holders', {
    method: 'POST',
    body: formData,
  });
}
