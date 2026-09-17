/* =========================================================
   US COURIER
   ADMIN PORTAL JAVASCRIPT
========================================================= */


/* =========================================================
   CREATE PARCEL BUTTON
========================================================= */

function bindCreateParcelButton() {
  const button = document.getElementById('open-create-shipment-btn');

  if (!button) {
    return;
  }

  button.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();

    showModal('modal-create-shipment');
  });
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

async function handleAdminLogin(e) {
  e.preventDefault();

  const emailEl =
    document.getElementById('login-email');

  const passwordEl =
    document.getElementById('login-password');

  if (!emailEl || !passwordEl) {
    console.error(
      'Admin login fields were not found.'
    );

    alert(
      'Admin login form is unavailable.'
    );

    return;
  }

  const email =
    emailEl.value.trim();

  const password =
    passwordEl.value;

  if (!email || !password) {
    alert(
      'Please enter your email and password.'
    );

    return;
  }

  try {
    const res =
      await fetch(
        '/api/auth/login',
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    let data = {};

    try {
      data =
        await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      alert(
        data.error ||
        'Invalid Operator Credentials'
      );

      return;
    }

    /*
     * The backend sets the authentication cookie.
     * No token is stored in localStorage.
     */

    await loadAdminDashboard();

  } catch (err) {
    console.error(
      'Admin login error:',
      err
    );

    alert(
      'Server Connection Error'
    );
  }
}


/* =========================================================
   ADMIN LOGOUT
========================================================= */

async function handleAdminLogout() {

  try {

    await fetch(
      '/api/auth/logout',
      {
        method: 'POST',

        credentials: 'include'
      }
    );

  } catch (error) {

    console.warn(
      'Logout request failed:',
      error
    );

  } finally {

    showSection(
      'admin-login'
    );
  }
}


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

async function loadAdminDashboard() {

  showSection(
    'admin-dashboard'
  );

  try {

    /* -----------------------------------------------------
       DASHBOARD STATISTICS
    ----------------------------------------------------- */

    const resStats =
      await fetch(
        '/api/admin/dashboard',
        {
          method: 'GET',

          credentials: 'include'
        }
      );

    if (
      resStats.status === 401 ||
      resStats.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }

    if (!resStats.ok) {

      throw new Error(
        'Unable to load dashboard statistics.'
      );
    }

    let stats = {};

    try {

      stats =
        await resStats.json();

    } catch {

      stats = {};
    }


    const counts =
      stats.counts || {};


    const totalEl =
      document.getElementById(
        'kpi-total'
      );

    const transitEl =
      document.getElementById(
        'kpi-transit'
      );

    const deliveredEl =
      document.getElementById(
        'kpi-delivered'
      );

    const messagesEl =
      document.getElementById(
        'kpi-messages'
      );


    if (totalEl) {

      totalEl.innerText =
        counts.total ?? 0;
    }


    if (transitEl) {

      transitEl.innerText =
        counts.in_transit ?? 0;
    }


    if (deliveredEl) {

      deliveredEl.innerText =
        counts.delivered ?? 0;
    }


    if (messagesEl) {

      messagesEl.innerText =
        stats.unread_messages ??
        counts.messages ??
        0;
    }


    /* -----------------------------------------------------
       LOAD CUSTOMER MESSAGES
    ----------------------------------------------------- */

    const resMessages =
      await fetch(
        '/api/admin/messages',
        {
          method: 'GET',

          credentials: 'include'
        }
      );


    if (
      resMessages.status === 401 ||
      resMessages.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (!resMessages.ok) {

      throw new Error(
        'Unable to load customer messages.'
      );
    }


    let messagesPayload = {};

    try {

      messagesPayload =
        await resMessages.json();

    } catch {

      messagesPayload = {};
    }


    const messages =
      Array.isArray(
        messagesPayload
      )
        ? messagesPayload
        : Array.isArray(
            messagesPayload.messages
          )
          ? messagesPayload.messages
          : [];


    const msgTbody =
      document.getElementById(
        'admin-messages-tbody'
      );


    if (msgTbody) {

      msgTbody.innerHTML = '';


      if (messages.length === 0) {

        msgTbody.innerHTML = `
          <tr>
            <td
              colspan="7"
              style="
                text-align:center;
                padding:2rem;
                color:var(--text-muted);
              "
            >
              <i
                class="icon icon-inbox"
                style="
                  font-size:1.5rem;
                  margin-bottom:0.5rem;
                  display:block;
                "
              ></i>

              No customer messages received.
            </td>
          </tr>
        `;

      } else {

        messages.forEach(
          (m) => {

            const tr =
              document.createElement(
                'tr'
              );


            const isUnread =
              String(
                m.status || ''
              ).toLowerCase() ===
              'unread';


            const safeName =
              escapeAdminHtml(
                m.sender_name ||
                m.name ||
                'Customer'
              );


            const safeEmail =
              escapeAdminHtml(
                m.email || ''
              );


            const safeSubject =
              escapeAdminHtml(
                m.subject ||
                'No Subject'
              );


            const safeMessage =
              escapeAdminHtml(
                m.message || ''
              );


            const safeDate =
              formatAdminDate(
                m.created_at
              );


            const messageId =
              Number(m.id);


            tr.innerHTML = `
              <td>
                <strong>
                  ${safeName}
                </strong>
              </td>

              <td>
                ${
                  m.email
                    ? `
                      <a
                        href="mailto:${encodeURIComponent(
                          String(m.email)
                        )}"
                        style="
                          color:var(--accent-gold);
                        "
                      >
                        ${safeEmail}
                      </a>
                    `
                    : '—'
                }
              </td>

              <td>
                ${safeSubject}
              </td>

              <td
                style="
                  max-width:250px;
                  font-size:0.85rem;
                  color:var(--text-muted);
                "
              >
                ${safeMessage}
              </td>

              <td
                style="
                  font-size:0.8rem;
                "
              >
                ${safeDate}
              </td>

              <td>
                <span
                  class="badge ${
                    isUnread
                      ? 'badge-pending'
                      : 'badge-delivered'
                  }"
                >
                  ${safeStatus(
                    m.status ||
                    'Unknown'
                  )}
                </span>
              </td>

              <td>
                <div
                  style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:0.4rem;
                  "
                >

                  <button
                    type="button"
                    class="btn-gold"
                    style="
                      padding:0.3rem 0.65rem;
                      font-size:0.75rem;
                    "
                    data-message-action="reply"
                    data-message-id="${messageId}"
                  >
                    <i class="icon icon-reply"></i>
                    Reply
                  </button>

                  ${
                    isUnread
                      ? `
                        <button
                          type="button"
                          class="btn-outline"
                          style="
                            padding:0.3rem 0.65rem;
                            font-size:0.75rem;
                          "
                          data-message-action="read"
                          data-message-id="${messageId}"
                        >
                          Mark Read
                        </button>
                      `
                      : ''
                  }

                  <button
                    type="button"
                    class="btn-outline"
                    style="
                      padding:0.3rem 0.65rem;
                      font-size:0.75rem;
                      border-color:var(--status-delayed);
                      color:var(--status-delayed);
                    "
                    data-message-action="delete"
                    data-message-id="${messageId}"
                  >
                    <i class="icon icon-trash"></i>
                    Delete
                  </button>

                </div>
              </td>
            `;


            const replyButton =
              tr.querySelector(
                '[data-message-action="reply"]'
              );

            if (replyButton) {

              replyButton.addEventListener(
                'click',
                () =>
                  openMessageReply(
                    messageId
                  )
              );
            }


            const readButton =
              tr.querySelector(
                '[data-message-action="read"]'
              );

            if (readButton) {

              readButton.addEventListener(
                'click',
                () =>
                  markMessageRead(
                    messageId
                  )
              );
            }


            const deleteButton =
              tr.querySelector(
                '[data-message-action="delete"]'
              );

            if (deleteButton) {

              deleteButton.addEventListener(
                'click',
                () =>
                  deleteMessage(
                    messageId
                  )
              );
            }


            msgTbody.appendChild(
              tr
            );
          }
        );
      }
    }


    /* -----------------------------------------------------
       LOAD SHIPMENTS
    ----------------------------------------------------- */

    const resShipments =
      await fetch(
        '/api/admin/shipments',
        {
          method: 'GET',

          credentials: 'include'
        }
      );


    if (
      resShipments.status === 401 ||
      resShipments.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (!resShipments.ok) {

      throw new Error(
        'Unable to load shipments.'
      );
    }


    let shipmentsPayload = {};

    try {

      shipmentsPayload =
        await resShipments.json();

    } catch {

      shipmentsPayload = {};
    }


    const shipments =
      Array.isArray(
        shipmentsPayload
      )
        ? shipmentsPayload
        : Array.isArray(
            shipmentsPayload.shipments
          )
          ? shipmentsPayload.shipments
          : [];


    const tbody =
      document.getElementById(
        'admin-shipments-tbody'
      );


    if (tbody) {

      tbody.innerHTML = '';


      if (shipments.length === 0) {

        tbody.innerHTML = `
          <tr>
            <td
              colspan="6"
              style="
                text-align:center;
                padding:2rem;
                color:var(--text-muted);
              "
            >
              No shipments available.
            </td>
          </tr>
        `;

      } else {

        shipments.forEach(
          (s) => {

            const tr =
              document.createElement(
                'tr'
              );


            const shipmentId =
              Number(s.id);


            const status =
              String(
                s.status ||
                'Pending'
              );


            const currentLocation =
              String(
                s.current_location ||
                ''
              );


            tr.innerHTML = `
              <td>
                <strong
                  style="
                    color:var(--accent-gold);
                  "
                >
                  ${escapeAdminHtml(
                    s.tracking_number
                  )}
                </strong>
              </td>

              <td>
                ${escapeAdminHtml(
                  s.origin ||
                  ''
                )}
                ➔
                ${escapeAdminHtml(
                  s.destination ||
                  ''
                )}
              </td>

              <td>
                ${escapeAdminHtml(
                  currentLocation
                )}
              </td>

              <td>
                ${escapeAdminHtml(
                  s.service_type ||
                  'Express'
                )}
              </td>

              <td>
                <span
                  class="badge badge-transit"
                >
                  ${safeStatus(
                    status
                  )}
                </span>
              </td>

              <td>
                <div
                  style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:0.35rem;
                  "
                >
                  <button
                    type="button"
                    class="btn-gold"
                    style="
                      padding:0.2rem 0.6rem;
                      font-size:0.75rem;
                    "
                    data-shipment-update-id="${shipmentId}"
                  >
                    <i class="icon icon-edit"></i>
                    Update
                  </button>

                  <button
                    type="button"
                    class="btn-outline"
                    style="
                      padding:0.2rem 0.6rem;
                      font-size:0.75rem;
                    "
                    data-shipment-track-id="${shipmentId}"
                  >
                    <i class="icon icon-map"></i>
                    View Tracking
                  </button>

                  <button
                    type="button"
                    class="btn-outline"
                    style="
                      padding:0.2rem 0.6rem;
                      font-size:0.75rem;
                    "
                    data-shipment-print-id="${shipmentId}"
                  >
                    <i class="icon icon-print"></i>
                    Print Tracking
                  </button>
                </div>
              </td>
            `;


            const updateButton =
              tr.querySelector(
                '[data-shipment-update-id]'
              );

            const trackingButton =
              tr.querySelector(
                '[data-shipment-track-id]'
              );

            const printButton =
              tr.querySelector(
                '[data-shipment-print-id]'
              );


            if (updateButton) {

              updateButton.addEventListener(
                'click',
                () => openUpdateShipmentModal(s)
              );
            }


            if (trackingButton) {

              trackingButton.addEventListener(
                'click',
                () => viewShipmentTracking(s)
              );
            }


            if (printButton) {

              printButton.addEventListener(
                'click',
                () => printShipmentTracking(s)
              );
            }


            tbody.appendChild(
              tr
            );
          }
        );
      }
    }

  } catch (err) {

    console.error(
      'Error loading operations console:',
      err
    );

    alert(
      err.message ||
      'Unable to load admin dashboard.'
    );
  }
}


/* =========================================================
   VIEW SHIPMENT TRACKING
========================================================= */

function viewShipmentTracking(shipment) {

  if (!shipment || !shipment.id) {
    alert('Unable to open tracking details.');
    return;
  }

  const titleEl =
    document.getElementById('tracking-events-title');

  if (titleEl) {
    titleEl.textContent =
      'Tracking: ' +
      (shipment.tracking_number || 'Unknown');
  }

  const tbody =
    document.getElementById('tracking-events-tbody');

  const loadingEl =
    document.getElementById('tracking-events-loading');

  const errorEl =
    document.getElementById('tracking-events-error');

  const emptyEl =
    document.getElementById('tracking-events-empty');

  const tableWrap =
    document.getElementById('tracking-events-table-wrap');

  if (!tbody || !loadingEl || !errorEl || !emptyEl || !tableWrap) {
    alert('Tracking details interface is unavailable.');
    return;
  }

  tbody.innerHTML = '';

  loadingEl.style.display = 'block';
  errorEl.style.display = 'none';
  emptyEl.style.display = 'none';
  tableWrap.style.display = 'none';

  window.__adminTrackingShipmentId = shipment.id;

  showModal('modal-tracking-events');

  loadAdminShipmentEvents(shipment.id);
}


/* =========================================================
   ADMIN TRACKING EVENTS
========================================================= */

async function loadAdminShipmentEvents(shipmentId) {

  const tbody =
    document.getElementById('tracking-events-tbody');

  const loadingEl =
    document.getElementById('tracking-events-loading');

  const errorEl =
    document.getElementById('tracking-events-error');

  const emptyEl =
    document.getElementById('tracking-events-empty');

  const tableWrap =
    document.getElementById('tracking-events-table-wrap');

  if (!tbody || !loadingEl || !errorEl || !emptyEl || !tableWrap) {
    return;
  }

  try {

    const response =
      await fetch(
        '/api/admin/shipments/' +
        encodeURIComponent(shipmentId) +
        '/events',
        {
          method: 'GET',
          credentials: 'include'
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    if (!response.ok || data.success !== true) {
      throw new Error(
        data.error ||
        'Failed to load tracking updates.'
      );
    }

    const events =
      Array.isArray(data.events)
        ? data.events
        : [];

    tbody.innerHTML = '';

    loadingEl.style.display = 'none';

    if (events.length === 0) {
      emptyEl.style.display = 'block';
      tableWrap.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    tableWrap.style.display = 'block';

    events.forEach((event) => {

      const tr =
        document.createElement('tr');

      tr.style.borderTop =
        '1px solid rgba(0,0,0,0.08)';

      const status =
        event.status || '—';

      const location =
        event.location || '—';

      const description =
        event.description || '—';

      const eventTime =
        formatAdminEventDate(event.event_time);

      tr.innerHTML = `
        <td style="padding:0.75rem; font-weight:600;">
          ${escapeAdminHtml(status)}
        </td>

        <td style="padding:0.75rem;">
          ${escapeAdminHtml(location)}
        </td>

        <td style="padding:0.75rem;">
          ${escapeAdminHtml(description)}
        </td>

        <td style="padding:0.75rem; white-space:nowrap;">
          ${escapeAdminHtml(eventTime)}
        </td>

        <td style="padding:0.75rem; text-align:right;">
          <button
            type="button"
            class="btn-outline"
            data-edit-event-id="${event.id}"
          >
            <i class="icon icon-edit"></i>
            Edit
          </button>
        </td>
      `;

      const editButton =
        tr.querySelector(
          '[data-edit-event-id]'
        );

      if (editButton) {
        editButton.addEventListener(
          'click',
          () => openEditTrackingEventModal(event)
        );
      }

      tbody.appendChild(tr);
    });

  } catch (error) {

    console.error(
      'Load tracking events error:',
      error
    );

    loadingEl.style.display = 'none';
    tableWrap.style.display = 'none';
    emptyEl.style.display = 'none';

    errorEl.textContent =
      error.message ||
      'Failed to load tracking updates.';

    errorEl.style.display = 'block';
  }
}


/* =========================================================
   OPEN TRACKING EVENT EDITOR
========================================================= */

function openEditTrackingEventModal(event) {

  if (!event || !event.id) {
    alert('Invalid tracking update.');
    return;
  }

  const idEl =
    document.getElementById('edit-event-id');

  const statusEl =
    document.getElementById('edit-event-status');

  const locationEl =
    document.getElementById('edit-event-location');

  const descriptionEl =
    document.getElementById('edit-event-description');

  const timeEl =
    document.getElementById('edit-event-time');

  const referenceEl =
    document.getElementById('edit-event-reference');

  if (
    !idEl ||
    !statusEl ||
    !locationEl ||
    !descriptionEl ||
    !timeEl ||
    !referenceEl
  ) {
    alert('Tracking update editor is unavailable.');
    return;
  }

  idEl.value =
    event.id;

  statusEl.value =
    event.status || '';

  locationEl.value =
    event.location || '';

  descriptionEl.value =
    event.description || '';

  timeEl.value =
    toAdminDateTimeLocal(event.event_time);

  referenceEl.textContent =
    'Update #' +
    event.id;

  showModal(
    'modal-edit-tracking-event'
  );
}


/* =========================================================
   SAVE TRACKING EVENT CORRECTION
========================================================= */

async function handleTrackingEventEditSubmit(e) {

  e.preventDefault();

  const id =
    document.getElementById(
      'edit-event-id'
    )?.value;

  const status =
    document.getElementById(
      'edit-event-status'
    )?.value.trim();

  const location =
    document.getElementById(
      'edit-event-location'
    )?.value.trim();

  const description =
    document.getElementById(
      'edit-event-description'
    )?.value.trim();

  const eventTime =
    document.getElementById(
      'edit-event-time'
    )?.value;

  const saveButton =
    document.getElementById(
      'save-tracking-event-btn'
    );

  if (!id) {
    alert('Invalid tracking update.');
    return;
  }

  if (!status) {
    alert('Status is required.');
    return;
  }

  const originalText =
    saveButton
      ? saveButton.textContent
      : '';

  try {

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }

    const response =
      await fetch(
        '/api/admin/shipment-events/' +
        encodeURIComponent(id),
        {
          method: 'PUT',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            status,
            location,
            description,
            event_time:
              eventTime
                ? new Date(eventTime).toISOString()
                : null
          })
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    if (!response.ok || data.success !== true) {
      throw new Error(
        data.error ||
        'Failed to save tracking correction.'
      );
    }

    hideModal(
      'modal-edit-tracking-event'
    );

    alert(
      'Tracking update corrected successfully.'
    );

    /*
     * Reload the event list so the admin immediately
     * sees the corrected route/update.
     */
    const title =
      document.getElementById(
        'tracking-events-title'
      )?.textContent || '';

    const trackingNumber =
      title.replace(
        /^Tracking:\s*/i,
        ''
      ).trim();

    /*
     * Find the shipment currently represented by the
     * tracking details modal and reload its events.
     */
    const rows =
      document.querySelectorAll(
        '#admin-shipments-tbody tr'
      );

    let shipmentId = null;

    rows.forEach((row) => {
      const text =
        row.textContent || '';

      if (
        !shipmentId &&
        trackingNumber &&
        text.includes(trackingNumber)
      ) {
        shipmentId =
          row.dataset.shipmentId || null;
      }
    });

    /*
     * The event API response is authoritative for the
     * current modal. If a shipment ID is available from
     * the stored admin tracking state, use it.
     */
    if (
      window.__adminTrackingShipmentId
    ) {
      shipmentId =
        window.__adminTrackingShipmentId;
    }

    if (shipmentId) {
      await loadAdminShipmentEvents(
        shipmentId
      );
    }

    /*
     * Refresh the shipment table as well.
     */
    await loadAdminDashboard();

  } catch (error) {

    console.error(
      'Save tracking event error:',
      error
    );

    alert(
      error.message ||
      'Failed to save tracking correction.'
    );

  } finally {

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent =
        originalText ||
        'Save Correction';
    }
  }
}


/* =========================================================
   TRACKING EVENT HELPERS
========================================================= */

function formatAdminEventDate(value) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString();
}


function toAdminDateTimeLocal(value) {

  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const pad =
    (n) => String(n).padStart(2, '0');

  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}


function escapeAdminHtml(value) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/* =========================================================
   PRINT SHIPMENT TRACKING
========================================================= */

function printShipmentTracking(shipment) {

  const trackingNumber =
    shipment?.tracking_number ||
    '';


  if (!trackingNumber) {

    alert(
      'This shipment does not have a tracking number.'
    );

    return;
  }


  /*
   * Reuse the existing official receipt generator.
   * This keeps the existing print design and QR system.
   */

  const generated =
    generateShipmentReceipt(
      shipment
    );


  if (!generated) {

    alert(
      'Unable to prepare the tracking receipt.'
    );

    return;
  }


  printShipmentReceipt();
}


/* =========================================================
   GENERATE OFFICIAL SHIPMENT RECEIPT
========================================================= */

function generateShipmentReceipt(
  shipment,
  fallback = {}
) {

  const trackingNumber =
    shipment?.tracking_number ||
    fallback.tracking_number ||
    '';

  if (!trackingNumber) {

    console.error(
      '[RECEIPT] Tracking number is missing.'
    );

    return false;
  }


  const setText =
    (id, value) => {

      const element =
        document.getElementById(id);

      if (element) {

        element.textContent =
          value || '-';
      }
    };


  setText(
    'prt-date',
    'Date: ' +
    new Date().toLocaleString()
  );

  setText(
    'prt-tracking',
    trackingNumber
  );

  setText(
    'prt-service',
    shipment.service_type ||
    fallback.service_type ||
    '-'
  );

  setText(
    'prt-status',
    shipment.status ||
    'Shipment Created'
  );

  setText(
    'prt-sender-name',
    'Name: ' +
    (
      shipment.sender_name ||
      fallback.sender_name ||
      '-'
    )
  );

  setText(
    'prt-sender-origin',
    'Origin: ' +
    (
      shipment.origin ||
      fallback.origin ||
      '-'
    )
  );

  setText(
    'prt-recipient-name',
    'Name: ' +
    (
      shipment.recipient_name ||
      fallback.recipient_name ||
      '-'
    )
  );

  setText(
    'prt-recipient-dest',
    'Destination: ' +
    (
      shipment.destination ||
      fallback.destination ||
      '-'
    )
  );

  setText(
    'prt-desc',
    'Cargo Manifest: ' +
    (
      shipment.description ||
      fallback.description ||
      '-'
    )
  );


  const packageCount =
    shipment.package_count ||
    fallback.package_count ||
    1;


  const weight =
    shipment.weight !== undefined &&
    shipment.weight !== null &&
    shipment.weight !== ''
      ? shipment.weight + ' kg'
      : '-';


  setText(
    'prt-pkg',
    'Package Count / Weight: ' +
    packageCount +
    ' / ' +
    weight
  );


  const declaredValue =
    shipment.declared_value ??
    fallback.declared_value ??
    '';


  const currency =
    shipment.currency ||
    fallback.currency ||
    '';


  const valueText =
    declaredValue !== ''
      ? (
          currency
            ? currency + ' '
            : ''
        ) + declaredValue
      : '-';


  setText(
    'prt-value',
    'Declared Value: ' +
    valueText
  );


  /* -------------------------------------------------------
     GENERATE QR CODE
  ------------------------------------------------------- */

  const qrBox =
    document.getElementById(
      'prt-qrcode-box'
    );


  if (qrBox) {

    qrBox.innerHTML = '';


    if (
      typeof QRCode !==
      'undefined'
    ) {

      try {

        const trackingUrl =
          new URL(
            window.location.href
          );


        trackingUrl.searchParams.set(
          'trk',
          trackingNumber
        );


        new QRCode(
          qrBox,
          {
            text:
              trackingUrl.toString(),

            width:
              150,

            height:
              150,

            correctLevel:
              QRCode.CorrectLevel.M
          }
        );


      } catch (error) {

        console.error(
          '[RECEIPT] QR generation failed:',
          error
        );
      }


    } else {

      console.warn(
        '[RECEIPT] QRCode library is unavailable.'
      );
    }
  }


  /* -------------------------------------------------------
     SHOW RECEIPT
  ------------------------------------------------------- */

  const receipt =
    document.getElementById(
      'printable-receipt-container'
    );


  if (receipt) {

    receipt.style.display =
      'block';
  }


  return true;
}


/* =========================================================
   PRINT OFFICIAL SHIPMENT RECEIPT
========================================================= */

/* =========================================================
   PUBLIC OFFICIAL RECEIPT BUTTON
========================================================= */

function triggerPrintOfficialReceipt() {

  const getText = (id) => {
    const el = document.getElementById(id);
    return el?.textContent?.trim() || '';
  };

  const trackingNumber =
    getText('trk-number-val');

  if (
    !trackingNumber ||
    trackingNumber === '-' ||
    trackingNumber === '—'
  ) {
    alert(
      'Please track a shipment before printing the official receipt.'
    );
    return;
  }

  const packageText =
    getText('trk-pkg-val');

  let packageCount = '';
  let weight = '';

  if (packageText.includes('/')) {
    const parts = packageText.split('/');
    packageCount = parts[0].trim();
    weight = parts.slice(1).join('/').trim();
  } else {
    packageCount = packageText;
  }

  const shipment = {
    tracking_number: trackingNumber,

    reference:
      getText('trk-reference-val'),

    service_type:
      getText('trk-service-val'),

    priority:
      getText('trk-priority-val'),

    status:
      getText('trk-detail-status-val'),

    sender_name:
      getText('trk-sender-val'),

    sender_country:
      getText('trk-sender-country-val'),

    recipient_name:
      getText('trk-recipient-val'),

    recipient_country:
      getText('trk-recipient-country-val'),

    origin:
      getText('trk-origin-val'),

    current_location:
      getText('trk-current-val'),

    destination:
      getText('trk-destination-val'),

    estimated_delivery:
      getText('trk-eta-val'),

    package_count:
      packageCount,

    weight:
      weight,

    currency:
      getText('trk-currency-val'),

    declared_value:
      getText('trk-val-val'),

    description:
      getText('trk-desc-val')
  };

  const generated =
    generateShipmentReceipt(shipment);

  if (!generated) {
    alert(
      'Unable to prepare the official receipt.'
    );
    return;
  }

  printShipmentReceipt();
}


function printShipmentReceipt() {

  const receipt =
    document.getElementById(
      'printable-receipt-container'
    );


  if (!receipt) {

    alert(
      'Official receipt template was not found.'
    );

    return;
  }


  receipt.style.display =
    'block';


  window.setTimeout(
    () => {

      window.print();

    },
    250
  );
}


/* =========================================================
   HIDE RECEIPT AFTER PRINT
========================================================= */

if (
  typeof window !== 'undefined'
) {

  window.addEventListener(
    'afterprint',
    () => {

      const receipt =
        document.getElementById(
          'printable-receipt-container'
        );


      if (receipt) {

        receipt.style.display =
          'none';
      }
    }
  );
}


/* =========================================================
   CREATE NEW SHIPMENT
========================================================= */

async function handleCreateShipmentSubmit(e) {

  e.preventDefault();


  const getValue =
    (id) => {

      const element =
        document.getElementById(id);

      return element
        ? element.value.trim()
        : '';
    };


  const payload = {

    sender_name:
      getValue(
        'cs-sender-name'
      ),

    sender_country:
      getValue(
        'cs-sender-country'
      ),

    recipient_name:
      getValue(
        'cs-recipient-name'
      ),

    recipient_country:
      getValue(
        'cs-recipient-country'
      ),

    origin:
      getValue(
        'cs-origin'
      ),

    destination:
      getValue(
        'cs-destination'
      ),

    service_type:
      getValue(
        'cs-service'
      ),

    estimated_delivery:
      getValue(
        'cs-eta'
      ),

    package_count:
      getValue(
        'cs-pkg-count'
      ),

    weight:
      getValue(
        'cs-weight'
      ),

    currency:
      getValue(
        'cs-currency'
      ),

    declared_value:
      getValue(
        'cs-value'
      ),

    description:
      getValue(
        'cs-desc'
      )
  };


  /* -------------------------------------------------------
     BASIC VALIDATION
  ------------------------------------------------------- */

  if (
    !payload.sender_name ||
    !payload.recipient_name ||
    !payload.origin ||
    !payload.destination ||
    !payload.service_type
  ) {

    alert(
      'Please complete all required shipment fields.'
    );

    return;
  }


  try {

    const res =
      await fetch(
        '/api/admin/shipments',
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(payload)
        }
      );


    let data = {};

    try {

      data =
        await res.json();

    } catch {

      data = {};
    }


    /* -----------------------------------------------------
       AUTHENTICATION FAILURE
    ----------------------------------------------------- */

    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    /* -----------------------------------------------------
       BACKEND ERROR
    ----------------------------------------------------- */

    if (!res.ok) {

      alert(
        data.error ||
        'Failed to generate shipment.'
      );

      return;
    }


    /* -----------------------------------------------------
       SUCCESSFUL SHIPMENT CREATION
    ----------------------------------------------------- */

    const createdShipment =
      data.shipment ||
      data ||
      {};


    const trackingNumber =
      data.tracking_number ||
      createdShipment.tracking_number ||
      '';


    if (!trackingNumber) {

      console.error(
        '[CREATE PARCEL] Backend did not return a tracking number.',
        data
      );


      alert(
        'Parcel was created, but the tracking number was not returned by the server.'
      );


      await loadAdminDashboard();

      return;
    }


    /* -----------------------------------------------------
       GENERATE OFFICIAL RECEIPT
    ----------------------------------------------------- */

    const receiptReady =
      generateShipmentReceipt(
        {
          ...createdShipment,

          tracking_number:
            trackingNumber
        },

        payload
      );


    /* -----------------------------------------------------
       CLOSE CREATE SHIPMENT MODAL
    ----------------------------------------------------- */

    hideModal(
      'modal-create-shipment'
    );


    /* -----------------------------------------------------
       RESET CREATE FORM
    ----------------------------------------------------- */

    const form =
      document.getElementById(
        'form-create-shipment'
      );


    if (form) {

      form.reset();
    }


    const createForm =
      document.querySelector(
        '#modal-create-shipment form'
      );


    if (
      createForm &&
      createForm !== form
    ) {

      createForm.reset();
    }


    /* -----------------------------------------------------
       REFRESH ADMIN DASHBOARD
    ----------------------------------------------------- */

    await loadAdminDashboard();


    /* -----------------------------------------------------
       SUCCESS MESSAGE
    ----------------------------------------------------- */

    alert(
      `Waybill Created Successfully!\n\nTracking Number: ${trackingNumber}`
    );


    /* -----------------------------------------------------
       OFFER TO PRINT OFFICIAL RECEIPT
    ----------------------------------------------------- */

    if (receiptReady) {

      const shouldPrint =
        window.confirm(
          'Official waybill receipt generated successfully.\n\nWould you like to print the receipt now?'
        );


      if (shouldPrint) {

        printShipmentReceipt();
      }
    }


  } catch (err) {

    console.error(
      'Create shipment error:',
      err
    );


    alert(
      'Failed to connect to backend server.'
    );
  }
}


