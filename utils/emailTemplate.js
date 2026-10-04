function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function contactEmailTemplate(name, email, subject, message) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Customer Message | US COURIER</title>
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
                  <div style="
                    width:42px;
                    height:42px;
                    line-height:42px;
                    text-align:center;
                    background:#111827;
                    border:2px solid #D4AF37;
                    border-radius:9px;
                    color:#ffffff;
                    font-size:21px;
                    font-weight:900;
                  ">UC</div>
                </td>

                <td valign="middle" style="padding-left:12px;">
                  <div style="
                    color:#ffffff;
                    font-size:18px;
                    line-height:22px;
                    font-weight:900;
                    letter-spacing:2px;
                  ">US COURIER</div>

                  <div style="
                    color:#D4AF37;
                    font-size:9px;
                    line-height:14px;
                    font-weight:800;
                    letter-spacing:2px;
                  ">LOGISTICS &amp; DELIVERY</div>
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
              font-size:25px;
              line-height:34px;
              font-weight:800;
            ">
              Customer Message
            </div>

            <div style="
              width:48px;
              height:3px;
              margin-top:12px;
              background:#D4AF37;
            "></div>
          </td>
        </tr>

        <!-- CUSTOMER DETAILS -->
        <tr>
          <td style="padding:12px 30px 8px 30px;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="
                background:#f7f9fc;
                border:1px solid #e3e8ef;
                border-radius:10px;
              ">

              <tr>
                <td style="
                  padding:12px 15px;
                  color:#68778c;
                  font-size:12px;
                  font-weight:700;
                ">NAME</td>

                <td style="
                  padding:12px 15px;
                  color:#172033;
                  font-size:14px;
                ">${safeName}</td>
              </tr>

              <tr>
                <td style="
                  padding:12px 15px;
                  color:#68778c;
                  font-size:12px;
                  font-weight:700;
                ">EMAIL</td>

                <td style="
                  padding:12px 15px;
                  color:#173b76;
                  font-size:14px;
                ">${safeEmail}</td>
              </tr>

              <tr>
                <td style="
                  padding:12px 15px;
                  color:#68778c;
                  font-size:12px;
                  font-weight:700;
                ">SUBJECT</td>

                <td style="
                  padding:12px 15px;
                  color:#172033;
                  font-size:14px;
                  font-weight:700;
                ">${safeSubject}</td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- MESSAGE -->
        <tr>
          <td style="
            padding:22px 30px 30px 30px;
            color:#34445d;
            font-size:15px;
            line-height:1.7;
          ">

            <div style="
              margin-bottom:10px;
              color:#173b76;
              font-size:14px;
              font-weight:800;
            ">
              CUSTOMER MESSAGE
            </div>

            <div style="
              padding:18px;
              background:#ffffff;
              border:1px solid #dfe5ee;
              border-left:4px solid #D4AF37;
              border-radius:8px;
            ">
              ${safeMessage}
            </div>

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
              margin-top:8px;
              color:#68778c;
              font-size:11px;
              line-height:17px;
            ">
              This message was submitted through the US COURIER contact form.
              Please handle customer information appropriately.
            </div>

            <div style="
              margin-top:10px;
              color:#8a96a8;
              font-size:11px;
              line-height:17px;
            ">
              https://uscourier.app
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

module.exports = { contactEmailTemplate };
