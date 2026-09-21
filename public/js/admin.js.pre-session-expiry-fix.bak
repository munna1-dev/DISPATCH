/* =========================================================
   US COURIER
   ADMIN PORTAL JAVASCRIPT
========================================================= */


/* =========================================================
   CREATE PARCEL BUTTON
========================================================= */

function bindCreateParcelButton() {
  const button =
    document.getElementById(
      'open-create-shipment-btn'
    );

  if (!button) {
    return;
  }

  if (
    !adminActionAllowed(
      'shipments.create'
    )
  ) {
    button.hidden = true;
    return;
  }

  button.addEventListener(
    'click',
    function(event) {
      event.preventDefault();
      event.stopPropagation();

      if (
        !adminActionAllowed(
          'shipments.create'
        )
      ) {
        return;
      }

      showModal(
        'modal-create-shipment'
      );
    }
  );
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

    window.location.replace(
      '/admin-login.html'
    );
  }
}



/* =========================================================
   ADMIN MESSAGE COMMAND CENTER
========================================================= */

let adminMessageRecords = [];
let adminMessageView = 'all';

function getAdminMessageRecords() {
  return Array.isArray(adminMessageRecords)
    ? adminMessageRecords
    : [];
}

function isAdminMessageUnread(message) {
  return String(message?.status || '').trim().toLowerCase() === 'unread';
}

function updateAdminMessageSummary(records) {
  const list = Array.isArray(records) ? records : [];

  const unread =
    list.filter(isAdminMessageUnread).length;

  const totalEl =
    document.getElementById('admin-message-total-count');

  const unreadEl =
    document.getElementById('admin-message-unread-count');

  const unreadTabEl =
    document.getElementById('admin-message-unread-tab-count');

  const sidebarEl =
    document.getElementById('admin-sidebar-message-count');

  if (totalEl) {
    totalEl.textContent = String(list.length);
  }

  if (unreadEl) {
    unreadEl.textContent = String(unread);
  }

  if (unreadTabEl) {
    unreadTabEl.textContent = String(unread);
  }

  if (sidebarEl) {
    sidebarEl.textContent = String(unread);
    sidebarEl.hidden = unread === 0;
  }
}

function renderAdminMessageCenter() {
  const tbody =
    document.getElementById('admin-messages-tbody');

  if (!tbody) {
    return;
  }

  const searchEl =
    document.getElementById('admin-message-search');

  const statusEl =
    document.getElementById('admin-message-status-filter');

  const summaryEl =
    document.getElementById('admin-message-filter-summary');

  const query =
    String(searchEl?.value || '')
      .trim()
      .toLowerCase();

  const statusFilter =
    String(statusEl?.value || '')
      .trim()
      .toLowerCase();

  const records =
    getAdminMessageRecords().filter(message => {

      if (
        adminMessageView === 'unread' &&
        !isAdminMessageUnread(message)
      ) {
        return false;
      }

      if (
        adminMessageView === 'dispatch' &&
        !String(message?.subject || '')
          .toLowerCase()
          .includes('dispatch')
      ) {
        return false;
      }

      if (
        statusFilter &&
        String(message?.status || '')
          .trim()
          .toLowerCase() !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        message?.sender_name,
        message?.email,
        message?.subject,
        message?.message
      ]
        .map(value => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });

  updateAdminMessageSummary(
    getAdminMessageRecords()
  );

  if (summaryEl) {
    summaryEl.textContent =
      records.length === getAdminMessageRecords().length
        ? `Showing all ${records.length} messages`
        : `Showing ${records.length} of ${getAdminMessageRecords().length} messages`;
  }

  if (!records.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="admin-status-empty">
            No messages match the current view.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(message => {

    const unread =
      isAdminMessageUnread(message);

    const id =
      Number(message?.id);

    const sender =
      escapeAdminHtml(
        message?.sender_name ||
        'Customer'
      );

    const email =
      escapeAdminHtml(
        message?.email || ''
      );

    const subject =
      escapeAdminHtml(
        message?.subject ||
        'No Subject'
      );

    const body =
      escapeAdminHtml(
        message?.message || ''
      );

    const date =
      escapeAdminHtml(
        formatAdminDate(message?.created_at)
      );

    return `
      <tr class="${unread ? 'is-unread' : ''}">

        <td>
          <div class="admin-message-sender">
            ${unread ? `
              <span
                class="admin-message-unread-dot"
                aria-label="Unread"
                title="Unread"
              ></span>
            ` : ''}

            <div>
              <strong>${sender}</strong>
              ${
                email
                  ? `<div class="admin-message-email">${email}</div>`
                  : `<div class="admin-message-email is-empty">No email</div>`
              }
            </div>
          </div>
        </td>

        <td>
          <div class="admin-message-subject">
            ${subject}
          </div>
        </td>

        <td>
          <div
            class="admin-message-preview"
            title="${body}"
          >
            ${body || '<span class="is-empty">No message content</span>'}
          </div>
        </td>

        <td>
          <span class="admin-message-date">
            ${date}
          </span>
        </td>

        <td>
          <span class="badge ${
            unread
              ? 'badge-pending'
              : 'badge-delivered'
          }">
            ${safeStatus(message?.status || 'Unknown')}
          </span>
        </td>

        <td>
          <div class="admin-message-actions">

            ${
              adminActionAllowed('messages.reply')
                ? `
                  <button
                    type="button"
                    class="btn-gold"
                    data-message-action="reply"
                    data-message-id="${id}"
                    aria-label="Reply to ${sender}"
                  >
                    <span
                      class="icon icon-reply"
                      aria-hidden="true"
                    ></span>
                    Reply
                  </button>
                `
                : ''
            }

            ${
              unread && adminActionAllowed('messages.read')
                ? `
                  <button
                    type="button"
                    class="btn-outline"
                    data-message-action="read"
                    data-message-id="${id}"
                    aria-label="Mark ${sender} message as read"
                  >
                    Mark Read
                  </button>
                `
                : ''
            }

            ${
              adminActionAllowed('messages.delete')
                ? `
                  <button
                    type="button"
                    class="btn-outline admin-message-delete"
                    data-message-action="delete"
                    data-message-id="${id}"
                    aria-label="Delete message from ${sender}"
                  >
                    <span
                      class="icon icon-trash"
                      aria-hidden="true"
                    ></span>
                    Delete
                  </button>
                `
                : ''
            }

          </div>
        </td>

      </tr>
    `;
  }).join('');
}

function initAdminMessageCenter() {
  const searchEl =
    document.getElementById('admin-message-search');

  const clearEl =
    document.getElementById('admin-message-search-clear');

  const statusEl =
    document.getElementById('admin-message-status-filter');

  const refreshEl =
    document.getElementById('admin-message-refresh');

  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';

    searchEl.addEventListener('input', () => {
      if (clearEl) {
        clearEl.hidden =
          !String(searchEl.value || '').length;
      }

      renderAdminMessageCenter();
    });
  }

  if (clearEl && !clearEl.dataset.bound) {
    clearEl.dataset.bound = '1';

    clearEl.addEventListener('click', () => {
      if (searchEl) {
        searchEl.value = '';
      }

      clearEl.hidden = true;

      renderAdminMessageCenter();
      searchEl?.focus();
    });
  }

  if (statusEl && !statusEl.dataset.bound) {
    statusEl.dataset.bound = '1';

    statusEl.addEventListener(
      'change',
      renderAdminMessageCenter
    );
  }

  if (refreshEl && !refreshEl.dataset.bound) {
    refreshEl.dataset.bound = '1';

    refreshEl.addEventListener(
      'click',
      async () => {
        if (refreshEl.disabled) {
          return;
        }

        const originalHtml =
          refreshEl.innerHTML;

        refreshEl.disabled = true;
        refreshEl.setAttribute(
          'aria-busy',
          'true'
        );

        refreshEl.innerHTML = `
          <span
            class="icon icon-spinner icon-spin"
            aria-hidden="true"
          ></span>
          Refreshing...
        `;

        try {
          await loadAdminDashboard();
        } finally {
          refreshEl.disabled = false;
          refreshEl.removeAttribute(
            'aria-busy'
          );
          refreshEl.innerHTML = originalHtml;
        }
      }
    );
  }

  document
    .querySelectorAll('[data-message-view]')
    .forEach(tab => {

      if (tab.dataset.bound) {
        return;
      }

      tab.dataset.bound = '1';

      tab.addEventListener('click', () => {

        adminMessageView =
          tab.dataset.messageView || 'all';

        document
          .querySelectorAll('[data-message-view]')
          .forEach(item => {
            const active =
              item === tab;

            item.classList.toggle(
              'is-active',
              active
            );

            item.setAttribute(
              'aria-selected',
              active ? 'true' : 'false'
            );
          });

        renderAdminMessageCenter();
      });
    });

  const tbody =
    document.getElementById('admin-messages-tbody');

  if (tbody && !tbody.dataset.bound) {
    tbody.dataset.bound = '1';

    tbody.addEventListener('click', event => {

      const button =
        event.target.closest(
          '[data-message-action]'
        );

      if (!button) {
        return;
      }

      const id =
        Number(button.dataset.messageId);

      const action =
        button.dataset.messageAction;

      const message =
        getAdminMessageRecords().find(
          item => Number(item.id) === id
        );

      if (!message) {
        return;
      }

      if (button.disabled) {
        return;
      }

      if (action === 'read') {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');

        Promise.resolve(markMessageRead(id))
          .finally(() => {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          });

        return;
      }

      if (action === 'delete') {
        deleteMessage(message.id);
        return;
      }

      if (action === 'reply') {
        openMessageReply(message.id);
      }
    });
  }

  updateAdminMessageSummary(
    getAdminMessageRecords()
  );

  renderAdminMessageCenter();
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */


/* =========================================================
   ADMIN SHARED WORKSPACE DATA LOADERS
   Each workspace loads its own authenticated PostgreSQL data.
========================================================= */

async function loadAdminMessages() {

  if (
    typeof adminActionAllowed === "function" &&
    !adminActionAllowed("messages.view")
  ) {
    return [];
  }

  const response = await fetch(
    "/api/admin/messages",
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    handleAdminSessionExpired();
    return [];
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.error ||
      "Unable to load customer messages."
    );
  }

  const records =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload.messages)
        ? payload.messages
        : [];

  adminMessageRecords = records;

  renderAdminMessageCenter();

  return records;
}


async function loadAdminShipments() {

  if (
    typeof adminActionAllowed === "function" &&
    !adminActionAllowed("shipments.view")
  ) {
    return [];
  }

  const response = await fetch(
    "/api/admin/shipments",
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    handleAdminSessionExpired();
    return [];
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.error ||
      "Unable to load shipments."
    );
  }

  const shipments =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload.shipments)
        ? payload.shipments
        : [];

  window.__adminShipments = shipments;

  return shipments;
}


async function loadAdminSettingsWorkspace() {

  if (
    typeof loadAdminSettings === "function"
  ) {
    await loadAdminSettings();
  }
}