/* =========================================================
   UPDATE SHIPMENT MODAL
========================================================= */

function openUpdateShipmentModal(shipment) {

  const get = (id) =>
    document.getElementById(id);


  if (!shipment || !shipment.id) {

    console.error(
      'Invalid shipment supplied to edit form.'
    );


    alert(
      'Unable to open shipment editor.'
    );


    return;
  }


  const shipmentIdEl =
    get('us-shipment-id');

  const trackingEl =
    get('us-tracking-number');

  const referenceEl =
    get('us-reference');

  const senderNameEl =
    get('us-sender-name');

  const senderCountryEl =
    get('us-sender-country');

  const recipientNameEl =
    get('us-recipient-name');

  const recipientCountryEl =
    get('us-recipient-country');

  const originEl =
    get('us-origin');

  const destinationEl =
    get('us-destination');

  const locationEl =
    get('us-location');

  const serviceTypeEl =
    get('us-service-type');

  const priorityEl =
    get('us-priority');

  const statusEl =
    get('us-status-select');

  const customStatusEl =
    get('us-status-custom');

  const etaEl =
    get('us-eta');

  const packageCountEl =
    get('us-package-count');

  const weightEl =
    get('us-weight');

  const currencyEl =
    get('us-currency');

  const declaredValueEl =
    get('us-declared-value');

  const descriptionEl =
    get('us-description');

  const eventDescriptionEl =
    get('us-event-description');


  const requiredElements = [
    shipmentIdEl,
    trackingEl,
    referenceEl,
    senderNameEl,
    senderCountryEl,
    recipientNameEl,
    recipientCountryEl,
    originEl,
    destinationEl,
    locationEl,
    serviceTypeEl,
    priorityEl,
    statusEl,
    customStatusEl,
    etaEl,
    packageCountEl,
    weightEl,
    currencyEl,
    declaredValueEl,
    descriptionEl,
    eventDescriptionEl
  ];


  if (
    requiredElements.some(
      (el) => !el
    )
  ) {

    console.error(
      'Edit Parcel form elements are missing.'
    );


    alert(
      'Unable to open shipment editor.'
    );


    return;
  }


  shipmentIdEl.value =
    shipment.id ?? '';


  trackingEl.value =
    shipment.tracking_number ?? '';


  referenceEl.value =
    shipment.reference ?? '';


  senderNameEl.value =
    shipment.sender_name ?? '';


  senderCountryEl.value =
    shipment.sender_country ?? '';


  recipientNameEl.value =
    shipment.recipient_name ?? '';


  recipientCountryEl.value =
    shipment.recipient_country ?? '';


  originEl.value =
    shipment.origin ?? '';


  destinationEl.value =
    shipment.destination ?? '';


  locationEl.value =
    shipment.current_location ?? '';


  serviceTypeEl.value =
    shipment.service_type ?? '';


  priorityEl.value =
    shipment.priority ||
    'Standard';


  etaEl.value =
    shipment.estimated_delivery
      ? String(
          shipment.estimated_delivery
        ).slice(
          0,
          10
        )
      : '';


  packageCountEl.value =
    Number.isInteger(
      Number(
        shipment.package_count
      )
    ) &&
    Number(
      shipment.package_count
    ) > 0
      ? Number(
          shipment.package_count
        )
      : 1;


  weightEl.value =
    shipment.weight ?? '';


  currencyEl.value =
    shipment.currency ||
    'USD';


  declaredValueEl.value =
    shipment.declared_value ?? '';


  descriptionEl.value =
    shipment.description ?? '';


  eventDescriptionEl.value =
    '';


  const currentStatus =
    String(
      shipment.status ||
      'Shipment Created'
    );


  const allowedStatuses = [
    'Shipment Created',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Customs Hold',
    'Delayed',
    'CUSTOM'
  ];


  if (
    allowedStatuses.includes(
      currentStatus
    )
  ) {

    statusEl.value =
      currentStatus;


    customStatusEl.value =
      '';


    customStatusEl.style.display =
      'none';

  } else {

    statusEl.value =
      'CUSTOM';


    customStatusEl.value =
      currentStatus;


    customStatusEl.style.display =
      'block';
  }


  showModal(
    'modal-update-shipment'
  );
}


