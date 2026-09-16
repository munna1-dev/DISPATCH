"use strict";

const https = require("https");

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "US COURIER <contact@uscourier.app>";

const ADMIN_EMAIL =
  process.env.RESEND_ADMIN_EMAIL ||
  "admin@uscourier.app";

const REPLY_TO =
  process.env.RESEND_REPLY_TO ||
  ADMIN_EMAIL;

const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL ||
  "https://uscourier.app";

const RESEND_API_KEY =
  process.env.RESEND_API_KEY;

/* =========================================================
   HTML HELPERS
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailLayout(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#160e0a;
  color:#f8f4f0;
  font-family:Arial,Helvetica,sans-serif;
">

  <div style="
    max-width:680px;
    margin:40px auto;
    padding:24px;
  ">

    <div style="
      background:#24130e;
      border:1px solid #3a241a;
      border-radius:16px;
      padding:30px;
    ">

      <div style="
        font-size:24px;
        font-weight:700;
        color:#e8a87c;
        margin-bottom:24px;
      ">
        US COURIER
      </div>

      ${content}

      <div style="
        margin-top:32px;
        padding-top:20px;
        border-top:1px solid #3a241a;
        color:#b8aaa2;
        font-size:13px;
      ">
        US COURIER<br>
        <a
          href="${escapeHtml(PUBLIC_APP_URL)}"
          style="color:#e8a87c;"
        >
          ${escapeHtml(PUBLIC_APP_URL)}
        </a>
      </div>

    </div>

  </div>

</body>
</html>
`;
}

/* =========================================================
   RESEND HTTPS TRANSPORT
========================================================= */

