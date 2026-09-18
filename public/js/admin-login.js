(function () {
  "use strict";

  const form = document.getElementById(
    "standalone-admin-login-form"
  );

  const emailEl = document.getElementById(
    "standalone-login-email"
  );

  const passwordEl = document.getElementById(
    "standalone-login-password"
  );

  const submitEl = document.getElementById(
    "standalone-admin-login-submit"
  );

  const statusEl = document.getElementById(
    "standalone-admin-login-status"
  );

  if (
    !form ||
    !emailEl ||
    !passwordEl ||
    !submitEl ||
    !statusEl
  ) {
    return;
  }

  function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.className =
      "standalone-admin-login-status" +
      (type ? " " + type : "");
  }

  function setLoading(isLoading) {
    submitEl.disabled = isLoading;
    submitEl.textContent =
      isLoading ? "Signing In…" : "Sign In";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    if (!email || !password) {
      setStatus(
        "Please enter your email and password.",
        "error"
      );
      return;
    }

    setStatus("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setStatus(
          data.error ||
          "Invalid Operator Credentials",
          "error"
        );
        return;
      }

      setStatus(
        "Authentication successful. Opening operations portal…",
        "success"
      );

      window.location.replace("/");
    } catch (error) {
      console.error(
        "Standalone admin login error:",
        error
      );

      setStatus(
        "Server connection error. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  });
})();