/* =========================================================
   CUSTOM STATUS TOGGLE
========================================================= */

function toggleCustomStatusInput(
  selectEl
) {

  const customEl =
    document.getElementById(
      'us-status-custom'
    );


  if (!customEl) {
    return;
  }


  if (
    selectEl &&
    selectEl.value === 'CUSTOM'
  ) {

    customEl.style.display =
      'block';


    customEl.focus();

  } else {

    customEl.style.display =
      'none';


    customEl.value =
      '';
  }
}


/* =========================================================
   UPDATE SHIPMENT
========================================================= */

async function handleUpdateShipmentSubmit(e) {
  e.preventDefault();

  const get = (id) =>
    document.getElementById(id);

  const shipmentIdEl =
    get('us-shipment-id');

  const trackingEl =
    get('us-tracking-number');

  const referenceEl =
    get('us-reference');

  const senderNameEl =
    get('us-sender-name');

  const senderCountryEl =
    get('us-sender-country');

  const recipientNameEl =
    get('us-recipient-name');

  const recipientCountryEl =
    get('us-recipient-country');

  const originEl =
    get('us-origin');

  const destinationEl =
    get('us-destination');

  const locationEl =
    get('us-location');

  const serviceTypeEl =
    get('us-service-type');

  const priorityEl =
    get('us-priority');

  const statusEl =
    get('us-status-select');

  const customStatusEl =
    get('us-status-custom');

  const etaEl =
    get('us-eta');

  const packageCountEl =
    get('us-package-count');

  const weightEl =
    get('us-weight');

  const currencyEl =
    get('us-currency');

  const declaredValueEl =
    get('us-declared-value');

  const descriptionEl =
    get('us-description');

  const eventDescriptionEl =
    get('us-event-description');

  const elements = [
    shipmentIdEl,
    trackingEl,
    referenceEl,
    senderNameEl,
    senderCountryEl,
    recipientNameEl,
    recipientCountryEl,
    originEl,
    destinationEl,
    locationEl,
    serviceTypeEl,
    priorityEl,
    statusEl,
    customStatusEl,
    etaEl,
    packageCountEl,
    weightEl,
    currencyEl,
    declaredValueEl,
    descriptionEl,
    eventDescriptionEl
  ];

  if (elements.some((el) => !el)) {
    console.error(
      '[UPDATE SHIPMENT] Missing form element.'
    );

    alert(
      'Edit Parcel form is incomplete.'
    );

    return;
  }

  const id =
    shipmentIdEl.value.trim();

  const trackingNumber =
    trackingEl.value.trim();

  if (!id) {
    alert(
      'Shipment ID is missing.'
    );

    return;
  }

  if (!trackingNumber) {
    alert(
      'Tracking number is required.'
    );

    trackingEl.focus();

    return;
  }

  const status =
    statusEl.value === 'CUSTOM'
      ? customStatusEl.value.trim()
      : statusEl.value.trim();

  if (!status) {
    alert(
      'Please select or enter a shipment status.'
    );

    return;
  }

  const packageCount =
    Number(packageCountEl.value);

  if (
    !Number.isInteger(packageCount) ||
    packageCount < 1
  ) {
    alert(
      'Package count must be a whole number of at least 1.'
    );

    packageCountEl.focus();

    return;
  }

  const weight =
    weightEl.value.trim() === ''
      ? null
      : Number(weightEl.value);

  if (
    weight !== null &&
    (
      !Number.isFinite(weight) ||
      weight < 0
    )
  ) {
    alert(
      'Please enter a valid weight.'
    );

    weightEl.focus();

    return;
  }

  const declaredValue =
    declaredValueEl.value.trim() === ''
      ? null
      : Number(declaredValueEl.value);

  if (
    declaredValue !== null &&
    (
      !Number.isFinite(declaredValue) ||
      declaredValue < 0
    )
  ) {
    alert(
      'Please enter a valid declared value.'
    );

    declaredValueEl.focus();

    return;
  }

  const payload = {
    tracking_number:
      trackingNumber,

    reference:
      referenceEl.value.trim(),

    sender_name:
      senderNameEl.value.trim(),

    sender_country:
      senderCountryEl.value.trim(),

    recipient_name:
      recipientNameEl.value.trim(),

    recipient_country:
      recipientCountryEl.value.trim(),

    origin:
      originEl.value.trim(),

    destination:
      destinationEl.value.trim(),

    current_location:
      locationEl.value.trim(),

    service_type:
      serviceTypeEl.value.trim(),

    priority:
      priorityEl.value.trim() ||
      'Standard',

    status,

    estimated_delivery:
      etaEl.value ||
      null,

    package_count:
      packageCount,

    weight,

    currency:
      currencyEl.value.trim() ||
      'USD',

    declared_value:
      declaredValue,

    description:
      descriptionEl.value.trim(),

    event_description:
      eventDescriptionEl.value.trim()
  };

  const saveButton =
    e.submitter ||
    document.querySelector(
      '#modal-update-shipment button[type="submit"]'
    );

  const originalText =
    saveButton?.textContent ||
    'Save Changes';

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }

    const response =
      await fetch(
        '/api/admin/shipments/' +
        encodeURIComponent(id),
        {
          method: 'PUT',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(payload)
        }
      );

    let data = {};

    try {
      data = await response.json();
    } catch (jsonError) {
      console.warn(
        '[UPDATE SHIPMENT] Response was not JSON.',
        jsonError
      );
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        'Failed to update parcel.'
      );
    }

    if (data.success !== true) {
      throw new Error(
        data.error ||
        'Server did not confirm the shipment update.'
      );
    }

    hideModal(
      'modal-update-shipment'
    );

    await loadAdminDashboard();

    alert(
      'Parcel updated successfully.'
    );

  } catch (error) {
    console.error(
      '[UPDATE SHIPMENT]',
      error
    );

    alert(
      error.message ||
      'Failed to update parcel.'
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }
}