function sendEmail({
  to,
  subject,
  html,
  replyTo = REPLY_TO
}) {
  return new Promise((resolve, reject) => {
    if (!RESEND_API_KEY) {
      return reject(
        new Error(
          "RESEND_API_KEY is not configured."
        )
      );
    }

    if (!to) {
      return reject(
        new Error(
          "Recipient email address is required."
        )
      );
    }

    const recipients =
      Array.isArray(to) ? to : [to];

    const payload = {
      from: FROM_EMAIL,
      to: recipients,
      subject,
      html,
      reply_to: replyTo
    };

    const body =
      JSON.stringify(payload);

    const request =
      https.request(
        {
          hostname: "api.resend.com",
          family: 4,
          port: 443,
          path: "/emails",
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${RESEND_API_KEY}`,

            "Content-Type":
              "application/json",

            "Content-Length":
              Buffer.byteLength(body)
          },

          /*
           * Force TLS SNI to the actual
           * Resend hostname.
           */
          servername:
            "api.resend.com"
        },

        (response) => {
          let responseBody = "";

          response.on(
            "data",
            (chunk) => {
              responseBody +=
                chunk.toString();
            }
          );

          response.on(
            "end",
            () => {
              let parsed;

              try {
                parsed =
                  responseBody
                    ? JSON.parse(
                        responseBody
                      )
                    : {};
              } catch {
                parsed = {
                  raw: responseBody
                };
              }

              if (
                response.statusCode >=
                  200 &&
                response.statusCode < 300
              ) {
                return resolve(
                  parsed
                );
              }

              const errorMessage =
                parsed?.message ||
                parsed?.error?.message ||
                `Resend returned HTTP ${response.statusCode}`;

              return reject(
                new Error(
                  errorMessage
                )
              );
            }
          );
        }
      );

    request.setTimeout(
      15000,
      () => {
        request.destroy(
          new Error(
            "Resend request timed out after 15 seconds."
          )
        );
      }
    );

    request.on(
      "error",
      (error) => {
        reject(error);
      }
    );

    request.write(body);
    request.end();
  });
}

/* =========================================================
   SHIPMENT EMAILS
========================================================= */

async function sendShipmentCreated({
  recipientEmail,
  recipientName,
  trackingNumber,
  destination
}) {
  const html =
    emailLayout(
      "Shipment Created",
      `
      <h1>Shipment Created</h1>

      <p>
        Hello ${escapeHtml(
          recipientName || "Customer"
        )},
      </p>

      <p>
        Your shipment has been successfully
        registered with US COURIER.
      </p>

      <div style="
        background:#160e0a;
        padding:18px;
        border-radius:12px;
        margin:20px 0;
      ">
        <strong>Tracking Number</strong><br>
        <span style="
          color:#e8a87c;
          font-size:20px;
        ">
          ${escapeHtml(
            trackingNumber
          )}
        </span>
      </div>

      <p>
        Destination:
        ${escapeHtml(
          destination || "N/A"
        )}
      </p>
      `
    );

  return sendEmail({
    to: recipientEmail,
    subject:
      `Shipment Created - ${trackingNumber}`,
    html
  });
}

async function sendShipmentStatusUpdated({
  recipientEmail,
  recipientName,
  trackingNumber,
  status,
  location
}) {
  const html =
    emailLayout(
      "Shipment Status Updated",
      `
      <h1>Shipment Status Updated</h1>

      <p>
        Hello ${escapeHtml(
          recipientName || "Customer"
        )},
      </p>

      <p>
        Your shipment status has been updated.
      </p>

      <div style="
        background:#160e0a;
        padding:18px;
        border-radius:12px;
      ">
        <strong>Tracking Number</strong><br>
        ${escapeHtml(
          trackingNumber
        )}

        <br><br>

        <strong>Status</strong><br>
        ${escapeHtml(status)}

        <br><br>

        <strong>Location</strong><br>
        ${escapeHtml(
          location || "N/A"
        )}
      </div>
      `
    );

  return sendEmail({
    to: recipientEmail,
    subject:
      `Shipment Update - ${trackingNumber}`,
    html
  });
}

async function sendShipmentInTransit({
  recipientEmail,
  recipientName,
  trackingNumber,
  location
}) {
  return sendShipmentStatusUpdated({
    recipientEmail,
    recipientName,
    trackingNumber,
    status: "In Transit",
    location
  });
}

async function sendShipmentDelivered({
  recipientEmail,
  recipientName,
  trackingNumber,
  location
}) {
  return sendShipmentStatusUpdated({
    recipientEmail,
    recipientName,
    trackingNumber,
    status: "Delivered",
    location
  });
}

/* =========================================================
   CONTACT MESSAGE
========================================================= */

async function sendContactNotification({
  senderName,
  email,
  subject,
  message
}) {
  const html =
    emailLayout(
      "New Customer Message",
      `
      <h1>New Customer Message</h1>

      <p>
        A customer has submitted a new
        message through the US COURIER website.
      </p>

      <div style="
        background:#160e0a;
        padding:18px;
        border-radius:12px;
        margin:20px 0;
      ">
        <strong>Name</strong><br>
        ${escapeHtml(senderName)}

        <br><br>

        <strong>Email</strong><br>
        ${escapeHtml(email)}

        <br><br>

        <strong>Subject</strong><br>
        ${escapeHtml(subject)}
      </div>

      <div style="
        background:#160e0a;
        padding:18px;
        border-radius:12px;
        white-space:pre-wrap;
        line-height:1.6;
      ">
        ${escapeHtml(message)}
      </div>
      `
    );

  return sendEmail({
    to: ADMIN_EMAIL,
    subject:
      `US COURIER Contact: ${subject}`,
    html,
    replyTo: email
  });
}

/* =========================================================
   CUSTOMER REPLY
========================================================= */

async function sendContactReply({
  recipientEmail,
  recipientName,
  subject,
  message
}) {
  const html =
    emailLayout(
      "US COURIER Support Reply",
      `
      <h1>US COURIER Support</h1>

      <p>
        Hello ${escapeHtml(
          recipientName || "Customer"
        )},
      </p>

      <div style="
        background:#160e0a;
        border-radius:12px;
        padding:18px;
        margin:20px 0;
        white-space:pre-wrap;
        line-height:1.6;
      ">
        ${escapeHtml(message)}
      </div>

      <p>
        Regards,<br>
        <strong>
          US COURIER Support Team
        </strong>
      </p>
      `
    );

  return sendEmail({
    to: recipientEmail,
    subject:
      subject ||
      "US COURIER Support",
    html,
    replyTo: REPLY_TO
  });
}

/* =========================================================
   PASSWORD RESET
========================================================= */

async function sendPasswordReset({
  recipientEmail,
  recipientName,
  resetUrl
}) {
  const html =
    emailLayout(
      "Password Reset",
      `
      <h1>Password Reset</h1>

      <p>
        Hello ${escapeHtml(
          recipientName || "Admin"
        )},
      </p>

      <p>
        A password reset was requested
        for your US COURIER account.
      </p>

      <p>
        <a
          href="${escapeHtml(
            resetUrl
          )}"
          style="
            display:inline-block;
            padding:12px 20px;
            background:#e8a87c;
            color:#24130e;
            text-decoration:none;
            border-radius:8px;
            font-weight:700;
          "
        >
          Reset Password
        </a>
      </p>
      `
    );

  return sendEmail({
    to: recipientEmail,
    subject:
      "US COURIER Password Reset",
    html
  });
}

/* =========================================================
   ADMIN LOGIN ALERT
========================================================= */

async function sendAdminLoginAlert({
  email,
  ipAddress
}) {
  const html =
    emailLayout(
      "Admin Login Alert",
      `
      <h1>Admin Login Alert</h1>

      <p>
        An administrator successfully
        signed in to the US COURIER
        management portal.
      </p>

      <div style="
        background:#160e0a;
        padding:18px;
        border-radius:12px;
      ">
        <strong>Account</strong><br>
        ${escapeHtml(email)}

        <br><br>

        <strong>IP Address</strong><br>
        ${escapeHtml(
          ipAddress || "Unavailable"
        )}

        <br><br>

        <strong>Time</strong><br>
        ${escapeHtml(
          new Date().toISOString()
        )}
      </div>
      `
    );

  return sendEmail({
    to: ADMIN_EMAIL,
    subject:
      "US COURIER Admin Login Alert",
    html
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  sendEmail,
  sendShipmentCreated,
  sendShipmentStatusUpdated,
  sendShipmentInTransit,
  sendShipmentDelivered,
  sendContactNotification,
  sendContactReply,
  sendPasswordReset,
  sendAdminLoginAlert
};