/* =========================================================
   ADMIN SHIPMENT WORKSPACE RENDERER
   Uses the shared authenticated shipment collection.
========================================================= */

  function renderAdminShipmentWorkspace() {

    const shipments =
      Array.isArray(window.__adminShipments)
        ? window.__adminShipments
        : [];

    const tbody =
      document.getElementById(
        'admin-shipments-tbody'
      );

    const searchInput =
      document.getElementById(
        'admin-shipment-search'
      );

    const searchClear =
      document.getElementById(
        'admin-shipment-search-clear'
      );

    const statusFilter =
      document.getElementById(
        'admin-shipment-status-filter'
      );

    const serviceFilter =
      document.getElementById(
        'admin-shipment-service-filter'
      );

    const filtersReset =
      document.getElementById(
        'admin-shipment-filters-reset'
      );

    const resultCount =
      document.getElementById(
        'admin-shipment-result-count'
      );

    const filterSummary =
      document.getElementById(
        'admin-shipment-filter-summary'
      );

    const normalizeShipmentValue =
      (value) =>
        String(value || '')
          .trim()
          .toLowerCase();

    const populateShipmentFilter =
      (select, values) => {
        if (!select) {
          return;
        }

        const currentValue =
          select.value;

        const uniqueValues =
          [...new Set(
            values
              .map(value => String(value || '').trim())
              .filter(Boolean)
          )].sort(
            (a, b) =>
              a.localeCompare(
                b,
                undefined,
                {
                  sensitivity: 'base'
                }
              )
          );

        select.innerHTML =
          '<option value="">All</option>';

        uniqueValues.forEach(
          value => {
            const option =
              document.createElement(
                'option'
              );

            option.value = value;
            option.textContent = value;

            select.appendChild(
              option
            );
          }
        );

        if (
          uniqueValues.includes(
            currentValue
          )
        ) {
          select.value =
            currentValue;
        }
      };

    populateShipmentFilter(
      statusFilter,
      shipments.map(
        shipment => shipment.status
      )
    );

    populateShipmentFilter(
      serviceFilter,
      shipments.map(
        shipment => shipment.service_type
      )
    );

    window.__adminShipmentFilterController = {
      getAll: () => [...shipments],
      getFiltered: () => filterShipments(),
      render: () => renderParcelWorkspace(),
      setStatus: value => {
        if (!statusFilter) {
          return false;
        }

        const target =
          String(value || '').trim();

        const matchingOption =
          Array.from(
            statusFilter.options
          ).find(
            option =>
              normalizeShipmentValue(
                option.value
              ) === normalizeShipmentValue(
                target
              )
          );

        if (!matchingOption && target) {
          return false;
        }

        statusFilter.value =
          matchingOption
            ? matchingOption.value
            : '';

        if (searchInput) {
          searchInput.value = '';
        }

        if (serviceFilter) {
          serviceFilter.value = '';
        }

        if (searchClear) {
          searchClear.hidden = true;
        }

        renderParcelWorkspace();

        return true;
      },
      clear: () => {
        if (searchInput) {
          searchInput.value = '';
        }

        if (statusFilter) {
          statusFilter.value = '';
        }

        if (serviceFilter) {
          serviceFilter.value = '';
        }

        if (searchClear) {
          searchClear.hidden = true;
        }

        renderParcelWorkspace();
      }
    };

    const filterShipments =
      () => {
        const searchTerm =
          normalizeShipmentValue(
            searchInput
              ? searchInput.value
              : ''
          );

        const selectedStatus =
          normalizeShipmentValue(
            statusFilter
              ? statusFilter.value
              : ''
          );

        const selectedService =
          normalizeShipmentValue(
            serviceFilter
              ? serviceFilter.value
              : ''
          );

        return shipments.filter(
          shipment => {
            const searchableText =
              [
                shipment.tracking_number,
                shipment.reference,
                shipment.recipient_name
              ]
                .map(
                  normalizeShipmentValue
                )
                .join(' ');

            const matchesSearch =
              !searchTerm ||
              searchableText.includes(
                searchTerm
              );

            const matchesStatus =
              !selectedStatus ||
              normalizeShipmentValue(
                shipment.status
              ) === selectedStatus;

            const matchesService =
              !selectedService ||
              normalizeShipmentValue(
                shipment.service_type
              ) === selectedService;

            return (
              matchesSearch &&
              matchesStatus &&
              matchesService
            );
          }
        );
      };

    const renderParcelWorkspace =
      () => {
        if (!tbody) {
          return;
        }

        const filteredShipments =
          filterShipments();

        tbody.innerHTML = '';

        if (
          filteredShipments.length === 0
        ) {
          tbody.innerHTML = `
            <tr>
              <td
                colspan="7"
                class="admin-parcel-empty"
              >
                No shipments match the current filters.
              </td>
            </tr>
          `;
        } else {
          filteredShipments.forEach(
            shipment => {
              const tr =
                document.createElement(
                  'tr'
                );

              const shipmentId =
                Number(
                  shipment.id
                );

              const status =
                String(
                  shipment.status ||
                  'Pending'
                );

              const service =
                String(
                  shipment.service_type ||
                  'Express'
                );

              const receiver =
                String(
                  shipment.recipient_name ||
                  '—'
                );

              const parcelType =
                String(
                  shipment.reference ||
                  'Courier Parcel'
                );

              const origin =
                String(
                  shipment.origin ||
                  '—'
                );

              const destination =
                String(
                  shipment.destination ||
                  '—'
                );

              const currentLocation =
                String(
                  shipment.current_location ||
                  '—'
                );

              tr.dataset.shipmentId =
                String(
                  shipmentId
                );

              tr.innerHTML = `
                <td>
                  <strong class="admin-parcel-tracking">
                    ${escapeAdminHtml(
                      shipment.tracking_number ||
                      '—'
                    )}
                  </strong>
                </td>

                <td>
                  <span class="admin-parcel-receiver">
                    ${escapeAdminHtml(
                      receiver
                    )}
                  </span>
                </td>

                <td>
                  <div class="admin-parcel-service">
                    <strong>
                      ${escapeAdminHtml(
                        service
                      )}
                    </strong>
                    <span>
                      ${escapeAdminHtml(
                        parcelType
                      )}
                    </span>
                  </div>
                </td>

                <td>
                  <span class="admin-parcel-route">
                    ${escapeAdminHtml(
                      origin
                    )}
                    <span aria-hidden="true">→</span>
                    ${escapeAdminHtml(
                      destination
                    )}
                  </span>
                </td>

                <td>
                  <span class="admin-parcel-location">
                    ${escapeAdminHtml(
                      currentLocation
                    )}
                  </span>
                </td>

                <td>
                  <span class="badge badge-transit">
                    ${safeStatus(
                      status
                    )}
                  </span>
                </td>

                <td>
                  <div class="admin-parcel-actions">

                    ${
                      adminActionAllowed(
                        'shipments.view'
                      )
                        ? `
                          <button
                            type="button"
                            class="btn-gold"
                            data-shipment-view-id="${shipmentId}"
                          >
                            View
                          </button>
                        `
                        : ''
                    }

                    ${
                      adminActionAllowed(
                        'shipments.update'
                      )
                        ? `
                          <button
                            type="button"
                            class="btn-outline"
                            data-shipment-update-id="${shipmentId}"
                          >
                            Update
                          </button>
                        `
                        : ''
                    }

                    ${
                      adminActionAllowed(
                        'shipments.delete'
                      )
                        ? `
                          <button
                            type="button"
                            class="btn-danger"
                            data-shipment-delete-id="${shipmentId}"
                          >
                            Delete
                          </button>
                        `
                        : ''
                    }

                  </div>
                </td>
              `;

              const viewButton =
                tr.querySelector(
                  '[data-shipment-view-id]'
                );

              const updateButton =
                tr.querySelector(
                  '[data-shipment-update-id]'
                );

              const deleteButton =
                tr.querySelector(
                  '[data-shipment-delete-id]'
                );

              if (viewButton) {
                viewButton.addEventListener(
                  'click',
                  () =>
                    openViewShipmentModal(
                      shipment
                    )
                );
              }

              if (updateButton) {
                updateButton.addEventListener(
                  'click',
                  () =>
                    openUpdateShipmentModal(
                      shipment
                    )
                );
              }

              if (deleteButton) {
                deleteButton.addEventListener(
                  'click',
                  () =>
                    deleteAdminShipment(
                      shipment
                    )
                );
              }

              tbody.appendChild(
                tr
              );
            }
          );
        }

        if (resultCount) {
          resultCount.textContent =
            String(
              filteredShipments.length
            );
        }

        if (filterSummary) {
          const currentSearchTerm =
            normalizeShipmentValue(
              searchInput
                ? searchInput.value
                : ''
            );

          const hasFilters =
            Boolean(
              currentSearchTerm ||
              selectedStatus ||
              selectedService
            );

          if (hasFilters) {
            filterSummary.textContent =
              `Showing ${filteredShipments.length} of ${shipments.length} shipments`;
          } else {
            filterSummary.textContent =
              `Showing all ${shipments.length} shipments`;
          }
        }

        if (searchClear) {
          const currentSearchTerm =
            normalizeShipmentValue(
              searchInput
                ? searchInput.value
                : ''
            );

          searchClear.hidden =
            !currentSearchTerm;
        }
      };

    if (searchInput) {
      searchInput.oninput =
        renderParcelWorkspace;
    }

    if (statusFilter) {
      statusFilter.onchange =
        renderParcelWorkspace;
    }

    if (serviceFilter) {
      serviceFilter.onchange =
        renderParcelWorkspace;
    }

    if (searchClear) {
      searchClear.onclick =
        () => {
          if (searchInput) {
            searchInput.value =
              '';
            searchInput.focus();
          }

          renderParcelWorkspace();
        };
    }

    if (filtersReset) {
      filtersReset.onclick =
        () => {
          if (searchInput) {
            searchInput.value =
              '';
          }

          if (statusFilter) {
            statusFilter.value =
              '';
          }

          if (serviceFilter) {
            serviceFilter.value =
              '';
          }

          renderParcelWorkspace();
        };
    }

    renderParcelWorkspace();
  }



async function refreshAdminShipmentWorkspace() {

  const dashboard =
    document.getElementById(
      'view-admin-dashboard'
    );

  const shipments =
    document.getElementById(
      'admin-shipments-workspace'
    );

  const tracking =
    document.getElementById(
      'admin-tracking-workspace'
    );

  const isVisible = function(element) {
    return (
      element &&
      element.style.display !== 'none'
    );
  };

  /*
   * Keep the currently selected workspace active.
   * Only refresh the data that belongs to it.
   */
  if (isVisible(shipments)) {

    const records =
      await loadAdminShipments();

    window.__adminShipments =
      Array.isArray(records)
        ? records
        : [];

    if (
      typeof renderAdminShipmentWorkspace ===
      'function'
    ) {
      renderAdminShipmentWorkspace();
    }

    return;
  }

  if (isVisible(tracking)) {

    const records =
      await loadAdminShipments();

    window.__adminShipments =
      Array.isArray(records)
        ? records
        : [];

    if (
      typeof initAdminTrackingCenter ===
      'function'
    ) {
      initAdminTrackingCenter();
    }

    return;
  }

  /*
   * If the operation was performed from the
   * Command Center, refresh the Command Center.
   */
  if (isVisible(dashboard)) {

    await loadAdminDashboard();
  }

}