/* =========================================================
   CUSTOMER MESSAGE REPLY
========================================================= */

async function openMessageReply(id) {

  if (!id) {

    alert(
      'Customer message ID is missing.'
    );

    return;
  }


  try {

    const res =
      await fetch(
        '/api/admin/messages',
        {
          method: 'GET',

          credentials: 'include'
        }
      );


    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (!res.ok) {

      throw new Error(
        'Unable to load customer messages.'
      );
    }


    let payload = {};

    try {

      payload =
        await res.json();

    } catch {

      payload = {};
    }


    const messages =
      Array.isArray(
        payload
      )
        ? payload
        : Array.isArray(
            payload.messages
          )
          ? payload.messages
          : [];


    const customerMessage =
      messages.find(
        (m) =>
          Number(m.id) ===
          Number(id)
      );


    if (!customerMessage) {

      alert(
        'Customer message could not be found.'
      );

      return;
    }


    createReplyModal();


    const messageIdEl =
      document.getElementById(
        'reply-message-id'
      );

    const recipientNameEl =
      document.getElementById(
        'reply-recipient-name'
      );

    const recipientEmailEl =
      document.getElementById(
        'reply-recipient-email'
      );

    const subjectEl =
      document.getElementById(
        'reply-subject'
      );

    const bodyEl =
      document.getElementById(
        'reply-body'
      );

    const statusEl =
      document.getElementById(
        'reply-status'
      );


    if (messageIdEl) {

      messageIdEl.value =
        customerMessage.id;
    }


    if (recipientNameEl) {

      recipientNameEl.value =
        customerMessage.sender_name ||
        customerMessage.name ||
        '';
    }


    if (recipientEmailEl) {

      recipientEmailEl.value =
        customerMessage.email ||
        '';
    }


    if (subjectEl) {

      subjectEl.value =
        `Re: ${
          customerMessage.subject ||
          'US COURIER Support'
        }`;
    }


    if (bodyEl) {

      bodyEl.value =
        '';
    }


    if (statusEl) {

      statusEl.innerHTML =
        '';
    }


    const sendButton =
      document.getElementById(
        'send-reply-button'
      );


    if (sendButton) {

      sendButton.disabled =
        false;

      sendButton.innerHTML = `
        <i class="icon icon-send"></i>
        Send Reply
      `;
    }


    const modal =
      document.getElementById(
        'modal-message-reply'
      );


    if (modal) {

      modal.style.display =
        'flex';
    }


    setTimeout(
      () => {

        if (bodyEl) {

          bodyEl.focus();
        }

      },
      100
    );


  } catch (err) {

    console.error(
      'Open reply error:',
      err
    );

    alert(
      err.message ||
      'Unable to open customer reply.'
    );
  }
}


