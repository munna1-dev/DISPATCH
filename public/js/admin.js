let authToken = localStorage.getItem('us_courier_token');

/* =========================================================
   ADMIN LOGIN
========================================================= */

async function handleAdminLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(
        data.error || 'Invalid Operator Credentials'
      );
    }

    authToken = data.token;

    localStorage.setItem(
      'us_courier_token',
      authToken
    );

    loadAdminDashboard();

  } catch (err) {
    console.error('Admin login error:', err);
    alert('Server Connection Error');
  }
}


/* =========================================================
   ADMIN LOGOUT
========================================================= */

function handleAdminLogout() {
  localStorage.removeItem('us_courier_token');

  authToken = null;

  showSection('admin-login');
}


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

async function loadAdminDashboard() {
  if (!authToken) {
    return showSection('admin-login');
  }

  showSection('admin-dashboard');

  try {

    /* -----------------------------------------------------
       DASHBOARD STATISTICS
    ----------------------------------------------------- */

    const resStats = await fetch(
      '/api/admin/dashboard',
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (resStats.status === 401 || resStats.status === 403) {
      handleAdminSessionExpired();
      return;
    }

    const stats = await resStats.json();

    if (stats.counts) {
      const totalEl =
        document.getElementById('kpi-total');

      const transitEl =
        document.getElementById('kpi-transit');

      const deliveredEl =
        document.getElementById('kpi-delivered');

      const messagesEl =
        document.getElementById('kpi-messages');

      if (totalEl) {
        totalEl.innerText =
          stats.counts.total || 0;
      }

      if (transitEl) {
        transitEl.innerText =
          stats.counts.in_transit || 0;
      }

      if (deliveredEl) {
        deliveredEl.innerText =
          stats.counts.delivered || 0;
      }

      if (messagesEl) {
        messagesEl.innerText =
          stats.unread_messages || 0;
      }
    }


    /* -----------------------------------------------------
       LOAD CUSTOMER MESSAGES
    ----------------------------------------------------- */

    const resMessages = await fetch(
      '/api/admin/messages',
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (
      resMessages.status === 401 ||
      resMessages.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    const messages = await resMessages.json();

    const msgTbody =
      document.getElementById(
        'admin-messages-tbody'
      );

    if (msgTbody) {
      msgTbody.innerHTML = '';

      if (!Array.isArray(messages) || messages.length === 0) {

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
                class="fa-solid fa-inbox"
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

        messages.forEach((m) => {

          const tr =
            document.createElement('tr');

          const isUnread =
            m.status === 'Unread';

          /*
           * Escape customer-controlled content before
           * placing it into HTML.
           */
          const safeName =
            escapeAdminHtml(m.sender_name);

          const safeEmail =
            escapeAdminHtml(m.email);

          const safeSubject =
            escapeAdminHtml(m.subject);

          const safeMessage =
            escapeAdminHtml(m.message);

          const safeDate =
            new Date(
              m.created_at
            ).toLocaleString();

          tr.innerHTML = `
            <td>
              <strong>
                ${safeName}
              </strong>
            </td>

            <td>
              <a
                href="mailto:${encodeURIComponent(m.email)}"
                style="color:var(--accent-gold);"
              >
                ${safeEmail}
              </a>
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
              style="font-size:0.8rem;"
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
                ${safeStatus(m.status)}
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
                  onclick="openMessageReply(${m.id})"
                >
                  <i class="fa-solid fa-reply"></i>
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
                        onclick="markMessageRead(${m.id})"
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
                  onclick="deleteMessage(${m.id})"
                >
                  <i class="fa-solid fa-trash"></i>
                  Delete
                </button>

              </div>
            </td>
          `;

          msgTbody.appendChild(tr);
        });
      }
    }


    /* -----------------------------------------------------
       LOAD SHIPMENTS
    ----------------------------------------------------- */

    const resShipments = await fetch(
      '/api/admin/shipments',
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (
      resShipments.status === 401 ||
      resShipments.status === 403
    ) {
      handleAdminSessionExpired();
      return;
    }

    const shipments =
      await resShipments.json();

    const tbody =
      document.getElementById(
        'admin-shipments-tbody'
      );

    if (tbody) {

      tbody.innerHTML = '';

      if (
        !Array.isArray(shipments) ||
        shipments.length === 0
      ) {

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

        shipments.forEach((s) => {

          const tr =
            document.createElement('tr');

          tr.innerHTML = `
            <td>
              <strong
                style="color:var(--accent-gold);"
              >
                ${escapeAdminHtml(
                  s.tracking_number
                )}
              </strong>
            </td>

            <td>
              ${escapeAdminHtml(
                s.origin
              )}
              ➔
              ${escapeAdminHtml(
                s.destination
              )}
            </td>

            <td>
              ${escapeAdminHtml(
                s.current_location
              )}
            </td>

            <td>
              ${escapeAdminHtml(
                s.service_type ||
                'Express'
              )}
            </td>

            <td>
              <span class="badge badge-transit">
                ${escapeAdminHtml(
                  s.status
                )}
              </span>
            </td>

            <td>
              <button
                class="btn-gold"
                style="
                  padding:0.2rem 0.6rem;
                  font-size:0.75rem;
                "
                onclick="openUpdateShipmentModal(
                  ${s.id},
                  '${escapeJsString(s.status)}',
                  '${escapeJsString(s.current_location)}',
                  '${escapeJsString(
                    s.estimated_delivery || ''
                  )}'
                )"
              >
                <i class="fa-solid fa-pen"></i>
                Update Node
              </button>
            </td>
          `;

          tbody.appendChild(tr);
        });
      }
    }

  } catch (err) {

    console.error(
      'Error loading operations console:',
      err
    );

  }
}


/* =========================================================
   CREATE NEW SHIPMENT
========================================================= */

async function handleCreateShipmentSubmit(e) {
  e.preventDefault();

  const payload = {
    sender_name:
      document.getElementById(
        'cs-sender-name'
      ).value,

    sender_country:
      document.getElementById(
        'cs-sender-country'
      ).value,

    recipient_name:
      document.getElementById(
        'cs-recipient-name'
      ).value,

    recipient_country:
      document.getElementById(
        'cs-recipient-country'
      ).value,

    origin:
      document.getElementById(
        'cs-origin'
      ).value,

    destination:
      document.getElementById(
        'cs-destination'
      ).value,

    service_type:
      document.getElementById(
        'cs-service'
      ).value,

    estimated_delivery:
      document.getElementById(
        'cs-eta'
      ).value,

    package_count:
      document.getElementById(
        'cs-pkg-count'
      ).value,

    weight:
      document.getElementById(
        'cs-weight'
      ).value,

    currency:
      document.getElementById(
        'cs-currency'
      ).value,

    declared_value:
      document.getElementById(
        'cs-value'
      ).value,

    description:
      document.getElementById(
        'cs-desc'
      ).value
  };

  try {

    const res = await fetch(
      '/api/admin/shipments',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            `Bearer ${authToken}`
        },

        body: JSON.stringify(payload)
      }
    );

    const data =
      await res.json();

    if (res.ok) {

      alert(
        `Waybill Created Successfully!\n\nTracking Number: ${data.tracking_number}`
      );

      hideModal(
        'modal-create-shipment'
      );

      loadAdminDashboard();

    } else {

      alert(
        data.error ||
        'Failed to generate shipment'
      );
    }

  } catch (err) {

    console.error(
      'Create shipment error:',
      err
    );

    alert(
      'Failed to connect to backend server'
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

  document.getElementById(
    'us-shipment-id'
  ).value = id;

  document.getElementById(
    'us-location'
  ).value = currentLoc;

  document.getElementById(
    'us-eta'
  ).value = eta;

  const now = new Date();

  now.setMinutes(
    now.getMinutes() -
    now.getTimezoneOffset()
  );

  document.getElementById(
    'us-timestamp'
  ).value =
    now.toISOString().slice(0, 16);

  const selectEl =
    document.getElementById(
      'us-status-select'
    );

  const customEl =
    document.getElementById(
      'us-status-custom'
    );

  const standardStatuses = [
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

    customEl.style.display =
      'none';

  } else {

    selectEl.value =
      'CUSTOM';

    customEl.style.display =
      'block';

    customEl.value =
      currentStatus;
  }

  showModal(
    'modal-update-shipment'
  );
}


/* =========================================================
   CUSTOM STATUS
========================================================= */

function toggleCustomStatusInput(selectEl) {

  const customEl =
    document.getElementById(
      'us-status-custom'
    );

  customEl.style.display =
    selectEl.value === 'CUSTOM'
      ? 'block'
      : 'none';
}


/* =========================================================
   UPDATE SHIPMENT
========================================================= */

async function handleUpdateShipmentSubmit(e) {
  e.preventDefault();

  const id =
    document.getElementById(
      'us-shipment-id'
    ).value;

  const selectVal =
    document.getElementById(
      'us-status-select'
    ).value;

  const finalStatus =
    selectVal === 'CUSTOM'
      ? document.getElementById(
          'us-status-custom'
        ).value
      : selectVal;

  const payload = {

    status:
      finalStatus,

    current_location:
      document.getElementById(
        'us-location'
      ).value,

    event_time:
      document.getElementById(
        'us-timestamp'
      ).value,

    estimated_delivery:
      document.getElementById(
        'us-eta'
      ).value,

    event_description:
      document.getElementById(
        'us-description'
      ).value ||
      `Shipment status updated to ${finalStatus}`
  };

  try {

    const res = await fetch(
      `/api/admin/shipments/${id}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${authToken}`
        },

        body:
          JSON.stringify(payload)
      }
    );

    if (res.ok) {

      hideModal(
        'modal-update-shipment'
      );

      loadAdminDashboard();

    } else {

      const data =
        await res.json();

      alert(
        data.error ||
        'Failed to update shipment'
      );
    }

  } catch (err) {

    console.error(
      'Update shipment error:',
      err
    );

    alert(
      'Error connecting to server.'
    );
  }
}


/* =========================================================
   CUSTOMER MESSAGE REPLY
========================================================= */

/*
 * Open the reply composer.
 *
 * We fetch the current message from the admin API instead
 * of putting customer-controlled content directly into
 * an onclick attribute.
 */

async function openMessageReply(id) {

  if (!authToken) {
    return handleAdminSessionExpired();
  }

  try {

    const res =
      await fetch(
        '/api/admin/messages',
        {
          headers: {
            'Authorization':
              `Bearer ${authToken}`
          }
        }
      );

    if (
      res.status === 401 ||
      res.status === 403
    ) {
      return handleAdminSessionExpired();
    }

    if (!res.ok) {
      throw new Error(
        'Unable to load customer message.'
      );
    }

    const messages =
      await res.json();

    const customerMessage =
      messages.find(
        (m) => Number(m.id) === Number(id)
      );

    if (!customerMessage) {
      return alert(
        'Customer message could not be found.'
      );
    }

    createReplyModal();

    document.getElementById(
      'reply-message-id'
    ).value =
      customerMessage.id;

    document.getElementById(
      'reply-recipient-name'
    ).value =
      customerMessage.sender_name || '';

    document.getElementById(
      'reply-recipient-email'
    ).value =
      customerMessage.email || '';

    document.getElementById(
      'reply-subject'
    ).value =
      `Re: ${
        customerMessage.subject ||
        'US COURIER Support'
      }`;

    document.getElementById(
      'reply-body'
    ).value = '';

    document.getElementById(
      'reply-status'
    ).innerHTML = '';

    document.getElementById(
      'modal-message-reply'
    ).style.display = 'flex';

    setTimeout(() => {
      const textarea =
        document.getElementById(
          'reply-body'
        );

      if (textarea) {
        textarea.focus();
      }
    }, 100);

  } catch (err) {

    console.error(
      'Open reply error:',
      err
    );

    alert(
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
    document.createElement('div');

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
          <i class="fa-solid fa-xmark"></i>
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
        style="margin-bottom:1rem;"
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
        style="margin-bottom:1rem;"
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
          <i class="fa-solid fa-paper-plane"></i>
          Send Reply
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);


  /*
   * Close when clicking outside the modal card.
   */

  modal.addEventListener(
    'click',
    (event) => {

      if (event.target === modal) {
        closeMessageReply();
      }

    }
  );


  /*
   * Escape key closes the composer.
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
    textarea.value = '';
  }

  const status =
    document.getElementById(
      'reply-status'
    );

  if (status) {
    status.innerHTML = '';
  }
}


/* =========================================================
   ESCAPE KEY
========================================================= */

function handleReplyEscapeKey(event) {

  if (
    event.key === 'Escape'
  ) {

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
}


/* =========================================================
   SEND CUSTOMER REPLY
========================================================= */

async function sendMessageReply() {

  const messageId =
    document.getElementById(
      'reply-message-id'
    ).value;

  const message =
    document.getElementById(
      'reply-body'
    ).value.trim();

  const button =
    document.getElementById(
      'send-reply-button'
    );

  const status =
    document.getElementById(
      'reply-status'
    );


  if (!message) {

    status.innerHTML = `
      <span
        style="color:#ffb4a2;"
      >
        Please enter a reply message.
      </span>
    `;

    return;
  }


  if (!messageId) {

    status.innerHTML = `
      <span
        style="color:#ffb4a2;"
      >
        Customer message ID is missing.
      </span>
    `;

    return;
  }


  button.disabled = true;

  button.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin"></i>
    Sending...
  `;

  status.innerHTML = `
    <span
      style="color:var(--text-muted);"
    >
      Sending your reply through US COURIER email service...
    </span>
  `;


  try {

    const res =
      await fetch(
        `/api/admin/messages/${messageId}/reply`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${authToken}`
          },

          body:
            JSON.stringify({
              message
            })
        }
      );


    const data =
      await res.json();


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
        <i class="fa-solid fa-circle-check"></i>
        Reply sent successfully.
      </span>
    `;


    button.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      Sent
    `;


    /*
     * Refresh the dashboard after a short delay so
     * the message status changes to Read and the
     * unread KPI updates.
     */

    setTimeout(() => {

      closeMessageReply();

      loadAdminDashboard();

    }, 900);


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
        <i class="fa-solid fa-circle-exclamation"></i>
        ${
          escapeAdminHtml(
            err.message ||
            'Unable to send reply.'
          )
        }
      </span>
    `;

    button.disabled = false;

    button.innerHTML = `
      <i class="fa-solid fa-paper-plane"></i>
      Send Reply
    `;
  }
}


/* =========================================================
   MARK MESSAGE READ
========================================================= */

async function markMessageRead(id) {

  try {

    const res =
      await fetch(
        `/api/admin/messages/${id}/read`,
        {
          method: 'PUT',

          headers: {
            'Authorization':
              `Bearer ${authToken}`
          }
        }
      );

    if (
      res.status === 401 ||
      res.status === 403
    ) {
      return handleAdminSessionExpired();
    }

    if (!res.ok) {
      throw new Error(
        'Unable to update message.'
      );
    }

    loadAdminDashboard();

  } catch (err) {

    console.error(
      'Mark message read error:',
      err
    );

    alert(
      'Failed to update message.'
    );
  }
}


/* =========================================================
   DELETE MESSAGE
========================================================= */

async function deleteMessage(id) {

  if (
    !confirm(
      'Delete this message permanently?'
    )
  ) {
    return;
  }

  try {

    const res =
      await fetch(
        `/api/admin/messages/${id}`,
        {
          method: 'DELETE',

          headers: {
            'Authorization':
              `Bearer ${authToken}`
          }
        }
      );

    if (
      res.status === 401 ||
      res.status === 403
    ) {
      return handleAdminSessionExpired();
    }

    if (!res.ok) {
      throw new Error(
        'Unable to delete message.'
      );
    }

    loadAdminDashboard();

  } catch (err) {

    console.error(
      'Delete message error:',
      err
    );

    alert(
      'Failed to delete message.'
    );
  }
}


/* =========================================================
   SESSION EXPIRATION
========================================================= */

function handleAdminSessionExpired() {

  localStorage.removeItem(
    'us_courier_token'
  );

  authToken = null;

  alert(
    'Your admin session has expired. Please sign in again.'
  );

  showSection(
    'admin-login'
  );
}


/* =========================================================
   HTML SAFETY HELPERS
========================================================= */

function escapeAdminHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function escapeJsString(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}


function safeStatus(value) {

  return escapeAdminHtml(
    value || 'Unknown'
  );
}