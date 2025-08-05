// Firebase imports (loaded via modules in HTML)
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Form functionality for housewarming RSVP
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector('form[action="your-server-endpoint"]');

  // Get the guest containers for each time slot
  const guestContainers = {
    ochtend: document.querySelector(".guests-ochtend"),
    middag: document.querySelector(".guests-middag"),
    avond: document.querySelector(".guests-avond"),
  };

  // Wait for Firebase to be ready
  const waitForFirebase = setInterval(() => {
    if (window.db) {
      clearInterval(waitForFirebase);
      initializeApp();
    }
  }, 100);

  function initializeApp() {
    // Set up real-time listener for RSVPs
    setupRealtimeListener();

    // Handle form submission
    if (form) {
      form.addEventListener("submit", handleFormSubmission);
    }

    // Handle cancel form submission
    const cancelForm = document.getElementById("cancel-form");
    if (cancelForm) {
      cancelForm.addEventListener("submit", handleCancelSubmission);
    }

    // Smooth scrolling for navigation links
    setupSmoothScrolling();
  }

  async function handleFormSubmission(e) {
    e.preventDefault();

    // Get form data
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    const groupSize = formData.get("group_size");

    // Get selected timeslots (multiple checkboxes)
    const selectedTimeslots = Array.from(
      form.querySelectorAll('input[name="timeslot"]:checked')
    ).map((checkbox) => checkbox.value);

    // Validate required fields
    if (!name || selectedTimeslots.length === 0 || !groupSize) {
      showNotification(
        "Vul alle velden in en selecteer minimaal één tijdslot!",
        "error"
      );
      return;
    }

    try {
      // Check if user already exists
      const existingRSVP = await checkExistingRSVP(name);

      // Delete existing RSVP if it exists (we'll create new ones for each timeslot)
      if (existingRSVP) {
        await deleteDoc(doc(window.db, "rsvps", existingRSVP.id));
      }

      // Create RSVP for each selected timeslot
      const promises = selectedTimeslots.map((timeslot) => {
        const rsvpData = {
          name: name,
          timeslot: timeslot,
          groupSize: groupSize,
          timestamp: new Date(),
        };
        return addDoc(collection(window.db, "rsvps"), rsvpData);
      });

      await Promise.all(promises);

      // Show success message
      const timeslotText =
        selectedTimeslots.length > 1
          ? `de ${selectedTimeslots.join(", ")}`
          : `de ${selectedTimeslots[0]}`;

      showNotification(
        `Gelukt! ${name}, je naam staat nu in het tijdschema hieronder voor ${timeslotText}. Scroll naar beneden om jezelf te zien! 🎉`,
        "success"
      );

      // Clear form
      form.reset();
    } catch (error) {
      console.error("Error saving RSVP:", error);
      showNotification(
        "Er ging iets mis bij het opslaan. Probeer het opnieuw.",
        "error"
      );
    }
  }

  function showNotification(message, type = "success") {
    // Remove existing modal if any
    const existing = document.querySelector(".modal-overlay");
    if (existing) {
      existing.remove();
    }

    // Create modal overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    // Create modal popup
    const popup = document.createElement("div");
    popup.className = `modal-popup ${type === "error" ? "error" : ""} ${
      type === "cancel" ? "cancel" : ""
    }`;

    // Create content
    const title = document.createElement("h3");
    if (type === "success") {
      title.textContent = "Aanmelding gelukt! 🎉";
    } else if (type === "cancel") {
      title.textContent = "Aanmelding geannuleerd 😢";
    } else {
      title.textContent = "Oops! 😅";
    }

    const messageP = document.createElement("p");
    messageP.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "modal-close";
    closeButton.textContent = "Sluiten";

    // Add close functionality
    const closeModal = () => {
      overlay.classList.add("hide");
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 300);
    };

    closeButton.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Assemble modal
    popup.appendChild(title);
    popup.appendChild(messageP);
    popup.appendChild(closeButton);
    overlay.appendChild(popup);

    // Add to page
    document.body.appendChild(overlay);
  }

  async function handleCancelSubmission(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const name = formData.get("cancel_name").trim();

    if (!name) {
      showNotification("Vul je naam in!", "error");
      return;
    }

    try {
      // Check if user exists
      const existingRSVP = await checkExistingRSVP(name);

      if (existingRSVP) {
        // Delete the RSVP
        await deleteDoc(doc(window.db, "rsvps", existingRSVP.id));
        showNotification(
          `${name}, je aanmelding is geannuleerd. Jammer dat je niet kunt komen! Je naam is nu verwijderd uit het tijdschema hierboven.`,
          "cancel"
        );

        // Clear the cancel form
        e.target.reset();
      } else {
        showNotification(
          `Geen aanmelding gevonden voor "${name}". Controleer of je naam correct is gespeld (let op hoofdletters!)`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error canceling RSVP:", error);
      showNotification(
        "Er ging iets mis bij het annuleren. Probeer het opnieuw.",
        "error"
      );
    }
  }

  async function checkExistingRSVP(name) {
    const q = query(collection(window.db, "rsvps"), where("name", "==", name));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  }

  function setupRealtimeListener() {
    // Listen for real-time updates
    onSnapshot(collection(window.db, "rsvps"), (snapshot) => {
      // Clear all guest containers
      Object.values(guestContainers).forEach((container) => {
        if (container) container.innerHTML = "";
      });

      // Group RSVPs by timeslot
      const rsvpsByTimeslot = {
        ochtend: [],
        middag: [],
        avond: [],
      };

      snapshot.forEach((doc) => {
        const rsvp = doc.data();
        if (rsvpsByTimeslot[rsvp.timeslot]) {
          rsvpsByTimeslot[rsvp.timeslot].push(rsvp);
        }
      });

      // Display guests in each timeslot
      Object.keys(rsvpsByTimeslot).forEach((timeslot) => {
        const container = guestContainers[timeslot];
        if (container) {
          rsvpsByTimeslot[timeslot].forEach((rsvp) => {
            const guestEntry = document.createElement("p");
            guestEntry.textContent = `${rsvp.name} (${rsvp.groupSize})`;
            guestEntry.classList.add("guest-entry");
            container.appendChild(guestEntry);
          });

          // Show message if no guests
          if (rsvpsByTimeslot[timeslot].length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "Nog geen aanmeldingen";
            emptyMessage.style.opacity = "0.6";
            emptyMessage.style.fontStyle = "italic";
            container.appendChild(emptyMessage);
          }
        }
      });
    });
  }

  function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    });
  }
});
