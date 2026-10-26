// When configured, the app uses Supabase Auth and the protected database.
// The browser-only preview remains available until project credentials are added.
const DEMO_WORKERS = [
  { id: "demo-1", name: "Wanjiku Njeri", service: "Plumber", area: "Kilimani", years: 8, initials: "WN", tags: ["Leaks & repairs", "Water heaters"], phone: "", demo: true },
  { id: "demo-2", name: "Musa Otieno", service: "Electrician", area: "South B", years: 6, initials: "MO", tags: ["Wiring", "Lighting"], phone: "", demo: true },
  { id: "demo-3", name: "Amina Hassan", service: "Tailor", area: "Eastleigh", years: 11, initials: "AH", tags: ["Alterations", "Custom wear"], phone: "", demo: true },
  { id: "demo-4", name: "Peter Kamau", service: "Carpenter", area: "Kasarani", years: 9, initials: "PK", tags: ["Furniture", "Fittings"], phone: "", demo: true },
  { id: "demo-5", name: "Grace Wambui", service: "House cleaner", area: "Lavington", years: 5, initials: "GW", tags: ["Deep cleaning", "Move-in"], phone: "", demo: true },
  { id: "demo-6", name: "Brian Mwangi", service: "Painter", area: "Roysambu", years: 7, initials: "BM", tags: ["Interior", "Finishing"], phone: "", demo: true },
  { id: "demo-7", name: "Fatuma Ali", service: "Hair stylist", area: "Ngara", years: 10, initials: "FA", tags: ["Braids", "Natural hair"], phone: "", demo: true },
  { id: "demo-8", name: "Joseph Maina", service: "Mechanic", area: "Industrial Area", years: 12, initials: "JM", tags: ["Diagnostics", "Servicing"], phone: "", demo: true },
  { id: "demo-9", name: "Lydia Achieng", service: "Caterer", area: "Westlands", years: 6, initials: "LA", tags: ["Events", "Home meals"], phone: "", demo: true }
];
const KEYS = { accounts: "jirani-preview-accounts", session: "jirani-preview-session" };
const supabaseConfig = window.JIRANI_SUPABASE_CONFIG || {};
const backendConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
let supabaseClient = null;
let backendSession = null;
let backendProfile = null;
let backendWorkers = [];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const serviceFilter = $("#service-filter");
const areaFilter = $("#area-filter");
const categoryRow = $("#category-row");
const listingGrid = $("#listing-grid");
const resultCount = $("#result-count");
const emptyState = $("#empty-state");
const authModal = $("#auth-modal");
const profileModal = $("#profile-modal");
let authMode = "login";
let selectedCategory = "";
let toastTimer;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function accounts() { return read(KEYS.accounts, []); }
function currentUser() {
  if (backendConfigured) {
    const authUser = backendSession?.user;
    if (!authUser) return null;
    const metadata = authUser.user_metadata || {};
    const profile = backendProfile ? {
      service: backendProfile.service,
      area: backendProfile.locality,
      phone: backendProfile.contact_phone,
      years: backendProfile.years_experience,
      skills: backendProfile.skills.join(", ")
    } : null;
    return {
      id: authUser.id,
      name: metadata.display_name || authUser.email?.split("@")[0] || "Neighbor",
      email: authUser.email || "",
      role: metadata.account_type === "worker" ? "worker" : "customer",
      profile,
      verification: backendProfile?.verification_status || "unverified"
    };
  }
  const sessionEmail = read(KEYS.session, "");
  return accounts().find((account) => account.email === sessionEmail) || null;
}
function saveAccounts(value) { localStorage.setItem(KEYS.accounts, JSON.stringify(value)); }
function saveAccount(updated) {
  const all = accounts();
  const index = all.findIndex((account) => account.email === updated.email);
  if (index < 0) all.push(updated); else all[index] = updated;
  saveAccounts(all);
}
function allWorkers() {
  if (backendConfigured) return backendWorkers;
  const members = accounts().filter((account) => account.role === "worker" && account.profile).map((account) => ({
    id: account.email, name: account.name, service: account.profile.service, area: account.profile.area,
    years: Number(account.profile.years) || 0, initials: account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
    tags: account.profile.skills.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3), phone: account.profile.phone, verification: account.verification || "unverified", demo: false
  }));
  return [...members, ...DEMO_WORKERS];
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("#auth-title").innerHTML = signup ? "Join your <em>neighborhood.</em>" : "Welcome to <em>Jirani.</em>";
  $("#auth-subtitle").textContent = signup ? "Create an account to find local help or offer your skills." : "Find someone good nearby, or let your neighborhood find you.";
  $("#auth-submit").innerHTML = signup ? "Create account <span>→</span>" : "Log in <span>→</span>";
  $("#name-wrap").hidden = !signup;
  $("#role-picker").hidden = !signup;
  $("#auth-form").elements.password.autocomplete = signup ? "new-password" : "current-password";
  $("#auth-notice").innerHTML = backendConfigured
    ? '<span>ⓘ</span> Secure sign-in is connected. New accounts must confirm their email before first login.'
    : '<span>ⓘ</span> Preview mode: accounts stay in this browser only. Real secure sign-in will be connected before launch.';
  $$('[data-auth-tab]').forEach((tab) => tab.classList.toggle("active", tab.dataset.authTab === mode));
  $("#auth-switch").innerHTML = signup ? 'Already joined? <button type="button" data-auth-tab="login">Log in</button>' : 'New to Jirani? <button type="button" data-auth-tab="signup">Create an account</button>';
  $("#form-error").textContent = "";
}
function openAuth(mode = "login", role = "customer") {
  setAuthMode(mode);
  const roleInput = $(`input[name="role"][value="${role}"]`);
  if (roleInput) roleInput.checked = true;
  authModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => $("#auth-form input[type=email]")?.focus(), 40);
}
function closeModal(modal) {
  modal.hidden = true;
  if (authModal.hidden && profileModal.hidden) document.body.classList.remove("modal-open");
}
function updateAccountActions() {
  const user = currentUser();
  const container = $("#account-actions");
  if (!user) {
    container.innerHTML = '<button class="login-link" data-open-auth="login">Log in</button><button class="worker-cta" data-open-auth="signup">Join Jirani <span aria-hidden="true">↗</span></button>';
    return;
  }
  container.innerHTML = `<button class="welcome-link" data-open-dashboard>Hi, ${escapeHtml(user.name.split(" ")[0])}</button><button class="worker-cta" data-signout>Log out <span aria-hidden="true">↗</span></button>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function mapBackendWorker(row) {
  const initials = row.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return {
    id: row.user_id,
    name: row.display_name,
    service: row.service,
    area: row.locality,
    years: Number(row.years_experience) || 0,
    initials,
    tags: row.skills || [],
    phone: row.contact_phone,
    verification: row.verification_status,
    demo: false
  };
}
async function loadBackendWorkers() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("worker_profiles")
    .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,verification_status")
    .eq("is_listed", true)
    .eq("contact_consent", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  backendWorkers = (data || []).map(mapBackendWorker);
}
async function loadOwnBackendProfile() {
  const authUser = backendSession?.user;
  if (!supabaseClient || !authUser || authUser.user_metadata?.account_type !== "worker") {
    backendProfile = null;
    return;
  }
  const { data, error } = await supabaseClient
    .from("worker_profiles")
    .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,contact_consent,is_listed,verification_status")
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (error) throw error;
  backendProfile = data;
}
async function refreshBackendState() {
  try {
    await Promise.all([loadBackendWorkers(), loadOwnBackendProfile()]);
    updateAccountActions();
    render();
  } catch (error) {
    showToast(`Backend connection issue: ${error.message}`);
  }
}
async function initializeBackend() {
  if (!backendConfigured) return;
  if (!window.supabase?.createClient) {
    showToast("The Supabase client did not load. Check your internet connection and reload.");
    return;
  }
  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      backendSession = session;
      backendProfile = null;
      setTimeout(() => refreshBackendState(), 0);
    });
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    backendSession = data.session;
    await refreshBackendState();
  } catch (error) {
    showToast(`Could not connect to Jirani's backend: ${error.message}`);
  }
}
function renderFilterOptions() {
  const workers = allWorkers();
  const currentService = serviceFilter.value;
  const currentArea = areaFilter.value;
  const services = [...new Set(workers.map((worker) => worker.service))].sort();
  const areas = [...new Set(workers.map((worker) => worker.area))].sort();
  serviceFilter.replaceChildren(new Option("Any service", ""), ...services.map((item) => new Option(item, item)));
  areaFilter.replaceChildren(new Option("Everywhere", ""), ...areas.map((item) => new Option(item, item)));
  serviceFilter.value = services.includes(currentService) ? currentService : "";
  areaFilter.value = areas.includes(currentArea) ? currentArea : "";
  const active = selectedCategory;
  categoryRow.replaceChildren();
  services.forEach((service) => {
    const chip = document.createElement("button");
    chip.className = "category-chip";
    chip.type = "button";
    chip.textContent = service;
    chip.dataset.service = service;
    chip.classList.toggle("active", service === active);
    chip.addEventListener("click", () => {
      selectedCategory = selectedCategory === service ? "" : service;
      serviceFilter.value = selectedCategory;
      render();
    });
    categoryRow.append(chip);
  });
}
function makeCard(worker, index) {
  const card = document.createElement("article");
  card.className = "worker-card";
  const top = document.createElement("div");
  top.className = "card-top";
  const avatar = document.createElement("div");
  avatar.className = `worker-avatar color-${index % 5}`;
  avatar.textContent = worker.initials;
  top.append(avatar);
  const badge = document.createElement("span");
  badge.className = `availability ${worker.verification === "verified" ? "verified" : worker.demo ? "sample" : "unverified"}`;
  badge.textContent = worker.verification === "verified" ? "Identity checked" : worker.demo ? "Sample profile" : "Not verified";
  top.append(badge);
  const name = document.createElement("h3"); name.textContent = worker.name;
  const role = document.createElement("p"); role.className = "worker-role"; role.textContent = worker.service;
  const details = document.createElement("div"); details.className = "worker-details";
  const area = document.createElement("span"); area.className = "worker-area";
  const pin = document.createElement("span"); pin.setAttribute("aria-hidden", "true"); pin.textContent = "⌖";
  area.append(pin, document.createTextNode(worker.area));
  const years = document.createElement("span"); years.className = "work-years"; years.textContent = `${worker.years} years’ experience`;
  details.append(area, years);
  const tags = document.createElement("div"); tags.className = "card-tags";
  (worker.tags.length ? worker.tags : ["Local service"]).forEach((tag) => { const item = document.createElement("span"); item.className = "card-tag"; item.textContent = tag; tags.append(item); });
  const actions = document.createElement("div"); actions.className = "card-actions";
  if (worker.demo || !worker.phone) {
    const label = document.createElement("span"); label.className = "card-button unavailable"; label.textContent = "Sample profile";
    const contact = document.createElement("button"); contact.className = "card-button primary"; contact.type = "button"; contact.textContent = "Contact worker"; contact.disabled = true;
    actions.append(label, contact);
  } else {
    const call = document.createElement("a"); call.className = "card-button"; call.href = `tel:${worker.phone}`; call.textContent = "Call ↗";
    const whatsapp = document.createElement("a"); whatsapp.className = "card-button primary"; whatsapp.href = `https://wa.me/${worker.phone.replace(/\D/g, "")}`; whatsapp.target = "_blank"; whatsapp.rel = "noopener noreferrer"; whatsapp.textContent = "WhatsApp ↗";
    actions.append(call, whatsapp);
  }
  card.append(top, name, role, details, tags, actions);
  return card;
}
function render() {
  renderFilterOptions();
  const service = serviceFilter.value;
  const area = areaFilter.value;
  const matches = allWorkers().filter((worker) => (!service || worker.service.toLowerCase() === service.toLowerCase()) && (!area || worker.area.toLowerCase() === area.toLowerCase()));
  listingGrid.replaceChildren(...matches.map((worker, index) => makeCard(worker, index)));
  resultCount.textContent = `${matches.length} ${matches.length === 1 ? "person" : "people"}`;
  emptyState.hidden = matches.length > 0;
  listingGrid.hidden = matches.length === 0;
  selectedCategory = service;
  $$(".category-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.service === service));
}
function openDashboard() {
  const user = currentUser();
  if (!user) return openAuth("login");
  $("#home-view").hidden = true;
  $("#directory").hidden = true;
  $("#how-view").hidden = true;
  $(".worker-banner").hidden = true;
  const dashboard = $("#dashboard-view");
  dashboard.hidden = false;
  const isWorker = user.role === "worker";
  const profile = user.profile;
  const statusLabel = user.verification === "pending" ? "Request received" : user.verification === "verified" ? "Identity checked" : user.verification === "rejected" ? "Review declined" : "Not verified yet";
  const statusDescription = user.verification === "pending" ? "A Jirani reviewer will check your submission." : user.verification === "verified" ? "A reviewer checked your submitted evidence." : user.verification === "rejected" ? "You can update your details and request another review." : "Request a review of your identity and work references.";
  const accountNote = backendConfigured
    ? "Your account and worker listing are stored in Jirani’s hosted backend."
    : "Preview account: this prototype saves account details only in this browser. Login and verification are simulated.";
  dashboard.innerHTML = `<div class="dashboard-wrap">
    <div class="dashboard-head"><div><div class="eyebrow section-eyebrow">YOUR JIRANI ACCOUNT</div><h1>Hello, <em>${escapeHtml(user.name.split(" ")[0])}.</em></h1><p>Manage your account and keep your local details up to date.</p></div><button class="outline-button" data-back-home>← Back to directory</button></div>
    <div class="dashboard-grid">
      <section class="dashboard-card"><div class="dash-card-heading"><span class="dash-icon">${isWorker ? "✳" : "⌕"}</span><div><h2>${isWorker ? "Your worker profile" : "Your account"}</h2><p>${isWorker ? "How neighbors see your listing" : "Your Jirani details"}</p></div></div>
        ${isWorker && profile ? `<div class="profile-summary"><div><span>Service</span><b>${escapeHtml(profile.service)}</b></div><div><span>Work area</span><b>${escapeHtml(profile.area)}</b></div><div><span>Contact phone</span><b>${escapeHtml(profile.phone)}</b></div><div><span>Experience</span><b>${escapeHtml(profile.years)} years</b></div></div><button class="outline-button full-button" data-edit-profile>Edit profile</button>` : isWorker ? `<p class="dash-copy">Finish your profile so people nearby can find and contact you.</p><button class="submit-button" data-create-profile>Create my worker profile <span>→</span></button>` : `<div class="profile-summary"><div><span>Name</span><b>${escapeHtml(user.name)}</b></div><div><span>Email</span><b>${escapeHtml(user.email)}</b></div></div><button class="outline-button full-button" data-back-home>Find a worker</button>`}
      </section>
      <section class="dashboard-card verification-card"><div class="dash-card-heading"><span class="dash-icon shield">✓</span><div><h2>Trust & verification</h2><p>Clear signals help neighbors make informed choices</p></div></div>
        ${isWorker ? `<div class="verification-status"><span class="status-dot ${user.verification === "pending" ? "pending" : user.verification === "verified" ? "checked" : ""}"></span><div><b>${statusLabel}</b><small>${statusDescription}</small></div></div><p class="verification-explainer">Verification is a human review of details and references. It does not guarantee work quality, safety, or outcomes.</p>${user.verification === "pending" || user.verification === "verified" ? "" : `<button class="outline-button full-button" data-request-verification ${!profile ? "disabled" : ""}>Request verification</button>`}` : `<div class="verification-status"><span class="status-dot"></span><div><b>Check details before hiring</b><small>Contact workers directly and agree on scope, price, and timing.</small></div></div><p class="verification-explainer">${backendConfigured ? "Listings are supplied by individual workers. Check details directly before agreeing to a job." : "Sample profiles in this preview are fictional. Never pay a deposit before you have agreed on the work and verified who you are dealing with."}</p>`}
      </section>
    </div>
    <div class="demo-warning"><span>ⓘ</span><p>${escapeHtml(accountNote)}</p></div>
  </div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function backHome() {
  $("#home-view").hidden = false; $("#directory").hidden = false; $("#how-view").hidden = false; $(".worker-banner").hidden = false; $("#dashboard-view").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function signOut() {
  if (backendConfigured) {
    if (!supabaseClient) { showToast("The backend is not connected yet."); return; }
    const { error } = await supabaseClient.auth.signOut();
    if (error) { showToast(error.message); return; }
    backendSession = null;
    backendProfile = null;
    updateAccountActions();
    backHome();
    showToast("You’re logged out.");
    return;
  }
  localStorage.removeItem(KEYS.session);
  updateAccountActions();
  backHome();
  showToast("You’re logged out.");
}
async function requestVerification() {
  const user = currentUser();
  if (!user?.profile) return;
  if (backendConfigured) {
    if (!supabaseClient) { showToast("The backend is not connected yet."); return; }
    const { error } = await supabaseClient.from("verification_requests").insert({
      worker_id: user.id,
      note: "Worker requested a profile verification review."
    });
    if (error) { showToast(error.message); return; }
    await loadOwnBackendProfile();
    openDashboard();
    showToast("Request sent. A reviewer will check your submission.");
    return;
  }
  saveAccount({ ...user, verification: "pending", verificationRequestedAt: new Date().toISOString() });
  openDashboard();
  showToast("Verification request saved in this browser preview.");
}
function showProfileForm(existing = null) {
  const form = $("#profile-form");
  const user = currentUser();
  if (!user) return;
  $("#profile-form .legal-note").textContent = backendConfigured
    ? "Your profile is stored in Jirani’s database and shown in the directory only with your consent."
    : "This preview stores it only in this browser.";
  form.elements.service.value = existing?.service || "";
  form.elements.area.value = existing?.area || "";
  form.elements.phone.value = existing?.phone || "";
  form.elements.years.value = existing?.years || "";
  form.elements.skills.value = existing?.skills || "";
  form.elements.consent.checked = false;
  $("#profile-error").textContent = "";
  profileModal.hidden = false;
  document.body.classList.add("modal-open");
}
async function handleSignup(formData) {
  const name = formData.get("name").trim();
  const email = formData.get("email").trim().toLowerCase();
  const role = formData.get("role");
  const password = formData.get("password");
  if (!name) throw new Error("Add your name to create an account.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
  if (backendConfigured) {
    if (!supabaseClient) throw new Error("Backend is not connected yet. Check the project URL and publishable key.");
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name, account_type: role },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`
      }
    });
    if (error) throw error;
    if (!data.session) {
      closeModal(authModal);
      showToast("Check your email and confirm your account. Then log in to continue.");
      return;
    }
    backendSession = data.session;
    await refreshBackendState();
    closeModal(authModal);
    if (role === "worker") showProfileForm();
    else { openDashboard(); showToast("Your account is ready."); }
    return;
  }
  if (accounts().some((account) => account.email === email)) throw new Error("An account with this email already exists in this browser. Try logging in.");
  const user = { name, email, role, profile: null, verification: "unverified", createdAt: new Date().toISOString() };
  saveAccount(user);
  localStorage.setItem(KEYS.session, JSON.stringify(email));
  closeModal(authModal); updateAccountActions();
  if (role === "worker") showProfileForm(); else { openDashboard(); showToast("Your preview account is ready."); }
}
async function handleLogin(formData) {
  const email = formData.get("email").trim().toLowerCase();
  const password = formData.get("password");
  if (!/^\S+@\S+\.\S+$/.test(email) || !password) throw new Error("Enter the email and password you used to sign up.");
  if (backendConfigured) {
    if (!supabaseClient) throw new Error("Backend is not connected yet. Check the project URL and publishable key.");
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    backendSession = data.session;
    await refreshBackendState();
    closeModal(authModal);
    openDashboard();
    showToast("You’re signed in.");
    return;
  }
  const user = accounts().find((account) => account.email === email);
  if (!user) throw new Error("No preview account for that email in this browser. Create an account first.");
  localStorage.setItem(KEYS.session, JSON.stringify(email));
  closeModal(authModal); updateAccountActions(); openDashboard(); showToast("You’re logged in to this browser preview.");
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  $("#form-error").textContent = "";
  try { if (authMode === "signup") await handleSignup(data); else await handleLogin(data); }
  catch (error) { $("#form-error").textContent = error.message; }
  // Passwords are deliberately never saved in local preview storage.
  form.elements.password.value = "";
});
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const error = $("#profile-error"); error.textContent = "";
  if (!/^\+?[0-9 ()-]{8,20}$/.test(data.get("phone").trim())) { error.textContent = "Enter a valid phone number, including the country code."; return; }
  if (!data.get("consent")) { error.textContent = "Please agree to show your profile details in the directory."; return; }
  const user = currentUser();
  const profile = { service: data.get("service").trim(), area: data.get("area").trim(), phone: data.get("phone").trim(), years: Number(data.get("years")), skills: data.get("skills").trim() };
  if (!profile.service || !profile.area || !profile.phone || !Number.isFinite(profile.years)) { error.textContent = "Please complete each required field."; return; }
  if (backendConfigured) {
    if (!supabaseClient || !user?.id) { error.textContent = "Sign in again before saving your profile."; return; }
    const skills = profile.skills.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
    const { data: savedProfile, error: saveError } = await supabaseClient
      .from("worker_profiles")
      .upsert({
        user_id: user.id,
        display_name: user.name,
        service: profile.service,
        locality: profile.area,
        contact_phone: profile.phone,
        years_experience: profile.years,
        skills,
        contact_consent: true,
        is_listed: true
      }, { onConflict: "user_id" })
      .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,contact_consent,is_listed,verification_status")
      .single();
    if (saveError) { error.textContent = saveError.message; return; }
    backendProfile = savedProfile;
    try { await loadBackendWorkers(); }
    catch (loadError) { error.textContent = `Profile saved, but the directory refresh failed: ${loadError.message}`; return; }
    closeModal(profileModal); render(); updateAccountActions(); openDashboard();
    showToast("Your worker profile is listed in the directory.");
    return;
  }
  saveAccount({ ...user, profile });
  closeModal(profileModal); render(); updateAccountActions(); openDashboard(); showToast("Worker profile saved in this browser preview.");
});