/* =========================================================
   CREATE REPLY MODAL
========================================================= */

function createReplyModal() {

  if (
    document.getElementById(
      'modal-message-reply'
    )
  ) {

    return;
  }


  const modal =
    document.createElement(
      'div'
    );


  modal.id =
    'modal-message-reply';


  modal.style.cssText = `
    position:fixed;
    inset:0;
    z-index:9999;
    display:none;
    align-items:center;
    justify-content:center;
    padding:1rem;
    background:rgba(0,0,0,0.78);
    backdrop-filter:blur(8px);
  `;


  modal.innerHTML = `

    <div
      class="card"
      style="
        width:100%;
        max-width:680px;
        max-height:90vh;
        overflow-y:auto;
        position:relative;
        border:1px solid rgba(232,168,124,0.25);
        box-shadow:0 25px 80px rgba(0,0,0,0.55);
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:1rem;
          margin-bottom:1.5rem;
        "
      >

        <div>

          <div
            style="
              font-size:0.7rem;
              letter-spacing:0.15em;
              color:var(--accent-gold);
              text-transform:uppercase;
              margin-bottom:0.35rem;
            "
          >
            Customer Support
          </div>

          <h2
            style="
              margin:0;
              font-size:1.35rem;
            "
          >
            Reply to Customer
          </h2>

        </div>


        <button
          type="button"
          onclick="closeMessageReply()"
          style="
            width:36px;
            height:36px;
            border-radius:50%;
            border:1px solid rgba(255,255,255,0.15);
            background:transparent;
            color:var(--text-primary);
            cursor:pointer;
            font-size:1rem;
          "
          aria-label="Close reply window"
        >
          <i class="icon icon-close"></i>
        </button>

      </div>


      <input
        type="hidden"
        id="reply-message-id"
      />


      <div
        style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:1rem;
          margin-bottom:1rem;
        "
      >

        <div>

          <label
            style="
              display:block;
              margin-bottom:0.4rem;
              font-size:0.78rem;
              color:var(--text-muted);
            "
          >
            Customer
          </label>

          <input
            id="reply-recipient-name"
            type="text"
            readonly
            style="
              width:100%;
              box-sizing:border-box;
            "
          />

        </div>


        <div>

          <label
            style="
              display:block;
              margin-bottom:0.4rem;
              font-size:0.78rem;
              color:var(--text-muted);
            "
          >
            Customer Email
          </label>

          <input
            id="reply-recipient-email"
            type="email"
            readonly
            style="
              width:100%;
              box-sizing:border-box;
            "
          />

        </div>

      </div>


      <div
        style="
          margin-bottom:1rem;
        "
      >

        <label
          style="
            display:block;
            margin-bottom:0.4rem;
            font-size:0.78rem;
            color:var(--text-muted);
          "
        >
          Subject
        </label>

        <input
          id="reply-subject"
          type="text"
          readonly
          style="
            width:100%;
            box-sizing:border-box;
          "
        />

      </div>


      <div
        style="
          margin-bottom:1rem;
        "
      >

        <label
          for="reply-body"
          style="
            display:block;
            margin-bottom:0.4rem;
            font-size:0.78rem;
            color:var(--text-muted);
          "
        >
          Your Reply
        </label>

        <textarea
          id="reply-body"
          rows="8"
          maxlength="10000"
          placeholder="Write your response to the customer..."
          style="
            width:100%;
            box-sizing:border-box;
            resize:vertical;
            min-height:180px;
          "
        ></textarea>

      </div>


      <div
        id="reply-status"
        style="
          min-height:20px;
          margin-bottom:1rem;
          font-size:0.85rem;
        "
      ></div>


      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:0.75rem;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="btn-outline"
          onclick="closeMessageReply()"
        >
          Cancel
        </button>


        <button
          type="button"
          id="send-reply-button"
          class="btn-gold"
          onclick="sendMessageReply()"
        >
          <i class="icon icon-send"></i>
          Send Reply
        </button>

      </div>

    </div>
  `;


  document.body.appendChild(
    modal
  );


  modal.addEventListener(
    'click',
    (event) => {

      if (
        event.target === modal
      ) {

        closeMessageReply();
      }
    }
  );


  document.addEventListener(
    'keydown',
    handleReplyEscapeKey
  );
}


