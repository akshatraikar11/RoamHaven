(() => {
  "use strict";

  const userId = window.__RH_USER_ID__;
  if (!userId) return;
  if (!window.io) return;

  const socket = window.io({ query: { userId } });
  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notifDropdownList");
  const markAllBtn = document.getElementById("notifMarkAllReadBtn");

  function setBadgeCount(count) {
    if (!badge) return;
    const n = Number(count || 0);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.display = n > 0 ? "inline-flex" : "none";
  }

  async function fetchNotifications() {
    if (!list) return;
    try {
      const res = await fetch("/api/notifications?limit=10");
      const data = await res.json();
      if (!data?.success) return;
      setBadgeCount(data.unreadCount || 0);
      list.innerHTML = "";
      if (!data.items || data.items.length === 0) {
        list.innerHTML = `<div class="dropdown-item text-muted small">No notifications yet.</div>`;
        return;
      }
      data.items.forEach((n) => {
        const item = document.createElement("a");
        item.className = "dropdown-item d-block";
        item.href = n.link || "#";
        item.innerHTML = `
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(n.title || "Notification")}</div>
              <div class="text-muted small">${escapeHtml(n.message || "")}</div>
            </div>
            ${n.isRead ? "" : `<span class="badge text-bg-danger">new</span>`}
          </div>
        `;
        item.addEventListener("click", async () => {
          if (!n._id) return;
          try {
            await fetch(`/api/notifications/${n._id}/read`, { method: "POST" });
          } catch (_) {}
        });
        list.appendChild(item);
      });
    } catch (_) {
      // ignore
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  socket.on("notification:new", () => {
    fetchNotifications();
  });

  if (markAllBtn) {
    markAllBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("/api/notifications/read-all", { method: "POST" });
      } catch (_) {}
      fetchNotifications();
    });
  }

  // Refresh list when dropdown is opened
  const dropdownToggle = document.getElementById("notifDropdownToggle");
  if (dropdownToggle) {
    dropdownToggle.addEventListener("click", () => {
      setTimeout(fetchNotifications, 50);
    });
  }
})();

