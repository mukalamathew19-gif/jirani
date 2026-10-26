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
const KEYS = { accounts: "jirani-preview-accounts", session: "jirani-preview-session", favorites: "jirani-favorites", settings: "jirani-settings", requests: "jirani-preview-requests", reviews: "jirani-preview-reviews" };
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
let pendingQuoteWorker = null;
let backendRequests = [];
let backendReviews = [];
let installPrompt = null;
let lastModalTrigger = null;
let deepLinkHandled = false;

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
      skills: backendProfile.skills.join(", "),
      bio: backendProfile.bio || "", priceHint: backendProfile.price_hint || "",
      availability: backendProfile.availability || "available", isListed: backendProfile.is_listed
    } : null;
    return {
      id: authUser.id,
      name: metadata.display_name || authUser.email?.split("@")[0] || "Neighbor",
      email: authUser.email || "",
      role: metadata.account_type === "worker" ? "worker" : "customer",
      profile,
      isListed: backendProfile?.is_listed ?? false,
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
  const previews = read(KEYS.reviews, []);
  const members = accounts().filter((account) => account.role === "worker" && account.profile?.isListed !== false && account.profile).map((account) => {
    const reviews = previews.filter((review) => String(review.workerId) === String(account.email));
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return {
      id: account.email, name: account.name, service: account.profile.service, area: account.profile.area,
      years: Number(account.profile.years) || 0, initials: account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      tags: (account.profile.skills || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3), phone: account.profile.phone, verification: account.verification || "unverified", demo: false,
      bio: account.profile.bio || "", priceHint: account.profile.priceHint || "", availability: account.profile.availability || "available", rating: reviews.length ? total / reviews.length : 0, reviewCount: reviews.length
    };
  });
  return [...members, ...DEMO_WORKERS];
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}
function settings() { return read(KEYS.settings, {}); }
function saveSettings(next) {
  const value = { ...settings(), ...next };
  localStorage.setItem(KEYS.settings, JSON.stringify(value));
  return value;
}
function setFontScale(scale) {
  const value = [1, 1.1, 1.2].includes(Number(scale)) ? Number(scale) : 1.1;
  document.documentElement.style.zoom = String(value);
  saveSettings({ fontSize: value });
  $$('[data-font-size]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.fontSize) === value)));
}
function applyDisplaySettings() {
  const prefs = settings();
  document.body.classList.toggle("high-contrast", Boolean(prefs.highContrast));
  document.body.classList.toggle("reduce-motion", Boolean(prefs.reduceMotion));
  $("#setting-contrast").checked = Boolean(prefs.highContrast);
  $("#setting-motion").checked = Boolean(prefs.reduceMotion);
  setFontScale(prefs.fontSize || 1.1);
}
function openSettings() {
  const user = currentUser();
  $("#settings-account-copy").textContent = user ? `${user.name} · ${user.email}` : "You are browsing Jirani.";
  $("[data-settings-signout]").hidden = !user;
  const row = $("#listing-setting-row");
  const copy = $("#privacy-settings-copy");
  const available = Boolean(user?.role === "worker" && user.profile);
  row.hidden = !available;
  copy.hidden = available;
  if (available) $("#setting-listed").checked = Boolean(user.isListed);
  showModal($("#settings-modal"));
}
function closeSettings() { closeModal($("#settings-modal")); }
function showModal(modal) {
  lastModalTrigger = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-close")?.focus();
}
async function shareJirani() {
  const url = "https://mukalamathew19-gif.github.io/jirani/";
  const data = { title: "Jirani — good people, closer to home", text: "Find local skills or share your own with your neighborhood on Jirani.", url };
  if (navigator.share) { try { await navigator.share(data); } catch (error) { if (error.name !== "AbortError") showToast("Could not open the share menu. Copy the Jirani link from the address bar."); } return; }
  await copyShareLink(url);
}
async function copyShareLink(url) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    else {
      const field = document.createElement("textarea");
      field.value = url; field.setAttribute("readonly", ""); field.style.position = "fixed"; field.style.opacity = "0";
      document.body.append(field); field.select();
      const copied = document.execCommand("copy"); field.remove();
      if (!copied) throw new Error("Clipboard unavailable");
    }
    showToast("Link copied. Send it to a neighbor or share it in a group.");
  } catch { showToast(`Copy this Jirani link to share: ${url}`); }
}
function highlightSharedWorker() {
  if (deepLinkHandled) return;
  const workerId = new URLSearchParams(location.search).get("worker");
  if (!workerId) { deepLinkHandled = true; return; }
  const worker = findWorker(workerId);
  if (!worker) return;
  deepLinkHandled = true;
  setTimeout(() => {
    const card = $(`[data-worker-id="${CSS.escape(String(worker.id))}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("shared-highlight");
    setTimeout(() => card?.classList.remove("shared-highlight"), 2800);
    history.replaceState({}, "", `${location.pathname}#directory`);
    showToast(`Showing ${worker.name}’s Jirani profile.`);
  }, 160);
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
  showModal(authModal);
  setTimeout(() => $("#auth-form input[type=email]")?.focus(), 40);
}
function closeModal(modal) {
  modal.hidden = true;
  const remaining = $$(".modal-backdrop").filter((item) => !item.hidden);
  document.body.classList.toggle("modal-open", remaining.length > 0);
  if (!remaining.length) lastModalTrigger?.focus?.();
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
    bio: row.bio || "", priceHint: row.price_hint || "",
    availability: row.availability || "available",
    rating: row.rating || 0, reviewCount: row.reviewCount || 0,
    verification: row.verification_status,
    demo: false
  };
}
async function loadBackendWorkers() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("worker_profiles")
    .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,verification_status,bio,price_hint,availability")
    .eq("is_listed", true)
    .eq("contact_consent", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const { data: reviews, error: reviewError } = await supabaseClient.from("worker_reviews").select("worker_id,rating");
  if (reviewError) throw reviewError;
  backendReviews = reviews || [];
  const ratings = new Map();
  backendReviews.forEach(({ worker_id, rating }) => {
    const entry = ratings.get(worker_id) || { total: 0, count: 0 };
    entry.total += Number(rating); entry.count += 1; ratings.set(worker_id, entry);
  });
  backendWorkers = (data || []).map((row) => {
    const rating = ratings.get(row.user_id) || { total: 0, count: 0 };
    return mapBackendWorker({ ...row, rating: rating.count ? rating.total / rating.count : 0, reviewCount: rating.count });
  });
}
async function loadOwnBackendProfile() {
  const authUser = backendSession?.user;
  if (!supabaseClient || !authUser || authUser.user_metadata?.account_type !== "worker") {
    backendProfile = null;
    return;
  }
  const { data, error } = await supabaseClient
    .from("worker_profiles")
    .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,contact_consent,is_listed,verification_status,bio,price_hint,availability")
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
    highlightSharedWorker();
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
  card.dataset.workerId = worker.id;
  const top = document.createElement("div");
  top.className = "card-top";
  const avatar = document.createElement("div");
  avatar.className = `worker-avatar color-${index % 5}`;
  avatar.textContent = worker.initials;
  top.append(avatar);
  const badge = document.createElement("span");
  badge.className = `availability ${worker.verification === "verified" ? "verified" : worker.demo ? "sample" : "unverified"}`;
  badge.textContent = worker.verification === "verified" ? "Identity checked" : worker.demo ? "Sample profile" : "Not verified";
  if (worker.availability === "paused") badge.textContent = "Not taking jobs";
  top.append(badge);
  const name = document.createElement("h3"); name.textContent = worker.name;
  const role = document.createElement("p"); role.className = "worker-role"; role.textContent = worker.service;
  const details = document.createElement("div"); details.className = "worker-details";
  const area = document.createElement("span"); area.className = "worker-area";
  const pin = document.createElement("span"); pin.setAttribute("aria-hidden", "true"); pin.textContent = "⌖";
  area.append(pin, document.createTextNode(worker.area));
  const years = document.createElement("span"); years.className = "work-years"; years.textContent = `${worker.years} years’ experience`;
  const availability = document.createElement("span");
  availability.className = `availability-state ${worker.availability || "available"}`;
  availability.textContent = worker.availability === "busy" ? "Limited availability" : worker.availability === "paused" ? "Taking a break" : "Available";
  details.append(area, years, availability);
  const tags = document.createElement("div"); tags.className = "card-tags";
  (worker.tags.length ? worker.tags : ["Local service"]).forEach((tag) => { const item = document.createElement("span"); item.className = "card-tag"; item.textContent = tag; tags.append(item); });
  const trust = document.createElement("p"); trust.className = "card-trust";
  trust.textContent = worker.reviewCount ? `★ ${worker.rating.toFixed(1)} · ${worker.reviewCount} ${worker.reviewCount === 1 ? "review" : "reviews"}` : "New to Jirani · no reviews yet";
  const description = document.createElement("p"); description.className = "card-description"; description.textContent = worker.bio || "Local professional ready to discuss your project.";
  const quote = document.createElement("p"); quote.className = "card-price"; quote.textContent = worker.priceHint || "Ask for a quote";
  const expanded = document.createElement("div"); expanded.className = "card-expanded"; expanded.hidden = true;
  expanded.append(description, quote);
  const detailActions = document.createElement("div"); detailActions.className = "detail-actions";
  const report = document.createElement("button"); report.type = "button"; report.className = "text-action report-action"; report.dataset.reportWorker = worker.id; report.textContent = "Report profile";
  const share = document.createElement("button"); share.type = "button"; share.className = "text-action"; share.dataset.shareWorker = worker.id; share.textContent = "Share profile ↗";
  detailActions.append(report, share); expanded.append(detailActions);
  const actions = document.createElement("div"); actions.className = "card-actions";
  const favorite = document.createElement("button"); favorite.type = "button"; favorite.className = "card-button favorite-button";
  favorite.dataset.favoriteWorker = worker.id;
  const isFavorite = read(KEYS.favorites, []).includes(String(worker.id));
  favorite.setAttribute("aria-pressed", String(isFavorite)); favorite.textContent = isFavorite ? "♥ Saved" : "♡ Save";
  const view = document.createElement("button"); view.type = "button"; view.className = "card-button"; view.dataset.toggleDetails = ""; view.setAttribute("aria-expanded", "false"); view.textContent = "Profile details";
  const request = document.createElement("button"); request.type = "button"; request.className = "card-button primary"; request.dataset.requestQuote = worker.id; request.textContent = worker.availability === "paused" ? "Unavailable" : "Request a quote"; request.disabled = worker.availability === "paused";
  actions.append(favorite, view, request);
  if (!worker.demo && worker.phone) {
    const call = document.createElement("a"); call.className = "card-button"; call.href = `tel:${worker.phone}`; call.textContent = "Call ↗";
    let whatsappPhone = worker.phone.replace(/\D/g, "");
    if (whatsappPhone.startsWith("0")) whatsappPhone = `254${whatsappPhone.slice(1)}`;
    const whatsapp = document.createElement("a"); whatsapp.className = "card-button primary"; whatsapp.href = `https://wa.me/${whatsappPhone}`; whatsapp.target = "_blank"; whatsapp.rel = "noopener noreferrer"; whatsapp.textContent = "WhatsApp ↗";
    detailActions.append(call, whatsapp);
  }
  card.append(top, name, role, details, tags, trust, actions, expanded);
  return card;
}
function render() {
  renderFilterOptions();
  const service = serviceFilter.value;
  const area = areaFilter.value;
  const query = $("#directory-query")?.value.trim().toLowerCase() || "";
  const sort = $("#sort-workers")?.value || "recent";
  const favoritesOnly = Boolean($("#favorites-only")?.checked);
  const favorites = read(KEYS.favorites, []);
  let matches = allWorkers().filter((worker) => (!favoritesOnly || favorites.includes(String(worker.id))) && (!service || worker.service.toLowerCase() === service.toLowerCase()) && (!area || worker.area.toLowerCase() === area.toLowerCase()) && (!query || [worker.name, worker.service, worker.area, worker.bio, ...(worker.tags || [])].join(" ").toLowerCase().includes(query)));
  if (sort === "experience") matches = matches.sort((a, b) => b.years - a.years);
  if (sort === "rating") matches = matches.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
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
        ${isWorker && profile ? `<div class="profile-summary"><div><span>Service</span><b>${escapeHtml(profile.service)}</b></div><div><span>Work area</span><b>${escapeHtml(profile.area)}</b></div><div><span>Contact phone</span><b>${escapeHtml(profile.phone)}</b></div><div><span>Experience</span><b>${escapeHtml(profile.years)} years</b></div><div><span>Availability</span><b>${escapeHtml(profile.availability || "available")}</b></div><div><span>Directory</span><b>${user.isListed ? "Public" : "Private"}</b></div></div><button class="outline-button full-button" data-edit-profile>Edit profile</button><button class="text-action full-button" data-open-settings>Privacy and display settings</button>` : isWorker ? `<p class="dash-copy">Finish your profile so people nearby can find and contact you.</p><button class="submit-button" data-create-profile>Create my worker profile <span>→</span></button>` : `<div class="profile-summary"><div><span>Name</span><b>${escapeHtml(user.name)}</b></div><div><span>Email</span><b>${escapeHtml(user.email)}</b></div><div><span>Saved workers</span><b>${read(KEYS.favorites, []).length}</b></div></div><button class="outline-button full-button" data-back-home>Find a worker</button>`}
      </section>
      <section class="dashboard-card verification-card"><div class="dash-card-heading"><span class="dash-icon shield">✓</span><div><h2>Trust & verification</h2><p>Clear signals help neighbors make informed choices</p></div></div>
        ${isWorker ? `<div class="verification-status"><span class="status-dot ${user.verification === "pending" ? "pending" : user.verification === "verified" ? "checked" : ""}"></span><div><b>${statusLabel}</b><small>${statusDescription}</small></div></div><p class="verification-explainer">Verification is a human review of details and references. It does not guarantee work quality, safety, or outcomes.</p>${user.verification === "pending" || user.verification === "verified" ? "" : `<button class="outline-button full-button" data-request-verification ${!profile ? "disabled" : ""}>Request verification</button>`}` : `<div class="verification-status"><span class="status-dot"></span><div><b>Check details before hiring</b><small>Contact workers directly and agree on scope, price, and timing.</small></div></div><p class="verification-explainer">${backendConfigured ? "Listings are supplied by individual workers. Check details directly before agreeing to a job." : "Sample profiles in this preview are fictional. Never pay a deposit before you have agreed on the work and verified who you are dealing with."}</p>`}
      </section>
    </div>
    <section class="dashboard-card requests-panel"><div class="dash-card-heading"><span class="dash-icon">${isWorker ? "↗" : "⌕"}</span><div><h2>${isWorker ? "Quote inbox" : "Your requests"}</h2><p>${isWorker ? "Manage new enquiries and update customers" : "Follow up on work you have requested"}</p></div></div><div id="request-list" class="request-list"><p class="settings-copy">Loading your requests…</p></div></section>
    <div class="demo-warning"><span>ⓘ</span><p>${escapeHtml(accountNote)}</p></div>
  </div>`;
  loadDashboardRequests();
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
function findWorker(id) { return allWorkers().find((worker) => String(worker.id) === String(id)); }
function openQuoteRequest(workerId) {
  const worker = findWorker(workerId);
  if (!worker) { showToast("That worker profile is no longer available."); return; }
  if (!currentUser()) {
    pendingQuoteWorker = workerId;
    openAuth("login", "customer");
    showToast("Log in or create an account to send a private quote request.");
    return;
  }
  if (currentUser().role === "worker") { showToast("Sign in with a customer account to request a quote."); return; }
  pendingQuoteWorker = workerId;
  $("#quote-worker-name").textContent = `${worker.name} · ${worker.service} · ${worker.area}`;
  const form = $("#quote-form");
  form.elements.locality.value = worker.area;
  form.elements.description.value = "";
  form.elements.date.value = "";
  form.elements.budget.value = "";
  $("#quote-error").textContent = "";
  showModal($("#quote-modal"));
}
async function loadDashboardRequests() {
  const user = currentUser();
  const list = $("#request-list");
  if (!user || !list) return;
  if (backendConfigured) {
    if (!supabaseClient) return;
    const column = user.role === "worker" ? "worker_id" : "customer_id";
    const { data, error } = await supabaseClient.from("service_requests").select("*").eq(column, user.id).order("created_at", { ascending: false });
    if (error) { list.innerHTML = `<p class="settings-copy">Could not load requests: ${escapeHtml(error.message)}</p>`; return; }
    backendRequests = data || [];
    if (user.role === "customer") {
      const { data: reviews, error: reviewError } = await supabaseClient.from("worker_reviews").select("request_id").eq("customer_id", user.id);
      if (reviewError) { list.innerHTML = `<p class="settings-copy">Could not load reviews: ${escapeHtml(reviewError.message)}</p>`; return; }
      backendReviews = reviews || [];
    }
  } else {
    backendRequests = read(KEYS.requests, []).filter((request) => user.role === "worker" ? request.workerId === user.id : request.customerId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (!backendRequests.length) {
    list.innerHTML = `<div class="request-empty"><span>✳</span><b>${user.role === "worker" ? "No requests yet" : "No requests sent yet"}</b><small>${user.role === "worker" ? "New customer quote requests will show up here." : "When you request a quote, you can follow its progress here."}</small></div>`;
    return;
  }
  list.innerHTML = backendRequests.map((request) => {
    const id = request.id;
    const customerName = request.customer_name || request.customerName || "Neighbor";
    const worker = findWorker(request.worker_id || request.workerId);
    const service = request.service || worker?.service || "Service request";
    const area = request.locality || "Local area";
    const description = request.description || "";
    const status = request.status || "new";
    let controls = "";
    if (user.role === "worker" && status === "new") controls = `<button data-request-update="accepted" data-request-id="${escapeHtml(id)}">Accept</button><button class="secondary" data-request-update="declined" data-request-id="${escapeHtml(id)}">Decline</button>`;
    if (user.role === "worker" && status === "accepted") controls = `<button data-request-update="completed" data-request-id="${escapeHtml(id)}">Mark completed</button>`;
    if (user.role === "customer" && status === "new") controls = `<button class="secondary" data-request-update="cancelled" data-request-id="${escapeHtml(id)}">Cancel request</button>`;
    if (user.role === "customer" && status === "accepted") controls = `<button data-request-update="completed" data-request-id="${escapeHtml(id)}">Mark work completed</button><button class="secondary" data-request-update="cancelled" data-request-id="${escapeHtml(id)}">Cancel</button>`;
    const alreadyReviewed = backendConfigured
      ? backendReviews.some((item) => String(item.request_id) === String(id))
      : read(KEYS.reviews, []).some((item) => String(item.requestId) === String(id));
    const review = user.role === "customer" && status === "completed" && !alreadyReviewed ? `<button class="secondary" data-review-request="${escapeHtml(id)}">Leave a review</button>` : "";
    return `<article class="request-card"><div class="request-card-top"><div><b>${escapeHtml(service)}</b><small>${user.role === "worker" ? `From ${escapeHtml(customerName)}` : `For ${escapeHtml(worker?.name || "your worker")}`} · ${escapeHtml(area)}</small></div><span class="request-status status-${escapeHtml(status)}">${escapeHtml(status)}</span></div><p>${escapeHtml(description)}</p>${request.budget_hint || request.budgetHint ? `<small class="request-meta">Budget: ${escapeHtml(request.budget_hint || request.budgetHint)}</small>` : ""}${request.preferred_date || request.preferredDate ? `<small class="request-meta">Preferred: ${escapeHtml(request.preferred_date || request.preferredDate)}</small>` : ""}${request.customer_phone || request.customerPhone ? `<small class="request-meta">Phone: ${escapeHtml(request.customer_phone || request.customerPhone)}</small>` : ""}<div class="request-actions">${controls}${review}</div></article>`;
  }).join("");
}
async function updateRequestStatus(requestId, status) {
  const user = currentUser();
  if (!user) return;
  if (backendConfigured) {
    const { error } = await supabaseClient.from("service_requests").update({ status }).eq("id", requestId);
    if (error) { showToast(`Could not update request: ${error.message}`); return; }
  } else {
    const requests = read(KEYS.requests, []);
    const request = requests.find((item) => item.id === requestId);
    if (request) request.status = status;
    localStorage.setItem(KEYS.requests, JSON.stringify(requests));
  }
  await loadDashboardRequests();
  showToast(`Request marked ${status}.`);
  if (status === "completed" && user.role === "customer") openReview(requestId);
}
function openReview(requestId) {
  const form = $("#review-form"); form.elements.requestId.value = requestId;
  $("#review-error").textContent = ""; showModal($("#review-modal"));
}
async function reportWorker(workerId) {
  if (!currentUser()) { openAuth("login"); showToast("Log in to send a private report."); return; }
  const form = $("#report-form"); form.elements.workerId.value = workerId;
  $("#report-error").textContent = ""; showModal($("#report-modal"));
}
function toggleFavorite(workerId, button) {
  const id = String(workerId); const favorites = read(KEYS.favorites, []);
  const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
  localStorage.setItem(KEYS.favorites, JSON.stringify(next));
  button.setAttribute("aria-pressed", String(next.includes(id)));
  button.textContent = next.includes(id) ? "♥ Saved" : "♡ Save";
  showToast(next.includes(id) ? "Saved to your favorites on this device." : "Removed from your favorites.");
}
function resumePendingQuote() {
  if (!pendingQuoteWorker) return;
  const workerId = pendingQuoteWorker;
  setTimeout(() => openQuoteRequest(workerId), 0);
}
function showProfileForm(existing = null) {
  const form = $("#profile-form");
  const user = currentUser();
  if (!user) return;
  $("#profile-form .legal-note").textContent = backendConfigured
    ? "Your profile stays out of public search until you choose to list it. You can change this later in Settings."
    : "This preview stores it only in this browser.";
  form.elements.service.value = existing?.service || "";
  form.elements.area.value = existing?.area || "";
  form.elements.phone.value = existing?.phone || "";
  form.elements.years.value = existing?.years || "";
  form.elements.skills.value = existing?.skills || "";
  form.elements.bio.value = existing?.bio || "";
  form.elements.priceHint.value = existing?.priceHint || "";
  form.elements.availability.value = existing?.availability || "available";
  form.elements.consent.checked = false;
  form.elements.isListed.checked = existing?.isListed ?? true;
  $("#profile-error").textContent = "";
  showModal(profileModal);
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
    else if (pendingQuoteWorker) resumePendingQuote();
    else { openDashboard(); showToast("Your account is ready."); }
    return;
  }
  if (accounts().some((account) => account.email === email)) throw new Error("An account with this email already exists in this browser. Try logging in.");
  const user = { name, email, role, profile: null, verification: "unverified", createdAt: new Date().toISOString() };
  saveAccount(user);
  localStorage.setItem(KEYS.session, JSON.stringify(email));
  closeModal(authModal); updateAccountActions();
  if (role === "worker") showProfileForm(); else if (pendingQuoteWorker) resumePendingQuote(); else { openDashboard(); showToast("Your preview account is ready."); }
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
    if (pendingQuoteWorker) resumePendingQuote(); else openDashboard();
    showToast("You’re signed in.");
    return;
  }
  const user = accounts().find((account) => account.email === email);
  if (!user) throw new Error("No preview account for that email in this browser. Create an account first.");
  localStorage.setItem(KEYS.session, JSON.stringify(email));
  closeModal(authModal); updateAccountActions(); if (pendingQuoteWorker) resumePendingQuote(); else openDashboard(); showToast("You’re logged in to this browser preview.");
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

$("#quote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget); const user = currentUser();
  const worker = findWorker(pendingQuoteWorker); const error = $("#quote-error"); error.textContent = "";
  if (!user || !worker) { error.textContent = "Sign in and choose a worker to send this request."; return; }
  const request = { customer_id: user.id, worker_id: worker.id, customer_name: user.name, customer_phone: data.get("phone").trim(), service: worker.service, description: data.get("description").trim(), locality: data.get("locality").trim(), preferred_date: data.get("date") || null, budget_hint: data.get("budget").trim() };
  if (!request.description || request.description.length < 8 || !request.locality) { error.textContent = "Add a little more detail and your area."; return; }
  if (backendConfigured) {
    const { error: saveError } = await supabaseClient.from("service_requests").insert(request);
    if (saveError) { error.textContent = saveError.message; return; }
  } else {
    const localRequests = read(KEYS.requests, []);
    localRequests.unshift({ ...request, id: `preview-${Date.now()}`, customerId: user.id, workerId: worker.id, customerName: user.name, customerPhone: request.customer_phone, preferredDate: request.preferred_date, budgetHint: request.budget_hint, createdAt: new Date().toISOString(), status: "new" });
    localStorage.setItem(KEYS.requests, JSON.stringify(localRequests));
  }
  closeModal($("#quote-modal")); pendingQuoteWorker = null; showToast("Quote request sent privately to the worker.");
  if (document.querySelector("#dashboard-view:not([hidden])")) openDashboard();
});

$("#review-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); const user=currentUser(); const error=$("#review-error"); error.textContent="";
  const request=backendRequests.find((item)=>String(item.id)===String(data.get("requestId"))) || read(KEYS.requests,[]).find((item)=>String(item.id)===String(data.get("requestId")));
  if (!user || !request) { error.textContent="This completed request could not be found."; return; }
  if (backendConfigured) {
    const { error: saveError } = await supabaseClient.from("worker_reviews").insert({ request_id: request.id, worker_id: request.worker_id, customer_id: user.id, rating: Number(data.get("rating")), comment: data.get("comment").trim() });
    if (saveError) { error.textContent=saveError.message; return; }
    await loadBackendWorkers();
  } else {
    const reviews=read(KEYS.reviews,[]); reviews.push({requestId:request.id,workerId:request.workerId,rating:Number(data.get("rating")),comment:data.get("comment").trim()}); localStorage.setItem(KEYS.reviews,JSON.stringify(reviews));
  }
  closeModal($("#review-modal")); render(); openDashboard(); showToast("Thanks. Your review helps neighbors choose with confidence.");
});

$("#report-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const data=new FormData(event.currentTarget); const user=currentUser(); const error=$("#report-error"); error.textContent="";
  if (!user) { error.textContent="Log in to send a private report."; return; }
  const report={reporter_id:user.id,worker_id:data.get("workerId"),reason:data.get("reason"),details:data.get("details").trim()};
  if (backendConfigured) { const {error:saveError}=await supabaseClient.from("worker_reports").insert(report); if(saveError){error.textContent=saveError.message;return;} }
  else { const reports=read("jirani-preview-reports",[]); reports.unshift({...report,createdAt:new Date().toISOString(),status:"open"}); localStorage.setItem("jirani-preview-reports",JSON.stringify(reports)); }
  closeModal($("#report-modal")); showToast("Private report sent. The Jirani team will review it.");
});

$("#setting-contrast").addEventListener("change", (event) => { saveSettings({highContrast:event.target.checked}); applyDisplaySettings(); });
$("#setting-motion").addEventListener("change", (event) => { saveSettings({reduceMotion:event.target.checked}); applyDisplaySettings(); });
$("#setting-listed").addEventListener("change", async (event) => {
  const user=currentUser(); if(!user?.profile) return;
  const isListed=event.target.checked;
  if(backendConfigured){const {error}=await supabaseClient.from("worker_profiles").update({is_listed:isListed}).eq("user_id",user.id); if(error){event.target.checked=!isListed;showToast(`Could not update listing: ${error.message}`);return;} backendProfile.is_listed=isListed;await loadBackendWorkers();}
  else {saveAccount({...user,profile:{...user.profile,isListed}});}
  updateAccountActions();render();showToast(isListed?"Your profile is public in the directory.":"Your profile is hidden from the public directory.");
});
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const error = $("#profile-error"); error.textContent = "";
  if (!/^\+?[0-9 ()-]{8,20}$/.test(data.get("phone").trim())) { error.textContent = "Enter a valid phone number, including the country code."; return; }
  if (!data.get("consent")) { error.textContent = "Please agree to show your profile details in the directory."; return; }
  const user = currentUser();
  const profile = { service: data.get("service").trim(), area: data.get("area").trim(), phone: data.get("phone").trim(), years: Number(data.get("years")), skills: data.get("skills").trim(), bio: data.get("bio").trim(), priceHint: data.get("priceHint").trim(), availability: data.get("availability"), isListed: Boolean(data.get("isListed")) };
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
        bio: profile.bio,
        price_hint: profile.priceHint,
        availability: profile.availability,
        contact_consent: true,
        is_listed: profile.isListed
      }, { onConflict: "user_id" })
      .select("user_id,display_name,service,locality,contact_phone,years_experience,skills,contact_consent,is_listed,verification_status,bio,price_hint,availability")
      .single();
    if (saveError) { error.textContent = saveError.message; return; }
    backendProfile = savedProfile;
    try { await loadBackendWorkers(); }
    catch (loadError) { error.textContent = `Profile saved, but the directory refresh failed: ${loadError.message}`; return; }
    closeModal(profileModal); render(); updateAccountActions(); openDashboard();
    showToast(profile.isListed ? "Your profile is live in the directory." : "Your profile is saved privately. You can list it later in Settings.");
    return;
  }
  saveAccount({ ...user, profile });
  closeModal(profileModal); render(); updateAccountActions(); openDashboard(); showToast("Worker profile saved in this browser preview.");
});

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-share-app]")) { await shareJirani(); return; }
  if (event.target.closest("[data-open-settings]")) { openSettings(); return; }
  if (event.target.closest("[data-close-settings]")) { closeSettings(); return; }
  if (event.target.closest("[data-settings-signout]")) { closeSettings(); await signOut(); return; }
  const fontButton = event.target.closest("[data-font-size]");
  if (fontButton) { setFontScale(fontButton.dataset.fontSize); return; }
  if (event.target.closest("[data-toggle-details]")) {
    const button = event.target.closest("[data-toggle-details]");
    const expanded = button.closest(".worker-card")?.querySelector(".card-expanded");
    if (expanded) { expanded.hidden = !expanded.hidden; button.setAttribute("aria-expanded", String(!expanded.hidden)); button.textContent = expanded.hidden ? "Profile details" : "Hide details"; }
    return;
  }
  const favoriteButton = event.target.closest("[data-favorite-worker]");
  if (favoriteButton) { toggleFavorite(favoriteButton.dataset.favoriteWorker, favoriteButton); return; }
  const quoteButton = event.target.closest("[data-request-quote]");
  if (quoteButton) { openQuoteRequest(quoteButton.dataset.requestQuote); return; }
  const reportButton = event.target.closest("[data-report-worker]");
  if (reportButton) { await reportWorker(reportButton.dataset.reportWorker); return; }
  const shareButton = event.target.closest("[data-share-worker]");
  if (shareButton) {
    const worker = findWorker(shareButton.dataset.shareWorker);
    if (!worker) { showToast("That worker profile is no longer available."); return; }
    const url = `https://mukalamathew19-gif.github.io/jirani/?worker=${encodeURIComponent(worker.id)}#directory`;
    if (navigator.share) { try { await navigator.share({ title: `${worker.name} on Jirani`, text: `${worker.service} in ${worker.area} — view this local worker profile on Jirani.`, url }); } catch (error) { if (error.name !== "AbortError") await copyShareLink(url); } }
    else await copyShareLink(url);
    return;
  }
  const statusButton = event.target.closest("[data-request-update]");
  if (statusButton) { await updateRequestStatus(statusButton.dataset.requestId, statusButton.dataset.requestUpdate); return; }
  const reviewButton = event.target.closest("[data-review-request]");
  if (reviewButton) { openReview(reviewButton.dataset.reviewRequest); return; }
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
$("#directory-query").addEventListener("input", render);
$("#sort-workers").addEventListener("change", render);
$("#favorites-only").addEventListener("change", render);
$("#search-form").addEventListener("submit", (event) => { event.preventDefault(); render(); $("#directory").scrollIntoView({ behavior: "smooth" }); });
$("#reset-filters").addEventListener("click", () => { serviceFilter.value = ""; areaFilter.value = ""; selectedCategory = ""; render(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const topmost = $$(".modal-backdrop").filter((modal) => !modal.hidden).at(-1);
    if (topmost) closeModal(topmost);
  }
  if (event.key === "Tab") {
    const modal = $$(".modal-backdrop").filter((item) => !item.hidden).at(-1);
    if (!modal) return;
    const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]', modal).filter((item) => !item.hidden);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

updateAccountActions();
applyDisplaySettings();
render();
highlightSharedWorker();
initializeBackend();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  const installButton = $("[data-install-app]");
  if (installButton) installButton.hidden = false;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  const installButton = $("[data-install-app]");
  if (installButton) installButton.hidden = true;
  showToast("Jirani has been added to your device.");
});
document.addEventListener("click", async (event) => {
  if (!event.target.closest("[data-install-app]")) return;
  if (!installPrompt) { showToast("Use your browser menu and choose ‘Install app’ or ‘Add to Home screen’."); return; }
  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") showToast("Jirani is being added to your device.");
  installPrompt = null;
});