/* =========================================================
   CLOSE REPLY MODAL
========================================================= */

function closeMessageReply() {

  const modal =
    document.getElementById(
      'modal-message-reply'
    );


  if (!modal) {
    return;
  }


  modal.style.display =
    'none';


  const textarea =
    document.getElementById(
      'reply-body'
    );


  if (textarea) {

    textarea.value =
      '';
  }


  const status =
    document.getElementById(
      'reply-status'
    );


  if (status) {

    status.innerHTML =
      '';
  }


  const button =
    document.getElementById(
      'send-reply-button'
    );


  if (button) {

    button.disabled =
      false;

    button.innerHTML = `
      <i class="icon icon-send"></i>
      Send Reply
    `;
  }
}


/* =========================================================
   ESCAPE KEY
========================================================= */

function handleReplyEscapeKey(
  event
) {

  if (
    event.key !== 'Escape'
  ) {

    return;
  }


  const modal =
    document.getElementById(
      'modal-message-reply'
    );


  if (
    modal &&
    modal.style.display === 'flex'
  ) {

    closeMessageReply();
  }
}


/* =========================================================
   SEND CUSTOMER REPLY
========================================================= */

async function sendMessageReply() {

  const messageIdEl =
    document.getElementById(
      'reply-message-id'
    );

  const messageEl =
    document.getElementById(
      'reply-body'
    );

  const button =
    document.getElementById(
      'send-reply-button'
    );

  const status =
    document.getElementById(
      'reply-status'
    );


  if (
    !messageIdEl ||
    !messageEl ||
    !button ||
    !status
  ) {

    alert(
      'Reply form is unavailable.'
    );

    return;
  }


  const messageId =
    messageIdEl.value.trim();


  const message =
    messageEl.value.trim();


  if (!message) {

    status.innerHTML = `
      <span
        style="
          color:#ffb4a2;
        "
      >
        Please enter a reply message.
      </span>
    `;

    return;
  }


  if (!messageId) {

    status.innerHTML = `
      <span
        style="
          color:#ffb4a2;
        "
      >
        Customer message ID is missing.
      </span>
    `;

    return;
  }


  button.disabled =
    true;


  button.innerHTML = `
    <i class="icon icon-spinner icon-spin"></i>
    Sending...
  `;


  status.innerHTML = `
    <span
      style="
        color:var(--text-muted);
      "
    >
      Sending your reply through US COURIER email service...
    </span>
  `;


  try {

    const res =
      await fetch(
        `/api/admin/messages/${encodeURIComponent(
          messageId
        )}/reply`,
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              message
            })
        }
      );


    let data = {};

    try {

      data =
        await res.json();

    } catch {

      data = {};
    }


    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (!res.ok) {

      throw new Error(
        data.error ||
        'Unable to send reply.'
      );
    }


    status.innerHTML = `
      <span
        style="
          color:#8fd694;
          font-weight:600;
        "
      >
        <i class="icon icon-check"></i>
        Reply sent successfully.
      </span>
    `;


    button.innerHTML = `
      <i class="icon icon-check"></i>
      Sent
    `;


    setTimeout(
      async () => {

        closeMessageReply();

        await loadAdminDashboard();

      },
      900
    );


  } catch (err) {

    console.error(
      'Send customer reply error:',
      err
    );


    status.innerHTML = `
      <span
        style="
          color:#ffb4a2;
          font-weight:600;
        "
      >
        <i class="icon icon-warning"></i>
        ${escapeAdminHtml(
          err.message ||
          'Unable to send reply.'
        )}
      </span>
    `;


    button.disabled =
      false;


    button.innerHTML = `
      <i class="icon icon-send"></i>
      Send Reply
    `;
  }
}


