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

  const passwordToggle = document.getElementById(
    "admin-password-toggle"
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

  let authenticationCheckInProgress = false;
  let loginInProgress = false;

  function setStatus(message, type) {
    statusEl.textContent = message || "";

    statusEl.className =
      "admin-auth-status" +
      (type ? " " + type : "");
  }

  function setLoading(isLoading) {
    submitEl.disabled = isLoading;

    submitEl.textContent =
      isLoading
        ? "Authenticating…"
        : "Sign In Securely";
  }

  function setPasswordVisibility(isVisible) {
    passwordEl.type =
      isVisible ? "text" : "password";

    passwordToggle.textContent =
      isVisible ? "HIDE" : "SHOW";

    passwordToggle.setAttribute(
      "aria-label",
      isVisible
        ? "Hide password"
        : "Show password"
    );

    passwordToggle.setAttribute(
      "aria-pressed",
      String(isVisible)
    );
  }

  if (passwordToggle) {
    passwordToggle.addEventListener(
      "click",
      function () {
        setPasswordVisibility(
          passwordEl.type === "password"
        );
      }
    );
  }

  async function checkExistingSession() {
    if (authenticationCheckInProgress) {
      return;
    }

    authenticationCheckInProgress = true;

    try {
      const response = await fetch(
        "/api/admin/profile",
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (
        data?.success &&
        (data?.profile || data?.user)
      ) {
        setStatus(
          "Active operator session detected. Opening operations portal…",
          "success"
        );

        window.location.replace("/admin");
      }
    } catch (error) {
      console.warn(
        "[ADMIN LOGIN SESSION CHECK]",
        error
      );
    } finally {
      authenticationCheckInProgress = false;
    }
  }

  form.addEventListener(
    "submit",
    async function (event) {
      event.preventDefault();

      if (loginInProgress) {
        return;
      }

      const email =
        emailEl.value.trim();

      const password =
        passwordEl.value;

      if (!email || !password) {
        setStatus(
          "Enter your operator email and password.",
          "error"
        );
        return;
      }

      if (!emailEl.checkValidity()) {
        setStatus(
          "Enter a valid operator email address.",
          "error"
        );
        emailEl.focus();
        return;
      }

      loginInProgress = true;

      setStatus(
        "Verifying operator credentials…"
      );

      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/auth/login",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json"
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
            await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          setStatus(
            data.error ||
            "Authentication failed. Check your credentials.",
            "error"
          );

          return;
        }

        setStatus(
          "Authentication successful. Verifying portal access…",
          "success"
        );

        /*
         * Verify the newly established session through
         * the protected admin profile endpoint before
         * allowing entry to the dashboard.
         */
        const profileResponse =
          await fetch(
            "/api/admin/profile",
            {
              method: "GET",
              credentials: "include",
              headers: {
                Accept:
                  "application/json"
              },
              cache: "no-store"
            }
          );

        if (!profileResponse.ok) {
          setStatus(
            "Authentication succeeded, but portal access could not be verified.",
            "error"
          );

          return;
        }

        const profileData =
          await profileResponse.json();

        if (
          !profileData?.success ||
          !(
            profileData?.profile ||
            profileData?.user
          )
        ) {
          setStatus(
            "Administrator access could not be verified.",
            "error"
          );

          return;
        }

        setStatus(
          "Access verified. Opening operations portal…",
          "success"
        );

        window.location.replace("/admin");

      } catch (error) {
        console.error(
          "[ADMIN LOGIN]",
          error
        );

        setStatus(
          "Unable to connect to the authentication service. Please try again.",
          "error"
        );

      } finally {
        loginInProgress = false;
        setLoading(false);
      }
    }
  );

  /*
   * If an authenticated operator manually opens the
   * login page, return them to the protected portal.
   */
  checkExistingSession();

})();
