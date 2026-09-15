function buildRequestPayload(form) {
  const fd = new FormData(form);

  const modeOfTravel = {
    careVehicle: fd.get('mode_careVehicle') === 'on',
    publicTransport: fd.get('mode_publicTransport') === 'on',
    aircraft: fd.get('mode_aircraft') === 'on',
  };

  const passengers = [];
  form.querySelectorAll('.passenger-row').forEach((row) => {
    const userId = row.querySelector('[data-passenger-user]')?.value?.trim() || '';
    const name = row.querySelector('[data-passenger-name]')?.value?.trim() || '';
    const employeeNumber = row.querySelector('[data-passenger-employee]')?.value?.trim() || '';
    if (userId) {
      passengers.push({
        user: userId,
        name: name || undefined,
        employeeNumber: employeeNumber || undefined,
      });
    }
  });

  return {
    selected_approver_id: fd.get('selected_approver_id')?.trim() || '',
    project: {
      name: fd.get('project_name')?.trim() || '',
      businessUnit: fd.get('project_businessUnit')?.trim() || '',
      fundCode: fd.get('project_fundCode')?.trim() || '',
      projectId: fd.get('project_projectId')?.trim() || '',
      departmentId: fd.get('project_departmentId')?.trim() || '',
      activityId: fd.get('project_activityId')?.trim() || '',
    },
    assignedAreaOfOperation: fd.get('assignedAreaOfOperation')?.trim() || '',
    employeeOffice: fd.get('employeeOffice')?.trim() || '',
    purposeOfTrip: fd.get('purposeOfTrip')?.trim() || '',
    requesterSignature: fd.get('requesterSignature')?.trim() || '',
    modeOfTravel,
    itinerary: {
      dateFrom: fd.get('itinerary_dateFrom') || '',
      dateTo: fd.get('itinerary_dateTo') || '',
      destination: fd.get('itinerary_destination')?.trim() || '',
      accommodationNeeded: fd.get('itinerary_accommodationNeeded') === 'on',
    },
    travelSegments: Array.from(form.querySelectorAll('.travel-segment')).map((row) => ({
      from: row.querySelector('[data-segment="from"]').value.trim(),
      to: row.querySelector('[data-segment="to"]').value.trim(),
      destination: row.querySelector('[data-segment="destination"]').value.trim(),
      dateFrom: row.querySelector('[data-segment="dateFrom"]').value,
      dateTo: row.querySelector('[data-segment="dateTo"]').value,
    })),
    passengers,
  };
}

/** Populate form fields from a request object (for edit/resubmit) */
async function populateRequestForm(form, request, passengerOptions = null) {
  const set = (name, value) => {
    const el = form.elements[name];
    if (el) el.value = value ?? '';
  };

  const p = request.project || {};
  set('selected_approver_id', request.selected_approver_id?._id || request.selected_approver_id?.id || '');
  set('project_name', p.name);
  set('project_businessUnit', p.businessUnit);
  set('project_fundCode', p.fundCode);
  set('project_projectId', p.projectId);
  set('project_departmentId', p.departmentId);
  set('project_activityId', p.activityId);
  set('assignedAreaOfOperation', request.assignedAreaOfOperation);
  set('employeeOffice', request.employeeOffice);
  set('purposeOfTrip', request.purposeOfTrip);
  set('requesterSignature', request.requesterSignature);

  const modes = request.modeOfTravel || {};
  form.elements.mode_careVehicle.checked = !!modes.careVehicle;
  form.elements.mode_publicTransport.checked = !!modes.publicTransport;
  form.elements.mode_aircraft.checked = !!modes.aircraft;

  const it = request.itinerary || {};
  set('itinerary_dateFrom', it.dateFrom ? it.dateFrom.slice(0, 10) : '');
  set('itinerary_dateTo', it.dateTo ? it.dateTo.slice(0, 10) : '');
  set('itinerary_destination', it.destination);
  const segments = request.travelSegments || [];
  const segmentContainer = form.querySelector('#travel-segments');
  if (segmentContainer) {
    segmentContainer.innerHTML = '';
    segments.forEach((segment) => addTravelSegment(segmentContainer, segment));
  }
  form.elements.itinerary_accommodationNeeded.checked = !!it.accommodationNeeded;

  const container = form.querySelector('#passengers-list');
  if (container) {
    const options = passengerOptions || (await loadPassengerOptions());
    container.innerHTML = '';
    passengerIndex = 0;
    const passengers = request.passengers?.length ? request.passengers : [{}];
    passengers.forEach((pass) => addPassengerRow(container, options, pass));

  }
}

