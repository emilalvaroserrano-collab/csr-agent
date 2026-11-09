const form = document.getElementById("leadForm");
const toastEl = document.getElementById("toast");

function toast(t) {
  if (!toastEl) return;
  toastEl.textContent = t;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const lead = {
    name: document.getElementById("leadName").value.trim(),
    company: document.getElementById("leadCompany").value.trim(),
    requirement: document.getElementById("leadReason").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    email: document.getElementById("leadEmail").value.trim(),
    submittedAt: Date.now(),
  };
  try {
    sessionStorage.setItem("abi-tech-pending-lead", JSON.stringify(lead));
    localStorage.setItem("abi-tech-last-lead", JSON.stringify(lead));
    window.location.assign("/calling");
  } catch (err) {
    console.error(err);
    alert("Your browser blocked site storage. Please allow storage and try again.");
  }
});

const navCall = document.getElementById("navCall");
if (navCall) {
  navCall.addEventListener("click", (e) => {
    let hasLead = false;
    try {
      hasLead = !!(sessionStorage.getItem("abi-tech-pending-lead") || localStorage.getItem("abi-tech-last-lead"));
    } catch (_) {}
    if (!hasLead) {
      e.preventDefault();
      toast("Submit your details first to start a support call.");
      document.getElementById("leadName")?.focus();
    }
  });
}

const navHelp = document.getElementById("navHelp");
if (navHelp) {
  navHelp.addEventListener("click", () => {
    toast("Need help? Submit the form and Abbie will assist you.");
  });
}