document.addEventListener("click", async (event) => {
  const authButton = event.target.closest("[data-open-auth]");
  if (authButton) { openAuth(authButton.dataset.openAuth, authButton.dataset.role || "customer"); return; }
  const tab = event.target.closest("[data-auth-tab]");
  if (tab) { setAuthMode(tab.dataset.authTab); return; }
  if (event.target.closest(".modal-close")) { closeModal(event.target.closest(".modal-backdrop")); return; }
  if (event.target.classList.contains("modal-backdrop")) { closeModal(event.target); return; }
  if (event.target.closest("[data-open-dashboard]")) { openDashboard(); return; }
  if (event.target.closest("[data-signout]")) { await signOut(); return; }
  if (event.target.closest("[data-back-home]")) { backHome(); return; }
  if (event.target.closest("[data-create-profile]")) { showProfileForm(); return; }
  if (event.target.closest("[data-edit-profile]")) { showProfileForm(currentUser()?.profile); return; }
  if (event.target.closest("[data-request-verification]")) {
    await requestVerification();
    return;
  }
  const nav = event.target.closest("[data-view]");
  if (nav) {
    if (nav.dataset.view === "how") $("#how-view").scrollIntoView({ behavior: "smooth" });
    else { backHome(); $("#directory").scrollIntoView({ behavior: "smooth" }); }
    $$(".nav-link").forEach((link) => link.classList.toggle("active", link === nav));
  }
});
serviceFilter.addEventListener("change", render);
areaFilter.addEventListener("change", render);
$("#search-form").addEventListener("submit", (event) => { event.preventDefault(); render(); $("#directory").scrollIntoView({ behavior: "smooth" }); });
$("#reset-filters").addEventListener("click", () => { serviceFilter.value = ""; areaFilter.value = ""; selectedCategory = ""; render(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeModal(authModal); closeModal(profileModal); } });

