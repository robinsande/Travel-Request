function formatDateInput(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function parseDateInput(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function bindDatePicker(textInput, picker) {
  if (!textInput || !picker) return;

  const syncPicker = () => {
    const parsed = parseDateInput(textInput.value);
    picker.value = /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : '';
  };

  textInput.addEventListener('input', syncPicker);
  picker.addEventListener('change', () => {
    textInput.value = formatDateInput(picker.value);
    textInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  textInput.parentElement.querySelector('.date-input__button')?.addEventListener('click', () => {
    syncPicker();
    if (typeof picker.showPicker === 'function') picker.showPicker();
    else picker.focus();
  });
  syncPicker();
}

function bindDatePickers(root = document) {
  root.querySelectorAll('[data-date-text]').forEach((textInput) => {
    bindDatePicker(textInput, textInput.parentElement.querySelector('[data-date-picker]'));
  });
}

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
    selected_approver_ids: Array.from(form.querySelector('[name="selected_approver_ids"]')?.selectedOptions || []).map((option) => option.value),
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
      dateFrom: parseDateInput(fd.get('itinerary_dateFrom')),
      dateTo: parseDateInput(fd.get('itinerary_dateTo')),
      destination: fd.get('itinerary_destination')?.trim() || '',
      accommodationNeeded: fd.get('itinerary_accommodationNeeded') === 'on',
    },
    travelSegments: Array.from(form.querySelectorAll('.travel-segment')).map((row) => ({
      from: row.querySelector('[data-segment="from"]').value.trim(),
      to: row.querySelector('[data-segment="to"]').value.trim(),
      destination: row.querySelector('[data-segment="destination"]').value.trim(),
      dateFrom: parseDateInput(row.querySelector('[data-segment="dateFrom"]').value),
      dateTo: parseDateInput(row.querySelector('[data-segment="dateTo"]').value),
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
  set('itinerary_dateFrom', formatDateInput(it.dateFrom));
  set('itinerary_dateTo', formatDateInput(it.dateTo));
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
    <div class="form-group"><label>Arrival</label><div class="date-input"><input type="text" inputmode="numeric" data-segment="dateFrom" data-date-text placeholder="DD/MM/YYYY" pattern="\\d{1,2}/\\d{1,2}/\\d{4}" required value="${escapeHtml(formatDateInput(segment.dateFrom))}" /><button type="button" class="date-input__button" aria-label="Open arrival date picker">&#128197;</button><input type="date" data-date-picker tabindex="-1" aria-hidden="true" /></div></div>
    <div class="form-group"><label>Departure</label><div class="date-input"><input type="text" inputmode="numeric" data-segment="dateTo" data-date-text placeholder="DD/MM/YYYY" pattern="\\d{1,2}/\\d{1,2}/\\d{4}" required value="${escapeHtml(formatDateInput(segment.dateTo))}" /><button type="button" class="date-input__button" aria-label="Open departure date picker">&#128197;</button><input type="date" data-date-picker tabindex="-1" aria-hidden="true" /></div></div>
    <button type="button" class="btn btn--danger btn--sm remove-travel-segment">Remove</button>`;
  row.querySelector('.remove-travel-segment').addEventListener('click', () => row.remove());
  container.appendChild(row);
  bindDatePickers(row);
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
    if (container.querySelectorAll('.passenger-row').length > 1) {
      row.remove();
      container.dispatchEvent(new Event('change', { bubbles: true }));
    } else showToast('At least one passenger is required.', 'warning');
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
  const approvers = request.selected_approver_ids?.length
    ? request.selected_approver_ids
    : [request.selected_approver_id];
  const labels = approvers.map((approver) => approver?.name || approver?.email || getEntityId(approver)).filter(Boolean);
  if (labels.length) return labels.join(', ');
  return (
    request.selected_approver_id?.name ||
    request.selected_approver_id?.email ||
    'Selected approver not available'
  );
}

function getRequestApproverIds(request) {
  const approvers = request.selected_approver_ids?.length
    ? request.selected_approver_ids
    : [request.selected_approver_id];
  return approvers.map((approver) => getEntityId(approver) || approver).filter(Boolean);
}

function getRequestDateRange(request) {
  return `${formatDate(request.itinerary?.dateFrom)} – ${formatDate(request.itinerary?.dateTo)}`;
}

function canApproveTravelRequest(request, user = getUser()) {
  if (!user || user.role !== 'admin' || request?.status !== 'pending') return false;
  const uid = String(user.id || user._id || '');
  const approverIds = request.selected_approver_ids?.length
    ? request.selected_approver_ids.map((approver) => String(getEntityId(approver) || approver))
    : [String(getSelectedApproverId(request) || '')];
  return Boolean(uid && approverIds.includes(uid));
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
      <input type="text" class="signature-text-input" placeholder="Or type your full name as a digital signature" autocomplete="off" />
      <input type="hidden" class="signature-value approval-signature" />
      <button type="button" class="btn btn--ghost btn--sm clear-signature-btn">Clear signature</button>
      <label>Approval date</label>
      <input type="date" class="approval-date" value="${new Date().toISOString().slice(0, 10)}" />
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
  const approvalDateEl = card.querySelector('.approval-date');
  const rejectToggleBtn = card.querySelector('.reject-toggle-btn');
  const confirmRejectBtn = card.querySelector('.confirm-reject-btn');
  const cancelRejectBtn = card.querySelector('.cancel-reject-btn');
  if (!approveBtn || !rejectToggleBtn || !confirmRejectBtn) return;

  approveBtn.addEventListener('click', async () => {
    const signature = signatureEl?.value.trim() || '';
    const decisionDate = approvalDateEl?.value || '';
    if (!signature) {
      showToast('Your signature is required before approval.', 'warning');
      signatureEl?.focus();
      return;
    }

    await runDecisionAction(approveBtn, {
      confirmMessage: 'Approve this travel request?',
      loadingText: 'Approving…',
      action: () => approveRequest(id, { signature, decisionDate }),
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
  const textInput = root.querySelector('.signature-text-input');
  const valueInput = root.querySelector('.signature-value');
  const clearButton = root.querySelector('.clear-signature-btn');
  if (!canvas) return () => '';

  const context = canvas.getContext('2d');
  let hasSignature = false;
  let drawing = false;

  context.strokeStyle = '#0000FF';
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
    if (textInput) textInput.value = '';
    if (valueInput) valueInput.value = canvas.toDataURL('image/png');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  });
  canvas.addEventListener('pointerup', () => {
    drawing = false;
    if (valueInput && hasSignature) valueInput.value = canvas.toDataURL('image/png');
  });
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
        if (textInput) textInput.value = '';
        if (valueInput) valueInput.value = canvas.toDataURL('image/png');
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  textInput?.addEventListener('input', () => {
    const value = textInput.value.trim();
    if (value) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasSignature = false;
      if (upload) upload.value = '';
    }
    if (valueInput) valueInput.value = value;
  });

  clearButton?.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    if (valueInput) valueInput.value = '';
    if (upload) upload.value = '';
    if (textInput) textInput.value = '';
  });

  return () => valueInput?.value || (hasSignature ? canvas.toDataURL('image/png') : '');
}

function renderRequestDetail(request) {
  const p = request.project || {};
  const it = request.itinerary || {};
  const approver = getRequestApproverLabel(request);
  const requester = getRequesterLabel(request);
  const passengers = (request.passengers || []).map((pass) => {
    const user = pass.user && typeof pass.user === 'object' ? pass.user : null;
    return {
      name: user?.name || pass.name || '—',
      employeeNumber: user?.employeeNumber || pass.employeeNumber || '—',
    };
  });
  const office = request.employeeOffice || request.requestedBy?.office || '—';
  const fieldValue = (value, fallback = '—') => {
    const text = value == null || value === '' ? fallback : String(value);
    const isFilled = value != null && value !== '' && text !== '—' && text !== 'No signature captured';
    return `<span class="${isFilled ? 'tar-preview__filled-value' : 'tar-preview__blank-value'}">${escapeHtml(text)}</span>`;
  };
  const signatureCell = (signature, label) => signature
    ? `<img class="tar-preview__signature" src="${signature}" alt="${escapeHtml(label)}" />`
    : '<span class="tar-preview__missing">No signature captured</span>';
  const passengerNames = passengers.map((passenger) => passenger.name).join(', ') || requester;
  const passengerNumbers = passengers.map((passenger) => passenger.employeeNumber).join(', ') || '—';
  const mode = request.modeOfTravel || {};
  const travelMode = [
    `${mode.careVehicle ? '[X]' : '[ ]'} CARE Vehicle`,
    `${mode.publicTransport ? '[X]' : '[ ]'} Public Transport`,
    `${mode.aircraft ? '[X]' : '[ ]'} Aircraft`,
  ].join('   ');
  const hasTravelMode = Boolean(mode.careVehicle || mode.publicTransport || mode.aircraft);
  const status = String(request.status || 'pending').toUpperCase();
  const statusLabel = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'DECLINED' : 'PENDING APPROVAL';
  const attachments = request.attachments || [];
  const renderAttachments = (category, label) => {
    const files = attachments.filter((attachment) => attachment.category === category);
    if (!files.length) return '';
    return `<div class="detail-section"><h2>${label}</h2><div class="btn-group">${files.map((attachment) => `<button type="button" class="btn btn--secondary btn--sm request-attachment-btn" data-attachment-id="${escapeHtml(String(attachment._id))}" data-attachment-name="${escapeHtml(attachment.originalName)}">${escapeHtml(attachment.originalName)}</button>`).join('')}</div></div>`;
  };

  return `
    <div class="tar-preview-wrap">
      <a href="javascript:history.back()" class="back-link">&larr; Back</a>
      <article class="tar-preview">
        <div class="tar-preview__logo"><img src="assets/care-logo.jpg" alt="CARE logo" /><small>CARE KENYA</small></div>
        <h1>COUNTRY OFFICES FLEET POLICIES</h1>
        <h2>3.5.7 &nbsp; TRAVEL AUTHORIZATION REQUEST</h2>
        <table>
          <tbody>
            <tr><th>Employee<br>Name</th><td>${fieldValue(passengerNames, '')}</td><th>Employee<br>Number</th><td>${fieldValue(passengerNumbers, '')}</td><th>Project<br>Name</th><td>${fieldValue(p.name)}</td></tr>
            <tr><th>Business Unit:</th><td>${fieldValue(p.businessUnit)}</td><th>Fund Code:</th><td>${fieldValue(p.fundCode)}</td><th></th><td></td></tr>
            <tr><th>Project ID:</th><td>${fieldValue(p.projectId)}</td><th>Department ID:</th><td>${fieldValue(p.departmentId)}</td><th>Activity ID:</th><td>${fieldValue(p.activityId)}</td></tr>
            <tr><th>Assigned Area<br>of Operation</th><td colspan="2">${fieldValue(request.assignedAreaOfOperation)}</td><th>Employees<br>Office</th><td colspan="2">${fieldValue(office)}</td></tr>
            <tr><th>Purpose of the Trip</th><td colspan="5">${fieldValue(request.purposeOfTrip)}</td></tr>
            <tr><th>Mode of Travel</th><td colspan="5">${fieldValue(hasTravelMode ? travelMode : '')}</td></tr>
            <tr><th colspan="6" class="tar-preview__section-title">Travel Itinerary (must be completed prior to supervisor authorizing travel)</th></tr>
            <tr><th>Date From</th><th>Date To</th><th colspan="2">Destination</th><th>Passengers</th><th>Accommodation</th></tr>
            <tr><td>${fieldValue(it.dateFrom ? formatDate(it.dateFrom) : '')}</td><td>${fieldValue(it.dateTo ? formatDate(it.dateTo) : '')}</td><td colspan="2">${fieldValue(it.destination)}</td><td>${fieldValue(passengers.length || '')}</td><td>${fieldValue(it.accommodationNeeded ? 'Yes' : '')}</td></tr>
            ${(request.travelSegments || []).length ? `<tr><th colspan="6" class="tar-preview__section-title">Additional Travel Destinations</th></tr><tr><th>Arrival</th><th>Departure</th><th>From</th><th>To</th><th colspan="2">Destination</th></tr>${request.travelSegments.map((segment) => `<tr><td>${formatDate(segment.dateFrom)}</td><td>${formatDate(segment.dateTo)}</td><td>${escapeHtml(segment.from || '—')}</td><td>${escapeHtml(segment.to || '—')}</td><td colspan="2">${escapeHtml(segment.destination || '—')}</td></tr>`).join('')}` : ''}
            <tr class="tar-preview__signature-row"><th>Requested by:<br><br>Signature:</th><td colspan="3">${fieldValue(requester)}<br>${signatureCell(request.requesterSignature, 'Requester signature')}</td><td colspan="2">Date: ${fieldValue(request.submittedAt || request.createdAt ? formatDate(request.submittedAt || request.createdAt) : '')}</td></tr>
            <tr class="tar-preview__signature-row"><th>Travel<br>Authorized<br>by:</th><td>Print Name:<br>${fieldValue(approver)}</td><td>Position:<br>${fieldValue(request.decision?.decidedBy?.position || request.selected_approver_id?.position || 'Supervisor / Approver')}</td><td>Signature:<br>${signatureCell(request.decision?.signature, 'Approver signature')}</td><td colspan="2">Date:<br>${fieldValue(request.decision?.decidedAt || request.submittedAt ? formatDate(request.decision?.decidedAt || request.submittedAt) : '')}</td></tr>
            <tr><td colspan="6" class="tar-preview__center-note">To be signed by supervisor once all is completed</td></tr>
            <tr><td colspan="6" class="tar-preview__fine-print">Note: This form must be produced in 3 or 4 copies BEFORE travel is undertaken. The signed original is to be submitted to the Finance Unit when seeking an advance or claiming reimbursement, another photocopy provided to the Security Officer and the Fleet Officer if requesting a CARE vehicle for travel, and the third copy for employee's records/file.</td></tr>
          </tbody>
        </table>
        <div class="tar-preview__status">TAR STATUS: ${escapeHtml(statusLabel)}</div>
        <div class="tar-preview__meta">Request ID: ${escapeHtml(String(request._id || ''))} &nbsp;&nbsp; Approved/Reviewed by: ${escapeHtml(approver)}</div>
      </article>
      ${renderAttachments('scope', 'Scope Documents')}
      ${renderAttachments('supporting', 'Other Supporting Documents')}
    </div>`;
}
