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
    if (
      typeof loadShipments === 'function'
    ) {
      await loadShipments();
    } else if (
      typeof loadAdminShipments === 'function'
    ) {
      await loadAdminShipments();
    }

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


  const get =
    (id) =>
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


  if (
    elements.some(
      (el) => !el
    )
  ) {

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
      : statusEl.value;


  if (!status) {

    alert(
      'Please select or enter a shipment status.'
    );


    return;
  }


  const packageCount =
    Number(
      packageCountEl.value
    );


  if (
    !Number.isInteger(
      packageCount
    ) ||
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
      : Number(
          weightEl.value
        );


  if (
    weight !== null &&
    (
      !Number.isFinite(
        weight
      ) ||
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
      : Number(
          declaredValueEl.value
        );


  if (
    declaredValue !== null &&
    (
      !Number.isFinite(
        declaredValue
      ) ||
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
      priorityEl.value.trim(),

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
    saveButton
      ? saveButton.textContent
      : '';


  try {

    if (saveButton) {

      saveButton.disabled =
        true;


      saveButton.textContent =
        'Saving...';
    }


    const response =
      await fetch(
        '/api/admin/shipments/' +
        encodeURIComponent(
          id
        ),
        {
          method: 'PUT',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (
      !response.ok ||
      data.success !== true
    ) {

      throw new Error(
        data.error ||
        'Failed to update parcel.'
      );
    }


    hideModal(
      'modal-update-shipment'
    );


    alert(
      'Parcel updated successfully.'
    );


    if (
      typeof loadShipments ===
      'function'
    ) {

      await loadShipments();

    } else if (
      typeof loadAdminShipments ===
      'function'
    ) {

      await loadAdminShipments();

    } else {

      await loadAdminDashboard();
    }


  } catch (error) {

    console.error(
      '[EDIT PARCEL]',
      error
    );


    alert(
      error.message ||
      'Failed to update parcel.'
    );


  } finally {

    if (saveButton) {

      saveButton.disabled =
        false;


      saveButton.textContent =
        originalText;
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

async function loadAdministratorSettings() {
  try {
    const response =
      await adminRequest(
        "/api/admin/profile"
      );

    if (handleAdminApiFailure(response)) {
      return;
    }

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
        "Unable to load administrator profile."
      );
    }

    const profile =
      data.profile ||
      data.user ||
      data;

    const name =
      document.getElementById(
        "admin-profile-name"
      );

    const email =
      document.getElementById(
        "admin-profile-email"
      );

    if (name) {
      name.value =
        profile.name ||
        "";
    }

    if (email) {
      email.value =
        profile.email ||
        "";
    }
  } catch (error) {
    console.error(
      "[ADMIN PROFILE LOAD]",
      error
    );

    const message =
      document.getElementById(
        "administrator-settings-message"
      );

    if (message) {
      message.textContent =
        error.message ||
        "Unable to load administrator profile.";

      message.style.display =
        "block";
    }
  }
}


async function saveAdminProfile(event) {
  if (event) {
    event.preventDefault();
  }

  const name =
    document.getElementById(
      "admin-profile-name"
    )?.value.trim() || "";

  const email =
    document.getElementById(
      "admin-profile-email"
    )?.value.trim() || "";

  const message =
    document.getElementById(
      "administrator-settings-message"
    );

  try {
    const response =
      await adminRequest(
        "/api/admin/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            name,
            email
          })
        }
      );

    if (handleAdminApiFailure(response)) {
      return;
    }

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
        "Unable to update administrator profile."
      );
    }

    if (message) {
      message.style.display = "block";
      message.textContent =
        data.message ||
        "Administrator profile updated successfully.";
    }

    if (data.profile) {
      const headerName =
        document.getElementById(
          "admin-header-name"
        );

      if (headerName) {
        headerName.textContent =
          data.profile.name ||
          "Administrator";
      }
    }
  } catch (error) {
    console.error(
      "[ADMIN PROFILE UPDATE]",
      error
    );

    if (message) {
      message.style.display = "block";
      message.textContent =
        error.message ||
        "Unable to update administrator profile.";
    }
  }
}


async function changeAdminPassword(event) {
  if (event) {
    event.preventDefault();
  }

  const currentPassword =
    document.getElementById(
      "admin-current-password"
    )?.value || "";

  const newPassword =
    document.getElementById(
      "admin-new-password"
    )?.value || "";

  const message =
    document.getElementById(
      "administrator-settings-message"
    );

  try {
    const response =
      await adminRequest(
        "/api/admin/profile/password",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        }
      );

    if (handleAdminApiFailure(response)) {
      return;
    }

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
        "Unable to change administrator password."
      );
    }

    if (message) {
      message.style.display = "block";
      message.textContent =
        data.message ||
        "Administrator password changed successfully.";
    }

    const form =
      document.getElementById(
        "admin-password-form"
      );

    if (form) {
      form.reset();
    }

    setTimeout(() => {
      showSection('admin-login');
    }, 1500);
  } catch (error) {
    console.error(
      "[ADMIN PASSWORD UPDATE]",
      error
    );

    if (message) {
      message.style.display = "block";
      message.textContent =
        error.message ||
        "Unable to change administrator password.";
    }
  }
}


function openWebsiteSettings() {
  showSection('admin-settings');
  loadAdminSettings();
}