/* =========================================================
   MARK MESSAGE READ
========================================================= */

async function markMessageRead(
  id
) {

  if (!id) {

    alert(
      'Message ID is missing.'
    );

    return;
  }


  try {

    const res =
      await fetch(
        `/api/admin/messages/${encodeURIComponent(
          id
        )}/read`,
        {
          method: 'PUT',

          credentials: 'include'
        }
      );


    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    let data = {};

    try {

      data =
        await res.json();

    } catch {

      data = {};
    }


    if (!res.ok) {

      throw new Error(
        data.error ||
        'Unable to update message.'
      );
    }


    await loadAdminDashboard();

  } catch (err) {

    console.error(
      'Mark message read error:',
      err
    );

    alert(
      err.message ||
      'Failed to update message.'
    );
  }
}


/* =========================================================
   DELETE MESSAGE
========================================================= */

async function deleteMessage(
  id
) {

  if (!id) {

    alert(
      'Message ID is missing.'
    );

    return;
  }


  const confirmed =
    window.confirm(
      'Delete this message permanently?'
    );


  if (!confirmed) {
    return;
  }


  try {

    const res =
      await fetch(
        `/api/admin/messages/${encodeURIComponent(
          id
        )}`,
        {
          method: 'DELETE',

          credentials: 'include'
        }
      );


    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    let data = {};

    try {

      data =
        await res.json();

    } catch {

      data = {};
    }


    if (!res.ok) {

      throw new Error(
        data.error ||
        'Unable to delete message.'
      );
    }


    await loadAdminDashboard();

  } catch (err) {

    console.error(
      'Delete message error:',
      err
    );

    alert(
      err.message ||
      'Failed to delete message.'
    );
  }
}



/* =========================================================
   ADMIN SETTINGS
========================================================= */

function openAdminSettings() {
  showSection('admin-settings');
  loadAdminSettings();
}


function setAdminSettingValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  if (element.type === 'checkbox') {
    element.checked = Boolean(value);
    return;
  }

  element.value =
    value === null ||
    value === undefined
      ? ''
      : String(value);
}


function showAdminSettingsMessage(message, type) {
  const element =
    document.getElementById(
      'admin-settings-message'
    );

  if (!element) {
    return;
  }

  element.style.display = 'block';
  element.textContent = message;

  if (type === 'error') {
    element.style.border = '1px solid #dc3545';
  } else {
    element.style.border = '1px solid #198754';
  }

  element.style.padding = '0.75rem 1rem';
  element.style.borderRadius = '6px';
}