let passengerIndex = 0;
let cachedPassengerOptions = null;

function addTravelSegment(container, segment = {}) {
  const row = document.createElement('div');
  row.className = 'travel-segment form-row';
  row.innerHTML = `
    <div class="form-group"><label>From</label><input type="text" data-segment="from" required value="${escapeHtml(segment.from || '')}" /></div>
    <div class="form-group"><label>To</label><input type="text" data-segment="to" required value="${escapeHtml(segment.to || '')}" /></div>
    <div class="form-group"><label>Destination</label><input type="text" data-segment="destination" required value="${escapeHtml(segment.destination || '')}" /></div>
    <div class="form-group"><label>Arrival</label><input type="date" data-segment="dateFrom" required value="${escapeHtml(segment.dateFrom ? String(segment.dateFrom).slice(0, 10) : '')}" /></div>
    <div class="form-group"><label>Departure</label><input type="date" data-segment="dateTo" required value="${escapeHtml(segment.dateTo ? String(segment.dateTo).slice(0, 10) : '')}" /></div>
    <button type="button" class="btn btn--danger btn--sm remove-travel-segment">Remove</button>`;
  row.querySelector('.remove-travel-segment').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

async function loadPassengerOptions() {
  if (cachedPassengerOptions) return cachedPassengerOptions;
  const passengers = await fetchPassengers();
  cachedPassengerOptions = unwrapListResult(passengers).map(mapPassengerOption);
  return cachedPassengerOptions;
}

function getPassengerSelection(pass) {
  if (!pass) return { value: '', label: '', name: '', employeeNumber: '' };
  const user = pass.user && typeof pass.user === 'object' ? pass.user : null;
  const value = getEntityId(user || pass.user);
  const name = user?.name || pass.name || '';
  const email = user?.email || '';
  const employeeNumber = user?.employeeNumber || pass.employeeNumber || '';
  const label = value
    ? `${name}${email ? ` (${email})` : ''}${employeeNumber ? ` · ${employeeNumber}` : ''}`
    : '';
  return { value, label, name, employeeNumber };
}

function addPassengerRow(container, options, pass = null) {
  const idx = passengerIndex++;
  const selected = getPassengerSelection(pass);
  const row = document.createElement('div');
  row.className = 'passenger-row';
  row.innerHTML = `
    <div class="form-group passenger-row__select">
      <label for="passenger-search-${idx}">Passenger</label>
      <div class="passenger-select" data-passenger-select="${idx}"></div>
      <input type="hidden" data-passenger-name="${idx}" value="${escapeHtml(selected.name)}" />
      <input type="hidden" data-passenger-employee="${idx}" value="${escapeHtml(selected.employeeNumber)}" />
    </div>
    <button type="button" class="btn btn--ghost btn--sm passenger-remove" aria-label="Remove passenger">Remove</button>`;

  container.appendChild(row);

  const selectContainer = row.querySelector(`[data-passenger-select="${idx}"]`);
  const nameInput = row.querySelector(`[data-passenger-name="${idx}"]`);
  const empInput = row.querySelector(`[data-passenger-employee="${idx}"]`);

  buildSearchableSelect(selectContainer, options, {
    hiddenInputName: `passenger_user_${idx}`,
    placeholder: 'Search employees…',
    selectedValue: selected.value,
    selectedLabel: selected.label,
    onChange(value) {
      const match = options.find((option) => String(option.value) === String(value));
      nameInput.value = match?.name || '';
      empInput.value = match?.employeeNumber || '';
      const hidden = selectContainer.querySelector('input[type="hidden"]');
      if (hidden) hidden.setAttribute('data-passenger-user', idx);
    },
  });

  const hidden = selectContainer.querySelector('input[type="hidden"]');
  if (hidden) {
    hidden.setAttribute('data-passenger-user', idx);
    if (selected.value) hidden.value = selected.value;
  }

  row.querySelector('.passenger-remove').addEventListener('click', () => {
    if (container.querySelectorAll('.passenger-row').length > 1) row.remove();
    else showToast('At least one passenger is required.', 'warning');
  });

  return row;
}

async function initPassengerList(container, initialPassengers = null) {
  passengerIndex = 0;
  container.innerHTML = '';
  const options = await loadPassengerOptions();
  const seeds = initialPassengers?.length ? initialPassengers : [null];
  seeds.forEach((pass) => addPassengerRow(container, options, pass));

  return options;
}

function getSelectedPassengerIds(form) {
  return Array.from(form.querySelectorAll('.passenger-row [data-passenger-user]'))
    .map((input) => input.value?.trim())
    .filter(Boolean);
}

function getRequestId(request) {
  return getEntityId(request);
}

function getRequesterLabel(request) {
  return request.requestedBy?.name || request.requestedBy?.email || '—';
}

function getRequestApproverLabel(request) {
  return (
    request.selected_approver_id?.name ||
    request.selected_approver_id?.email ||
    'Selected approver not available'
  );
}

function getRequestDateRange(request) {
  return `${formatDate(request.itinerary?.dateFrom)} – ${formatDate(request.itinerary?.dateTo)}`;
}

function canApproveTravelRequest(request, user = getUser()) {
  if (!user || user.role !== 'admin' || request?.status !== 'pending') return false;
  const uid = String(user.id || user._id || '');
  const approverId = String(getSelectedApproverId(request) || '');
  return Boolean(uid && approverId && uid === approverId);
}

function renderTravelRejectForm(requestId) {
  return `
    <div class="reject-form" hidden>
      <div class="form-group">
        <label for="reject-comment-${escapeHtml(requestId)}">Rejection comment (required)</label>
        <textarea id="reject-comment-${escapeHtml(requestId)}" class="reject-comment" rows="3" required placeholder="Explain why this request is being rejected…"></textarea>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn--danger btn--sm confirm-reject-btn">Confirm Rejection</button>
        <button type="button" class="btn btn--ghost btn--sm cancel-reject-btn">Cancel</button>
      </div>
    </div>`;
}

function renderTravelDecisionButtons(requestId) {
  return `
    <div class="btn-group" style="margin-top: 1rem;">
      <a href="request-detail.html?id=${encodeURIComponent(requestId)}" class="btn btn--secondary btn--sm">View Details</a>
      <button type="button" class="btn btn--success btn--sm approve-btn">Approve</button>
      <button type="button" class="btn btn--danger btn--sm reject-toggle-btn">Reject</button>
    </div>
    <div class="form-group approval-signature-field">
      <label>Approver Signature</label>
      <canvas class="signature-pad" width="520" height="150" aria-label="Draw approver signature"></canvas>
      <input type="file" class="signature-upload" accept="image/*" />
      <button type="button" class="btn btn--ghost btn--sm clear-signature-btn">Clear signature</button>
    </div>
    ${renderTravelRejectForm(requestId)}`;
}

/** Render a request summary card for list views */
function renderRequestRow(request, options = {}) {
  const id = getRequestId(request);
  const dest = request.itinerary?.destination || 'No destination';
  const dates = getRequestDateRange(request);
  const requester = getRequesterLabel(request);
  const typeBadge = options.showType
    ? '<span class="badge badge--type">Travel Request</span>'
    : '';
  const canDecide = options.showApproveActions && canApproveTravelRequest(request);

  if (canDecide) {
    return `
      <article class="approval-card" data-request-id="${escapeHtml(id)}" data-item-type="travel">
        <div class="approval-card__header">
          <div>
            <h3>${escapeHtml(dest)}</h3>
            <p class="text-muted">Requested by ${escapeHtml(requester)} · ${escapeHtml(dates)}</p>
          </div>
          <div class="request-card__badges">
            ${typeBadge}
            ${statusBadge(request.status)}
          </div>
        </div>
        <p>${escapeHtml(request.purposeOfTrip || '')}</p>
        <p class="text-muted">Mode: ${escapeHtml(formatModeOfTravel(request.modeOfTravel))}</p>
        ${renderTravelDecisionButtons(id)}
      </article>`;
  }

  return `
    <a href="request-detail.html?id=${encodeURIComponent(id)}" class="request-card">
      <div class="request-card__header">
        <span class="request-card__dest">${escapeHtml(dest)}</span>
        <div class="request-card__badges">
          ${typeBadge}
          ${statusBadge(request.status)}
        </div>
      </div>
      <div class="request-card__meta">
        <span>${escapeHtml(dates)}</span>
        ${request.requestedBy ? `<span>Requested by: ${escapeHtml(requester)}</span>` : ''}
      </div>
      <p class="request-card__purpose">${escapeHtml(request.purposeOfTrip || '')}</p>
      <span class="btn btn--secondary btn--sm">View TAR Form</span>
    </a>`;
}

function bindTravelApprovalCard(card, options = {}) {
  const id = card.dataset.requestId;
  const rejectForm = card.querySelector('.reject-form');
  const commentEl = card.querySelector('.reject-comment');
  const approveBtn = card.querySelector('.approve-btn');
  const signatureEl = card.querySelector('.approval-signature');
  const rejectToggleBtn = card.querySelector('.reject-toggle-btn');
  const confirmRejectBtn = card.querySelector('.confirm-reject-btn');
  const cancelRejectBtn = card.querySelector('.cancel-reject-btn');
  if (!approveBtn || !rejectToggleBtn || !confirmRejectBtn) return;

  approveBtn.addEventListener('click', async () => {
    const signature = signatureEl?.value.trim() || '';
    if (!signature) {
      showToast('Your signature is required before approval.', 'warning');
      signatureEl?.focus();
      return;
    }

    await runDecisionAction(approveBtn, {
      confirmMessage: 'Approve this travel request?',
      loadingText: 'Approving…',
      action: () => approveRequest(id, { signature }),
      successMessage: 'Travel request approved.',
      errorMessage: 'Failed to approve travel request.',
      onSuccess: () => {
        if (typeof options.onSuccess === 'function') options.onSuccess(card);
        if (typeof refreshApprovalBadges === 'function') refreshApprovalBadges();
      },
    });
  });

  rejectToggleBtn.addEventListener('click', () => {
    rejectForm.hidden = !rejectForm.hidden;
  });

  cancelRejectBtn?.addEventListener('click', () => {
    rejectForm.hidden = true;
    if (commentEl) commentEl.value = '';
  });

  confirmRejectBtn.addEventListener('click', async () => {
    const comment = commentEl?.value.trim() || '';
    if (!comment) {
      showToast('A rejection comment is required.', 'warning');
      commentEl?.focus();
      return;
    }

    await runDecisionAction(confirmRejectBtn, {
      confirmMessage: 'Reject this travel request?',
      loadingText: 'Rejecting…',
      action: () => rejectRequest(id, comment),
      successMessage: 'Travel request rejected.',
      errorMessage: 'Failed to reject travel request.',
      onSuccess: () => {
        if (typeof options.onSuccess === 'function') options.onSuccess(card);
        if (typeof refreshApprovalBadges === 'function') refreshApprovalBadges();
      },
    });
  });
}

function bindTravelApprovalActions(root, options = {}) {
  root.querySelectorAll('.approval-card[data-request-id]').forEach((card) => {
    bindTravelApprovalCard(card, options);
  });
}

function initSignaturePad(root) {
  const canvas = root.querySelector('.signature-pad');
  const upload = root.querySelector('.signature-upload');
  const valueInput = root.querySelector('.signature-value');
  const clearButton = root.querySelector('.clear-signature-btn');
  if (!canvas) return () => '';

  const context = canvas.getContext('2d');
  let hasSignature = false;
  let drawing = false;

  context.strokeStyle = '#123a8c';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    hasSignature = true;
    if (valueInput) valueInput.value = canvas.toDataURL('image/png');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });

  upload?.addEventListener('change', () => {
    const file = upload.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file for the signature.', 'warning');
      upload.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        hasSignature = true;
        if (valueInput) valueInput.value = canvas.toDataURL('image/png');
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  clearButton?.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    if (valueInput) valueInput.value = '';
    if (upload) upload.value = '';
  });

  return () => valueInput?.value || (hasSignature ? canvas.toDataURL('image/png') : '');
}

