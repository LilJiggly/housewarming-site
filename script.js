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
    const timeslot = formData.get("timeslot");
    const groupSize = formData.get("group_size");
    const transport = formData.get("transport");

    // Validate required fields
    if (!name || !timeslot || !groupSize || !transport) {
      alert("Vul alle velden in!");
      return;
    }

    try {
      // Check if user already exists
      const existingRSVP = await checkExistingRSVP(name);

      const rsvpData = {
        name: name,
        timeslot: timeslot,
        groupSize: groupSize,
        transport: transport,
        timestamp: new Date(),
      };

      if (existingRSVP) {
        // Update existing RSVP
        await updateDoc(doc(window.db, "rsvps", existingRSVP.id), rsvpData);
        alert(`${name}, je aanmelding is bijgewerkt voor de ${timeslot}!`);
      } else {
        // Create new RSVP
        await addDoc(collection(window.db, "rsvps"), rsvpData);
        alert(`Bedankt ${name}! Je bent aangemeld voor de ${timeslot}.`);
      }

      // Clear form
      form.reset();
    } catch (error) {
      console.error("Error saving RSVP:", error);
      alert("Er ging iets mis bij het opslaan. Probeer het opnieuw.");
    }
  }

  async function handleCancelSubmission(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const name = formData.get("cancel_name").trim();

    if (!name) {
      alert("Vul je naam in!");
      return;
    }

    try {
      // Check if user exists
      const existingRSVP = await checkExistingRSVP(name);

      if (existingRSVP) {
        // Delete the RSVP
        await deleteDoc(doc(window.db, "rsvps", existingRSVP.id));
        alert(
          `${name}, je aanmelding is geannuleerd. Jammer dat je niet kunt komen!`
        );

        // Clear the cancel form
        e.target.reset();
      } else {
        alert(
          `Geen aanmelding gevonden voor "${name}". Controleer of je naam correct is gespeld. HOOFDLETTER GEVOELIG!`
        );
      }
    } catch (error) {
      console.error("Error canceling RSVP:", error);
      alert("Er ging iets mis bij het annuleren. Probeer het opnieuw.");
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