async function loadAdminSettings() {
  try {
    const response =
      await fetch(
        '/api/admin/settings',
        {
          method: 'GET',
          credentials: 'include'
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        'Unable to load admin settings.'
      );
    }

    const settings =
      data.settings || {};

    const company =
      settings.company || {};

    const contact =
      settings.contact || {};

    const website =
      settings.website || {};

    const footer =
      settings.footer || {};

    const tracking =
      settings.tracking || {};

    const shipment =
      settings.shipment || {};

    const receipt =
      settings.receipt || {};

    const qr =
      settings.qr || {};

    const notifications =
      settings.notifications || {};

    const maintenance =
      settings.maintenance || {};


    setAdminSettingValue(
      'setting-company-name',
      company.name
    );

    setAdminSettingValue(
      'setting-company-logo',
      company.logo
    );

    setAdminSettingValue(
      'setting-contact-email',
      contact.email
    );

    setAdminSettingValue(
      'setting-contact-phone',
      contact.phone
    );

    setAdminSettingValue(
      'setting-contact-address',
      contact.address
    );

    setAdminSettingValue(
      'setting-contact-timezone',
      contact.timezone
    );


    setAdminSettingValue(
      'setting-website-title',
      website.title
    );

    setAdminSettingValue(
      'setting-website-tagline',
      website.tagline
    );

    setAdminSettingValue(
      'setting-website-notice',
      website.notice
    );


    setAdminSettingValue(
      'setting-footer-copyright',
      footer.copyright
    );

    setAdminSettingValue(
      'setting-footer-text',
      footer.text
    );


    setAdminSettingValue(
      'setting-tracking-prefix',
      tracking.prefix
    );

    setAdminSettingValue(
      'setting-tracking-message',
      tracking.message
    );

    setAdminSettingValue(
      'setting-tracking-details',
      tracking.show_details
    );


    setAdminSettingValue(
      'setting-default-service',
      shipment.default_service
    );

    setAdminSettingValue(
      'setting-default-priority',
      shipment.default_priority ||
      'Standard'
    );

    setAdminSettingValue(
      'setting-shipment-statuses',
      Array.isArray(shipment.statuses)
        ? shipment.statuses.join('\n')
        : ''
    );


    setAdminSettingValue(
      'setting-receipt-title',
      receipt.title
    );

    setAdminSettingValue(
      'setting-receipt-footer',
      receipt.footer
    );

    setAdminSettingValue(
      'setting-receipt-enabled',
      receipt.enabled
    );


    setAdminSettingValue(
      'setting-qr-enabled',
      qr.enabled
    );


    setAdminSettingValue(
      'setting-notifications-enabled',
      notifications.enabled
    );

    setAdminSettingValue(
      'setting-contact-enabled',
      notifications.contact_form
    );


    setAdminSettingValue(
      'setting-maintenance-enabled',
      maintenance.enabled
    );

    setAdminSettingValue(
      'setting-maintenance-message',
      maintenance.message
    );

    showAdminSettingsMessage(
      'Settings loaded successfully.',
      'success'
    );

  } catch (error) {

    console.error(
      '[ADMIN SETTINGS LOAD]',
      error
    );

    showAdminSettingsMessage(
      error.message ||
      'Failed to load admin settings.',
      'error'
    );
  }
}


function getAdminSettingValue(id) {
  const element =
    document.getElementById(id);

  if (!element) {
    return '';
  }

  if (element.type === 'checkbox') {
    return element.checked;
  }

  return element.value.trim();
}


async function saveAdminSettings() {

  const statuses =
    getAdminSettingValue(
      'setting-shipment-statuses'
    )
      .split('\n')
      .map(status => status.trim())
      .filter(Boolean);


  const settings = {

    company: {
      name:
        getAdminSettingValue(
          'setting-company-name'
        ),

      logo:
        getAdminSettingValue(
          'setting-company-logo'
        )
    },


    contact: {
      email:
        getAdminSettingValue(
          'setting-contact-email'
        ),

      phone:
        getAdminSettingValue(
          'setting-contact-phone'
        ),

      address:
        getAdminSettingValue(
          'setting-contact-address'
        ),

      timezone:
        getAdminSettingValue(
          'setting-contact-timezone'
        )
    },


    website: {
      title:
        getAdminSettingValue(
          'setting-website-title'
        ),

      tagline:
        getAdminSettingValue(
          'setting-website-tagline'
        ),

      notice:
        getAdminSettingValue(
          'setting-website-notice'
        )
    },


    footer: {
      copyright:
        getAdminSettingValue(
          'setting-footer-copyright'
        ),

      text:
        getAdminSettingValue(
          'setting-footer-text'
        )
    },


    tracking: {
      prefix:
        getAdminSettingValue(
          'setting-tracking-prefix'
        ),

      message:
        getAdminSettingValue(
          'setting-tracking-message'
        ),

      show_details:
        getAdminSettingValue(
          'setting-tracking-details'
        )
    },


    shipment: {
      default_service:
        getAdminSettingValue(
          'setting-default-service'
        ),

      default_priority:
        getAdminSettingValue(
          'setting-default-priority'
        ),

      statuses
    },


    receipt: {
      title:
        getAdminSettingValue(
          'setting-receipt-title'
        ),

      footer:
        getAdminSettingValue(
          'setting-receipt-footer'
        ),

      enabled:
        getAdminSettingValue(
          'setting-receipt-enabled'
        )
    },


    qr: {
      enabled:
        getAdminSettingValue(
          'setting-qr-enabled'
        )
    },


    notifications: {
      enabled:
        getAdminSettingValue(
          'setting-notifications-enabled'
        ),

      contact_form:
        getAdminSettingValue(
          'setting-contact-enabled'
        )
    },


    maintenance: {
      enabled:
        getAdminSettingValue(
          'setting-maintenance-enabled'
        ),

      message:
        getAdminSettingValue(
          'setting-maintenance-message'
        )
    }
  };


  try {

    const response =
      await fetch(
        '/api/admin/settings',
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify({
              settings
            })
        }
      );


    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }


    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }


    if (!response.ok) {
      throw new Error(
        data.error ||
        'Failed to save admin settings.'
      );
    }


    showAdminSettingsMessage(
      'Settings saved successfully.',
      'success'
    );


  } catch (error) {

    console.error(
      '[ADMIN SETTINGS SAVE]',
      error
    );

    showAdminSettingsMessage(
      error.message ||
      'Failed to save admin settings.',
      'error'
    );
  }
}


/* =========================================================
   SESSION EXPIRATION
========================================================= */

function handleAdminSessionExpired() {

  alert(
    'Your admin session has expired. Please sign in again.'
  );


  showSection(
    'admin-login'
  );
}


/* =========================================================
   HTML SAFETY
========================================================= */

/* =========================================================
   JAVASCRIPT STRING SAFETY
========================================================= */

function escapeJsString(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';
  }


  return String(value)
    .replace(
      /\\/g,
      '\\\\'
    )
    .replace(
      /'/g,
      "\\'"
    )
    .replace(
      /\r/g,
      '\\r'
    )
    .replace(
      /\n/g,
      '\\n'
    );
}


/* =========================================================
   STATUS SAFETY
========================================================= */

function safeStatus(
  value
) {

  return escapeAdminHtml(
    value ||
    'Unknown'
  );
}


/* =========================================================
   ADMIN DATE FORMATTER
========================================================= */

function formatAdminDate(
  value
) {

  if (!value) {
    return '—';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return escapeAdminHtml(
      value
    );
  }


  return escapeAdminHtml(
    date.toLocaleString()
  );
}


/* =========================================================
   BIND ADMIN BUTTONS
========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    bindCreateParcelButton
  );

} else {

  bindCreateParcelButton();
}