function openAdminSettings() {
  showSection('administrator-settings');
  loadAdministratorSettings();
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

function escapeAdminHtml(
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


/* =========================================================
   ADMIN PORTAL REDESIGN — MANAGEMENT LAYER
   Uses existing authenticated APIs and existing modals.
========================================================= */

(function initAdminPortalRedesign() {

  window.__adminState = window.__adminState || {
    shipments: [],
    messages: [],
    customers: [],
    users: [],
    currentPanel: 'dashboard',
    selectedShipment: null,
    selectedMessage: null
  };


  const state = window.__adminState;


  const adminPanelTitles = {
    dashboard: 'Dashboard',
    parcels: 'Parcels',
    customers: 'Customers',
    users: 'User Management',
    messages: 'Customer Messages',
    transactions: 'Transactions',
    support: 'Support',
    reports: 'Reports'
  };


  function adminEscape(value) {
    if (typeof escapeAdminHtml === 'function') {
      return escapeAdminHtml(value);
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  function adminDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return adminEscape(value);
    }

    return adminEscape(
      date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    );
  }


  function adminStatus(value) {
    const status = String(value || 'Unknown');

    const normalized =
      status.toLowerCase();

    let className =
      'admin-status-neutral';

    if (
      normalized.includes('deliver')
    ) {
      className =
        'admin-status-delivered';

    } else if (
      normalized.includes('transit') ||
      normalized.includes('dispatch') ||
      normalized.includes('out for')
    ) {
      className =
        'admin-status-transit';

    } else if (
      normalized.includes('pending') ||
      normalized.includes('created') ||
      normalized.includes('received')
    ) {
      className =
        'admin-status-pending';

    } else if (
      normalized.includes('exception') ||
      normalized.includes('delay') ||
      normalized.includes('held') ||
      normalized.includes('failed')
    ) {
      className =
        'admin-status-danger';
    }

    return `
      <span class="admin-status-pill ${className}">
        ${adminEscape(status)}
      </span>
    `;
  }


  function adminRequest(url, options = {}) {

    return fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
  }


  function handleAdminApiFailure(response) {

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      if (
        typeof handleAdminSessionExpired ===
        'function'
      ) {
        handleAdminSessionExpired();
      }

      return true;
    }

    return false;
  }


  /* -------------------------------------------------------
     PANEL NAVIGATION
  ------------------------------------------------------- */

  async function loadAdminUsers() {
    try {
      const response = await adminRequest('/api/admin/users');

      if (handleAdminApiFailure(response)) return;

      const data = await response.json();

      if (response.status < 200 || response.status >= 300 || data.success !== true) {
        throw new Error(data.error || 'Unable to load users.');
      }

      state.users = Array.isArray(data.users)
        ? data.users
        : [];

      renderAdminUsers();

    } catch (error) {
      console.error('[ADMIN USERS]', error);

      const tbody =
        document.getElementById('admin-users-tbody');

      if (tbody) {
        tbody.textContent =
          error.message || 'Unable to load users.';
      }
    }
  }


  function renderAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    const count = document.getElementById('admin-users-count');

    if (tbody === null) return;

    const users = Array.isArray(state.users) ? state.users : [];

    if (count) {
      count.textContent = users.length + ' ' + (users.length === 1 ? 'record' : 'records');
    }

    tbody.innerHTML = '';

    if (users.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'No users found.';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    users.forEach(user => {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = user.name || 'Unnamed User';

      const emailCell = document.createElement('td');
      emailCell.textContent = user.email || '—';

      const roleCell = document.createElement('td');
      roleCell.textContent = user.role || 'Customer';

      const createdCell = document.createElement('td');
      createdCell.textContent = adminDate(user.created_at);

      const actionsCell = document.createElement('td');
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn-outline';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', function() {
        openEditAdminUser(user.id);
      });
      actionsCell.appendChild(editButton);

      row.appendChild(nameCell);
      row.appendChild(emailCell);
      row.appendChild(roleCell);
      row.appendChild(createdCell);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  }


  function openEditAdminUser(userId) {
    const user = (Array.isArray(state.users) ? state.users : []).find(function(item) {
      return Number(item.id) === Number(userId);
    });

    if (user === undefined) {
      console.error('[ADMIN USERS] User not found:', userId);
      return;
    }

    const modal = document.getElementById('admin-edit-user-modal');
    const idField = document.getElementById('admin-edit-user-id');
    const nameField = document.getElementById('admin-edit-user-name');
    const emailField = document.getElementById('admin-edit-user-email');
    const message = document.getElementById('admin-edit-user-message');

    if (modal === null || idField === null || nameField === null || emailField === null) {
      console.error('[ADMIN USERS] Edit user modal elements are missing.');
      return;
    }

    idField.value = user.id;
    nameField.value = user.name || '';
    emailField.value = user.email || '';

    if (message) {
      message.textContent = '';
      message.style.display = 'none';
    }

    modal.style.display = 'flex';
    nameField.focus();
  }


  async function saveAdminUserEdit(event) {
    event.preventDefault();

    const idField = document.getElementById('admin-edit-user-id');
    const nameField = document.getElementById('admin-edit-user-name');
    const emailField = document.getElementById('admin-edit-user-email');
    const message = document.getElementById('admin-edit-user-message');

    if (idField === null || nameField === null || emailField === null) {
      return;
    }

    const userId = Number(idField.value);
    const name = nameField.value.trim();
    const email = emailField.value.trim();

    if (Number.isInteger(userId) === false || userId <= 0) {
      return;
    }

    try {
      if (message) {
        message.textContent = 'Saving changes...';
        message.style.display = 'block';
      }

      const response = await adminRequest('/api/admin/users/' + userId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email
        })
      });

      if (handleAdminApiFailure(response)) return;

      const data = await response.json();

      if (response.status < 200 || response.status >= 300 || data.success !== true) {
        throw new Error(data.error || 'Unable to update user.');
      }

      if (message) {
        message.textContent = data.message || 'User updated successfully.';
        message.style.display = 'block';
      }

      await loadAdminUsers();

      setTimeout(function() {
        closeEditAdminUser();
      }, 700);

    } catch (error) {
      console.error('[ADMIN USERS]', error);

      if (message) {
        message.textContent = error.message || 'Unable to update user.';
        message.style.display = 'block';
      }
    }
  }


  function closeEditAdminUser() {
    const modal = document.getElementById('admin-edit-user-modal');

    if (modal) {
      modal.style.display = 'none';
    }
  }


  window.openEditAdminUser = openEditAdminUser;
  window.saveAdminUserEdit = saveAdminUserEdit;
  window.closeEditAdminUser = closeEditAdminUser;

  window.loadAdminUsers = loadAdminUsers;


  window.showAdminPanel = function(panel) {

    const validPanels = [
      'dashboard',
      'parcels',
      'customers',
      'users',
      'messages',
      'transactions',
      'support',
      'reports'
    ];

    if (!validPanels.includes(panel)) {
      panel = 'dashboard';
    }

    state.currentPanel = panel;

    document
      .querySelectorAll(
        '#admin-portal-shell .admin-panel'
      )
      .forEach(element => {
        const isActive =
          element.dataset.adminView === panel;

        element.style.display =
          isActive ? '' : 'none';

        element.classList.toggle(
          'active',
          isActive
        );
      });


    const title =
      document.getElementById(
        'admin-page-title'
      );

    if (title) {
      title.textContent =
        adminPanelTitles[panel] ||
        'Dashboard';
    }


    document
      .querySelectorAll(
        '#admin-sidebar [data-admin-panel]'
      )
      .forEach(item => {
        item.classList.toggle(
          'active',
          item.dataset.adminPanel === panel
        );
      });


    closeAdminSidebar();


    if (panel === 'dashboard') {
      loadAdminPortalDashboard();
    }

    if (panel === 'parcels') {
      loadAdminParcels();
    }

    if (panel === 'customers') {
      loadAdminCustomers();
    }

    if (panel === 'users') {
      loadAdminUsers();
    }

    if (panel === 'messages') {
      loadAdminMessages();
    }


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };


  window.toggleAdminSidebar = function() {

    const sidebar =
      document.getElementById(
        'admin-sidebar'
      );

    const backdrop =
      document.getElementById(
        'admin-sidebar-backdrop'
      );

    const menu =
      document.getElementById(
        'admin-mobile-menu'
      );

    if (!sidebar) return;


    const open =
      sidebar.classList.toggle(
        'admin-sidebar-open'
      );

    if (backdrop) {
      backdrop.classList.toggle(
        'admin-backdrop-visible',
        open
      );
    }

    if (menu) {
      menu.setAttribute(
        'aria-expanded',
        open ? 'true' : 'false'
      );
    }

    document.body.classList.toggle(
      'admin-menu-open',
      open
    );
  };


  window.closeAdminSidebar = function() {

    const sidebar =
      document.getElementById(
        'admin-sidebar'
      );

    const backdrop =
      document.getElementById(
        'admin-sidebar-backdrop'
      );

    const menu =
      document.getElementById(
        'admin-mobile-menu'
      );

    if (sidebar) {
      sidebar.classList.remove(
        'admin-sidebar-open'
      );
    }

    if (backdrop) {
      backdrop.classList.remove(
        'admin-backdrop-visible'
      );
    }

    if (menu) {
      menu.setAttribute(
        'aria-expanded',
        'false'
      );
    }

    document.body.classList.remove(
      'admin-menu-open'
    );
  };


  /* -------------------------------------------------------
     DASHBOARD
  ------------------------------------------------------- */

  async function loadAdminPortalDashboard() {

    try {

      const response =
        await adminRequest(
          '/api/admin/dashboard'
        );

      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          'Unable to load dashboard.'
        );
      }

      const data =
        await response.json();


      const stats =
        data.stats ||
        data.dashboard ||
        data ||
        {};


      setAdminText(
        'kpi-total',
        stats.total ?? 0
      );

      setAdminText(
        'kpi-transit',
        stats.in_transit ?? 0
      );

      setAdminText(
        'kpi-delivered',
        stats.delivered ?? 0
      );

      setAdminText(
        'kpi-pending',
        stats.pending_exceptions ?? 0
      );

      setAdminText(
        'kpi-customers',
        stats.customers ?? 0
      );

      setAdminText(
        'kpi-messages',
        stats.unread_messages ??
        stats.messages ??
        0
      );


      updateAdminMessageCount(
        stats.unread_messages ??
        0
      );


      await Promise.all([
        loadAdminParcels(true),
        loadAdminMessages(true)
      ]);

      renderAdminRecentShipments();
      renderAdminRecentMessages();

    } catch (error) {

      console.error(
        '[ADMIN PORTAL DASHBOARD]',
        error
      );

      showAdminInlineError(
        'admin-recent-shipments-tbody',
        error.message ||
        'Unable to load dashboard.'
      );
    }
  }


  function setAdminText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        String(value ?? 0);
    }
  }


  function updateAdminMessageCount(count) {

    const value =
      Math.max(
        0,
        Number(count) || 0
      );


    const ids = [
      'admin-nav-message-count',
      'admin-header-message-count',
      'kpi-messages'
    ];


    ids.forEach(id => {

      const element =
        document.getElementById(id);

      if (!element) return;

      element.textContent =
        String(value);

      if (
        id !== 'kpi-messages'
      ) {
        element.style.display =
          value > 0 ? '' : 'none';
      }
    });
  }


  function renderAdminRecentShipments() {

    const tbody =
      document.getElementById(
        'admin-recent-shipments-tbody'
      );

    if (!tbody) return;


    const shipments =
      state.shipments.slice(
        0,
        8
      );


    if (!shipments.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="admin-table-empty">
              No shipment records available.
            </div>
          </td>
        </tr>
      `;

      return;
    }


    tbody.innerHTML =
      shipments.map(shipment => `
        <tr>
          <td>
            <strong class="admin-tracking-number">
              ${adminEscape(
                shipment.tracking_number
              )}
            </strong>
          </td>

          <td>
            <div class="admin-route-cell">
              <span>
                ${adminEscape(
                  shipment.origin || '—'
                )}
              </span>
              <span class="admin-route-arrow">→</span>
              <span>
                ${adminEscape(
                  shipment.destination || '—'
                )}
              </span>
            </div>
          </td>

          <td>
            ${adminStatus(
              shipment.status
            )}
          </td>

          <td>
            ${adminDate(
              shipment.updated_at ||
              shipment.created_at
            )}
          </td>

          <td>
            <button
              type="button"
              class="btn-outline btn-small"
              data-admin-recent-view="${Number(
                shipment.id
              )}"
            >
              View
            </button>
          </td>
        </tr>
      `)
      .join('');


    tbody
      .querySelectorAll(
        '[data-admin-recent-view]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const shipment =
              state.shipments.find(
                item =>
                  Number(item.id) ===
                  Number(
                    button.dataset.adminRecentView
                  )
              );

            if (shipment) {
              showAdminPanel('parcels');
              openAdminParcelDetail(
                shipment
              );
            }
          }
        );
      });
  }


  function renderAdminRecentMessages() {

    const container =
      document.getElementById(
        'admin-recent-messages-list'
      );

    if (!container) return;


    const messages =
      state.messages.slice(
        0,
        6
      );


    if (!messages.length) {

      container.innerHTML = `
        <div class="admin-empty-state admin-empty-state-compact">
          <div class="admin-empty-icon">✉</div>
          <h3>No customer messages</h3>
          <p>Incoming contact requests will appear here.</p>
        </div>
      `;

      return;
    }


    container.innerHTML =
      messages.map(message => {

        const unread =
          String(
            message.status || ''
          ).toLowerCase() === 'unread';

        return `
          <button
            type="button"
            class="admin-message-preview ${
              unread
                ? 'admin-message-unread'
                : ''
            }"
            data-admin-preview-message="${
              Number(message.id)
            }"
          >
            <span class="admin-message-preview-main">
              <strong>
                ${adminEscape(
                  message.sender_name ||
                  message.name ||
                  'Customer'
                )}
              </strong>

              <span>
                ${adminEscape(
                  message.subject ||
                  'No subject'
                )}
              </span>
            </span>

            <span class="admin-message-preview-meta">
              ${adminDate(
                message.created_at
              )}
            </span>
          </button>
        `;
      })
      .join('');


    container
      .querySelectorAll(
        '[data-admin-preview-message]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            showAdminPanel('messages');

            openAdminMessageDetail(
              Number(
                button.dataset.adminPreviewMessage
              )
            );
          }
        );
      });
  }


  /* -------------------------------------------------------
     PARCELS
  ------------------------------------------------------- */

  async function loadAdminParcels(
    silent = false
  ) {

    try {

      const response =
        await adminRequest(
          '/api/admin/shipments'
        );

      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          'Unable to load parcels.'
        );
      }

      const data =
        await response.json();


      state.shipments =
        Array.isArray(data)
          ? data
          : (
              data.shipments ||
              data.data ||
              []
            );


      renderAdminParcels();

      if (!silent) {
        renderAdminRecentShipments();
      }

      return state.shipments;

    } catch (error) {

      console.error(
        '[ADMIN PARCELS]',
        error
      );

      const tbody =
        document.getElementById(
          'admin-parcels-tbody'
        );

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="admin-inline-error">
                ${adminEscape(
                  error.message ||
                  'Unable to load parcels.'
                )}
              </div>
            </td>
          </tr>
        `;
      }

      if (!silent) {
        alert(
          error.message ||
          'Unable to load parcels.'
        );
      }
    }
  }


  function renderAdminParcels() {

    const tbody =
      document.getElementById(
        'admin-parcels-tbody'
      );

    if (!tbody) return;


    const count =
      document.getElementById(
        'admin-parcels-count'
      );

    if (count) {
      count.textContent =
        `${state.shipments.length} ${
          state.shipments.length === 1
            ? 'record'
            : 'records'
        }`;
    }


    if (!state.shipments.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="admin-table-empty">
              <strong>No parcels found</strong>
              <span>Create a parcel to begin tracking shipments.</span>
            </div>
          </td>
        </tr>
      `;

      return;
    }


    tbody.innerHTML =
      state.shipments.map(shipment => `
        <tr>
          <td>
            <strong class="admin-tracking-number">
              ${adminEscape(
                shipment.tracking_number
              )}
            </strong>

            ${
              shipment.reference
                ? `
                  <small class="admin-table-secondary">
                    ${adminEscape(
                      shipment.reference
                    )}
                  </small>
                `
                : ''
            }
          </td>

          <td>
            <div class="admin-party-cell">
              <strong>
                ${adminEscape(
                  shipment.sender_name || '—'
                )}
              </strong>
              <span>→</span>
              <strong>
                ${adminEscape(
                  shipment.recipient_name || '—'
                )}
              </strong>
            </div>
          </td>

          <td>
            <div class="admin-route-cell">
              <span>
                ${adminEscape(
                  shipment.origin || '—'
                )}
              </span>
              <span class="admin-route-arrow">→</span>
              <span>
                ${adminEscape(
                  shipment.destination || '—'
                )}
              </span>
            </div>
          </td>

          <td>
            ${adminEscape(
              shipment.service_type || '—'
            )}
          </td>

          <td>
            ${adminStatus(
              shipment.status
            )}
          </td>

          <td>
            ${adminDate(
              shipment.updated_at ||
              shipment.created_at
            )}
          </td>

          <td>
            <button
              type="button"
              class="btn-gold btn-small"
              data-admin-parcel-view="${
                Number(shipment.id)
              }"
            >
              View Parcel
            </button>
          </td>
        </tr>
      `)
      .join('');


    tbody
      .querySelectorAll(
        '[data-admin-parcel-view]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const shipment =
              state.shipments.find(
                item =>
                  Number(item.id) ===
                  Number(
                    button.dataset.adminParcelView
                  )
              );

            if (shipment) {
              openAdminParcelDetail(
                shipment
              );
            }
          }
        );
      });
  }


  window.openAdminParcelDetail =
    async function(shipment) {

      if (
        !shipment ||
        !shipment.id
      ) {
        return;
      }


      state.selectedShipment =
        shipment;


      const detail =
        document.getElementById(
          'admin-parcel-detail'
        );

      if (detail) {
        detail.style.display = '';
      }


      const listCard =
        document.querySelector(
          '#admin-panel-parcels > .admin-content-card'
        );

      if (listCard) {
        listCard.style.display = 'none';
      }


      setAdminText(
        'admin-parcel-detail-tracking',
        shipment.tracking_number ||
        'Shipment'
      );

      setAdminText(
        'admin-parcel-detail-reference',
        shipment.reference ||
        'No reference provided'
      );


      const status =
        document.getElementById(
          'admin-parcel-detail-status'
        );

      if (status) {
        status.innerHTML =
          adminStatus(
            shipment.status
          );
      }


      const info =
        document.getElementById(
          'admin-parcel-info-grid'
        );

      if (info) {

        const fields = [
          [
            'Tracking Number',
            shipment.tracking_number
          ],
          [
            'Sender',
            shipment.sender_name
          ],
          [
            'Sender Country',
            shipment.sender_country
          ],
          [
            'Recipient',
            shipment.recipient_name
          ],
          [
            'Recipient Country',
            shipment.recipient_country
          ],
          [
            'Origin',
            shipment.origin
          ],
          [
            'Destination',
            shipment.destination
          ],
          [
            'Current Location',
            shipment.current_location
          ],
          [
            'Service Type',
            shipment.service_type
          ],
          [
            'Priority',
            shipment.priority
          ],
          [
            'Package Count',
            shipment.package_count
          ],
          [
            'Weight',
            shipment.weight
          ],
          [
            'Declared Value',
            shipment.declared_value
              ? `${shipment.currency || ''} ${
                  shipment.declared_value
                }`
              : null
          ],
          [
            'Estimated Delivery',
            shipment.estimated_delivery
              ? adminDate(
                  shipment.estimated_delivery
                )
              : null
          ],
          [
            'Created',
            adminDate(
              shipment.created_at
            )
          ],
          [
            'Last Updated',
            adminDate(
              shipment.updated_at
            )
          ]
        ];


        info.innerHTML =
          fields
            .filter(
              field =>
                field[1] !== null &&
                field[1] !== undefined &&
                String(field[1]).trim() !== ''
            )
            .map(field => `
              <div class="admin-info-item">
                <span>${adminEscape(
                  field[0]
                )}</span>
                <strong>${adminEscape(
                  field[1]
                )}</strong>
              </div>
            `)
            .join('');
      }


      const editButton =
        document.getElementById(
          'admin-parcel-edit-btn'
        );

      if (editButton) {

        editButton.onclick =
          () => {

            if (
              typeof openUpdateShipmentModal ===
              'function'
            ) {
              openUpdateShipmentModal(
                state.selectedShipment
              );
            }
          };
      }


      const printButton =
        document.getElementById(
          'admin-parcel-print-btn'
        );

      if (printButton) {

        printButton.onclick =
          () => {

            if (
              typeof printShipmentTracking ===
              'function'
            ) {
              printShipmentTracking(
                state.selectedShipment
              );
            }
          };
      }


      const deleteButton =
        document.getElementById(
          'admin-parcel-delete-btn'
        );

      if (deleteButton) {

        deleteButton.onclick =
          () => deleteAdminShipment(
            state.selectedShipment.id
          );
      }


      await loadAdminParcelTimeline(
        shipment.id
      );
    };


  window.closeAdminParcelDetail =
    function() {

      state.selectedShipment =
        null;


      const detail =
        document.getElementById(
          'admin-parcel-detail'
        );

      if (detail) {
        detail.style.display =
          'none';
      }


      const listCard =
        document.querySelector(
          '#admin-panel-parcels > .admin-content-card'
        );

      if (listCard) {
        listCard.style.display = '';
      }
    };


  async function loadAdminParcelTimeline(
    shipmentId
  ) {

    const timeline =
      document.getElementById(
        'admin-parcel-timeline'
      );

    const loading =
      document.getElementById(
        'admin-parcel-timeline-loading'
      );

    const error =
      document.getElementById(
        'admin-parcel-timeline-error'
      );


    if (timeline) {
      timeline.innerHTML = '';
    }

    if (error) {
      error.style.display =
        'none';
      error.textContent = '';
    }

    if (loading) {
      loading.style.display = '';
    }


    try {

      const response =
        await adminRequest(
          `/api/admin/shipments/${encodeURIComponent(
            shipmentId
          )}/events`
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          'Unable to load tracking history.'
        );
      }


      const data =
        await response.json();


      const events =
        Array.isArray(data)
          ? data
          : (
              data.events ||
              data.data ||
              []
            );


      if (!events.length) {

        if (timeline) {
          timeline.innerHTML = `
            <div class="admin-empty-state admin-empty-state-compact">
              <h3>No tracking events</h3>
              <p>No recorded tracking history is available for this parcel.</p>
            </div>
          `;
        }

        return;
      }


      if (timeline) {

        timeline.innerHTML =
          events.map((event, index) => `
            <article class="admin-timeline-item">
              <div class="admin-timeline-marker">
                <span></span>
              </div>

              <div class="admin-timeline-content">
                <div class="admin-timeline-topline">
                  <strong>
                    ${adminEscape(
                      event.status ||
                      'Status Update'
                    )}
                  </strong>

                  <time>
                    ${adminDate(
                      event.event_time ||
                      event.created_at
                    )}
                  </time>
                </div>

                <div class="admin-timeline-location">
                  ${adminEscape(
                    event.location ||
                    'Location not recorded'
                  )}
                </div>

                ${
                  event.description
                    ? `
                      <p>
                        ${adminEscape(
                          event.description
                        )}
                      </p>
                    `
                    : ''
                }
              </div>
            </article>
          `)
          .join('');
      }

    } catch (err) {

      console.error(
        '[ADMIN PARCEL TIMELINE]',
        err
      );

      if (error) {
        error.textContent =
          err.message ||
          'Unable to load tracking history.';

        error.style.display = '';
      }

    } finally {

      if (loading) {
        loading.style.display =
          'none';
      }
    }
  }


  async function deleteAdminShipment(
    shipmentId
  ) {

    if (!shipmentId) {
      return;
    }


    const shipment =
      state.shipments.find(
        item =>
          Number(item.id) ===
          Number(shipmentId)
      );


    const tracking =
      shipment &&
      shipment.tracking_number
        ? shipment.tracking_number
        : 'this parcel';


    if (
      !window.confirm(
        `Delete ${tracking}? This action cannot be undone.`
      )
    ) {
      return;
    }


    try {

      const response =
        await adminRequest(
          `/api/admin/shipments/${encodeURIComponent(
            shipmentId
          )}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type':
                'application/json'
            }
          }
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      const data =
        await response.json()
          .catch(() => ({}));


      if (!response.ok) {
        throw new Error(
          data.error ||
          'Unable to delete parcel.'
        );
      }


      closeAdminParcelDetail();

      await loadAdminParcels();

      await loadAdminPortalDashboard();

    } catch (error) {

      console.error(
        '[ADMIN DELETE PARCEL]',
        error
      );

      alert(
        error.message ||
        'Unable to delete parcel.'
      );
    }
  }


  /* -------------------------------------------------------
     CUSTOMERS
  ------------------------------------------------------- */

  async function loadAdminCustomers() {

    try {

      const response =
        await adminRequest(
          '/api/admin/customers'
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      if (!response.ok) {
        throw new Error(
          'Unable to load customers.'
        );
      }


      const data =
        await response.json();


      state.customers =
        Array.isArray(data)
          ? data
          : (
              data.customers ||
              data.data ||
              []
            );


      renderAdminCustomers();

    } catch (error) {

      console.error(
        '[ADMIN CUSTOMERS]',
        error
      );

      const tbody =
        document.getElementById(
          'admin-customers-tbody'
        );

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="admin-inline-error">
                ${adminEscape(
                  error.message ||
                  'Unable to load customers.'
                )}
              </div>
            </td>
          </tr>
        `;
      }
    }
  }


  function renderAdminCustomers() {

    const tbody =
      document.getElementById(
        'admin-customers-tbody'
      );

    if (!tbody) return;


    const count =
      document.getElementById(
        'admin-customers-count'
      );

    if (count) {
      count.textContent =
        `${state.customers.length} ${
          state.customers.length === 1
            ? 'record'
            : 'records'
        }`;
    }


    if (!state.customers.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="admin-table-empty">
              <strong>No customers found</strong>
              <span>No customer accounts are currently registered.</span>
            </div>
          </td>
        </tr>
      `;

      return;
    }


    tbody.innerHTML =
      state.customers.map(customer => `
        <tr>
          <td>
            <strong>
              ${adminEscape(
                customer.name ||
                'Unnamed Customer'
              )}
            </strong>
          </td>

          <td>
            ${adminEscape(
              customer.email ||
              '—'
            )}
          </td>

          <td>
            ${adminEscape(
              customer.role ||
              'Customer'
            )}
          </td>

          <td>
            ${adminDate(
              customer.created_at
            )}
          </td>
        </tr>
      `)
      .join('');
  }


  /* -------------------------------------------------------
     CUSTOMER MESSAGES
  ------------------------------------------------------- */

  async function loadAdminMessages(
    silent = false
  ) {

    try {

      const response =
        await adminRequest(
          '/api/admin/messages'
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      if (!response.ok) {
        throw new Error(
          'Unable to load customer messages.'
        );
      }


      const data =
        await response.json();


      state.messages =
        Array.isArray(data)
          ? data
          : (
              data.messages ||
              data.data ||
              []
            );


      renderAdminMessages();


      const unread =
        state.messages.filter(
          message =>
            String(
              message.status || ''
            ).toLowerCase() ===
            'unread'
        ).length;


      updateAdminMessageCount(
        unread
      );


      if (!silent) {
        renderAdminRecentMessages();
      }


      return state.messages;

    } catch (error) {

      console.error(
        '[ADMIN MESSAGES]',
        error
      );


      const list =
        document.getElementById(
          'admin-messages-list'
        );


      if (list) {
        list.innerHTML = `
          <div class="admin-inline-error">
            ${adminEscape(
              error.message ||
              'Unable to load messages.'
            )}
          </div>
        `;
      }
    }
  }


  function renderAdminMessages() {

    const list =
      document.getElementById(
        'admin-messages-list'
      );

    if (!list) return;


    const count =
      document.getElementById(
        'admin-message-count-label'
      );


    if (count) {
      count.textContent =
        `${state.messages.length} ${
          state.messages.length === 1
            ? 'message'
            : 'messages'
        }`;
    }


    if (!state.messages.length) {

      list.innerHTML = `
        <div class="admin-empty-state">
          <div class="admin-empty-icon">✉</div>
          <h3>Inbox is empty</h3>
          <p>Customer contact messages will appear here.</p>
        </div>
      `;

      return;
    }


    list.innerHTML =
      state.messages.map(message => {

        const unread =
          String(
            message.status || ''
          ).toLowerCase() ===
          'unread';


        return `
          <button
            type="button"
            class="admin-message-row ${
              unread
                ? 'admin-message-row-unread'
                : ''
            }"
            data-admin-message-id="${
              Number(message.id)
            }"
          >

            <span class="admin-message-row-avatar">
              ${adminEscape(
                String(
                  message.sender_name ||
                  message.name ||
                  'C'
                )
                .trim()
                .charAt(0)
                .toUpperCase()
              )}
            </span>

            <span class="admin-message-row-body">

              <span class="admin-message-row-top">
                <strong>
                  ${adminEscape(
                    message.sender_name ||
                    message.name ||
                    'Customer'
                  )}
                </strong>

                <time>
                  ${adminDate(
                    message.created_at
                  )}
                </time>
              </span>

              <span class="admin-message-row-subject">
                ${adminEscape(
                  message.subject ||
                  'No subject'
                )}
              </span>

              <span class="admin-message-row-preview">
                ${adminEscape(
                  message.message ||
                  ''
                )}
              </span>

            </span>

            <span class="admin-message-row-status">
              ${unread
                ? '<span class="admin-unread-dot" title="Unread"></span>'
                : adminEscape(
                    message.status ||
                    'Read'
                  )}
            </span>

          </button>
        `;
      })
      .join('');


    list
      .querySelectorAll(
        '[data-admin-message-id]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            openAdminMessageDetail(
              Number(
                button.dataset.adminMessageId
              )
            );
          }
        );
      });
  }


  window.openAdminMessageDetail =
    async function(messageId) {

      const message =
        state.messages.find(
          item =>
            Number(item.id) ===
            Number(messageId)
        );


      if (!message) {
        return;
      }


      state.selectedMessage =
        message;


      const detail =
        document.getElementById(
          'admin-message-detail'
        );


      if (!detail) {
        return;
      }


      detail.innerHTML = `
        <div class="admin-message-detail-inner">

          <div class="admin-detail-toolbar admin-message-detail-toolbar">
            <div>
              <span class="admin-detail-eyebrow">
                CUSTOMER MESSAGE
              </span>

              <h3>
                ${adminEscape(
                  message.subject ||
                  'No subject'
                )}
              </h3>
            </div>

            <div class="admin-detail-actions">
              ${
                String(
                  message.status || ''
                ).toLowerCase() === 'unread'
                  ? `
                    <button
                      type="button"
                      class="btn-outline btn-small"
                      id="admin-detail-mark-read"
                    >
                      Mark Read
                    </button>
                  `
                  : ''
              }

              <button
                type="button"
                class="btn-danger btn-small"
                id="admin-detail-delete-message"
              >
                Delete
              </button>
            </div>
          </div>


          <div class="admin-message-customer-card">

            <div class="admin-message-customer-avatar">
              ${adminEscape(
                String(
                  message.sender_name ||
                  message.name ||
                  'C'
                )
                .trim()
                .charAt(0)
                .toUpperCase()
              )}
            </div>

            <div>
              <strong>
                ${adminEscape(
                  message.sender_name ||
                  message.name ||
                  'Customer'
                )}
              </strong>

              <a
                href="mailto:${adminEscape(
                  message.email || ''
                )}"
              >
                ${adminEscape(
                  message.email ||
                  'No email'
                )}
              </a>
            </div>

            <div class="admin-message-meta">
              <span>Received</span>
              <strong>
                ${adminDate(
                  message.created_at
                )}
              </strong>
            </div>

          </div>


          <div class="admin-message-full">
            <span class="admin-field-label">
              Message
            </span>

            <div class="admin-message-body">
              ${adminEscape(
                message.message ||
                ''
              ).replace(
                /\n/g,
                '<br>'
              )}
            </div>
          </div>


          <div class="admin-message-response">

            <div class="admin-field-heading">
              <div>
                <span class="admin-field-label">
                  Administrator Response
                </span>

                <small>
                  Send a response to the customer's email address.
                </small>
              </div>
            </div>

            <textarea
              id="admin-message-response-text"
              class="admin-response-textarea"
              rows="7"
              placeholder="Write your response here..."
            ></textarea>

            <div class="admin-response-actions">

              <button
                type="button"
                class="btn-gold"
                id="admin-message-send-response"
              >
                Send Response
              </button>

              <button
                type="button"
                class="btn-outline"
                id="admin-message-mark-read-secondary"
              >
                ${
                  String(
                    message.status || ''
                  ).toLowerCase() === 'unread'
                    ? 'Mark Read'
                    : 'Read'
                }
              </button>

            </div>

            <div
              id="admin-message-response-feedback"
              class="admin-inline-feedback"
              style="display:none;"
            ></div>

          </div>

        </div>
      `;


      const markButton =
        document.getElementById(
          'admin-detail-mark-read'
        );

      if (markButton) {
        markButton.onclick =
          () => markAdminMessageRead(
            message.id
          );
      }


      const secondaryRead =
        document.getElementById(
          'admin-message-mark-read-secondary'
        );

      if (secondaryRead) {
        secondaryRead.onclick =
          () => markAdminMessageRead(
            message.id
          );
      }


      const deleteButton =
        document.getElementById(
          'admin-detail-delete-message'
        );

      if (deleteButton) {
        deleteButton.onclick =
          () => deleteAdminMessage(
            message.id
          );
      }


      const sendButton =
        document.getElementById(
          'admin-message-send-response'
        );

      if (sendButton) {
        sendButton.onclick =
          () => sendAdminMessageResponse(
            message.id
          );
      }


      if (
        String(
          message.status || ''
        ).toLowerCase() === 'unread'
      ) {
        await markAdminMessageRead(
          message.id,
          true
        );
      }
    };


  async function markAdminMessageRead(
    messageId,
    silent = false
  ) {

    try {

      const response =
        await adminRequest(
          `/api/admin/messages/${encodeURIComponent(
            messageId
          )}/read`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({})
          }
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      const data =
        await response.json()
          .catch(() => ({}));


      if (!response.ok) {
        throw new Error(
          data.error ||
          'Unable to mark message as read.'
        );
      }


      const message =
        state.messages.find(
          item =>
            Number(item.id) ===
            Number(messageId)
        );


      if (message) {
        message.status = 'Read';
        message.read_at =
          new Date().toISOString();
      }


      renderAdminMessages();


      updateAdminMessageCount(
        state.messages.filter(
          item =>
            String(
              item.status || ''
            ).toLowerCase() ===
            'unread'
        ).length
      );


      renderAdminRecentMessages();


      if (
        !silent &&
        state.selectedMessage
      ) {
        openAdminMessageDetail(
          messageId
        );
      }

    } catch (error) {

      console.error(
        '[ADMIN MARK MESSAGE READ]',
        error
      );

      if (!silent) {
        alert(
          error.message ||
          'Unable to mark message as read.'
        );
      }
    }
  }


  async function sendAdminMessageResponse(
    messageId
  ) {

    const textarea =
      document.getElementById(
        'admin-message-response-text'
      );

    const feedback =
      document.getElementById(
        'admin-message-response-feedback'
      );

    const sendButton =
      document.getElementById(
        'admin-message-send-response'
      );


    const responseText =
      textarea
        ? textarea.value.trim()
        : '';


    if (!responseText) {

      if (feedback) {
        feedback.textContent =
          'Please enter a response before sending.';

        feedback.className =
          'admin-inline-feedback admin-inline-feedback-error';

        feedback.style.display = '';
      }

      return;
    }


    try {

      if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent =
          'Sending...';
      }


      const response =
        await adminRequest(
          `/api/admin/messages/${encodeURIComponent(
            messageId
          )}/reply`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              message: responseText
            })
          }
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      const data =
        await response.json()
          .catch(() => ({}));


      if (!response.ok) {
        throw new Error(
          data.error ||
          'Unable to send response.'
        );
      }


      if (feedback) {
        feedback.textContent =
          'Response sent successfully.';

        feedback.className =
          'admin-inline-feedback admin-inline-feedback-success';

        feedback.style.display = '';
      }


      if (textarea) {
        textarea.value = '';
      }


      await loadAdminMessages();


      const updated =
        state.messages.find(
          item =>
            Number(item.id) ===
            Number(messageId)
        );


      if (updated) {
        state.selectedMessage =
          updated;

        openAdminMessageDetail(
          messageId
        );
      }

    } catch (error) {

      console.error(
        '[ADMIN MESSAGE RESPONSE]',
        error
      );

      if (feedback) {
        feedback.textContent =
          error.message ||
          'Unable to send response.';

        feedback.className =
          'admin-inline-feedback admin-inline-feedback-error';

        feedback.style.display = '';
      }

    } finally {

      if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent =
          'Send Response';
      }
    }
  }


  async function deleteAdminMessage(
    messageId
  ) {

    if (
      !window.confirm(
        'Delete this customer message? This action cannot be undone.'
      )
    ) {
      return;
    }


    try {

      const response =
        await adminRequest(
          `/api/admin/messages/${encodeURIComponent(
            messageId
          )}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type':
                'application/json'
            }
          }
        );


      if (
        handleAdminApiFailure(response)
      ) {
        return;
      }


      const data =
        await response.json()
          .catch(() => ({}));


      if (!response.ok) {
        throw new Error(
          data.error ||
          'Unable to delete message.'
        );
      }


      state.messages =
        state.messages.filter(
          item =>
            Number(item.id) !==
            Number(messageId)
        );


      state.selectedMessage =
        null;


      renderAdminMessages();
      renderAdminRecentMessages();


      updateAdminMessageCount(
        state.messages.filter(
          item =>
            String(
              item.status || ''
            ).toLowerCase() ===
            'unread'
        ).length
      );


      const detail =
        document.getElementById(
          'admin-message-detail'
        );


      if (detail) {
        detail.innerHTML = `
          <div class="admin-empty-state">
            <div class="admin-empty-icon">✓</div>
            <h3>Message deleted</h3>
            <p>The customer message has been removed.</p>
          </div>
        `;
      }

    } catch (error) {

      console.error(
        '[ADMIN DELETE MESSAGE]',
        error
      );

      alert(
        error.message ||
        'Unable to delete message.'
      );
    }
  }


  /* -------------------------------------------------------
     HONEST EMPTY PANELS
  ------------------------------------------------------- */

  function configureUnavailablePanels() {

    const panelData = {
      transactions: {
        title: 'Transactions are not connected',
        text: 'No transaction table or transaction API is currently configured for this portal.'
      },

      support: {
        title: 'Support tickets are not connected',
        text: 'No support-ticket table or support API is currently configured for this portal.'
      },

      reports: {
        title: 'Reports are not connected',
        text: 'Reporting views remain empty until the required reporting data is available.'
      }
    };


    Object.entries(panelData)
      .forEach(([panel, data]) => {

        const element =
          document.querySelector(
            `[data-admin-view="${panel}"]`
          );

        if (!element) return;


        if (
          element.dataset.adminEmptyConfigured ===
          'true'
        ) {
          return;
        }


        element.dataset.adminEmptyConfigured =
          'true';


        const content =
          element.querySelector(
            '.admin-content-card'
          );


        if (!content) return;


        content.innerHTML = `
          <div class="admin-empty-state admin-panel-empty-state">

            <div class="admin-empty-icon">
              ${panel === 'transactions'
                ? '▤'
                : panel === 'support'
                  ? '?'
                  : '▥'}
            </div>

            <h3>
              ${adminEscape(
                data.title
              )}
            </h3>

            <p>
              ${adminEscape(
                data.text
              )}
            </p>

          </div>
        `;
      });
  }


  /* -------------------------------------------------------
     COMPATIBILITY OVERRIDE
     Existing login/settings/receipt/event functions stay.
  ------------------------------------------------------- */

  window.loadAdminDashboard =
    async function() {

      showSection(
        'admin-dashboard'
      );

      configureUnavailablePanels();


      const nameElement =
        document.getElementById(
          'admin-header-name'
        );


      try {

        await loadAdminPortalDashboard();

      } catch (error) {

        console.error(
          '[ADMIN DASHBOARD COMPATIBILITY]',
          error
        );
      }


      if (nameElement) {

        const storedName =
          window.__adminName ||
          'Administrator';

        nameElement.textContent =
          storedName;
      }


      showAdminPanel(
        state.currentPanel ||
        'dashboard'
      );
    };


  /* -------------------------------------------------------
     SIDEBAR BACKDROP
  ------------------------------------------------------- */

  function bindSidebarBackdrop() {

    const backdrop =
      document.getElementById(
        'admin-sidebar-backdrop'
      );


    if (!backdrop) return;


    if (
      backdrop.dataset.adminBound ===
      'true'
    ) {
      return;
    }


    backdrop.dataset.adminBound =
      'true';


    backdrop.addEventListener(
      'click',
      closeAdminSidebar
    );
  }


  /* -------------------------------------------------------
     INITIALIZATION
  ------------------------------------------------------- */

  function initialize() {

    configureUnavailablePanels();

    bindSidebarBackdrop();


    const shell =
      document.getElementById(
        'admin-portal-shell'
      );


    if (shell) {

      shell.addEventListener(
        'click',
        event => {

          const nav =
            event.target.closest(
              '[data-admin-panel], [data-admin-view]'
            );

          if (!nav) return;

          const panel =
            nav.dataset.adminView ||
            nav.dataset.adminPanel;

          if (panel) {
            event.preventDefault();
            showAdminPanel(panel);
          }
        }
      );
    }
  }


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once: true
      }
    );

  } else {

    initialize();
  }

})();
