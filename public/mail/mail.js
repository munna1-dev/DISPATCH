document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelectorAll(".nav-item");
  const title = document.querySelector(".main h2");
  const subtitle = document.querySelector(".subtitle");
  const listHead = document.querySelector(".list-head strong");
  const listCount = document.querySelector(".list-head span");
  const list = document.querySelector(".message-list");
  const empty = document.querySelector(".message-empty");
  const compose = document.querySelector(".compose");
  const search = document.querySelector(".search input");
  const modal = document.getElementById("composeModal");
  const close = document.getElementById("closeCompose");
  const save = document.getElementById("saveDraft");
  const send = document.getElementById("sendMail");
  const attachment = document.getElementById("composeAttachment");
  const attachmentStatus = document.getElementById("attachmentStatus");
  const reader = document.querySelector(".reader");
  const mailContent = document.querySelector(".mail-content");
  const refreshMail = document.getElementById("refreshMail");

  let replyToMessageId = null;
  let editingDraftId = null;

  const mailLogin = document.getElementById("mailLogin");
  const mailShell = document.getElementById("mailShell");
  const mailLoginForm = document.getElementById("mailLoginForm");
  const mailLoginEmail = document.getElementById("mailLoginEmail");
  const mailLoginPassword = document.getElementById("mailLoginPassword");
  const mailLoginSubmit = document.getElementById("mailLoginSubmit");
  const mailLoginStatus = document.getElementById("mailLoginStatus");
  const mailPasswordToggle = document.getElementById("mailPasswordToggle");
  const mailLogout = document.getElementById("mailLogout");
  const mailAccountEmail = document.getElementById("mailAccountEmail");

  let folder = "inbox";
  let messages = [];

  const labels = {
    inbox: "Inbox",
    starred: "Starred",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive",
    trash: "Trash"
  };


  async function mailboxAction(url, method = "PATCH", body = {}) {
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: method === "DELETE" ? undefined : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Mailbox action failed.");
    }

    return data;
  }

  async function updateReadState(messageId, isRead = true) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId) +
        "/read",
      "PATCH",
      { isRead }
    );
  }

  async function updateStarState(messageId, isStarred) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId) +
        "/star",
      "PATCH",
      { isStarred }
    );
  }

  async function archiveMessage(messageId) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId) +
        "/archive"
    );
  }

  async function trashMessage(messageId) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId) +
        "/trash"
    );
  }

  async function restoreMessage(messageId) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId) +
        "/restore"
    );
  }

  async function permanentlyDeleteMessage(messageId) {
    return mailboxAction(
      "/api/mailbox/messages/" +
        encodeURIComponent(messageId),
      "DELETE"
    );
  }


  function setLoginStatus(message, type = "error") {
    if (!mailLoginStatus) return;

    mailLoginStatus.textContent = message || "";
    mailLoginStatus.dataset.state = message ? type : "";
    mailLoginStatus.hidden = !message;
  }

  function showLogin() {
    if (mailLogin) mailLogin.hidden = false;
    if (mailShell) mailShell.hidden = true;
    if (mailLoginEmail) mailLoginEmail.focus();
  }

  function showMailShell(email = "") {
    if (mailLogin) mailLogin.hidden = true;
    if (mailShell) mailShell.hidden = false;

    if (mailAccountEmail && email) {
      mailAccountEmail.textContent = email;
    }
  }

  async function checkMailSession() {
    try {
      const response = await fetch("/api/mailbox", {
        credentials: "include"
      });

      if (!response.ok) {
        showLogin();
        return false;
      }

      const data = await response.json();

      if (!data.mailbox) {
        showLogin();
        return false;
      }

      showMailShell(data.mailbox.email || "");
      return true;
    } catch (error) {
      showLogin();
      return false;
    }
  }

  async function loginToMail(event) {
    event.preventDefault();

    const email = mailLoginEmail.value.trim().toLowerCase();
    const password = mailLoginPassword.value;

    if (!email || !password) {
      setLoginStatus("Email and password are required.");
      return;
    }

    mailLoginSubmit.disabled = true;
    mailLoginSubmit.textContent = "Signing in...";
    setLoginStatus("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Origin": window.location.origin
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to sign in.");
      }

      const mailboxResponse = await fetch("/api/mailbox", {
        credentials: "include"
      });

      const mailboxData =
        await mailboxResponse.json().catch(() => ({}));

      if (!mailboxResponse.ok || !mailboxData.mailbox) {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Origin": window.location.origin
          }
        }).catch(() => {});

        throw new Error(
          "This account does not have an active mailbox."
        );
      }

      mailLoginPassword.value = "";
      setLoginStatus("");
      showMailShell(mailboxData.mailbox.email || email);

      await loadMailbox();
      await loadMessages();

    } catch (error) {
      setLoginStatus(error.message || "Unable to sign in.");
    } finally {
      mailLoginSubmit.disabled = false;
      mailLoginSubmit.textContent = "Sign in securely";
    }
  }

  async function logoutFromMail() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Origin": window.location.origin
        }
      });
    } finally {
      messages = [];
      showLogin();
      setLoginStatus("You have been signed out.", "success");
    }
  }

  async function loadMailbox() {
    try {
      const response = await fetch("/api/mailbox", { credentials: "include" });
      if (!response.ok) throw new Error("Mailbox unavailable");
      const data = await response.json();
      if (data.mailbox) {
        subtitle.textContent = data.mailbox.email;
      }
    } catch (error) {
      subtitle.textContent = "Unable to load mailbox information";
    }
  }

  async function loadMessages() {
    list.innerHTML = "";
    empty.hidden = true;
    listCount.textContent = "Loading…";
    if (mailContent) mailContent.classList.remove("reader-open");

    try {
      const response = await fetch("/api/mailbox/messages?folder=" + encodeURIComponent(folder), {
        credentials: "include"
      });

      if (!response.ok) throw new Error("Unable to load messages");

      const data = await response.json();
      messages = Array.isArray(data.messages) ? data.messages : [];
      renderMessages();
    } catch (error) {
      messages = [];
      listCount.textContent = "0 messages";
      empty.hidden = false;
      empty.textContent = "Unable to load messages. Please sign in again.";
    }
  }

  function renderMessages() {
    list.innerHTML = "";

    title.textContent = labels[folder];
    listHead.textContent = labels[folder];

    listCount.textContent =
      messages.length +
      (messages.length === 1 ? " message" : " messages");

    if (!messages.length) {
      empty.hidden = false;

      if (folder === "trash") {
        empty.textContent = "Trash is empty";
      } else if (folder === "starred") {
        empty.textContent = "No starred messages";
      } else if (folder === "drafts") {
        empty.textContent = "No saved drafts";
      } else if (folder === "sent") {
        empty.textContent = "No sent messages";
      } else if (folder === "archive") {
        empty.textContent = "Archive is empty";
      } else {
        empty.textContent = "No messages yet";
      }

      return;
    }

    empty.hidden = true;

    messages.forEach((message, index) => {
      const row = document.createElement("div");

      row.className =
        "message-row-wrap" +
        (message.is_read ? "" : " unread");

      const openButton = document.createElement("button");

      openButton.type = "button";
      openButton.className =
        "message-row" +
        (message.is_read ? "" : " unread");

      openButton.setAttribute(
        "aria-label",
        `Open message ${index + 1}: ${
          message.subject || "No subject"
        }`
      );

      const number = document.createElement("span");
      number.className = "message-number";
      number.textContent = String(index + 1);

      const sender = document.createElement("strong");
      sender.className = "message-sender";
      sender.textContent =
        message.sender_name ||
        message.sender_email ||
        "Unknown sender";

      const subject = document.createElement("span");
      subject.className = "message-subject";
      subject.textContent =
        message.subject || "(No subject)";

      const date = document.createElement("time");
      date.className = "message-date";
      date.dateTime =
        message.received_at ||
        message.sent_at ||
        message.created_at ||
        "";

      date.textContent = formatMessageDate(
        message.received_at ||
        message.sent_at ||
        message.created_at
      );

      openButton.append(
        number,
        sender,
        subject,
        date
      );

      openButton.addEventListener("click", () => {
        if (folder === "drafts") {
          openDraft(message);
          return;
        }

        openMessage(message);
      });

      const actions = document.createElement("div");
      actions.className = "message-row-actions";

      const star = document.createElement("button");
      star.type = "button";
      star.className = "message-action";
      star.setAttribute(
        "aria-label",
        message.is_starred
          ? "Remove star"
          : "Star message"
      );
      star.setAttribute(
        "aria-pressed",
        message.is_starred ? "true" : "false"
      );
      star.textContent =
        message.is_starred ? "★" : "☆";

      star.addEventListener("click", async (event) => {
        event.stopPropagation();

        try {
          await updateStarState(
            message.id,
            !message.is_starred
          );

          message.is_starred =
            !message.is_starred;

          star.setAttribute(
            "aria-pressed",
            message.is_starred ? "true" : "false"
          );

          if (
            folder === "starred" &&
            !message.is_starred
          ) {
            await loadMessages();
          } else {
            renderMessages();
          }
        } catch (error) {
          subtitle.textContent =
            error.message ||
            "Unable to update star.";
        }
      });

      actions.appendChild(star);

      if (folder === "trash") {
        const restore = document.createElement("button");

        restore.type = "button";
        restore.className = "message-action";
        restore.textContent = "↩";
        restore.setAttribute(
          "aria-label",
          "Restore message"
        );

        restore.addEventListener(
          "click",
          async (event) => {
            event.stopPropagation();

            try {
              await restoreMessage(message.id);
              await loadMessages();
            } catch (error) {
              subtitle.textContent =
                error.message ||
                "Unable to restore message.";
            }
          }
        );

        const remove = document.createElement("button");

        remove.type = "button";
        remove.className =
          "message-action message-action-danger";
        remove.textContent = "×";
        remove.setAttribute(
          "aria-label",
          "Permanently delete message"
        );

        remove.addEventListener(
          "click",
          async (event) => {
            event.stopPropagation();

            try {
              await permanentlyDeleteMessage(
                message.id
              );

              await loadMessages();
            } catch (error) {
              subtitle.textContent =
                error.message ||
                "Unable to permanently delete message.";
            }
          }
        );

        actions.append(
          restore,
          remove
        );
      } else {
        const archive = document.createElement("button");

        archive.type = "button";
        archive.className = "message-action";
        archive.textContent = "⌁";
        archive.setAttribute(
          "aria-label",
          "Archive message"
        );

        archive.addEventListener(
          "click",
          async (event) => {
            event.stopPropagation();

            try {
              await archiveMessage(message.id);
              await loadMessages();
            } catch (error) {
              subtitle.textContent =
                error.message ||
                "Unable to archive message.";
            }
          }
        );

        const trash = document.createElement("button");

        trash.type = "button";
        trash.className =
          "message-action message-action-danger";
        trash.textContent = "⌫";
        trash.setAttribute(
          "aria-label",
          "Move message to trash"
        );

        trash.addEventListener(
          "click",
          async (event) => {
            event.stopPropagation();

            try {
              await trashMessage(message.id);
              await loadMessages();
            } catch (error) {
              subtitle.textContent =
                error.message ||
                "Unable to move message to trash.";
            }
          }
        );

        actions.append(
          archive,
          trash
        );
      }

      row.append(
        openButton,
        actions
      );

      list.appendChild(row);
    });
  }

  function formatMessageDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function renderSafeBody(message) {
    const body = document.createElement("div");
    body.className = "reader-body";

    if (message.text_body) {
      body.textContent = message.text_body;
    } else {
      const note = document.createElement("p");
      note.textContent = "This message contains no plain-text body.";
      body.appendChild(note);
    }

    return body;
  }

  async function openDraft(message) {
    try {
      const response = await fetch(
        "/api/mailbox/drafts/" +
          encodeURIComponent(message.id),
        {
          credentials: "include"
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.draft) {
        throw new Error(
          data.error || "Unable to open draft."
        );
      }

      const draft = data.draft;

      editingDraftId = draft.id;

      // in_reply_to is the stored RFC Message-ID, not the
      // database UUID expected by replyToMessageId.
      // Keep it unset while editing an existing draft so
      // the server does not mistake the Message-ID for a UUID.
      replyToMessageId = null;

      const recipients = Array.isArray(draft.recipients)
        ? draft.recipients
        : [];

      const to = recipients
        .filter((item) => item.type === "to")
        .map((item) => item.email)
        .filter(Boolean);

      const cc = recipients
        .filter((item) => item.type === "cc")
        .map((item) => item.email)
        .filter(Boolean);

      const bcc = recipients
        .filter((item) => item.type === "bcc")
        .map((item) => item.email)
        .filter(Boolean);

      document.getElementById("composeTo").value =
        to.join(", ");

      document.getElementById("composeCc").value =
        cc.join(", ");

      document.getElementById("composeBcc").value =
        bcc.join(", ");

      document.getElementById("composeSubject").value =
        draft.subject || "";

      document.getElementById("composeBody").value =
        draft.text_body || "";

      attachment.value = "";
      attachmentStatus.textContent =
        "No file attached";

      const composeTitle =
        document.querySelector(".compose-head strong");

      if (composeTitle) {
        composeTitle.textContent = "Edit draft";
      }

      modal.hidden = false;
      document.getElementById("composeTo").focus();

    } catch (error) {
      subtitle.textContent =
        error.message || "Unable to open draft.";
    }
  }

  function startReply(message) {
    editingDraftId = null;

    const sender = message.sender_email || "";
    const subject = message.subject || "";

    document.getElementById("composeTo").value = sender;
    document.getElementById("composeCc").value = "";
    document.getElementById("composeBcc").value = "";
    document.getElementById("composeSubject").value =
      /^\s*re\s*:/i.test(subject)
        ? subject
        : `Re: ${subject || "(No subject)"}`;
    document.getElementById("composeBody").value = "";

    replyToMessageId = message.id;
    modal.hidden = false;

    const composeTitle = document.querySelector(".compose-head strong");
    if (composeTitle) composeTitle.textContent = "Reply";

    document.getElementById("composeBody").focus();
  }

  function renderReader(threadMessages, selectedId) {
    reader.innerHTML = "";

    const thread = document.createElement("div");
    thread.className = "reader-thread";

    const header = document.createElement("div");
    header.className = "reader-head";

    const heading = document.createElement("div");
    heading.className = "reader-heading";

    const subject = document.createElement("h3");
    subject.textContent = threadMessages[0]?.subject || "(No subject)";

    const count = document.createElement("span");
    count.textContent =
      threadMessages.length > 1
        ? `${threadMessages.length} messages in thread`
        : "Message";

    heading.append(subject, count);

    const actions = document.createElement("div");
    actions.className = "reader-actions";

    const selected =
      threadMessages.find((item) => item.id === selectedId) ||
      threadMessages[threadMessages.length - 1];

    const reply = document.createElement("button");
    reply.type = "button";
    reply.className = "reader-action";
    reply.textContent = "Reply";
    reply.addEventListener("click", () => startReply(selected));

    actions.appendChild(reply);
    header.append(heading, actions);
    thread.appendChild(header);

    threadMessages.forEach((item) => {
      const card = document.createElement("article");
      card.className =
        "thread-message" + (item.id === selectedId ? " selected" : "");

      const meta = document.createElement("div");
      meta.className = "thread-meta";

      const sender = document.createElement("div");
      sender.className = "thread-sender";
      sender.textContent = item.sender_name
        ? `${item.sender_name} <${item.sender_email}>`
        : item.sender_email || "Unknown sender";

      const date = document.createElement("time");
      date.textContent = formatMessageDate(
        item.received_at || item.sent_at || item.created_at
      );

      meta.append(sender, date);
      card.appendChild(meta);

      const recipients = (item.recipients || [])
        .filter((recipient) => recipient.type !== "bcc")
        .map((recipient) => recipient.email)
        .join(", ");

      if (recipients) {
        const recipientLine = document.createElement("div");
        recipientLine.className = "thread-recipients";
        recipientLine.textContent = `To: ${recipients}`;
        card.appendChild(recipientLine);
      }

      card.appendChild(renderSafeBody(item));

      const attachments = Array.isArray(item.attachments)
        ? item.attachments
        : [];

      if (attachments.length) {
        const attachmentList = document.createElement("div");
        attachmentList.className = "reader-attachments";

        attachments.forEach((file) => {
          const attachmentItem = document.createElement("span");
          attachmentItem.className = "reader-attachment";
          attachmentItem.textContent = file.filename || "Attachment";
          attachmentList.appendChild(attachmentItem);
        });

        card.appendChild(attachmentList);
      }

      thread.appendChild(card);
    });

    reader.appendChild(thread);
  }

  async function openMessage(message) {
    title.textContent =
      message.subject || "(No subject)";
    subtitle.textContent =
      "Loading conversation…";

    try {
      if (!message.is_read) {
        try {
          await updateReadState(message.id, true);
          message.is_read = true;
        } catch (readError) {
          console.warn(
            "[MAILBOX READ]",
            readError.message
          );
        }
      }

      const response = await fetch(
        "/api/mailbox/messages/" +
          encodeURIComponent(message.id) +
          "/thread",
        {
          credentials: "include"
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
          "Unable to load conversation."
        );
      }

      const threadMessages =
        Array.isArray(data.messages)
          ? data.messages
          : [message];

      renderReader(
        threadMessages,
        message.id
      );

      if (mailContent) {
        mailContent.classList.add(
          "reader-open"
        );
      }

      subtitle.textContent =
        message.sender_email ||
        "Conversation";

      renderMessages();

    } catch (error) {
      reader.innerHTML = "";

      const state =
        document.createElement("div");

      state.className =
        "reader-empty";

      state.textContent =
        error.message ||
        "Unable to load conversation.";

      reader.appendChild(state);

      subtitle.textContent =
        "Unable to load conversation";
    }
  }

  function showFolder(nextFolder) {
    folder = nextFolder;
    subtitle.textContent = "Loading " + labels[folder].toLowerCase() + "…";
    loadMessages();
  }

  nav.forEach((item) => {
    item.addEventListener("click", () => {
      nav.forEach((node) => node.classList.remove("active"));
      item.classList.add("active");
      const label = item.querySelector("span").textContent.replace("★ ", "").trim().toLowerCase();
      showFolder(label);
    });
  });

  compose.addEventListener("click", () => {
    editingDraftId = null;
    replyToMessageId = null;

    document.getElementById("composeTo").value = "";
    document.getElementById("composeCc").value = "";
    document.getElementById("composeBcc").value = "";
    document.getElementById("composeSubject").value = "";
    document.getElementById("composeBody").value = "";

    attachment.value = "";
    attachmentStatus.textContent = "No file attached";

    const composeTitle =
      document.querySelector(".compose-head strong");

    if (composeTitle) {
      composeTitle.textContent = "New message";
    }

    modal.hidden = false;
    document.getElementById("composeTo").focus();
  });

  close.addEventListener("click", () => {
    modal.hidden = true;
  });

  save.addEventListener("click", async () => {
    const to = document.getElementById("composeTo").value.trim();
    const cc = document.getElementById("composeCc").value.trim();
    const bcc = document.getElementById("composeBcc").value.trim();
    const subject = document.getElementById("composeSubject").value.trim();
    const body = document.getElementById("composeBody").value.trim();

    save.disabled = true;
    save.textContent = "Saving...";

    try {
      const isEditing = Boolean(editingDraftId);

      // The mailbox draft endpoint uses POST for both
      // creating and updating drafts. An existing draft is
      // identified by draftId in the request body.
      const url = "/api/mailbox/drafts";
      const method = "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          body,
          replyToMessageId,
          draftId: editingDraftId || undefined
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to save draft."
        );
      }

      editingDraftId =
        data.draft_id ||
        data.draft?.id ||
        editingDraftId;

      modal.hidden = true;
      subtitle.textContent = isEditing
        ? "Draft updated successfully."
        : "Draft saved successfully.";

      showFolder("drafts");

    } catch (error) {
      subtitle.textContent =
        error.message || "Unable to save draft.";
    } finally {
      save.disabled = false;
      save.textContent = "Save draft";
    }
  });

  send.addEventListener("click", async () => {
    const to = document.getElementById("composeTo").value.trim();
    const cc = document.getElementById("composeCc").value.trim();
    const bcc = document.getElementById("composeBcc").value.trim();
    const subject = document.getElementById("composeSubject").value.trim();
    const body = document.getElementById("composeBody").value.trim();

    if (!to || !body) {
      subtitle.textContent = "Recipient and message body are required.";
      return;
    }

    send.disabled = true;
    send.textContent = "Sending...";

    try {
      const formData = new FormData();

      formData.append("to", to);
      formData.append("cc", cc);
      formData.append("bcc", bcc);
      formData.append("subject", subject);
      formData.append("body", body);

      if (replyToMessageId) {
        formData.append("replyToMessageId", replyToMessageId);
      }

      if (editingDraftId) {
        formData.append("draftId", editingDraftId);
      }

      for (const file of Array.from(attachment.files || [])) {
        formData.append("attachments", file);
      }

      const response = await fetch("/api/mailbox/send", {
        method: "POST",
        credentials: "include",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to send email.");
      }

      modal.hidden = true;
      document.getElementById("composeTo").value = "";
      document.getElementById("composeCc").value = "";
      document.getElementById("composeBcc").value = "";
      document.getElementById("composeSubject").value = "";
      document.getElementById("composeBody").value = "";
      attachment.value = "";
      attachmentStatus.textContent = "No file attached";
      replyToMessageId = null;
      editingDraftId = null;

      const composeTitle =
        document.querySelector(".compose-head strong");
      if (composeTitle) composeTitle.textContent = "New message";
      subtitle.textContent = "Message sent successfully.";
      showFolder("sent");
    } catch (error) {
      subtitle.textContent = error.message;
    } finally {
      send.disabled = false;
      send.textContent = "Send";
    }
  });

  if (refreshMail) {
    refreshMail.addEventListener("click", async () => {
      refreshMail.disabled = true;
      try {
        await loadMessages();
      } finally {
        refreshMail.disabled = false;
      }
    });
  }

  search.addEventListener("input", () => {
    const value = search.value.trim().toLowerCase();
    if (!value) {
      renderMessages();
      return;
    }
    const filtered = messages.filter((message) => {
      return [message.sender_name, message.sender_email, message.subject, message.text_body].join(" ").toLowerCase().includes(value);
    });
    const original = messages;
    messages = filtered;
    renderMessages();
    messages = original;
  });

  attachment.addEventListener("change", () => {
    const files = Array.from(attachment.files || []);

    if (!files.length) {
      attachmentStatus.textContent = "No file attached";
      return;
    }

    const maxFiles = 5;
    const maxFileSize = 2 * 1024 * 1024;
    const maxTotalSize = 3 * 1024 * 1024;

    if (files.length > maxFiles) {
      attachment.value = "";
      attachmentStatus.textContent =
        "Maximum 5 attachments allowed.";
      return;
    }

    const oversized = files.find(
      (file) => file.size > maxFileSize
    );

    if (oversized) {
      attachment.value = "";
      attachmentStatus.textContent =
        `${oversized.name} exceeds the 2 MB file limit.`;
      return;
    }

    const totalSize = files.reduce(
      (total, file) => total + file.size,
      0
    );

    if (totalSize > maxTotalSize) {
      attachment.value = "";
      attachmentStatus.textContent =
        "Attachments exceed the 3 MB combined limit.";
      return;
    }

    if (files.length === 1) {
      attachmentStatus.textContent =
        `${files[0].name} attached`;
      return;
    }

    attachmentStatus.textContent =
      `${files.length} files attached`;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) modal.hidden = true;
  });

  if (mailLoginForm) {
    mailLoginForm.addEventListener("submit", loginToMail);
  }

  if (mailLogout) {
    mailLogout.addEventListener("click", logoutFromMail);
  }

  if (mailPasswordToggle && mailLoginPassword) {
    mailPasswordToggle.addEventListener("click", () => {
      const visible =
        mailLoginPassword.type === "text";

      mailLoginPassword.type =
        visible ? "password" : "text";

      mailPasswordToggle.textContent =
        visible ? "SHOW" : "HIDE";
    });
  }

  (async () => {
    const authenticated = await checkMailSession();

    if (authenticated) {
      await loadMailbox();
      await loadMessages();
    }
  })();
});