updateAccountActions();
render();
initializeBackend();


async function shareJirani() {
  const url = "https://mukalamathew19-gif.github.io/jirani/";
  const shareData = { title: "Jirani — good people, closer to home", text: "Find local skills or share your own with your neighborhood on Jirani.", url };
  if (navigator.share) {
    try { await navigator.share(shareData); }
    catch (error) { if (error.name !== "AbortError") showToast("Could not open the share menu. Copy the Jirani link from your browser address bar."); }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Jirani link copied. Share it in a message or on social media.");
  } catch { showToast(`Copy and share the Jirani link: ${url}`); }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-share-app]")) await shareJirani();
});

document.addEventListener("click", (event) => {
  const inviteButton = event.target.closest(".directory-footer [data-open-auth]");
  if (!inviteButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  shareJirani();
}, true);


const directorySection = $("#directory");
if (directorySection && !directorySection.querySelector(".text-size-control")) {
  const control = document.createElement("div");
  control.className = "text-size-control";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Text size");
  control.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:7px;margin:12px 0;color:#596357;font-size:14px";
  const label = document.createElement("span"); label.textContent = "Text size"; control.append(label);
  [[1,"A","Standard text size"],[1.1,"A+","Large text"],[1.2,"A++","Largest text"]].forEach(([size,text,name]) => {
    const button = document.createElement("button"); button.type = "button"; button.dataset.fontSize = String(size); button.setAttribute("aria-label", name); button.setAttribute("aria-pressed", "false"); button.textContent = text;
    button.style.cssText = "min-width:42px;min-height:42px;padding:6px 9px;border:1px solid #dfe4da;border-radius:5px;background:#fff;color:#28573d;font:600 16px sans-serif";
    button.addEventListener("click", () => { const chosen=Number(size); document.documentElement.style.zoom=String(chosen); localStorage.setItem("jirani-font-scale",String(chosen)); control.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.fontSize)===chosen))); });
    control.append(button);
  });
  $("#directory .section-heading")?.after(control);
  const chosen=Number(localStorage.getItem("jirani-font-scale")||1.1); document.documentElement.style.zoom=String(chosen);
  control.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.fontSize)===chosen)));
}
document.addEventListener("click", (event) => {
  const invite = event.target.closest(".directory-footer button");
  if (!invite) return;
  event.preventDefault(); event.stopImmediatePropagation(); shareJirani();
}, true);
