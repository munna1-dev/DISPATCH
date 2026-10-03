/*
 * USCourier Platform Configuration
 *
 * Frontend-only configuration workspace.
 *
 * Reuses existing production APIs:
 *   /api/admin/settings
 *   /api/admin/users
 *   /api/admin/users/:id/access-policy
 *
 * This module deliberately does NOT expose or manage:
 *   - database
 *   - database schema
 *   - SQL queries
 *   - environment variables
 *   - secrets
 *   - deployments
 *   - infrastructure
 *   - server shell
 *   - session termination
 *   - API keys
 *   - JWT secrets
 *   - database credentials
 */

(function () {
  "use strict";

  const CONFIG = {
    settingsEndpoint: "/api/admin/settings",
    usersEndpoint: "/api/admin/users",
    accessPolicyEndpoint: function (id) {
      return (
        "/api/admin/users/" +
        encodeURIComponent(id) +
        "/access-policy"
      );
    },

    selectors: {
      sidebar: ".admin-sidebar",
      sidebarToggle: "#admin-sidebar-toggle",
      developerView: "#view-admin-developer",
      createParcel: "#open-create-shipment-btn",
      updateParcel:
        "[data-action='update-parcel'], #open-update-shipment-btn",
      dashboard:
        "[data-action='dashboard'], #admin-dashboard-btn"
    },

    permissions: [
      {
        group: "Dashboard",
        items: [
          ["dashboard.view", "Dashboard access"]
        ]
      },
      {
        group: "Shipments",
        items: [
          ["shipments.view", "View parcels"],
          ["shipments.create", "Create parcels"],
          ["shipments.update", "Update parcels"],
          ["shipments.delete", "Delete parcels"]
        ]
      },
      {
        group: "Tracking",
        items: [
          ["tracking.view", "View tracking"],
          ["tracking.update", "Update tracking"]
        ]
      },
      {
        group: "Customers",
        items: [
          ["customers.view", "View customers"]
        ]
      },
      {
        group: "Staff",
        items: [
          ["staff.view", "View staff"],
          ["staff.create", "Create staff"],
          ["staff.update", "Update staff"],
          ["staff.role", "Change staff roles"],
          ["staff.password", "Reset staff passwords"]
        ]
      },
      {
        group: "Customer Communication",
        items: [
          ["messages.read", "Read messages"],
          ["messages.view", "View messages"],
          ["messages.reply", "Reply to messages"],
          ["messages.delete", "Delete messages"]
        ]
      },
      {
        group: "Mail",
        items: [
          ["mail.users.view", "View mailbox users"]
        ]
      },
      {
        group: "Profile",
        items: [
          ["profile.view", "View profile"],
          ["profile.update", "Update profile"],
          ["profile.password", "Change password"]
        ]
      },
      {
        group: "Platform Settings",
        items: [
          ["settings.view", "View platform settings"],
          ["settings.update", "Update platform settings"]
        ]
      },
      {
        group: "Developer Access",
        items: [
          ["developer.view", "Access Platform Configuration"]
        ]
      }
    ]
  };

  const ROLE_OPTIONS = [
    "Operations Manager",
    "Dispatcher",
    "Driver",
    "Trunk Driver",
    "Cargo Personnel",
    "Warehouse Personnel",
    "Customer Service",
    "Customer"
  ];

  const state = {
    settings: {},
    users: [],
    selectedUser: null,
    selectedPolicy: null,
    loading: false
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setMessage(message, type) {
    const element = $("#platform-config-message");

    if (!element) {
      return;
    }

    element.textContent = message || "";
    element.hidden = !message;

    element.className =
      "platform-config-message " +
      (type === "error"
        ? "is-error"
        : type === "success"
          ? "is-success"
          : "is-info");
  }

  function setSectionMessage(id, message, type) {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.textContent = message || "";
    element.hidden = !message;

    element.className =
      "platform-config-message " +
      (type === "error"
        ? "is-error"
        : type === "success"
          ? "is-success"
          : "is-info");
  }

  async function api(url, options) {
    const response = await fetch(
      url,
      Object.assign(
        {
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        },
        options || {}
      )
    );

    let data = {};

    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (response.status === 401) {
      if (
        typeof handleAdminSessionExpired ===
        "function"
      ) {
        handleAdminSessionExpired();
      }

      throw new Error("Your session has expired.");
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          "The requested operation could not be completed."
      );
    }

    return data;
  }

  /*
   * ------------------------------------------------------------
   * MOBILE SIDEBAR
   * ------------------------------------------------------------
   */

  function setupMobileSidebar() {
    const toggle = $(
      CONFIG.selectors.sidebarToggle
    );

    const sidebar = $(
      CONFIG.selectors.sidebar
    );

    if (!toggle || !sidebar) {
      return;
    }

    if (
      toggle.dataset.platformConfigBound ===
      "true"
    ) {
      return;
    }

    toggle.dataset.platformConfigBound = "true";

    toggle.addEventListener(
      "click",
      function () {
        sidebar.classList.toggle("is-open");

        toggle.setAttribute(
          "aria-expanded",
          sidebar.classList.contains("is-open")
            ? "true"
            : "false"
        );
      }
    );

    $$(".admin-sidebar a, .admin-sidebar button")
      .forEach(function (item) {
        item.addEventListener(
          "click",
          function () {
            if (window.innerWidth <= 900) {
              sidebar.classList.remove(
                "is-open"
              );

              toggle.setAttribute(
                "aria-expanded",
                "false"
              );
            }
          }
        );
      });
  }

  /*
   * ------------------------------------------------------------
   * TOP ACTIONS
   * ------------------------------------------------------------
   */

  function setupTopActions() {
    const create = $(
      CONFIG.selectors.createParcel
    );

    const update = $(
      CONFIG.selectors.updateParcel
    );

    const dashboard = $(
      CONFIG.selectors.dashboard
    );

    [create, update, dashboard]
      .filter(Boolean)
      .forEach(function (button) {
        button.classList.add(
          "top-action-button"
        );
      });

    $$(
      "[data-bottom-create], .bottom-create-action, .create-action-bottom"
    ).forEach(function (button) {
      button.remove();
    });
  }

  /*
   * ------------------------------------------------------------
   * PLATFORM VIEW
   * ------------------------------------------------------------
   */

  function buildPlatformView() {
    const view = $(
      CONFIG.selectors.developerView
    );

    if (!view) {
      return;
    }

    view.innerHTML = `
      <div class="container platform-config-shell">

        <div class="admin-dashboard-identity">
          <div
            class="admin-dashboard-identity-mark"
            aria-hidden="true"
          >
            <svg viewBox="0 0 48 48" role="img">
              <rect
                x="2.5"
                y="2.5"
                width="43"
                height="43"
                rx="12"
              ></rect>
              <path d="M14 17h20M14 24h20M14 31h12"></path>
              <path d="M10 11h28v26H10z"></path>
            </svg>
          </div>

          <div class="admin-dashboard-identity-copy">
            <span>
              US COURIER • PLATFORM CONFIGURATION
            </span>

            <h1>PLATFORM CONFIGURATION</h1>

            <p>
              Manage the public website, staff access,
              customer communication and business settings.
            </p>
          </div>
        </div>

        <div
          id="platform-config-message"
          class="platform-config-message"
          hidden
        ></div>

        <nav
          class="platform-config-nav"
          aria-label="Platform configuration sections"
        >
          <button
            type="button"
            class="active"
            data-platform-section="website"
          >
            Public Website
          </button>

          <button
            type="button"
            data-platform-section="staff"
          >
            Staff Access
          </button>

          <button
            type="button"
            data-platform-section="communication"
          >
            Customer Communication
          </button>

          <button
            type="button"
            data-platform-section="mail"
          >
            Mail Configuration
          </button>

          <button
            type="button"
            data-platform-section="business"
          >
            Business Settings
          </button>

          <button
            type="button"
            data-platform-section="maintenance"
          >
            Public Maintenance
          </button>
        </nav>

        <section
          class="platform-config-section"
          data-section="website"
        >
          <div class="admin-panel">
            <div class="admin-panel-heading">
              <div>
                <span class="admin-panel-kicker">
                  PUBLIC WEBSITE
                </span>
                <h3>Company & Website</h3>
              </div>

              <button
                type="button"
                class="btn btn-gold"
                data-save-settings
              >
                Save Website Settings
              </button>
            </div>

            <div
              id="platform-website-message"
              hidden
            ></div>

            <div class="platform-config-grid">

              <label>
                <span>Company name</span>
                <input
                  id="pc-company-name"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Company logo URL</span>
                <input
                  id="pc-company-logo"
                  class="form-control"
                  type="url"
                >
              </label>

              <label>
                <span>Contact email</span>
                <input
                  id="pc-contact-email"
                  class="form-control"
                  type="email"
                >
              </label>

              <label>
                <span>Contact phone</span>
                <input
                  id="pc-contact-phone"
                  class="form-control"
                  type="text"
                >
              </label>

              <label class="platform-config-wide">
                <span>Business address</span>
                <input
                  id="pc-contact-address"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Timezone</span>
                <input
                  id="pc-contact-timezone"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Website title</span>
                <input
                  id="pc-website-title"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Website tagline</span>
                <input
                  id="pc-website-tagline"
                  class="form-control"
                  type="text"
                >
              </label>

              <label class="platform-config-wide">
                <span>Public website notice</span>
                <textarea
                  id="pc-website-notice"
                  class="form-control"
                  rows="3"
                ></textarea>
              </label>

              <label>
                <span>Footer copyright</span>
                <input
                  id="pc-footer-copyright"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Footer text</span>
                <input
                  id="pc-footer-text"
                  class="form-control"
                  type="text"
                >
              </label>

            </div>
          </div>
        </section>

        <section
          class="platform-config-section"
          data-section="staff"
          hidden
        >
          <div class="platform-staff-layout">

            <div class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <span class="admin-panel-kicker">
                    STAFF ACCOUNTS
                  </span>
                  <h3>Staff Access</h3>
                </div>

                <button
                  type="button"
                  class="btn btn-secondary"
                  id="pc-refresh-users"
                >
                  Refresh
                </button>
              </div>

              <div
                id="pc-staff-message"
                hidden
              ></div>

              <div
                id="pc-staff-list"
                class="platform-staff-list"
              >
                Loading staff...
              </div>
            </div>

            <div class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <span class="admin-panel-kicker">
                    ACCESS POLICY
                  </span>
                  <h3 id="pc-selected-staff">
                    Select a staff member
                  </h3>
                </div>
              </div>

              <div
                id="pc-policy-editor"
              >
                <p class="platform-config-muted">
                  Select a staff account to configure
                  explicit access.
                </p>
              </div>
            </div>

          </div>
        </section>

        <section
          class="platform-config-section"
          data-section="communication"
          hidden
        >
          <div class="admin-panel">
            <div class="admin-panel-heading">
              <div>
                <span class="admin-panel-kicker">
                  CUSTOMER COMMUNICATION
                </span>
                <h3>Communication Settings</h3>
              </div>

              <button
                type="button"
                class="btn btn-gold"
                data-save-settings
              >
                Save Communication Settings
              </button>
            </div>

            <div
              id="platform-communication-message"
              hidden
            ></div>

            <div class="platform-config-toggle-list">

              <label class="platform-toggle">
                <input
                  id="pc-notifications-enabled"
                  type="checkbox"
                >
                <span>
                  <strong>Customer notifications</strong>
                  <small>
                    Enable customer-facing notification functionality.
                  </small>
                </span>
              </label>

              <label class="platform-toggle">
                <input
                  id="pc-contact-enabled"
                  type="checkbox"
                >
                <span>
                  <strong>Customer contact form</strong>
                  <small>
                    Enable the public customer contact channel.
                  </small>
                </span>
              </label>

            </div>
          </div>
        </section>

        <section
          class="platform-config-section"
          data-section="mail"
          hidden
        >
          <div class="admin-panel">
            <div class="admin-panel-heading">
              <div>
                <span class="admin-panel-kicker">
                  MAIL CONFIGURATION
                </span>
                <h3>Business Mail Access</h3>
              </div>
            </div>

            <p class="platform-config-muted">
              Mail infrastructure remains protected by the
              existing authentication and server-side authorization.
              Mail permissions can be assigned to staff below.
            </p>

            <div class="platform-mail-summary">

              <article>
                <strong>Mailbox access</strong>
                <span>
                  Controlled by staff access policies.
                </span>
              </article>

              <article>
                <strong>Customer communication</strong>
                <span>
                  Use the Customer Communication settings
                  for public notification controls.
                </span>
              </article>

              <article>
                <strong>Security</strong>
                <span>
                  Resend keys, webhook secrets and mailbox
                  credentials are never displayed here.
                </span>
              </article>

            </div>

            <div class="platform-config-notice">
              <strong>Protected infrastructure</strong>
              <p>
                Sending, receiving, attachments and mailbox
                authorization continue to use the existing
                production mail backend.
              </p>
            </div>
          </div>
        </section>

        <section
          class="platform-config-section"
          data-section="business"
          hidden
        >
          <div class="admin-panel">
            <div class="admin-panel-heading">
              <div>
                <span class="admin-panel-kicker">
                  BUSINESS SETTINGS
                </span>
                <h3>Tracking, Shipment, Receipt & QR</h3>
              </div>

              <button
                type="button"
                class="btn btn-gold"
                data-save-settings
              >
                Save Business Settings
              </button>
            </div>

            <div
              id="platform-business-message"
              hidden
            ></div>

            <div class="platform-config-grid">

              <label>
                <span>Tracking prefix</span>
                <input
                  id="pc-tracking-prefix"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Tracking message</span>
                <input
                  id="pc-tracking-message"
                  class="form-control"
                  type="text"
                >
              </label>

              <label class="platform-toggle">
                <input
                  id="pc-tracking-details"
                  type="checkbox"
                >
                <span>
                  <strong>Show tracking details</strong>
                  <small>
                    Allow detailed tracking information.
                  </small>
                </span>
              </label>

              <label>
                <span>Default service</span>
                <input
                  id="pc-default-service"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Default priority</span>
                <input
                  id="pc-default-priority"
                  class="form-control"
                  type="text"
                >
              </label>

              <label class="platform-config-wide">
                <span>Shipment statuses</span>
                <textarea
                  id="pc-shipment-statuses"
                  class="form-control"
                  rows="6"
                  placeholder="One status per line"
                ></textarea>
              </label>

              <label>
                <span>Receipt title</span>
                <input
                  id="pc-receipt-title"
                  class="form-control"
                  type="text"
                >
              </label>

              <label>
                <span>Receipt footer</span>
                <input
                  id="pc-receipt-footer"
                  class="form-control"
                  type="text"
                >
              </label>

              <label class="platform-toggle">
                <input
                  id="pc-receipt-enabled"
                  type="checkbox"
                >
                <span>
                  <strong>Receipts enabled</strong>
                </span>
              </label>

              <label class="platform-toggle">
                <input
                  id="pc-qr-enabled"
                  type="checkbox"
                >
                <span>
                  <strong>QR functionality enabled</strong>
                </span>
              </label>

            </div>
          </div>
        </section>

        <section
          class="platform-config-section"
          data-section="maintenance"
          hidden
        >
          <div class="admin-panel">
            <div class="admin-panel-heading">
              <div>
                <span class="admin-panel-kicker">
                  PUBLIC MAINTENANCE
                </span>
                <h3>Website Availability</h3>
              </div>

              <button
                type="button"
                class="btn btn-gold"
                data-save-settings
              >
                Save Maintenance Settings
              </button>
            </div>

            <div
              id="platform-maintenance-message"
              hidden
            ></div>

            <label class="platform-toggle">
              <input
                id="pc-maintenance-enabled"
                type="checkbox"
              >
              <span>
                <strong>Maintenance mode</strong>
                <small>
                  Controls the existing public maintenance setting.
                </small>
              </span>
            </label>

            <label
              style="display:block; margin-top:1rem;"
            >
              <span>Public maintenance message</span>
              <textarea
                id="pc-maintenance-message"
                class="form-control"
                rows="4"
                placeholder="The website is temporarily unavailable. Please check back later."
              ></textarea>
            </label>
          </div>
        </section>

      </div>
    `;

    addPlatformStyles();
  }

  /*
   * ------------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------------
   */

  function value(id) {
    const element = document.getElementById(id);

    if (!element) {
      return "";
    }

    if (element.type === "checkbox") {
      return element.checked;
    }

    return String(element.value || "").trim();
  }

  function setValue(id, input) {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    if (element.type === "checkbox") {
      element.checked = Boolean(input);
    } else {
      element.value =
        input == null ? "" : String(input);
    }
  }

  function populateSettings(settings) {
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

    setValue(
      "pc-company-name",
      company.name
    );

    setValue(
      "pc-company-logo",
      company.logo
    );

    setValue(
      "pc-contact-email",
      contact.email
    );

    setValue(
      "pc-contact-phone",
      contact.phone
    );

    setValue(
      "pc-contact-address",
      contact.address
    );

    setValue(
      "pc-contact-timezone",
      contact.timezone
    );

    setValue(
      "pc-website-title",
      website.title
    );

    setValue(
      "pc-website-tagline",
      website.tagline
    );

    setValue(
      "pc-website-notice",
      website.notice
    );

    setValue(
      "pc-footer-copyright",
      footer.copyright
    );

    setValue(
      "pc-footer-text",
      footer.text
    );

    setValue(
      "pc-tracking-prefix",
      tracking.prefix
    );

    setValue(
      "pc-tracking-message",
      tracking.message
    );

    setValue(
      "pc-tracking-details",
      tracking.show_details
    );

    setValue(
      "pc-default-service",
      shipment.default_service
    );

    setValue(
      "pc-default-priority",
      shipment.default_priority ||
        "Standard"
    );

    setValue(
      "pc-shipment-statuses",
      Array.isArray(shipment.statuses)
        ? shipment.statuses.join("\n")
        : ""
    );

    setValue(
      "pc-receipt-title",
      receipt.title
    );

    setValue(
      "pc-receipt-footer",
      receipt.footer
    );

    setValue(
      "pc-receipt-enabled",
      receipt.enabled
    );

    setValue(
      "pc-qr-enabled",
      qr.enabled
    );

    setValue(
      "pc-notifications-enabled",
      notifications.enabled
    );

    setValue(
      "pc-contact-enabled",
      notifications.contact_form
    );

    setValue(
      "pc-maintenance-enabled",
      maintenance.enabled
    );

    setValue(
      "pc-maintenance-message",
      maintenance.message
    );
  }

  async function loadSettings() {
    const data = await api(
      CONFIG.settingsEndpoint
    );

    state.settings =
      data.settings || {};

    populateSettings(
      state.settings
    );
  }

  function buildSettingsPatch() {
    const current =
      state.settings || {};

    const statuses =
      value("pc-shipment-statuses")
        .split("\n")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);

    return {
      company: Object.assign(
        {},
        current.company || {},
        {
          name: value("pc-company-name"),
          logo: value("pc-company-logo")
        }
      ),

      contact: Object.assign(
        {},
        current.contact || {},
        {
          email: value("pc-contact-email"),
          phone: value("pc-contact-phone"),
          address: value("pc-contact-address"),
          timezone: value("pc-contact-timezone")
        }
      ),

      website: Object.assign(
        {},
        current.website || {},
        {
          title: value("pc-website-title"),
          tagline: value("pc-website-tagline"),
          notice: value("pc-website-notice")
        }
      ),

      footer: Object.assign(
        {},
        current.footer || {},
        {
          copyright:
            value("pc-footer-copyright"),
          text:
            value("pc-footer-text")
        }
      ),

      tracking: Object.assign(
        {},
        current.tracking || {},
        {
          prefix:
            value("pc-tracking-prefix"),
          message:
            value("pc-tracking-message"),
          show_details:
            value("pc-tracking-details")
        }
      ),

      shipment: Object.assign(
        {},
        current.shipment || {},
        {
          default_service:
            value("pc-default-service"),
          default_priority:
            value("pc-default-priority"),
          statuses
        }
      ),

      receipt: Object.assign(
        {},
        current.receipt || {},
        {
          title:
            value("pc-receipt-title"),
          footer:
            value("pc-receipt-footer"),
          enabled:
            value("pc-receipt-enabled")
        }
      ),

      qr: Object.assign(
        {},
        current.qr || {},
        {
          enabled:
            value("pc-qr-enabled")
        }
      ),

      notifications: Object.assign(
        {},
        current.notifications || {},
        {
          enabled:
            value("pc-notifications-enabled"),
          contact_form:
            value("pc-contact-enabled")
        }
      ),

      maintenance: Object.assign(
        {},
        current.maintenance || {},
        {
          enabled:
            value("pc-maintenance-enabled"),
          message:
            value("pc-maintenance-message")
        }
      )
    };
  }

  async function saveSettings() {
    if (
      typeof adminActionAllowed ===
        "function" &&
      !adminActionAllowed(
        "settings.update"
      )
    ) {
      throw new Error(
        "You do not have permission to update platform settings."
      );
    }

    const settings =
      buildSettingsPatch();

    const data = await api(
      CONFIG.settingsEndpoint,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json"
        },
        body: JSON.stringify({
          settings
        })
      }
    );

    state.settings = Object.assign(
      {},
      state.settings,
      settings
    );

    populateSettings(
      state.settings
    );

    setMessage(
      data.message ||
        "Platform settings saved successfully.",
      "success"
    );
  }

  /*
   * ------------------------------------------------------------
   * STAFF
   * ------------------------------------------------------------
   */

  async function loadUsers() {
    const data = await api(
      CONFIG.usersEndpoint
    );

    state.users =
      Array.isArray(data.users)
        ? data.users
        : [];

    renderStaffList();
  }

  function renderStaffList() {
    const container =
      $("#pc-staff-list");

    if (!container) {
      return;
    }

    const staff =
      state.users.filter(function (user) {
        return (
          String(user.role || "")
            .toLowerCase() !==
          "super admin"
        );
      });

    if (!staff.length) {
      container.innerHTML =
        '<p class="platform-config-muted">No staff accounts available.</p>';

      return;
    }

    container.innerHTML =
      staff
        .map(function (user) {
          const selected =
            state.selectedUser &&
            Number(state.selectedUser.id) ===
              Number(user.id);

          return `
            <button
              type="button"
              class="platform-staff-item ${
                selected ? "active" : ""
              }"
              data-staff-id="${escapeHtml(user.id)}"
            >
              <strong>
                ${escapeHtml(user.name || "Unnamed")}
              </strong>

              <span>
                ${escapeHtml(user.email || "")}
              </span>

              <small>
                ${escapeHtml(user.role || "No role")}
              </small>
            </button>
          `;
        })
        .join("");

    $$(".platform-staff-item", container)
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            selectStaff(
              Number(button.dataset.staffId)
            );
          }
        );
      });
  }

  async function selectStaff(userId) {
    const user =
      state.users.find(function (item) {
        return (
          Number(item.id) ===
          Number(userId)
        );
      });

    if (!user) {
      return;
    }

    state.selectedUser = user;

    renderStaffList();

    const heading =
      $("#pc-selected-staff");

    if (heading) {
      heading.textContent =
        user.name ||
        user.email ||
        "Staff member";
    }

    const editor =
      $("#pc-policy-editor");

    if (editor) {
      editor.innerHTML =
        '<p class="platform-config-muted">Loading access policy...</p>';
    }

    try {
      const data = await api(
        CONFIG.accessPolicyEndpoint(
          userId
        )
      );

      state.selectedPolicy =
        data.policy || {
          access_approved: false,
          parcel_scope: "none",
          permissions: {},
          dashboard_access: {}
        };

      renderPolicyEditor();
    } catch (error) {
      if (editor) {
        editor.innerHTML =
          '<p class="platform-config-error">' +
          escapeHtml(error.message) +
          "</p>";
      }
    }
  }

  function renderPolicyEditor() {
    const editor =
      $("#pc-policy-editor");

    const user =
      state.selectedUser;

    const policy =
      state.selectedPolicy || {};

    if (!editor || !user) {
      return;
    }

    const permissions =
      policy.permissions || {};

    const permissionGroups =
      CONFIG.permissions
        .map(function (group) {
          return `
            <div class="platform-permission-group">
              <h4>
                ${escapeHtml(group.group)}
              </h4>

              <div class="platform-permission-grid">
                ${group.items
                  .map(function (item) {
                    const key =
                      item[0];

                    const label =
                      item[1];

                    return `
                      <label class="platform-toggle">
                        <input
                          type="checkbox"
                          data-policy-permission="${escapeHtml(key)}"
                          ${
                            permissions[key] ===
                            true
                              ? "checked"
                              : ""
                          }
                        >

                        <span>
                          <strong>
                            ${escapeHtml(label)}
                          </strong>

                          <small>
                            ${escapeHtml(key)}
                          </small>
                        </span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("");

    editor.innerHTML = `
      <div class="platform-staff-profile">

        <div class="platform-staff-profile-card">
          <strong>
            ${escapeHtml(user.name || "Unnamed")}
          </strong>

          <span>
            ${escapeHtml(user.email || "")}
          </span>

          <small>
            Current role:
            ${escapeHtml(user.role || "None")}
          </small>
        </div>

        <label class="platform-toggle">
          <input
            id="pc-policy-approved"
            type="checkbox"
            ${
              policy.access_approved ===
              true
                ? "checked"
                : ""
            }
          >

          <span>
            <strong>Access approved</strong>
            <small>
              Staff access remains denied until explicitly approved.
            </small>
          </span>
        </label>

        <label
          style="display:block; margin-top:1rem;"
        >
          <span>Parcel scope</span>

          <select
            id="pc-policy-scope"
            class="form-control"
          >
            <option
              value="none"
              ${
                policy.parcel_scope ===
                "none"
                  ? "selected"
                  : ""
              }
            >
              No parcel access
            </option>

            <option
              value="own"
              ${
                policy.parcel_scope ===
                "own"
                  ? "selected"
                  : ""
              }
            >
              Own parcels only
            </option>

            <option
              value="all"
              ${
                policy.parcel_scope ===
                "all"
                  ? "selected"
                  : ""
              }
            >
              All permitted parcels
            </option>
          </select>
        </label>

        <div
          class="platform-permissions"
          style="margin-top:1.25rem;"
        >
          ${permissionGroups}
        </div>

        <button
          type="button"
          class="btn btn-gold"
          id="pc-save-policy"
          style="margin-top:1.5rem;"
        >
          Save Staff Access
        </button>

        <div
          id="pc-policy-message"
          hidden
          style="margin-top:1rem;"
        ></div>

      </div>
    `;

    const saveButton =
      $("#pc-save-policy");

    if (saveButton) {
      saveButton.addEventListener(
        "click",
        saveSelectedPolicy
      );
    }
  }

  async function saveSelectedPolicy() {
    const user =
      state.selectedUser;

    if (!user) {
      return;
    }

    const approved =
      $("#pc-policy-approved");

    const scope =
      $("#pc-policy-scope");

    const permissions = {};

    $$(
      "[data-policy-permission]"
    ).forEach(function (input) {
      permissions[
        input.dataset.policyPermission
      ] = input.checked;
    });

    try {
      const data = await api(
        CONFIG.accessPolicyEndpoint(
          user.id
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },
          body: JSON.stringify({
            access_approved:
              Boolean(
                approved &&
                  approved.checked
              ),

            parcel_scope:
              scope
                ? scope.value
                : "none",

            permissions
          })
        }
      );

      state.selectedPolicy =
        data.policy ||
        state.selectedPolicy;

      setSectionMessage(
        "pc-policy-message",
        "Staff access policy saved successfully.",
        "success"
      );

      setMessage(
        "Staff access updated successfully.",
        "success"
      );
    } catch (error) {
      setSectionMessage(
        "pc-policy-message",
        error.message,
        "error"
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * NAVIGATION
   * ------------------------------------------------------------
   */

  function setupConfigurationNavigation() {
    $$(
      "[data-platform-section]"
    ).forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          const section =
            button.dataset.platformSection;

          $$(".platform-config-section")
            .forEach(function (element) {
              element.hidden =
                element.dataset.section !==
                section;
            });

          $$(
            ".platform-config-nav [data-platform-section]"
          ).forEach(function (item) {
            item.classList.toggle(
              "active",
              item.dataset.platformSection ===
                section
            );
          });
        }
      );
    });
  }

  /*
   * ------------------------------------------------------------
   * INITIALIZATION
   * ------------------------------------------------------------
   */

  async function initPlatformConfiguration() {
    const view =
      $(CONFIG.selectors.developerView);

    if (!view) {
      return;
    }

    if (
      typeof adminActionAllowed ===
        "function" &&
      !adminActionAllowed(
        "developer.view"
      )
    ) {
      return;
    }

    buildPlatformView();

    setupConfigurationNavigation();

    try {
      await loadSettings();
    } catch (error) {
      setMessage(
        error.message,
        "error"
      );
    }

    try {
      await loadUsers();
    } catch (error) {
      setSectionMessage(
        "pc-staff-message",
        error.message,
        "error"
      );
    }

    const saveButtons =
      $$("[data-save-settings]");

    saveButtons.forEach(
      function (button) {
        button.addEventListener(
          "click",
          async function () {
            try {
              button.disabled = true;
              button.textContent =
                "Saving...";

              await saveSettings();
            } catch (error) {
              setMessage(
                error.message,
                "error"
              );
            } finally {
              button.disabled = false;
              button.textContent =
                "Save Settings";
            }
          }
        );
      }
    );

    const refreshUsers =
      $("#pc-refresh-users");

    if (refreshUsers) {
      refreshUsers.addEventListener(
        "click",
        async function () {
          try {
            refreshUsers.disabled =
              true;

            await loadUsers();

            setSectionMessage(
              "pc-staff-message",
              "Staff list refreshed.",
              "success"
            );
          } catch (error) {
            setSectionMessage(
              "pc-staff-message",
              error.message,
              "error"
            );
          } finally {
            refreshUsers.disabled =
              false;
          }
        }
      );
    }
  }

  /*
   * The old admin.js exposes initDeveloperConsole().
   * Replace only the frontend entry point so the old visible
   * database/environment/deployment UI is not initialized.
   *
   * Existing backend infrastructure is intentionally untouched.
   */
  window.initDeveloperConsole =
    async function () {
      await initPlatformConfiguration();
    };

  /*
   * Existing public helpers retained for other UI code.
   */
  window.USCourierPlatformConfig = {
    loadStaffAccessPolicy:
      async function (userId) {
        const data = await api(
          CONFIG.accessPolicyEndpoint(
            userId
          )
        );

        return data;
      },

    saveStaffAccessPolicy:
      async function (
        userId,
        policy
      ) {
        const data = await api(
          CONFIG.accessPolicyEndpoint(
            userId
          ),
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json"
            },
            body: JSON.stringify(
              policy || {}
            )
          }
        );

        return data;
      }
  };

  /*
   * ------------------------------------------------------------
   * VISUAL HELPERS
   * ------------------------------------------------------------
   */

  function addPlatformStyles() {
    if (
      document.getElementById(
        "uscourier-platform-config-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "uscourier-platform-config-styles";

    style.textContent = `
      .platform-config-shell {
        max-width: 1400px;
      }

      .platform-config-nav {
        display: flex;
        flex-wrap: wrap;
        gap: .55rem;
        margin-bottom: 1.25rem;
      }

      .platform-config-nav button {
        border: 1px solid rgba(23,59,118,.14);
        background: #fff;
        color: #172033;
        border-radius: 10px;
        padding: .7rem .9rem;
        cursor: pointer;
        font-weight: 700;
      }

      .platform-config-nav button.active {
        background: #173b76;
        color: #fff;
        border-color: #173b76;
      }

      .platform-config-message {
        padding: .85rem 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        font-size: .92rem;
      }

      .platform-config-message.is-success {
        background: #eaf8ef;
        color: #176b38;
      }

      .platform-config-message.is-error {
        background: #fff0f0;
        color: #9d2020;
      }

      .platform-config-message.is-info {
        background: #eef4ff;
        color: #214b8f;
      }

      .platform-config-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .platform-config-grid label,
      .platform-staff-profile > label {
        display: block;
      }

      .platform-config-grid label > span,
      .platform-staff-profile > label > span {
        display: block;
        margin-bottom: .4rem;
        font-weight: 700;
      }

      .platform-config-wide {
        grid-column: 1 / -1;
      }

      .platform-config-muted {
        color: var(--text-muted, #718096);
      }

      .platform-config-error {
        color: #a02020;
      }

      .platform-staff-layout {
        display: grid;
        grid-template-columns:
          minmax(260px, .75fr)
          minmax(0, 1.6fr);
        gap: 1.25rem;
      }

      .platform-staff-list {
        display: grid;
        gap: .5rem;
      }

      .platform-staff-item {
        text-align: left;
        border: 1px solid rgba(23,59,118,.12);
        background: #fff;
        border-radius: 10px;
        padding: .8rem;
        cursor: pointer;
      }

      .platform-staff-item.active {
        border-color: #173b76;
        box-shadow: 0 0 0 2px rgba(23,59,118,.08);
      }

      .platform-staff-item strong,
      .platform-staff-item span,
      .platform-staff-item small {
        display: block;
      }

      .platform-staff-item span,
      .platform-staff-item small {
        margin-top: .2rem;
        color: var(--text-muted, #718096);
      }

      .platform-staff-profile-card {
        display: grid;
        gap: .25rem;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 10px;
        background: #f5f7fb;
      }

      .platform-staff-profile-card span,
      .platform-staff-profile-card small {
        color: var(--text-muted, #718096);
      }

      .platform-permission-group {
        margin-top: 1.25rem;
      }

      .platform-permission-group h4 {
        margin-bottom: .7rem;
      }

      .platform-permission-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: .55rem;
      }

      .platform-toggle {
        display: flex;
        gap: .75rem;
        align-items: flex-start;
        padding: .75rem;
        border: 1px solid rgba(23,59,118,.10);
        border-radius: 10px;
        background: #fff;
      }

      .platform-toggle input {
        margin-top: .2rem;
        flex: 0 0 auto;
      }

      .platform-toggle strong,
      .platform-toggle small {
        display: block;
      }

      .platform-toggle small {
        color: var(--text-muted, #718096);
        margin-top: .2rem;
      }

      .platform-mail-summary {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }

      .platform-mail-summary article {
        border: 1px solid rgba(23,59,118,.10);
        border-radius: 10px;
        padding: 1rem;
      }

      .platform-mail-summary strong,
      .platform-mail-summary span {
        display: block;
      }

      .platform-mail-summary span {
        margin-top: .35rem;
        color: var(--text-muted, #718096);
      }

      .platform-config-notice {
        margin-top: 1.25rem;
        padding: 1rem;
        border-radius: 10px;
        background: #f5f7fb;
      }

      .platform-config-notice p {
        margin-bottom: 0;
        color: var(--text-muted, #718096);
      }

      @media (max-width: 900px) {
        .platform-config-grid,
        .platform-staff-layout,
        .platform-mail-summary,
        .platform-permission-grid {
          grid-template-columns: 1fr;
        }

        .platform-config-wide {
          grid-column: auto;
        }

        .platform-config-nav {
          overflow-x: auto;
          flex-wrap: nowrap;
          padding-bottom: .35rem;
        }

        .platform-config-nav button {
          white-space: nowrap;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /*
   * ------------------------------------------------------------
   * STARTUP
   * ------------------------------------------------------------
   */

  function startup() {
    setupMobileSidebar();
    setupTopActions();

    /*
     * The developer view is initialized by the existing
     * admin dashboard navigation. We intentionally do not
     * invoke the old infrastructure controller.
     */
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startup
    );
  } else {
    startup();
  }
})();
