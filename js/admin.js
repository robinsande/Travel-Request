function renderImportSummary(result, container) {
  const summary = result.summary || result;
  const created = summary.created ?? 0;
  const updated = summary.updated ?? 0;
  const skipped = summary.skipped ?? 0;
  const invitesSent = summary.invitesSent ?? 0;
  const errors = summary.errors || [];

  let errorsHtml = '';
  if (errors.length) {
    errorsHtml = `
      <div class="import-errors">
        <h4>Errors (${errors.length})</h4>
        <ul>${errors
          .map((item) => {
            const text = typeof item === 'string'
              ? item
              : item.email
                ? `${item.email}: ${item.message}`
                : item.name
                  ? `${item.name}: ${item.message}`
                : item.message || JSON.stringify(item);
            return `<li>${escapeHtml(text)}</li>`;
          })
          .join('')}</ul>
      </div>`;
  }

  container.innerHTML = `
    <div class="import-summary">
      <h3>Import Complete</h3>
      <dl class="detail-grid">
        <dt>Created</dt><dd>${created}</dd>
        <dt>Updated</dt><dd>${updated}</dd>
        <dt>Skipped</dt><dd>${skipped}</dd>
        <dt>Invites Sent</dt><dd>${invitesSent}</dd>
      </dl>
      ${errorsHtml}
    </div>`;

  container.hidden = false;
}

function renderUserRow(user) {
  const roles = ['user', 'admin', 'superadmin'];
  const initials = String(user.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const roleOptions = roles
    .map(
      (role) =>
        `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role === 'admin' ? 'Admin / line manager' : role}</option>`
    )
    .join('');

  return `
    <tr>
      <td data-label="Select"><input type="checkbox" class="bulk-user-select" data-user-id="${escapeHtml(user._id || user.id)}" aria-label="Select ${escapeHtml(user.name)} for invitation"${user.isActive === false || user.role === 'superadmin' ? ' disabled' : ''} /></td>
      <td data-label="Name"><div class="user-identity"><span class="user-identity__avatar">${escapeHtml(initials)}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || 'Staff account')}</small></span></div></td>
      <td data-label="Email"><a class="user-email" href="mailto:${escapeHtml(user.email)}">${escapeHtml(user.email)}</a><small class="user-department">${escapeHtml(user.department || user.office || 'No department')}</small></td>
      <td data-label="Role">
        <select class="user-role-select" data-user-id="${escapeHtml(user._id || user.id)}" data-previous-role="${escapeHtml(user.role)}" aria-label="Change role for ${escapeHtml(user.name)}">
          ${roleOptions}
        </select>
      </td>
      <td data-label="Manager">${escapeHtml(formatManagerLabel(user) || '—')}</td>
      <td data-label="Status">
        <span class="account-status account-status--${user.isActive === false ? 'inactive' : 'active'}"><span></span>${user.isActive === false ? 'Inactive' : 'Active'}</span>
        <div class="user-actions">
          <button type="button" class="btn btn--secondary user-status-button" data-user-id="${escapeHtml(user._id || user.id)}" data-active="${user.isActive !== false}">${user.isActive === false ? 'Activate' : 'Deactivate'}</button>
          <button type="button" class="btn btn--secondary user-edit-button" data-user-id="${escapeHtml(user._id || user.id)}">Edit profile</button>
          <button type="button" class="btn btn--secondary user-reset-password-button" data-user-id="${escapeHtml(user._id || user.id)}">Reset password</button>
          <button type="button" class="btn btn--danger user-delete-button" data-user-id="${escapeHtml(user._id || user.id)}">Delete</button>
        </div>
      </td>
    </tr>`;
}