async function loadAdminDashboard() {

  if (
    typeof adminActionAllowed === "function" &&
    !adminActionAllowed("dashboard.view")
  ) {
    console.warn(
      "[ADMIN RBAC] Dashboard access blocked."
    );
    return;
  }

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
    /* -----------------------------------------------------
       LOAD SHIPMENTS
       Use the shared authenticated shipment loader so
       Dashboard, Shipments and Live Tracking use the same
       PostgreSQL-backed data source.
    ----------------------------------------------------- */

    const shipments =
      await loadAdminShipments();

    window.__adminShipments =
      Array.isArray(shipments)
        ? shipments
        : [];

    /* -----------------------------------------------------
       RENDER COMMAND CENTER
       Uses the real dashboard counts returned by PostgreSQL.
    ----------------------------------------------------- */

    if (typeof renderAdminCommandCenter === 'function') {
      renderAdminCommandCenter(
        shipments,
        counts
      );
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
   ADMIN OPERATIONS TRACKING CENTER
========================================================= */

let adminTrackingEvents = [];
let adminTrackingShipment = null;

function initAdminTrackingCenter() {

  const select =
    document.getElementById(
      'admin-tracking-shipment-select'
    );

  const refresh =
    document.getElementById(
      'admin-tracking-refresh'
    );

  if (!select) {
    return;
  }

  const shipments =
    Array.isArray(window.__adminShipments)
      ? window.__adminShipments
      : [];

  select.innerHTML =
    '<option value="">Select shipment...</option>';

  shipments.forEach(shipment => {

    if (!shipment || !shipment.id) {
      return;
    }

    const option =
      document.createElement('option');

    option.value =
      String(shipment.id);

    option.textContent =
      `${shipment.tracking_number || 'Unknown'} · ` +
      `${shipment.recipient_name || 'Receiver unavailable'}`;

    select.appendChild(option);
  });

  select.onchange = () => {

    const shipment =
      shipments.find(item =>
        String(item.id) ===
        String(select.value)
      );

    if (!shipment) {
      resetAdminTrackingCenter();
      return;
    }

    loadAdminTrackingCenter(
      shipment
    );
  };

  if (refresh) {

    refresh.onclick = () => {

      if (adminTrackingShipment) {
        loadAdminTrackingCenter(
          adminTrackingShipment
        );
      } else {
        initAdminTrackingCenter();
      }
    };
  }
}


function resetAdminTrackingCenter() {

  adminTrackingShipment = null;
  adminTrackingEvents = [];

  const content =
    document.getElementById(
      'admin-tracking-content'
    );

  const empty =
    document.getElementById(
      'admin-tracking-empty'
    );

  const loading =
    document.getElementById(
      'admin-tracking-loading'
    );

  const error =
    document.getElementById(
      'admin-tracking-error'
    );

  if (content) content.hidden = true;
  if (loading) loading.hidden = true;
  if (error) error.hidden = true;
  if (empty) empty.hidden = false;
}


async function loadAdminTrackingCenter(
  shipment
) {

  if (!shipment || !shipment.id) {
    resetAdminTrackingCenter();
    return;
  }

  adminTrackingShipment =
    shipment;

  const content =
    document.getElementById(
      'admin-tracking-content'
    );

  const empty =
    document.getElementById(
      'admin-tracking-empty'
    );

  const loading =
    document.getElementById(
      'admin-tracking-loading'
    );

  const error =
    document.getElementById(
      'admin-tracking-error'
    );

  const errorText =
    document.getElementById(
      'admin-tracking-error-text'
    );

  if (empty) empty.hidden = true;
  if (content) content.hidden = true;
  if (error) error.hidden = true;
  if (loading) loading.hidden = false;

  try {

    const response =
      await fetch(
        '/api/admin/shipments/' +
        encodeURIComponent(shipment.id) +
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

    if (
      !response.ok ||
      data.success !== true
    ) {
      throw new Error(
        data.error ||
        'Failed to load tracking data.'
      );
    }

    adminTrackingEvents =
      Array.isArray(data.events)
        ? data.events
        : [];

    renderAdminTrackingCenter(
      shipment,
      adminTrackingEvents
    );

    if (loading) loading.hidden = true;
    if (content) content.hidden = false;

  } catch (err) {

    console.error(
      '[ADMIN TRACKING CENTER]',
      err
    );

    if (loading) loading.hidden = true;

    if (error) {
      error.hidden = false;
    }

    if (errorText) {
      errorText.textContent =
        err.message ||
        'Please try again.';
    }
  }
}


function renderAdminTrackingCenter(
  shipment,
  events
) {

  const setText =
    (id, value) => {

      const el =
        document.getElementById(id);

      if (el) {
        el.textContent =
          value || '—';
      }
    };

  setText(
    'admin-tracking-number',
    shipment.tracking_number
  );

  setText(
    'admin-tracking-status',
    shipment.status
  );

  setText(
    'admin-tracking-current',
    shipment.current_location ||
    shipment.location
  );

  setText(
    'admin-tracking-event-count',
    String(events.length)
  );

  const gpsCount =
    events.filter(event =>
      event &&
      Number.isFinite(Number(event.latitude)) &&
      Number.isFinite(Number(event.longitude))
    ).length;

  setText(
    'admin-tracking-gps-count',
    String(gpsCount)
  );

  const latestEvent =
    [...events].sort(
      (a, b) =>
        new Date(
          b.event_time ||
          b.created_at ||
          0
        ) -
        new Date(
          a.event_time ||
          a.created_at ||
          0
        )
    )[0];

  setText(
    'admin-tracking-last-update',
    latestEvent
      ? formatAdminTrackingDate(
          latestEvent.event_time ||
          latestEvent.created_at
        )
      : 'No events'
  );

  setText(
    'admin-tracking-origin',
    shipment.origin
  );

  setText(
    'admin-tracking-destination',
    shipment.destination
  );

  renderAdminTrackingHistory(
    events
  );

  drawAdminTrackingMap(
    shipment,
    events
  );
}


function renderAdminTrackingHistory(
  events
) {

  const container =
    document.getElementById(
      'admin-tracking-history'
    );

  if (!container) {
    return;
  }

  if (!events.length) {

    container.innerHTML =
      '<div class="admin-tracking-state">' +
      '<strong>No tracking events</strong>' +
      '<span>No tracking history is available for this shipment.</span>' +
      '</div>';

    return;
  }

  const ordered =
    [...events].sort(
      (a, b) =>
        new Date(
          a.event_time ||
          a.created_at ||
          0
        ) -
        new Date(
          b.event_time ||
          b.created_at ||
          0
        )
    );

  const latestId =
    ordered.length
      ? ordered[ordered.length - 1].id
      : null;

  container.innerHTML =
    ordered.map(event => {

      const date =
        event.event_time ||
        event.created_at;

      const hasGps =
        Number.isFinite(
          Number(event.latitude)
        ) &&
        Number.isFinite(
          Number(event.longitude)
        );

      return `
        <article
          class="admin-tracking-history-item ${
            event.id === latestId
              ? 'is-current'
              : ''
          }"
        >

          <span
            class="admin-tracking-history-dot"
            aria-hidden="true"
          ></span>

          <div class="admin-tracking-history-content">

            <div class="admin-tracking-history-top">

              <strong>
                ${escapeAdminHtml(
                  event.status || 'Update'
                )}
              </strong>

              <time>
                ${escapeAdminHtml(
                  formatAdminTrackingDate(date)
                )}
              </time>

            </div>

            <div class="admin-tracking-history-location">

              ${escapeAdminHtml(
                event.location ||
                'Location not recorded'
              )}

              ${
                hasGps
                  ? ' · GPS verified'
                  : ''
              }

            </div>

            ${
              event.description
                ? `
                  <p>
                    ${escapeAdminHtml(
                      event.description
                    )}
                  </p>
                `
                : ''
            }

          </div>

        </article>
      `;
    }).join('');
}


function drawAdminTrackingMap(
  shipment,
  events
) {

  const canvas =
    document.getElementById(
      'adminTrackingMapCanvas'
    );

  const empty =
    document.getElementById(
      'admin-tracking-map-empty'
    );

  const gpsState =
    document.getElementById(
      'admin-tracking-gps-state'
    );

  if (!canvas) {
    return;
  }

  const container =
    canvas.parentElement;

  if (!container) {
    return;
  }

  const gpsEvents =
    events.filter(event =>
      event &&
      Number.isFinite(
        Number(event.latitude)
      ) &&
      Number.isFinite(
        Number(event.longitude)
      )
    );

  if (!gpsEvents.length) {

    if (empty) empty.hidden = false;

    if (gpsState) {
      gpsState.textContent =
        'GPS unavailable';
    }

    const ctx =
      canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    return;
  }

  if (empty) empty.hidden = true;

  if (gpsState) {
    gpsState.textContent =
      `${gpsEvents.length} GPS point${
        gpsEvents.length === 1
          ? ''
          : 's'
      } · Verified`;
  }

  const width =
    Math.max(
      320,
      container.clientWidth || 700
    );

  const height =
    Math.max(
      280,
      container.clientHeight || 380
    );

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  canvas.style.width =
    `${width}px`;

  canvas.style.height =
    `${height}px`;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  const points =
    gpsEvents.map(event => ({
      lat: Number(event.latitude),
      lon: Number(event.longitude),
      event
    }));

  const lats =
    points.map(point => point.lat);

  const lons =
    points.map(point => point.lon);

  const minLat =
    Math.min(...lats);

  const maxLat =
    Math.max(...lats);

  const minLon =
    Math.min(...lons);

  const maxLon =
    Math.max(...lons);

  const latRange =
    Math.max(
      0.01,
      maxLat - minLat
    );

  const lonRange =
    Math.max(
      0.01,
      maxLon - minLon
    );

  const latPad =
    Math.max(
      0.01,
      latRange * 0.18
    );

  const lonPad =
    Math.max(
      0.01,
      lonRange * 0.18
    );

  const bounds = {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad
  };

  const project =
    (lat, lon) => {

      const x =
        ((lon - bounds.minLon) /
          (bounds.maxLon - bounds.minLon)) *
        (width - 60) +
        30;

      const y =
        ((bounds.maxLat - lat) /
          (bounds.maxLat - bounds.minLat)) *
        (height - 60) +
        30;

      return {
        x,
        y
      };
    };

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      0,
      height
    );

  gradient.addColorStop(
    0,
    '#101820'
  );

  gradient.addColorStop(
    1,
    '#080d13'
  );

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.strokeStyle =
    'rgba(255,255,255,0.055)';

  ctx.lineWidth = 1;

  const gridStep = 45;

  for (
    let x = 0;
    x <= width;
    x += gridStep
  ) {

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (
    let y = 0;
    y <= height;
    y += gridStep
  ) {

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const projected =
    points.map(point =>
      project(
        point.lat,
        point.lon
      )
    );

  if (projected.length > 1) {

    ctx.beginPath();

    projected.forEach(
      (point, index) => {

        if (index === 0) {
          ctx.moveTo(
            point.x,
            point.y
          );
        } else {
          ctx.lineTo(
            point.x,
            point.y
          );
        }
      }
    );

    ctx.strokeStyle =
      '#d4af37';

    ctx.lineWidth = 2.5;

    ctx.stroke();
  }

  projected.forEach(
    (point, index) => {

      const current =
        index === projected.length - 1;

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        current ? 7 : 4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        current
          ? '#d4af37'
          : '#a9b1bb';

      ctx.fill();

      if (current) {

        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          13,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle =
          'rgba(212,175,55,0.28)';

        ctx.lineWidth = 2;

        ctx.stroke();
      }
    }
  );

  const first =
    projected[0];

  const last =
    projected[
      projected.length - 1
    ];

  if (first) {

    ctx.font =
      '600 11px sans-serif';

    ctx.fillStyle =
      '#d8dde4';

    ctx.fillText(
      'START',
      first.x + 10,
      first.y - 10
    );
  }

  if (last) {

    ctx.font =
      '600 11px sans-serif';

    ctx.fillStyle =
      '#d4af37';

    ctx.fillText(
      'CURRENT',
      last.x + 10,
      last.y - 10
    );
  }
}


function activateAdminTrackingWorkspace() {

  initAdminTrackingCenter();

  const workspace =
    document.getElementById(
      'admin-tracking-workspace'
    );

  if (workspace) {
    workspace.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
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
          ${
            adminActionAllowed('tracking.update')
              ? `
                <button
                  type="button"
                  class="btn-outline"
                  data-edit-event-id="${event.id}"
                >
                  <i class="icon icon-edit"></i>
                  Edit
                </button>
              `
              : ''
          }
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

  if (!adminActionAllowed('tracking.update')) {
    return;
  }

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

  if (!adminActionAllowed('tracking.update')) {
    return;
  }

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
     * Refresh only the active admin workspace.
     * The tracking event itself was already refreshed
     * through loadAdminShipmentEvents().
     */
    await refreshAdminShipmentWorkspace();

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


      await refreshAdminShipmentWorkspace();

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
       REFRESH ACTIVE ADMIN WORKSPACE
    ----------------------------------------------------- */

    await refreshAdminShipmentWorkspace();


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
   VIEW SHIPMENT / PARCEL DETAILS
========================================================= */

function openViewShipmentModal(shipment) {

  if (
    !adminActionAllowed(
      'shipments.view'
    )
  ) {
    return;
  }

  if (!shipment || !shipment.id) {

    console.error(
      'Invalid shipment supplied to view form.'
    );

    alert(
      'Unable to open parcel details.'
    );

    return;
  }


  const modal =
    document.getElementById(
      'modal-view-shipment'
    );


  if (!modal) {

    console.error(
      'modal-view-shipment is missing.'
    );

    alert(
      'Parcel details modal is missing.'
    );

    return;
  }


  const get =
    (id) =>
      document.getElementById(id);


  const setValue = (
    id,
    value
  ) => {

    const el =
      get(id);

    if (!el) {
      return;
    }

    el.textContent =
      value === null ||
      value === undefined ||
      value === ''
        ? '—'
        : String(value);
  };


  setValue(
    'vs-tracking-number',
    shipment.tracking_number
  );

  setValue(
    'vs-reference',
    shipment.reference
  );

  setValue(
    'vs-status',
    shipment.status
  );

  setValue(
    'vs-origin',
    shipment.origin
  );

  setValue(
    'vs-destination',
    shipment.destination
  );

  setValue(
    'vs-current-location',
    shipment.current_location
  );

  setValue(
    'vs-service-type',
    shipment.service_type
  );

  setValue(
    'vs-priority',
    shipment.priority
  );

  setValue(
    'vs-sender-name',
    shipment.sender_name
  );

  setValue(
    'vs-sender-country',
    shipment.sender_country
  );

  setValue(
    'vs-recipient-name',
    shipment.recipient_name
  );

  setValue(
    'vs-recipient-country',
    shipment.recipient_country
  );

  setValue(
    'vs-package-count',
    shipment.package_count
  );

  setValue(
    'vs-weight',
    shipment.weight
  );

  setValue(
    'vs-currency',
    shipment.currency
  );

  setValue(
    'vs-declared-value',
    shipment.declared_value
  );

  setValue(
    'vs-eta',
    shipment.estimated_delivery
      ? String(
          shipment.estimated_delivery
        ).slice(
          0,
          10
        )
      : ''
  );

  setValue(
    'vs-created-at',
    shipment.created_at
      ? formatAdminTrackingDate(
          shipment.created_at
        )
      : 'Not available'
  );

  setValue(
    'vs-updated-at',
    shipment.updated_at
      ? formatAdminTrackingDate(
          shipment.updated_at
        )
      : 'Not available'
  );

  setValue(
    'vs-description',
    shipment.description
  );


  const statusEl =
    get('vs-status');

  if (statusEl) {

    statusEl.className =
      'admin-detail-status ' +
      (
        String(
          shipment.status ||
          ''
        ).toLowerCase().includes(
          'delivered'
        )
          ? 'is-delivered'
          : String(
              shipment.status ||
              ''
            ).toLowerCase().includes(
              'delay'
            )
              ? 'is-warning'
              : 'is-active'
      );
  }


  const historyEl =
    get('vs-tracking-history');

  const loadingEl =
    get('vs-tracking-loading');

  const emptyEl =
    get('vs-tracking-empty');

  const errorEl =
    get('vs-tracking-error');

  const countEl =
    get('vs-event-count');


  if (historyEl) {
    historyEl.innerHTML = '';
  }

  if (loadingEl) {
    loadingEl.hidden = false;
  }

  if (emptyEl) {
    emptyEl.hidden = true;
  }

  if (errorEl) {
    errorEl.hidden = true;
  }

  if (countEl) {
    countEl.textContent =
      'Loading...';
  }


  const updateButton =
    get('vs-update-button');

  if (updateButton) {

    updateButton.onclick =
      () => {

        hideModal(
          'modal-view-shipment'
        );

        openUpdateShipmentModal(
          shipment
        );
      };
  }


  const deleteButton =
    get('vs-delete-button');

  if (deleteButton) {

    deleteButton.onclick =
      () => {

        deleteAdminShipment(
          shipment
        );
      };
  }


  showModal(
    'modal-view-shipment'
  );


  loadShipmentTrackingHistory(
    shipment.id
  );
}


/* =========================================================
   VIEW SHIPMENT TRACKING HISTORY
========================================================= */

async function loadShipmentTrackingHistory(
  shipmentId
) {

  const historyEl =
    document.getElementById(
      'vs-tracking-history'
    );

  const loadingEl =
    document.getElementById(
      'vs-tracking-loading'
    );

  const emptyEl =
    document.getElementById(
      'vs-tracking-empty'
    );

  const errorEl =
    document.getElementById(
      'vs-tracking-error'
    );

  const countEl =
    document.getElementById(
      'vs-event-count'
    );


  if (!historyEl) {
    return;
  }


  if (loadingEl) {
    loadingEl.hidden = false;
  }

  if (emptyEl) {
    emptyEl.hidden = true;
  }

  if (errorEl) {
    errorEl.hidden = true;
  }


  try {

    const response =
      await fetch(
        `/api/admin/shipments/${encodeURIComponent(
          shipmentId
        )}/events`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept:
              'application/json'
          }
        }
      );


    const data =
      await response.json()
        .catch(
          () => ({})
        );


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        'Failed to load tracking history.'
      );
    }


    const events =
      Array.isArray(
        data.events
      )
        ? data.events
        : [];


    historyEl.innerHTML = '';


    if (countEl) {

      countEl.textContent =
        `${events.length} ${
          events.length === 1
            ? 'event'
            : 'events'
        }`;
    }


    if (!events.length) {

      if (emptyEl) {
        emptyEl.hidden = false;
      }

      return;
    }


    events.forEach(
      (
        event,
        index
      ) => {

        const item =
          document.createElement(
            'article'
          );

        item.className =
          'admin-tracking-event';


        const status =
          event.status ||
          'Status Update';


        const location =
          event.location ||
          'Location unavailable';


        const description =
          event.description ||
          'Shipment status updated.';


        const eventDate =
          formatAdminTrackingDate(
            event.event_time ||
            event.created_at
          );


        item.innerHTML = `

          <div
            class="admin-tracking-event-marker"
            aria-hidden="true"
          ></div>

          <div class="admin-tracking-event-content">

            <div class="admin-tracking-event-top">

              <strong>
                ${escapeAdminHtml(
                  status
                )}
              </strong>

              <time>
                ${escapeAdminHtml(
                  eventDate
                )}
              </time>

            </div>

            <div class="admin-tracking-event-location">

              <span
                class="icon icon-location"
                aria-hidden="true"
              ></span>

              ${escapeAdminHtml(
                location
              )}

            </div>

            <p>
              ${escapeAdminHtml(
                description
              )}
            </p>

          </div>
        `;


        historyEl.appendChild(
          item
        );
      }
    );


  } catch (error) {

    console.error(
      '[VIEW PARCEL TRACKING]',
      error
    );


    historyEl.innerHTML = '';


    if (countEl) {
      countEl.textContent =
        'Unavailable';
    }


    if (errorEl) {
      errorEl.hidden = false;
    }


  } finally {

    if (loadingEl) {
      loadingEl.hidden = true;
    }
  }
}


/* =========================================================
   TRACKING DATE FORMATTER
========================================================= */

function formatAdminTrackingDate(
  value
) {

  if (!value) {
    return 'Date unavailable';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );
  }


  return date.toLocaleString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}


/* =========================================================
   DELETE PARCEL
========================================================= */

async function deleteAdminShipment(
  shipment
) {

  if (
    !adminActionAllowed(
      'shipments.delete'
    )
  ) {
    return;
  }

  if (
    !shipment ||
    !shipment.id
  ) {

    alert(
      'Unable to delete this parcel.'
    );

    return;
  }


  const trackingNumber =
    String(
      shipment.tracking_number ||
      'Unknown tracking number'
    );


  const confirmed =
    window.confirm(
      `Delete parcel ${trackingNumber}?\n\n` +
      `This action cannot be undone. ` +
      `The shipment record will be permanently removed.`
    );


  if (!confirmed) {
    return;
  }


  const deleteButton =
    document.getElementById(
      'vs-delete-button'
    );


  if (deleteButton) {

    deleteButton.disabled =
      true;

    deleteButton.textContent =
      'Deleting...';
  }


  try {

    const response =
      await fetch(
        `/api/admin/shipments/${encodeURIComponent(
          shipment.id
        )}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            Accept:
              'application/json'
          }
        }
      );


    const data =
      await response.json()
        .catch(
          () => ({})
        );


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        'Failed to delete parcel.'
      );
    }


    hideModal(
      'modal-view-shipment'
    );


    alert(
      `Parcel ${trackingNumber} was deleted successfully.`
    );


    await refreshAdminShipmentWorkspace();


  } catch (error) {

    console.error(
      '[DELETE PARCEL]',
      error
    );


    alert(
      error.message ||
      'Failed to delete parcel.'
    );


  } finally {

    if (deleteButton) {

      deleteButton.disabled =
        false;

      deleteButton.textContent =
        'Delete Parcel';
    }
  }
}


/* =========================================================
   UPDATE SHIPMENT MODAL
========================================================= */

function openUpdateShipmentModal(shipment) {

  if (
    !adminActionAllowed(
      'shipments.update'
    )
  ) {
    return;
  }

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

    await refreshAdminShipmentWorkspace();

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
  if (!adminActionAllowed('messages.reply')) {
    return;
  }


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
  if (!adminActionAllowed('messages.reply')) {
    return;
  }


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

        await loadAdminMessages();

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
  if (!adminActionAllowed('messages.read')) {
    return;
  }


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


    await loadAdminMessages();

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
  if (!adminActionAllowed('messages.delete')) {
    return;
  }


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


    await loadAdminMessages();

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
   FRONTEND RBAC FOUNDATION
   UX visibility only.
   Backend permissions remain the security boundary.
========================================================= */

const ADMIN_FRONTEND_PERMISSIONS = Object.freeze({

  "Admin": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "shipments.delete",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "messages.delete",
    "staff.view",
    "staff.create",
    "staff.update",
    "staff.role",
    "staff.password",
    "settings.view",
    "settings.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Operations Manager": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "shipments.delete",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "messages.delete",
    "staff.view",
    "staff.create",
    "staff.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Dispatcher": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Driver": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Trunk Driver": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Cargo Personnel": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Warehouse Personnel": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Customer Service": new Set([
    "dashboard.view",
    "shipments.view",
    "messages.view",
    "messages.reply",
    "messages.read",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Customer": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "profile.view",
    "profile.update",
    "profile.password"
  ])

});

let adminCurrentUser = null;
let adminCurrentRole = "";

function setAdminCurrentUser(user) {

  adminCurrentUser =
    user && typeof user === "object"
      ? user
      : null;

  adminCurrentRole =
    String(
      adminCurrentUser?.role || ""
    ).trim();

  window.__adminCurrentUser =
    adminCurrentUser;

  window.__adminCurrentRole =
    adminCurrentRole;

  return adminCurrentUser;
}

function getAdminCurrentRole() {
  return adminCurrentRole;
}

function hasAdminFrontendPermission(permission) {

  const permissions =
    ADMIN_FRONTEND_PERMISSIONS[
      getAdminCurrentRole()
    ];

  return Boolean(
    permissions &&
    permissions.has(permission)
  );
}

function adminFrontendCanAny(...permissions) {

  return permissions.some(
    permission =>
      hasAdminFrontendPermission(permission)
  );

}

async function loadAdminCurrentUser() {

  try {

    const response =
      await fetch(
        "/api/admin/profile",
        {
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {

      setAdminCurrentUser(null);

      return null;
    }

    if (!response.ok) {

      throw new Error(
        "Unable to load administrator profile."
      );

    }

    const payload =
      await response.json();

    const user =
      payload?.user ||
      payload?.profile ||
      payload;

    return setAdminCurrentUser(user);

  } catch (error) {

    console.error(
      "[ADMIN RBAC PROFILE]",
      error
    );

    setAdminCurrentUser(null);

    return null;
  }

}

function adminActionAllowed(permission) {
  return hasAdminFrontendPermission(permission);
}

function adminRequireFrontendPermission(
  permission
) {

  if (
    hasAdminFrontendPermission(permission)
  ) {

    return true;

  }

  console.warn(
    "[ADMIN RBAC] Frontend action blocked:",
    permission
  );

  return false;
}


function applyAdminSidebarPermissions() {

  const permissionByNav = {
    dashboard: "dashboard.view",
    shipments: "shipments.view",
    tracking: "tracking.view",
    messages: "messages.view",
    staff: "staff.view",
    settings: "settings.view"
  };

  document
    .querySelectorAll("[data-admin-nav]")
    .forEach(function(item) {

      const nav =
        item.dataset.adminNav || "";

      const permission =
        permissionByNav[nav];

      if (!permission) {
        return;
      }

      const allowed =
        hasAdminFrontendPermission(
          permission
        );

      item.hidden = !allowed;
      item.setAttribute(
        "aria-hidden",
        allowed ? "false" : "true"
      );

    });

  /*
   * Keep the sidebar structurally clean.
   * Empty navigation groups are hidden when
   * none of their child items are available.
   */
  document
    .querySelectorAll(
      ".admin-sidebar-nav-section"
    )
    .forEach(function(section) {

      const visibleItems =
        Array.from(
          section.querySelectorAll(
            "[data-admin-nav]"
          )
        ).some(function(item) {
          return !item.hidden;
        });

      section.hidden = !visibleItems;

    });

}

function adminGetFirstAllowedNav() {

  const navigationOrder = [
    "dashboard",
    "shipments",
    "tracking",
    "messages",
    "staff",
    "settings"
  ];

  return navigationOrder.find(
    function(nav) {

      const permissionByNav = {
        dashboard: "dashboard.view",
        shipments: "shipments.view",
        tracking: "tracking.view",
        messages: "messages.view",
        staff: "staff.view",
        settings: "settings.view"
      };

      return hasAdminFrontendPermission(
        permissionByNav[nav]
      );

    }
  ) || null;

}


async function bootstrapAdminRBAC() {

  const user =
    await loadAdminCurrentUser();

  if (!user) {

    console.warn(
      "[ADMIN RBAC] No authenticated admin profile available."
    );

    return null;
  }

  applyAdminSidebarPermissions();

  /*
   * Keep the currently selected navigation item
   * only when that item is allowed for the role.
   */
  const activeNav =
    document.querySelector(
      '[data-admin-nav].active'
    );

  const activeName =
    activeNav?.dataset?.adminNav || "";

  const permissionByNav = {
    dashboard: "dashboard.view",
    shipments: "shipments.view",
    tracking: "tracking.view",
    messages: "messages.view",
    staff: "staff.view",
    settings: "settings.view"
  };

  const activeAllowed =
    Boolean(
      activeName &&
      permissionByNav[activeName] &&
      hasAdminFrontendPermission(
        permissionByNav[activeName]
      )
    );

  if (!activeAllowed) {

    const fallback =
      adminGetFirstAllowedNav();

    if (fallback) {

      document
        .querySelectorAll(
          "[data-admin-nav]"
        )
        .forEach(function(item) {

          item.classList.toggle(
            "active",
            item.dataset.adminNav === fallback
          );

        });

    }

  }

  /*
   * Expose a small read-only-style snapshot for
   * existing admin UI code and diagnostics.
   */
  window.__adminRBAC = Object.freeze({
    role: getAdminCurrentRole(),
    userId: user?.id || null,
    email: user?.email || "",
    can: function(permission) {
      return hasAdminFrontendPermission(
        permission
      );
    }
  });

  return user;
}

function isAdminPortalVisible() {

  const portal =
    document.querySelector(
      ".admin-portal-shell"
    );

  if (!portal) {
    return false;
  }

  return (
    portal.offsetParent !== null
  );

}

function scheduleAdminRBACBootstrap() {

  if (
    window.__adminRBACBootstrapPromise
  ) {
    return window.__adminRBACBootstrapPromise;
  }

  window.__adminRBACBootstrapStarted =
    true;

  window.__adminRBACBootstrapPromise =
    bootstrapAdminRBAC()
      .catch(function(error) {

        console.error(
          "[ADMIN RBAC BOOTSTRAP]",
          error
        );

        setAdminCurrentUser(null);

        return null;

      });

  return window.__adminRBACBootstrapPromise;

}


/* =========================================================
   ADMIN SETTINGS
========================================================= */

function openAdminSettings() {
  if (!adminActionAllowed('settings.view')) {
    return;
  }

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
  if (!adminActionAllowed('settings.view')) {
    return;
  }

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

  if (!adminActionAllowed('settings.update')) {
    return;
  }

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

function escapeHtml(
  value
) {
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
    .replace(/'/g, '&#39;');
}


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
   ADMIN COMMAND CENTER
   ========================================================= */

function getAdminShipmentStatus(shipment) {
    return String(
        shipment?.status ||
        shipment?.shipment_status ||
        shipment?.current_status ||
        ''
    ).trim();
}

function getAdminShipmentDate(shipment) {
    return (
        shipment?.created_at ||
        shipment?.updated_at ||
        shipment?.createdAt ||
        shipment?.updatedAt ||
        shipment?.estimated_delivery ||
        ''
    );
}

function formatAdminDashboardDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function normalizeAdminStatus(status) {
    return String(status || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isAdminDelivered(status) {
    const value = normalizeAdminStatus(status);
    return value === 'delivered' || value === 'complete' || value === 'completed';
}

function isAdminTransit(status) {
    const value = normalizeAdminStatus(status);
    return [
        'in transit',
        'out for delivery',
        'dispatched',
        'shipped',
        'moving',
        'on the way'
    ].includes(value);
}

function isAdminPending(status) {
    const value = normalizeAdminStatus(status);
    return [
        'pending',
        'processing',
        'created',
        'awaiting pickup',
        'awaiting collection',
        'ready for pickup'
    ].includes(value);
}

function isAdminException(status) {
    const value = normalizeAdminStatus(status);
    return [
        'exception',
        'failed',
        'cancelled',
        'canceled',
        'returned',
        'held',
        'delayed',
        'lost'
    ].some(term => value === term || value.includes(term));
}

function setAdminKpi(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString();
}

function renderAdminCommandCenter(shipments, dashboardCounts = {}) {
    const shipmentList = Array.isArray(shipments) ? shipments : [];

    const total = Number(
        dashboardCounts.total ??
        dashboardCounts.total_shipments ??
        shipmentList.length ??
        0
    );

    const delivered = Number(
        dashboardCounts.delivered ??
        shipmentList.filter(
            s => isAdminDelivered(getAdminShipmentStatus(s))
        ).length ??
        0
    );

    const transit = Number(
        dashboardCounts.in_transit ??
        dashboardCounts.inTransit ??
        shipmentList.filter(
            s => isAdminTransit(getAdminShipmentStatus(s))
        ).length ??
        0
    );

    const unreadMessages = Number(
        dashboardCounts.unread_messages ??
        dashboardCounts.unreadMessages ??
        0
    );

    setAdminKpi('admin-kpi-total', total);
    setAdminKpi('admin-kpi-transit', transit);
    setAdminKpi('admin-kpi-delivered', delivered);
    setAdminKpi('admin-kpi-messages', unreadMessages);

    updateAdminSidebarMessageCount(unreadMessages);

    renderAdminStatusDistribution(shipmentList);
    adminCommandCenterBindKpiActions();
    renderAdminOperationalAlerts(shipmentList);
    renderAdminRecentShipments(shipmentList);

    const refresh = document.getElementById('admin-dashboard-last-refresh');
    if (refresh) {
        refresh.textContent = `Updated ${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }
}

function renderAdminStatusDistribution(shipments) {
    const container = document.getElementById('admin-status-distribution');
    if (!container) return;

    if (!shipments.length) {
        container.innerHTML = '<div class="admin-status-empty">No shipment data available.</div>';
        return;
    }

    const counts = new Map();

    shipments.forEach(shipment => {
        const raw = getAdminShipmentStatus(shipment);
        const label = raw || 'Unknown';
        const key = normalizeAdminStatus(label) || 'unknown';

        if (!counts.has(key)) {
            counts.set(key, {
                label,
                count: 0
            });
        }

        counts.get(key).count += 1;
    });

    const rows = Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    const max = Math.max(...rows.map(row => row.count), 1);

    container.innerHTML = rows.map(row => {
        const percentage =
            Math.max(
                2,
                Math.round(
                    (row.count / max) * 100
                )
            );

        const safeLabel =
            escapeHtml(row.label);

        return `
            <div
                class="admin-status-row admin-status-action"
                role="button"
                tabindex="0"
                data-admin-status-filter="${safeLabel}"
                aria-label="Filter shipments by status ${safeLabel}"
            >
                <span class="admin-status-name">
                    ${safeLabel}
                </span>

                <div class="admin-status-track">
                    <div
                        class="admin-status-fill"
                        style="width:${percentage}%"
                    ></div>
                </div>

                <span class="admin-status-value">
                    ${row.count}
                </span>
            </div>
        `;
    }).join('');

    container
        .querySelectorAll('[data-admin-status-filter]')
        .forEach(function(row) {
            if (row.dataset.statusFilterBound === 'true') {
                return;
            }

            row.dataset.statusFilterBound = 'true';

            const activate = function() {
                adminCommandCenterFilterStatus(
                    row.dataset.adminStatusFilter || ''
                );
            };

            row.addEventListener(
                'click',
                activate
            );

            row.addEventListener(
                'keydown',
                function(event) {
                    if (
                        event.key === 'Enter' ||
                        event.key === ' '
                    ) {
                        event.preventDefault();
                        activate();
                    }
                }
            );
        });
}

function adminCommandCenterFilterStatus(status) {
    if (
        !adminActionAllowed("shipments.view")
    ) {
        return;
    }

    const shipmentNav =
        document.querySelector(
            '[data-admin-nav="shipments"]'
        );

    if (
        shipmentNav &&
        !shipmentNav.hidden
    ) {
        shipmentNav.click();
    }

    const applyFilter = function() {
        const controller =
            window.__adminShipmentFilterController;

        if (
            controller &&
            typeof controller.setStatus === "function"
        ) {
            controller.setStatus(status);
            return true;
        }

        return false;
    };

    if (!applyFilter()) {
        window.setTimeout(
            applyFilter,
            180
        );
    }
}


/* COMMAND CENTER OPERATIONAL ALERT ACTIONS V1 */

function adminCommandCenterOpenShipments(options = {}) {
    if (!adminActionAllowed("shipments.view")) {
        return;
    }

    const shipmentNav =
        document.querySelector(
            '[data-admin-nav="shipments"]'
        );

    if (
        shipmentNav &&
        !shipmentNav.hidden
    ) {
        shipmentNav.click();
    }

    const apply = function() {
        const controller =
            window.__adminShipmentFilterController;

        if (
            !controller ||
            typeof controller.setStatus !== "function"
        ) {
            return false;
        }

        if (
            options.status &&
            typeof controller.setStatus === "function"
        ) {
            controller.setStatus(options.status);
        }

        return true;
    };

    if (!apply()) {
        window.setTimeout(
            apply,
            180
        );
    }
}

function adminCommandCenterBindAlertActions() {
    const container =
        document.getElementById(
            "admin-operational-alerts"
        );

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            "[data-admin-alert-action]"
        )
        .forEach(function(alert) {

            if (
                alert.dataset.alertActionBound ===
                "true"
            ) {
                return;
            }

            alert.dataset.alertActionBound = "true";

            const activate = function() {
                const action =
                    alert.dataset.adminAlertAction ||
                    "";

                if (
                    action === "exceptions"
                ) {
                    adminCommandCenterOpenShipments();
                    return;
                }

                if (
                    action === "missing-destination" ||
                    action === "missing-recipient"
                ) {
                    adminCommandCenterOpenShipments();
                }
            };

            alert.addEventListener(
                "click",
                activate
            );

            alert.addEventListener(
                "keydown",
                function(event) {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        activate();
                    }
                }
            );
        });
}

function renderAdminOperationalAlerts(shipments) {
    const container = document.getElementById('admin-operational-alerts');
    if (!container) return;

    const alerts = [];

    const exceptions = shipments.filter(s =>
        isAdminException(getAdminShipmentStatus(s))
    );

    if (exceptions.length) {
        alerts.push({
            type: 'danger',
            title: `${exceptions.length} shipment${exceptions.length === 1 ? '' : 's'} need attention`,
            detail: 'Review exception, delay, failed, held, or returned shipments.'
        });
    }

    const missingDestination = shipments.filter(s =>
        !String(s?.destination || '').trim()
    );

    if (missingDestination.length) {
        alerts.push({
            type: 'warning',
            title: `${missingDestination.length} shipment${missingDestination.length === 1 ? '' : 's'} missing destination`,
            detail: 'Destination information is incomplete.'
        });
    }

    const missingRecipient = shipments.filter(s =>
        !String(s?.recipient_name || s?.recipientName || '').trim()
    );

    if (missingRecipient.length) {
        alerts.push({
            type: 'warning',
            title: `${missingRecipient.length} shipment${missingRecipient.length === 1 ? '' : 's'} missing recipient`,
            detail: 'Recipient information is incomplete.'
        });
    }

    if (!alerts.length) {
        alerts.push({
            type: 'info',
            title: 'No operational alerts',
            detail: 'No issues were detected from the available shipment fields.'
        });
    }

    container.innerHTML = alerts.slice(0, 5).map(alert => {
        const action =
            alert.type === 'danger'
                ? 'exceptions'
                : alert.title.includes('missing destination')
                    ? 'missing-destination'
                    : alert.title.includes('missing recipient')
                        ? 'missing-recipient'
                        : '';

        const actionAttrs = action
            ? `
                role="button"
                tabindex="0"
                data-admin-alert-action="${action}"
                aria-label="Open shipments for ${escapeHtml(alert.title)}"
              `
            : '';

        return `
        <div
            class="admin-alert-item alert-${alert.type}"
            ${actionAttrs}
        >
            <span class="admin-alert-dot"></span>
            <div class="admin-alert-body">
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.detail)}</span>
            </div>
        </div>
        `;
    }).join('');

    adminCommandCenterBindAlertActions();
}

function renderAdminRecentShipments(shipments) {
    const container = document.getElementById('admin-recent-shipments');
    const countElement = document.getElementById('admin-recent-count');

    if (!container) return;

    const recent = [...shipments]
        .sort((a, b) => {
            const aDate = new Date(getAdminShipmentDate(a)).getTime() || 0;
            const bDate = new Date(getAdminShipmentDate(b)).getTime() || 0;
            return bDate - aDate;
        })
        .slice(0, 6);

    if (countElement) countElement.textContent = String(recent.length);

    if (!recent.length) {
        container.innerHTML = '<div class="admin-status-empty">No recent shipments.</div>';
        return;
    }

    container.innerHTML = recent.map(shipment => {
        const tracking =
            shipment?.tracking_number ||
            shipment?.trackingNumber ||
            shipment?.reference ||
            'Unassigned';

        const recipient =
            shipment?.recipient_name ||
            shipment?.recipientName ||
            'Recipient unavailable';

        const origin = shipment?.origin || 'Origin';
        const destination = shipment?.destination || 'Destination';
        const status = getAdminShipmentStatus(shipment) || 'Unknown';

        const shipmentId =
            shipment?.id ??
            shipment?.shipment_id ??
            "";

        return `
            <div class="admin-recent-row admin-recent-action"
                 role="button"
                 tabindex="0"
                 data-admin-command-action="shipment"
                 data-shipment-id="${escapeHtml(String(shipmentId))}"
                 aria-label="Open shipment ${escapeHtml(tracking)}">
                <div class="admin-recent-main">
                    <span class="admin-recent-tracking">${escapeHtml(tracking)}</span>
                    <span class="admin-recent-route">
                        ${escapeHtml(origin)} → ${escapeHtml(destination)}
                    </span>
                    <span class="admin-recent-status">${escapeHtml(status)}</span>
                </div>

                <div class="admin-recent-recipient">
                    ${escapeHtml(recipient)}
                </div>

                <div class="admin-recent-date">
                    ${escapeHtml(formatAdminDashboardDate(getAdminShipmentDate(shipment)))}
                </div>
            </div>
        `;
    }).join('');
}


/* COMMAND CENTER KPI ACTIONS V1 */

function adminCommandCenterOpenKpi(action) {
    const normalizedAction =
        String(action || "").trim();

    if (
        normalizedAction === "shipments" ||
        normalizedAction === "total"
    ) {
        if (!adminActionAllowed("shipments.view")) {
            return;
        }

        const nav =
            document.querySelector(
                '[data-admin-nav="shipments"]'
            );

        if (nav && !nav.hidden) {
            nav.click();
        }

        return;
    }

    if (normalizedAction === "transit") {
        if (!adminActionAllowed("shipments.view")) {
            return;
        }

        const nav =
            document.querySelector(
                '[data-admin-nav="shipments"]'
            );

        if (nav && !nav.hidden) {
            nav.click();
        }

        window.setTimeout(function() {
            const controller =
                window.__adminShipmentFilterController;

            if (
                controller &&
                typeof controller.setStatus === "function"
            ) {
                controller.setStatus("In Transit");
            }
        }, 180);

        return;
    }

    if (normalizedAction === "delivered") {
        if (!adminActionAllowed("shipments.view")) {
            return;
        }

        const nav =
            document.querySelector(
                '[data-admin-nav="shipments"]'
            );

        if (nav && !nav.hidden) {
            nav.click();
        }

        window.setTimeout(function() {
            const controller =
                window.__adminShipmentFilterController;

            if (
                controller &&
                typeof controller.setStatus === "function"
            ) {
                controller.setStatus("Delivered");
            }
        }, 180);

        return;
    }

    if (normalizedAction === "messages") {
        if (!adminActionAllowed("messages.view")) {
            return;
        }

        const nav =
            document.querySelector(
                '[data-admin-nav="messages"]'
            );

        if (nav && !nav.hidden) {
            nav.click();
        }
    }
}

function adminCommandCenterBindKpiActions() {
    const container =
        document.getElementById(
            "view-admin-dashboard"
        );

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            "[data-admin-kpi-action]"
        )
        .forEach(function(card) {

            if (
                card.dataset.kpiActionBound ===
                "true"
            ) {
                return;
            }

            card.dataset.kpiActionBound = "true";

            const activate = function() {
                adminCommandCenterOpenKpi(
                    card.dataset.adminKpiAction
                );
            };

            card.addEventListener(
                "click",
                activate
            );

            card.addEventListener(
                "keydown",
                function(event) {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        activate();
                    }
                }
            );
        });
}

