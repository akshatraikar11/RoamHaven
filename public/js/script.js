(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }

      form.classList.add("was-validated");
    }, false);
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  initializeToastsFromFlash();
  initializePageTransitions();
  initializeSkeletonLoading();
  initializeMicroInteractions();
  initializeOnboardingTour();
  runBookingConfettiIfNeeded();
});

function showToast(message, type = "success", delay = 4500) {
  if (!message) return;
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info",
  };

  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></div>
    <div class="toast-body-text">${escapeHtml(message)}</div>
    <button type="button" class="toast-close-btn" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  const dismiss = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 260);
  };

  toast.querySelector(".toast-close-btn")?.addEventListener("click", dismiss);
  setTimeout(dismiss, delay);
}

function initializeToastsFromFlash() {
  const flashData = document.getElementById("flash-data");
  if (!flashData) return;

  flashData.querySelectorAll("[data-flash-message]").forEach((node) => {
    const msg = node.getAttribute("data-flash-message");
    const rawType = node.getAttribute("data-flash-type");
    const type = rawType === "error" ? "error" : "success";
    showToast(msg, type);
  });
}

function initializePageTransitions() {
  const overlay = document.getElementById("pageTransitionOverlay");
  if (!overlay) return;
  document.body.classList.add("page-ready");

  document.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      const isSameTab = !target || target === "_self";
      const isInternal = href && href.startsWith("/");
      if (!isSameTab || !isInternal || event.defaultPrevented) return;
      overlay.classList.add("active");
    });
  });
}

function initializeSkeletonLoading() {
  const cards = document.querySelectorAll(".listing-skeleton-card");
  if (!cards.length) return;
  cards.forEach((card) => card.classList.add("is-loading"));
  setTimeout(() => {
    cards.forEach((card) => card.classList.remove("is-loading"));
  }, 600);
}

function initializeMicroInteractions() {
  document.querySelectorAll(".fav-heart-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove("heart-pop");
      // Reflow to replay the keyframe each click.
      void button.offsetWidth;
      button.classList.add("heart-pop");
      const icon = button.querySelector(".fav-heart");
      const listingId = button.getAttribute("data-listing-id");
      if (!listingId) {
        // fallback: purely visual
        if (icon) {
          icon.classList.toggle("fa-regular");
          icon.classList.toggle("fa-solid");
          icon.classList.toggle("heart-active");
        }
        showToast("Saved to your favorites", "success", 2200);
        return;
      }

      try {
        const res = await fetch(`/wishlist/${listingId}/toggle`, { method: "POST" });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to update wishlist");
        const isFav = !!data.isFavorite;
        if (icon) {
          icon.classList.toggle("fa-regular", !isFav);
          icon.classList.toggle("fa-solid", isFav);
          icon.classList.toggle("heart-active", isFav);
        }
        showToast(isFav ? "Saved to your wishlist" : "Removed from wishlist", "success", 2200);
      } catch (e) {
        showToast("Login required to save listings", "error", 2800);
      }
    });
  });
}

function initializeOnboardingTour() {
  if (!window.Shepherd) return;
  if (localStorage.getItem("rh_onboarding_done") === "1") return;
  if (!document.querySelector(".search-form-nav")) return;

  const tour = new window.Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shadow-lg",
      scrollTo: { behavior: "smooth", block: "center" },
      cancelIcon: { enabled: true },
    },
  });

  tour.addStep({
    title: "Search Smarter",
    text: "Use natural search text to quickly find the right destination.",
    attachTo: { element: ".search-form-nav", on: "bottom" },
    buttons: [{ text: "Next", action: tour.next }],
  });

  if (document.querySelector(".advanced-filters-bar")) {
    tour.addStep({
      title: "Advanced Filters",
      text: "Refine by location, price, amenities, rating and more.",
      attachTo: { element: ".advanced-filters-bar", on: "bottom" },
      buttons: [
        { text: "Back", action: tour.back },
        { text: "Next", action: tour.next },
      ],
    });
  }

  if (document.querySelector(".listing-card")) {
    tour.addStep({
      title: "Explore Listings",
      text: "Open any card to view details, availability and complete booking flow.",
      attachTo: { element: ".listing-card", on: "top" },
      buttons: [
        { text: "Back", action: tour.back },
        {
          text: "Done",
          action: () => {
            localStorage.setItem("rh_onboarding_done", "1");
            tour.complete();
          },
        },
      ],
    });
  }

  setTimeout(() => tour.start(), 700);
}

function runBookingConfettiIfNeeded() {
  if (!window.confetti) return;
  const isSuccessPage = window.location.pathname.includes("/bookings/success");
  if (!isSuccessPage) return;

  window.confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.62 },
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}