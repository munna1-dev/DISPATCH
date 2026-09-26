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
    listCount.textContent = messages.length + (messages.length === 1 ? " message" : " messages");

    if (!messages.length) {
      empty.hidden = false;
      empty.textContent = folder === "trash" ? "Trash is empty" : "No messages yet";
      return;
    }

    empty.hidden = true;

    messages.forEach((message) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "message-row" + (message.is_read ? "" : " unread");

      const sender = document.createElement("strong");
      sender.textContent = message.sender_name || message.sender_email || "Unknown sender";

      const subject = document.createElement("span");
      subject.textContent = message.subject || "(No subject)";

      const preview = document.createElement("small");
      preview.textContent = message.text_body || "";

      row.append(sender, subject, preview);

      row.addEventListener("click", () => {
        openMessage(message);
      });

      list.appendChild(row);
    });
  }

  function openMessage(message) {
    title.textContent = message.subject || "(No subject)";
    subtitle.textContent = message.sender_email || "Message";
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = message.text_body || "This message contains no plain-text body."; 
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
      const response = await fetch("/api/mailbox/drafts", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ to, cc, bcc, subject, body })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to save draft.");
      }

      modal.hidden = true;
      subtitle.textContent = "Draft saved successfully.";
      showFolder("drafts");
    } catch (error) {
      subtitle.textContent = error.message;
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
      const response = await fetch("/api/mailbox/send", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ to, cc, bcc, subject, body })
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
      subtitle.textContent = "Message sent successfully.";
      showFolder("sent");
    } catch (error) {
      subtitle.textContent = error.message;
    } finally {
      send.disabled = false;
      send.textContent = "Send";
    }
  });

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
    const file = attachment.files[0];
    attachmentStatus.textContent = file ? file.name + " attached" : "No file attached";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) modal.hidden = true;
  });

  loadMailbox();
  loadMessages();
});