function adminCommandCenterNavigate(action, shipmentId = null) {
    const normalizedAction = String(action || "").trim();

    if (normalizedAction === "messages") {
        if (!adminActionAllowed("messages.view")) {
            return;
        }

        const messageNav =
            document.querySelector('[data-admin-nav="messages"]');

        if (messageNav && !messageNav.hidden) {
            messageNav.click();
        }

        return;
    }

    if (
        normalizedAction === "shipments" ||
        normalizedAction === "shipment"
    ) {
        if (!adminActionAllowed("shipments.view")) {
            return;
        }

        const shipmentNav =
            document.querySelector('[data-admin-nav="shipments"]');

        if (shipmentNav && !shipmentNav.hidden) {
            shipmentNav.click();
        }

        if (
            normalizedAction === "shipment" &&
            shipmentId
        ) {
            const targetId = String(shipmentId);

            const shipments =
                Array.isArray(window.__adminShipments)
                    ? window.__adminShipments
                    : [];

            const shipment = shipments.find(function(item) {
                return String(
                    item?.id ??
                    item?.shipment_id ??
                    ""
                ) === targetId;
            });

            if (
                shipment &&
                typeof openViewShipmentModal === "function"
            ) {
                window.setTimeout(function() {
                    openViewShipmentModal(shipment);
                }, 120);

                return;
            }

            window.setTimeout(function() {
                const row = document.querySelector(
                    '#admin-shipments-tbody tr[data-shipment-id="' +
                    CSS.escape(targetId) +
                    '"]'
                );

                if (row) {
                    row.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    row.classList.add(
                        "admin-command-target-highlight"
                    );

                    window.setTimeout(function() {
                        row.classList.remove(
                            "admin-command-target-highlight"
                        );
                    }, 1600);
                }
            }, 120);
        }
    }
}