function renderRequestDetail(request) {
  const p = request.project || {};
  const it = request.itinerary || {};
  const approver = getRequestApproverLabel(request);
  const requester = getRequesterLabel(request);

  let passengersHtml = '<p class="text-muted">No passengers listed</p>';
  if (request.passengers?.length) {
    passengersHtml = `<ul class="detail-list">${request.passengers
      .map((pass) => {
        const user = pass.user && typeof pass.user === 'object' ? pass.user : null;
        const name = user?.name || pass.name || '—';
        const emp = user?.employeeNumber || pass.employeeNumber;
        const email = user?.email;
        const bits = [emp ? `(${emp})` : null, email || null].filter(Boolean).join(' ');
        return `<li>${escapeHtml(name)}${bits ? ` ${escapeHtml(bits)}` : ''}</li>`;
      })
      .join('')}</ul>`;
  }

  const rejectionComment = request.decision?.comment;
  let rejectionHtml = '';
  if (request.status === 'rejected' && rejectionComment) {
    rejectionHtml = `
      <section class="detail-section detail-section--rejected">
        <h3>Rejection Reason</h3>
        <p>${escapeHtml(rejectionComment)}</p>
      </section>`;
  }

  return `
    <div class="page-header">
      <div>
        <a href="javascript:history.back()" class="back-link">← Back</a>
        <h1>Travel Request Details</h1>
      </div>
      ${statusBadge(request.status)}
    </div>

    ${rejectionHtml}

    <section class="detail-section">
      <h2>Project Information</h2>
      <dl class="detail-grid">
        <dt>Project Name</dt><dd>${escapeHtml(p.name)}</dd>
        <dt>Business Unit</dt><dd>${escapeHtml(p.businessUnit)}</dd>
        <dt>Fund Code</dt><dd>${escapeHtml(p.fundCode)}</dd>
        <dt>Project ID</dt><dd>${escapeHtml(p.projectId)}</dd>
        <dt>Department ID</dt><dd>${escapeHtml(p.departmentId)}</dd>
        <dt>Activity ID</dt><dd>${escapeHtml(p.activityId)}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h2>Trip Details</h2>
      <dl class="detail-grid">
        <dt>Area of Operation</dt><dd>${escapeHtml(request.assignedAreaOfOperation)}</dd>
        <dt>Employees Office</dt><dd>${escapeHtml(request.employeeOffice || request.requestedBy?.office || '—')}</dd>
        <dt>Purpose of Trip</dt><dd>${escapeHtml(request.purposeOfTrip)}</dd>
        <dt>Mode of Travel</dt><dd>${escapeHtml(formatModeOfTravel(request.modeOfTravel))}</dd>
        <dt>Destination</dt><dd>${escapeHtml(it.destination)}</dd>
        <dt>Travel Dates</dt><dd>${formatDate(it.dateFrom)} – ${formatDate(it.dateTo)}</dd>
        <dt>Accommodation Needed</dt><dd>${it.accommodationNeeded ? 'Yes' : 'No'}</dd>
      </dl>
      ${(request.travelSegments || []).length ? `<h3>Additional Travel Segments</h3><div class="detail-grid">${request.travelSegments.map((segment) => `<dt>Route</dt><dd>${escapeHtml(segment.from)} → ${escapeHtml(segment.to)}: ${escapeHtml(segment.destination)} (${formatDate(segment.dateFrom)} – ${formatDate(segment.dateTo)})</dd>`).join('')}</div>` : ''}
    </section>

    <section class="detail-section">
      <h2>Passengers</h2>
      ${passengersHtml}
    </section>

    <section class="detail-section">
      <h2>Workflow</h2>
      <dl class="detail-grid">
        <dt>Requested By</dt><dd>${escapeHtml(requester)}</dd>
        <dt>Selected Approver</dt><dd>${escapeHtml(approver)}</dd>
        <dt>Submitted</dt><dd>${formatDateTime(request.submittedAt || request.createdAt)}</dd>
        ${request.updatedAt ? `<dt>Last Updated</dt><dd>${formatDateTime(request.updatedAt)}</dd>` : ''}
      </dl>
    </section>`;
}
