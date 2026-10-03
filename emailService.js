"use strict";

const https = require("https");

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "US COURIER MAILBOX <support@uscourier.app>";

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
  const safeTitle = escapeHtml(title);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeTitle} | US COURIER</title>
</head>

<body style="
  margin:0;
  padding:0;
  width:100%;
  background:#f3f6fa;
  color:#172033;
  font-family:Arial,Helvetica,sans-serif;
">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="width:100%;margin:0;padding:28px 12px;background:#f3f6fa;">
    <tr>
      <td align="center">

        <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0"
          style="
            width:100%;
            max-width:680px;
            background:#ffffff;
            border:1px solid #dfe5ee;
            border-radius:14px;
            overflow:hidden;
          ">

          <!-- HEADER -->
          <tr>
            <td style="
              padding:22px 28px;
              background:#111827;
              border-bottom:4px solid #D4AF37;
            ">

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="52" valign="middle">

                    <!-- USCOURIER brand logo -->
                    <img
                      src="${escapeHtml(PUBLIC_APP_URL)}/assets/brand/uscourier-icon.svg"
                      width="46"
                      height="46"
                      alt="USCOURIER"
                      style="
                        display:block;
                        width:46px;
                        height:46px;
                        border:0;
                      "
                    />

                  </td>

                  <td valign="middle" style="padding-left:12px;">
                    <div style="
                      color:#ffffff;
                      font-size:18px;
                      line-height:22px;
                      font-weight:900;
                      letter-spacing:2px;
                    ">
                      US COURIER
                    </div>

                    <div style="
                      color:#D4AF37;
                      font-size:9px;
                      line-height:14px;
                      font-weight:800;
                      letter-spacing:2px;
                    ">
                      LOGISTICS &amp; DELIVERY
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- TITLE -->
          <tr>
            <td style="padding:30px 30px 8px 30px;">

              <div style="
                color:#173b76;
                font-size:26px;
                line-height:34px;
                font-weight:800;
              ">
                ${safeTitle}
              </div>

              <div style="
                width:48px;
                height:3px;
                margin-top:12px;
                background:#D4AF37;
              "></div>

            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="
              padding:12px 30px 30px 30px;
              color:#34445d;
              font-size:15px;
              line-height:1.7;
            ">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              padding:22px 30px;
              background:#f7f9fc;
              border-top:1px solid #e3e8ef;
            ">

              <div style="
                color:#173b76;
                font-size:14px;
                line-height:20px;
                font-weight:800;
              ">
                US COURIER
              </div>

              <div style="
                margin-top:4px;
                color:#68778c;
                font-size:12px;
                line-height:18px;
              ">
                Reliable logistics. Professional delivery.
              </div>

              <div style="
                margin-top:12px;
                font-size:12px;
                line-height:18px;
              ">
                <a
                  href="${escapeHtml(PUBLIC_APP_URL)}"
                  style="
                    color:#173b76;
                    font-weight:700;
                    text-decoration:none;
                  "
                >
                  ${escapeHtml(PUBLIC_APP_URL)}
                </a>
              </div>

              <div style="
                margin-top:14px;
                padding-top:14px;
                border-top:1px solid #dfe5ee;
                color:#8793a4;
                font-size:11px;
                line-height:17px;
              ">
                This is an official communication from US COURIER MAILBOX.
                Please do not share confidential account or shipment
                information with unauthorized persons.
              </div>

            </td>
          </tr>

        </table>

        <div style="
          max-width:680px;
          padding:14px 12px 0;
          color:#8a96a7;
          font-size:10px;
          line-height:16px;
          text-align:center;
        ">
          &copy; ${new Date().getFullYear()} US COURIER. All rights reserved.
        </div>

      </td>
    </tr>
  </table>

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
        background:#eef3f8;
        padding:18px;
        border-radius:12px;
        margin:20px 0;
      ">
        <strong>Tracking Number</strong><br>
        <span style="
          color:#D4AF37;
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
        background:#eef3f8;
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
        background:#eef3f8;
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
        background:#eef3f8;
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
      "US COURIER MAILBOX Reply",
      `
      <h1>US COURIER MAILBOX</h1>

      <p>
        Hello ${escapeHtml(
          recipientName || "Customer"
        )},
      </p>

      <div style="
        background:#eef3f8;
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
          US COURIER MAILBOX
        </strong>
      </p>
      `
    );

  return sendEmail({
    to: recipientEmail,
    subject:
      subject ||
      "US COURIER MAILBOX",
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
            background:#D4AF37;
            color:#111827;
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
        background:#eef3f8;
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