function setupAdminCommandCenter() {
    const refreshButton = document.getElementById('admin-dashboard-refresh');

    if (refreshButton && !refreshButton.dataset.bound) {
        refreshButton.dataset.bound = 'true';

        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true;
            refreshButton.textContent = 'Refreshing…';

            try {
                if (typeof loadAdminDashboard === 'function') {
                    await loadAdminDashboard();
                }
            } finally {
                refreshButton.disabled = false;
                refreshButton.textContent = '↻ Refresh';
            }
        });
    }

    document
        .querySelectorAll('[data-admin-command-action]')
        .forEach(function(element) {
            if (element.dataset.commandBound === 'true') {
                return;
            }

            element.dataset.commandBound = 'true';

            const activate = function() {
                adminCommandCenterNavigate(
                    element.dataset.adminCommandAction,
                    element.dataset.shipmentId || null
                );
            };

            element.addEventListener('click', activate);

            element.addEventListener('keydown', function(event) {
                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {
                    event.preventDefault();
                    activate();
                }
            });
        });
}

document.addEventListener('DOMContentLoaded', setupAdminCommandCenter);




/* =========================================================
   STAFF MANAGEMENT
========================================================= */

let adminStaffRecords = [];
let adminStaffInitialized = false;

const ADMIN_STAFF_ROLES = [
  'Admin',
  'Operations Manager',
  'Dispatcher',
  'Driver',
  'Trunk Driver',
  'Cargo Personnel',
  'Warehouse Personnel',
  'Customer Service',
  'Customer'
];

