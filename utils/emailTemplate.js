function contactEmailTemplate(name, email, subject, message) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px;">
  <div style="max-width:650px;margin:auto;background:#fff;padding:30px;border-radius:8px;">
    <h2 style="color:#5a3825;">US COURIER — Customer Message</h2>

    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Subject:</strong> ${subject}</p>

    <hr>

    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap;">${message}</p>

    <hr>

    <p style="font-size:12px;color:#777;">
      This message was submitted through the official US COURIER contact form.
    </p>
  </div>
</body>
</html>`;
}

module.exports = { contactEmailTemplate };
