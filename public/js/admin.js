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


            /*
             * Message button handlers are attached directly
             * rather than placing customer data into inline JS.
             */

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


            const estimatedDelivery =
              String(
                s.estimated_delivery ||
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
                  Update Node
                </button>
              </td>
            `;


            const updateButton =
              tr.querySelector(
                '[data-shipment-update-id]'
              );


            if (updateButton) {

              updateButton.addEventListener(
                'click',
                () =>
                  openUpdateShipmentModal(
                    shipmentId,
                    status,
                    currentLocation,
                    estimatedDelivery
                  )
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

    /*
     * Do not expose internal backend errors
     * to the administrator.
     */

    alert(
      err.message ||
      'Unable to load admin dashboard.'
    );
  }
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


  /*
   * Basic frontend validation.
   */

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


    /*
     * Authentication failure.
     */

    if (
      res.status === 401 ||
      res.status === 403
    ) {

      handleAdminSessionExpired();

      return;
    }


    if (!res.ok) {

      alert(
        data.error ||
        'Failed to generate shipment.'
      );

      return;
    }


    /*
     * Successful shipment creation.
     */

    alert(
      `Waybill Created Successfully!\n\nTracking Number: ${
        data.tracking_number ||
        data.shipment?.tracking_number ||
        'Created'
      }`
    );


    hideModal(
      'modal-create-shipment'
    );


    /*
     * Reset form if it exists.
     */

    const form =
      document.getElementById(
        'form-create-shipment'
      );

    if (form) {
      form.reset();
    }


    /*
     * Some HTML versions may use a different form ID.
     */

    const createForm =
      document.querySelector(
        '#modal-create-shipment form'
      );

    if (createForm) {
      createForm.reset();
    }


    await loadAdminDashboard();

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

function openUpdateShipmentModal(
  id,
  currentStatus,
  currentLoc,
  eta
) {

  const shipmentIdEl =
    document.getElementById(
      'us-shipment-id'
    );

  const locationEl =
    document.getElementById(
      'us-location'
    );

  const etaEl =
    document.getElementById(
      'us-eta'
    );

  const timestampEl =
    document.getElementById(
      'us-timestamp'
    );

  const selectEl =
    document.getElementById(
      'us-status-select'
    );

  const customEl =
    document.getElementById(
      'us-status-custom'
    );


  if (
    !shipmentIdEl ||
    !locationEl ||
    !etaEl ||
    !timestampEl ||
    !selectEl ||
    !customEl
  ) {

    console.error(
      'Update shipment form elements are missing.'
    );

    alert(
      'Unable to open shipment update form.'
    );

    return;
  }


  shipmentIdEl.value =
    id || '';


  locationEl.value =
    currentLoc || '';


  etaEl.value =
    eta || '';


  /*
   * Use the current local date/time as the default
   * event time.
   */

  const now =
    new Date();


  now.setMinutes(
    now.getMinutes() -
    now.getTimezoneOffset()
  );


  timestampEl.value =
    now.toISOString()
      .slice(0, 16);


  /*
   * Standard statuses.
   */

  const standardStatuses = [
    'Shipment Created',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Customs Hold',
    'Delayed'
  ];


  if (
    standardStatuses.includes(
      currentStatus
    )
  ) {

    selectEl.value =
      currentStatus;


    customEl.value =
      '';


    customEl.style.display =
      'none';

  } else {

    selectEl.value =
      'CUSTOM';


    customEl.value =
      currentStatus || '';


    customEl.style.display =
      'block';
  }


  /*
   * Clear old description.
   */

  const descriptionEl =
    document.getElementById(
      'us-description'
    );


  if (descriptionEl) {

    descriptionEl.value =
      '';
  }


  showModal(
    'modal-update-shipment'
  );
}


/* =========================================================
   CUSTOM STATUS
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


  const shipmentIdEl =
    document.getElementById(
      'us-shipment-id'
    );

  const selectEl =
    document.getElementById(
      'us-status-select'
    );

  const customEl =
    document.getElementById(
      'us-status-custom'
    );

  const locationEl =
    document.getElementById(
      'us-location'
    );

  const timestampEl =
    document.getElementById(
      'us-timestamp'
    );

  const etaEl =
    document.getElementById(
      'us-eta'
    );

  const descriptionEl =
    document.getElementById(
      'us-description'
    );


  if (
    !shipmentIdEl ||
    !selectEl ||
    !customEl ||
    !locationEl ||
    !timestampEl ||
    !etaEl ||
    !descriptionEl
  ) {

    alert(
      'Shipment update form is incomplete.'
    );

    return;
  }


  const id =
    shipmentIdEl.value.trim();


  const selectVal =
    selectEl.value;


  const customStatus =
    customEl.value.trim();


  const finalStatus =
    selectVal === 'CUSTOM'
      ? customStatus
      : selectVal;


  const currentLocation =
    locationEl.value.trim();


  const eventTime =
    timestampEl.value;


  const estimatedDelivery =
    etaEl.value;


  const description =
    descriptionEl.value.trim();


  /*
   * Validate required fields.
   */

  if (!id) {

    alert(
      'Shipment ID is missing.'
    );

    return;
  }


  if (!finalStatus) {

    alert(
      'Please select or enter a shipment status.'
    );

    return;
  }


  if (!currentLocation) {

    alert(
      'Please enter the current shipment location.'
    );

    return;
  }


  /*
   * Build API payload.
   */

  const payload = {

    status:
      finalStatus,

    current_location:
      currentLocation,

    event_time:
      eventTime,

    estimated_delivery:
      estimatedDelivery,

    event_description:
      description ||
      `Shipment status updated to ${finalStatus}`
  };


  try {

    const res =
      await fetch(
        `/api/admin/shipments/${encodeURIComponent(id)}`,
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

      data =
        await res.json();

    } catch {

      data = {};

    }


    /*
     * Authentication failure.
     */

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
        'Failed to update shipment.'
      );
    }


    hideModal(
      'modal-update-shipment'
    );


    alert(
      'Shipment updated successfully.'
    );


    await loadAdminDashboard();

  } catch (err) {

    console.error(
      'Update shipment error:',
      err
    );

    alert(
      err.message ||
      'Error connecting to server.'
    );
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
      Array.isArray(payload)
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

  /*
   * Prevent duplicate modal.
   */

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


  /*
   * Close when clicking outside.
   */

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


  /*
   * Escape key.
   */

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindCreateParcelButton);
} else {
  bindCreateParcelButton();
}