function getAdminStaffRecords() {
  return Array.isArray(adminStaffRecords)
    ? adminStaffRecords
    : [];
}

function adminStaffDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function adminStaffEscape(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function showAdminStaffFeedback(message, type = 'success') {
  const el = document.getElementById('admin-staff-feedback');

  if (!el) {
    return;
  }

  el.textContent = message || '';
  el.className =
    'admin-staff-feedback ' +
    (type === 'error'
      ? 'is-error'
      : 'is-success');

  el.hidden = !message;

  if (message) {
    window.setTimeout(() => {
      if (el.textContent === message) {
        el.hidden = true;
      }
    }, 4500);
  }
}

function renderAdminStaffSummary(records) {
  const list = Array.isArray(records) ? records : [];

  const admins =
    list.filter(
      user => String(user.role || '') === 'Admin'
    ).length;

  const operations =
    list.filter(
      user => [
        'Operations Manager',
        'Dispatcher',
        'Driver',
        'Trunk Driver',
        'Cargo Personnel',
        'Warehouse Personnel'
      ].includes(String(user.role || ''))
    ).length;

  const service =
    list.filter(
      user => String(user.role || '') === 'Customer Service'
    ).length;

  const totalEl = document.getElementById('admin-staff-total');
  const adminsEl = document.getElementById('admin-staff-admins');
  const operationsEl = document.getElementById('admin-staff-operations');
  const serviceEl = document.getElementById('admin-staff-service');

  if (totalEl) totalEl.textContent = String(list.length);
  if (adminsEl) adminsEl.textContent = String(admins);
  if (operationsEl) operationsEl.textContent = String(operations);
  if (serviceEl) serviceEl.textContent = String(service);
}

function renderAdminStaffTable() {
  const tbody = document.getElementById('admin-staff-tbody');

  if (!tbody) {
    return;
  }

  const searchEl = document.getElementById('admin-staff-search');
  const roleEl = document.getElementById('admin-staff-role-filter');
  const summaryEl = document.getElementById('admin-staff-filter-summary');

  const query =
    String(searchEl?.value || '')
      .trim()
      .toLowerCase();

  const role =
    String(roleEl?.value || '').trim();

  const filtered = getAdminStaffRecords().filter(user => {
    const name = String(user.name || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();

    const matchesSearch =
      !query ||
      name.includes(query) ||
      email.includes(query);

    const matchesRole =
      !role ||
      String(user.role || '') === role;

    return matchesSearch && matchesRole;
  });

  renderAdminStaffSummary(getAdminStaffRecords());

  if (summaryEl) {
    summaryEl.textContent =
      `Showing ${filtered.length} of ${getAdminStaffRecords().length} accounts`;
  }

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="admin-status-empty">
            No staff accounts match the current filters.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(user => {
    const id = Number(user.id);
    const role = String(user.role || 'Customer');
    const name = String(user.name || 'Unnamed User');
    const email = String(user.email || '—');

    return `
      <tr>
        <td>
          <div class="admin-staff-person">
            <span class="admin-staff-avatar">
              ${adminStaffEscape(name.charAt(0).toUpperCase())}
            </span>
            <div>
              <strong>${adminStaffEscape(name)}</strong>
              <small>Account #${adminStaffEscape(id)}</small>
            </div>
          </div>
        </td>

        <td>
          <span class="admin-staff-email">
            ${adminStaffEscape(email)}
          </span>
        </td>

        <td>
          <span class="admin-staff-role">
            ${adminStaffEscape(role)}
          </span>
        </td>

        <td>
          <span class="admin-staff-date">
            ${adminStaffDate(user.created_at)}
          </span>
        </td>

        <td>
          <div class="admin-staff-actions">

            ${
              adminActionAllowed('staff.update')
                ? `
                  <button
                    type="button"
                    class="admin-staff-action"
                    data-staff-action="edit"
                    data-staff-id="${id}"
                    aria-label="Edit ${adminStaffEscape(name)}"
                  >
                    Edit
                  </button>
                `
                : ''
            }

            ${
              adminActionAllowed('staff.role')
                ? `
                  <button
                    type="button"
                    class="admin-staff-action"
                    data-staff-action="role"
                    data-staff-id="${id}"
                    aria-label="Change role for ${adminStaffEscape(name)}"
                  >
                    Role
                  </button>
                `
                : ''
            }

            ${
              adminActionAllowed('staff.password')
                ? `
                  <button
                    type="button"
                    class="admin-staff-action admin-staff-action-security"
                    data-staff-action="password"
                    data-staff-id="${id}"
                    aria-label="Reset password for ${adminStaffEscape(name)}"
                  >
                    Password
                  </button>
                `
                : ''
            }

          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadAdminStaff() {
  const refreshButton =
    document.getElementById('admin-staff-refresh');

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
  }

  try {
    const response = await fetch(
      '/api/admin/users',
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        'Failed to load staff accounts.'
      );
    }

    adminStaffRecords =
      Array.isArray(payload.users)
        ? payload.users
        : [];

    renderAdminStaffTable();

  } catch (error) {
    console.error(
      '[STAFF MANAGEMENT LOAD]',
      error
    );

    adminStaffRecords = [];
    renderAdminStaffTable();

    showAdminStaffFeedback(
      error.message ||
      'Unable to load staff accounts.',
      'error'
    );

  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.removeAttribute('aria-busy');
    }
  }
}

function openAdminStaffEdit(id) {

  if (
    !adminActionAllowed(
      'staff.update'
    )
  ) {
    return;
  }

  const user =
    getAdminStaffRecords().find(
      item => Number(item.id) === Number(id)
    );

  if (!user) {
    return;
  }

  document.getElementById('admin-staff-edit-id').value =
    String(user.id);

  document.getElementById('admin-staff-edit-name').value =
    String(user.name || '');

  document.getElementById('admin-staff-edit-email').value =
    String(user.email || '');

  const modal =
    document.getElementById('admin-staff-edit-modal');

  if (modal) {
    modal.hidden = false;
    document.getElementById('admin-staff-edit-name')?.focus();
  }
}

function closeAdminStaffEdit() {
  const modal =
    document.getElementById('admin-staff-edit-modal');

  if (modal) {
    modal.hidden = true;
  }
}

function openAdminStaffRole(id) {

  if (
    !adminActionAllowed(
      'staff.role'
    )
  ) {
    return;
  }

  const user =
    getAdminStaffRecords().find(
      item => Number(item.id) === Number(id)
    );

  if (!user) {
    return;
  }

  document.getElementById('admin-staff-role-id').value =
    String(user.id);

  document.getElementById('admin-staff-role-select').value =
    ADMIN_STAFF_ROLES.includes(String(user.role))
      ? String(user.role)
      : 'Customer';

  const member =
    document.getElementById('admin-staff-role-member');

  if (member) {
    member.textContent =
      `Select the operational role for ${user.name || user.email}.`;
  }

  const modal =
    document.getElementById('admin-staff-role-modal');

  if (modal) {
    modal.hidden = false;
    document.getElementById('admin-staff-role-select')?.focus();
  }
}

function closeAdminStaffRole() {
  const modal =
    document.getElementById('admin-staff-role-modal');

  if (modal) {
    modal.hidden = true;
  }
}

function openAdminStaffPassword(id) {

  if (
    !adminActionAllowed(
      'staff.password'
    )
  ) {
    return;
  }

  const user =
    getAdminStaffRecords().find(
      item => Number(item.id) === Number(id)
    );

  if (!user) {
    return;
  }

  document.getElementById('admin-staff-password-id').value =
    String(user.id);

  document.getElementById('admin-staff-new-password').value =
    '';

  const member =
    document.getElementById('admin-staff-password-member');

  if (member) {
    member.textContent =
      `Set a new password for ${user.name || user.email}.`;
  }

  const modal =
    document.getElementById('admin-staff-password-modal');

  if (modal) {
    modal.hidden = false;
    document.getElementById('admin-staff-new-password')?.focus();
  }
}

function closeAdminStaffPassword() {
  const modal =
    document.getElementById('admin-staff-password-modal');

  if (modal) {
    modal.hidden = true;
  }
}

async function submitAdminStaffEdit(event) {

  if (
    !adminActionAllowed(
      'staff.update'
    )
  ) {
    return;
  }

  event.preventDefault();

  const id =
    Number(
      document.getElementById('admin-staff-edit-id')?.value
    );

  const name =
    String(
      document.getElementById('admin-staff-edit-name')?.value || ''
    ).trim();

  const email =
    String(
      document.getElementById('admin-staff-edit-email')?.value || ''
    ).trim()
    .toLowerCase();

  if (!Number.isSafeInteger(id) || id < 1 || !name || !email) {
    showAdminStaffFeedback(
      'Name and email are required.',
      'error'
    );
    return;
  }

  const submitButton =
    event.currentTarget.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await fetch(
      `/api/admin/users/${id}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name,
          email
        })
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        'Failed to update staff account.'
      );
    }

    closeAdminStaffEdit();
    showAdminStaffFeedback(
      payload.message ||
      'Staff account updated successfully.'
    );

    await loadAdminStaff();

  } catch (error) {
    console.error(
      '[STAFF UPDATE]',
      error
    );

    showAdminStaffFeedback(
      error.message ||
      'Unable to update staff account.',
      'error'
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function submitAdminStaffRole(event) {

  if (
    !adminActionAllowed(
      'staff.role'
    )
  ) {
    return;
  }

  event.preventDefault();

  const id =
    Number(
      document.getElementById('admin-staff-role-id')?.value
    );

  const role =
    String(
      document.getElementById('admin-staff-role-select')?.value || ''
    );

  const user =
    getAdminStaffRecords().find(
      item => Number(item.id) === id
    );

  if (!Number.isSafeInteger(id) || id < 1 || !ADMIN_STAFF_ROLES.includes(role)) {
    showAdminStaffFeedback(
      'Please select a valid role.',
      'error'
    );
    return;
  }

  if (
    user &&
    String(user.role) === 'Admin' &&
    role !== 'Admin'
  ) {
    const confirmed =
      window.confirm(
        `Change ${user.name || user.email} from Administrator to ${role}?`
      );

    if (!confirmed) {
      return;
    }
  }

  const submitButton =
    event.currentTarget.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await fetch(
      `/api/admin/users/${id}/role`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ role })
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        'Failed to change staff role.'
      );
    }

    closeAdminStaffRole();

    showAdminStaffFeedback(
      payload.message ||
      'Staff role updated successfully.'
    );

    await loadAdminStaff();

  } catch (error) {
    console.error(
      '[STAFF ROLE]',
      error
    );

    showAdminStaffFeedback(
      error.message ||
      'Unable to change staff role.',
      'error'
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function submitAdminStaffPassword(event) {

  if (
    !adminActionAllowed(
      'staff.password'
    )
  ) {
    return;
  }

  event.preventDefault();

  const id =
    Number(
      document.getElementById('admin-staff-password-id')?.value
    );

  const password =
    String(
      document.getElementById('admin-staff-new-password')?.value || ''
    );

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    password.length < 8
  ) {
    showAdminStaffFeedback(
      'Password must contain at least 8 characters.',
      'error'
    );
    return;
  }

  const user =
    getAdminStaffRecords().find(
      item => Number(item.id) === id
    );

  const confirmed =
    window.confirm(
      `Reset the password for ${user?.name || user?.email || 'this account'}?`
    );

  if (!confirmed) {
    return;
  }

  const submitButton =
    event.currentTarget.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await fetch(
      `/api/admin/users/${id}/reset-password`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          password
        })
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        'Failed to reset password.'
      );
    }

    closeAdminStaffPassword();

    showAdminStaffFeedback(
      payload.message ||
      'Staff password reset successfully.'
    );

  } catch (error) {
    console.error(
      '[STAFF PASSWORD RESET]',
      error
    );

    showAdminStaffFeedback(
      error.message ||
      'Unable to reset staff password.',
      'error'
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function initAdminStaffManagement() {
  if (adminStaffInitialized) {
    renderAdminStaffTable();
    return;
  }

  adminStaffInitialized = true;

  const search =
    document.getElementById('admin-staff-search');

  const roleFilter =
    document.getElementById('admin-staff-role-filter');

  const refresh =
    document.getElementById('admin-staff-refresh');

  const dashboard =
    document.getElementById('admin-staff-dashboard');

  const tbody =
    document.getElementById('admin-staff-tbody');

  const editForm =
    document.getElementById('admin-staff-edit-form');

  const roleForm =
    document.getElementById('admin-staff-role-form');

  const passwordForm =
    document.getElementById('admin-staff-password-form');

  if (search) {
    search.addEventListener(
      'input',
      renderAdminStaffTable
    );
  }

  if (roleFilter) {
    roleFilter.addEventListener(
      'change',
      renderAdminStaffTable
    );
  }

  if (refresh) {
    refresh.addEventListener(
      'click',
      loadAdminStaff
    );
  }

  if (dashboard) {
    dashboard.addEventListener(
      'click',
      () => {
        if (typeof handleNav === 'function') {
          handleNav('dashboard');
        }
      }
    );
  }

  if (tbody) {
    tbody.addEventListener(
      'click',
      event => {
        const button =
          event.target.closest('[data-staff-action]');

        if (!button || button.disabled) {
          return;
        }

        const id =
          Number(button.dataset.staffId);

        const action =
          button.dataset.staffAction;

        if (action === 'edit') {
          openAdminStaffEdit(id);
          return;
        }

        if (action === 'role') {
          openAdminStaffRole(id);
          return;
        }

        if (action === 'password') {
          openAdminStaffPassword(id);
        }
      }
    );
  }

  if (editForm) {
    editForm.addEventListener(
      'submit',
      submitAdminStaffEdit
    );
  }

  if (roleForm) {
    roleForm.addEventListener(
      'submit',
      submitAdminStaffRole
    );
  }

  if (passwordForm) {
    passwordForm.addEventListener(
      'submit',
      submitAdminStaffPassword
    );
  }

  document.querySelectorAll('[data-staff-modal-close]')
    .forEach(button => {
      button.addEventListener(
        'click',
        closeAdminStaffEdit
      );
    });

  document.querySelectorAll('[data-staff-role-close]')
    .forEach(button => {
      button.addEventListener(
        'click',
        closeAdminStaffRole
      );
    });

  document.querySelectorAll('[data-staff-password-close]')
    .forEach(button => {
      button.addEventListener(
        'click',
        closeAdminStaffPassword
      );
    });

  renderAdminStaffTable();
}

window.loadAdminStaff = loadAdminStaff;
window.initAdminStaffManagement = initAdminStaffManagement;

/* =========================================================
   END STAFF MANAGEMENT
========================================================= */



/* =========================================================
   DISPATCH ADMIN SIDEBAR CONTROLLER
========================================================= */

(function initDispatchAdminSidebar() {

  if (window.__dispatchAdminSidebarInitialized) {
    return;
  }

  window.__dispatchAdminSidebarInitialized = true;

  const body = document.body;

  const sidebarToggle =
    document.getElementById('admin-sidebar-toggle');

  const mobileMenu =
    document.getElementById('admin-mobile-menu');

  const backdrop =
    document.getElementById('admin-sidebar-backdrop');

  const exitButton =
    document.getElementById('admin-sidebar-exit');

  const navItems =
    document.querySelectorAll('[data-admin-nav]');

  function isMobile() {
    return window.matchMedia('(max-width: 850px)').matches;
  }

  function closeMobileSidebar() {
    body.classList.remove(
      'admin-sidebar-mobile-open'
    );
  }

  function openMobileSidebar() {
    body.classList.add(
      'admin-sidebar-mobile-open'
    );
  }

  function toggleSidebar() {

    if (isMobile()) {
      if (
        body.classList.contains(
          'admin-sidebar-mobile-open'
        )
      ) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }

      return;
    }

    body.classList.toggle(
      'admin-sidebar-collapsed'
    );

    const collapsed =
      body.classList.contains(
        'admin-sidebar-collapsed'
      );

    localStorage.setItem(
      'dispatch_admin_sidebar_collapsed',
      collapsed ? '1' : '0'
    );

    if (sidebarToggle) {
      sidebarToggle.textContent =
        collapsed ? '›' : '‹';

      sidebarToggle.setAttribute(
        'aria-label',
        collapsed
          ? 'Expand sidebar'
          : 'Collapse sidebar'
      );
    }
  }

  function restoreSidebarState() {

    if (isMobile()) {
      body.classList.remove(
        'admin-sidebar-collapsed'
      );
      return;
    }

    const saved =
      localStorage.getItem(
        'dispatch_admin_sidebar_collapsed'
      );

    if (saved === '1') {
      body.classList.add(
        'admin-sidebar-collapsed'
      );

      if (sidebarToggle) {
        sidebarToggle.textContent = '›';
      }
    }
  }

  function setActiveNav(name) {

    navItems.forEach(function(item) {

      item.classList.toggle(
        'active',
        item.dataset.adminNav === name
      );

    });

  }

  function scrollToDashboardArea(selector) {

    const target =
      document.querySelector(selector);

    if (!target) {
      return;
    }

    closeMobileSidebar();

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }


  /*
   * Keep secondary admin workspaces mutually exclusive.
   */
  function hideAdminSecondaryWorkspaces() {

    [
      'admin-staff-management',
      'view-admin-settings',
      'admin-tracking-workspace'
    ].forEach(function(id) {

      const workspace =
        document.getElementById(id);

      if (workspace) {
        workspace.style.display = 'none';
      }

    });

  }


  function showAdminWorkspace(id) {

    hideAdminSecondaryWorkspaces();

    const workspace =
      document.getElementById(id);

    if (!workspace) {
      return null;
    }

    workspace.style.display = 'block';

    return workspace;
  }

  /*
   * Admin workspace isolation.
   * Only the selected workspace may remain visible.
   */
  function hideAllAdminWorkspaces() {

    [
      'view-admin-dashboard',
      'admin-shipments-workspace',
      'admin-messages',
      'admin-staff-management',
      'view-admin-settings',
      'admin-tracking-workspace'
    ].forEach(function(id) {

      const workspace =
        document.getElementById(id);

      if (workspace) {
        workspace.style.display = 'none';
      }

    });

  }


  function showOnlyAdminWorkspace(id) {

    hideAllAdminWorkspaces();

    const workspace =
      document.getElementById(id);

    if (!workspace) {
      return null;
    }

    workspace.style.display = 'block';

    return workspace;
  }

  function handleNav(name) {

    setActiveNav(name);

    if (name === 'dashboard') {

      const dashboard =
        showOnlyAdminWorkspace(
          'view-admin-dashboard'
        );

      if (dashboard) {

        if (
          typeof loadAdminDashboard === 'function'
        ) {
          loadAdminDashboard();
        }

        closeMobileSidebar();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

      }

      return;
    }


    if (name === 'shipments') {

      const target =
        showOnlyAdminWorkspace(
          'admin-shipments-workspace'
        );

      if (!target) {
        return;
      }

      closeMobileSidebar();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      loadAdminShipments()
        .then(function() {

          if (
            typeof renderAdminShipmentWorkspace ===
            'function'
          ) {
            renderAdminShipmentWorkspace();
          }

        })
        .catch(function(error) {

          console.error(
            '[ADMIN SHIPMENTS LOAD]',
            error
          );

          alert(
            error.message ||
            'Unable to load shipments.'
          );

        });

      return;
    }


    if (name === 'tracking') {

      hideAllAdminWorkspaces();

      const target =
        document.getElementById(
          'admin-tracking-workspace'
        );

      if (!target) {
        return;
      }

      closeMobileSidebar();

      loadAdminShipments()
        .then(function() {

          activateAdminTrackingWorkspace();

        })
        .catch(function(error) {

          console.error(
            '[ADMIN TRACKING LOAD]',
            error
          );

          alert(
            error.message ||
            'Unable to load tracking data.'
          );

        });

      return;
    }


    if (name === 'messages') {

      const target =
        showOnlyAdminWorkspace(
          'admin-messages'
        );

      if (!target) {
        return;
      }

      closeMobileSidebar();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      initAdminMessageCenter();

      loadAdminMessages()
        .catch(function(error) {

          console.error(
            '[ADMIN MESSAGES LOAD]',
            error
          );

          alert(
            error.message ||
            'Unable to load customer messages.'
          );

        });

      return;
    }


    if (name === 'staff') {

      const target =
        showOnlyAdminWorkspace(
          'admin-staff-management'
        );

      if (!target) {
        return;
      }

      closeMobileSidebar();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      initAdminStaffManagement();
      loadAdminStaff();

      return;
    }


    if (name === 'settings') {

      const target =
        showOnlyAdminWorkspace(
          'view-admin-settings'
        );

      if (!target) {
        return;
      }

      closeMobileSidebar();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      loadAdminSettingsWorkspace()
        .catch(function(error) {

          console.error(
            '[ADMIN SETTINGS LOAD]',
            error
          );

        });

      return;
    }

  }

  document
    .querySelectorAll(
      '[data-admin-internal-nav]'
    )
    .forEach(function(button) {

      button.addEventListener(
        'click',
        function() {

          const destination =
            button.getAttribute(
              'data-admin-internal-nav'
            );

          if (
            destination &&
            typeof handleNav === 'function'
          ) {
            handleNav(destination);
          }

        }
      );

    });


  if (sidebarToggle) {
    sidebarToggle.addEventListener(
      'click',
      toggleSidebar
    );
  }

  if (mobileMenu) {
    mobileMenu.addEventListener(
      'click',
      toggleSidebar
    );
  }

  if (backdrop) {
    backdrop.addEventListener(
      'click',
      closeMobileSidebar
    );
  }

  navItems.forEach(function(item) {

    item.addEventListener(
      'click',
      function() {

        handleNav(
          item.dataset.adminNav
        );

      }
    );

  });

  if (exitButton) {

    exitButton.addEventListener(
      'click',
      function() {

        /*
         * Reuse existing application navigation
         * rather than forcing a reload.
         */

        if (
          typeof loadPublicHome ===
          'function'
        ) {
          loadPublicHome();
          return;
        }

        const home =
          document.querySelector(
            '[data-view="home"]'
          );

        if (home) {
          home.click();
          return;
        }

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

      }
    );

  }

  window.addEventListener(
    'resize',
    function() {

      if (!isMobile()) {
        closeMobileSidebar();
        restoreSidebarState();
      }

    }
  );

  restoreSidebarState();

  /*
   * The sidebar is initialized first so the existing
   * navigation behavior remains intact. RBAC then
   * loads the authenticated profile and applies the
   * role-aware visibility layer.
   */
  scheduleAdminRBACBootstrap();

})();

/* =========================================================
   SIDEBAR MESSAGE BADGE
========================================================= */

function updateAdminSidebarMessageCount(count) {

  const badge =
    document.getElementById(
      'admin-sidebar-message-count'
    );

  if (!badge) {
    return;
  }

  const value =
    Number.isFinite(Number(count))
      ? Number(count)
      : 0;

  badge.textContent =
    value > 99
      ? '99+'
      : String(value);

  badge.style.display =
    value > 0
      ? 'inline-flex'
      : 'none';
}
