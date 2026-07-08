/**
 * NutriBot — AI Nutrition Agent
 * Frontend controller: chat, BMI, TDEE, meal planner, food analyser, family profiles, dark mode
 */

"use strict";

// ═══════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════
const API = {
  CHAT:           "/api/chat",
  CHAT_CLEAR:     "/api/chat/clear",
  BMI:            "/api/bmi",
  TDEE:           "/api/tdee",
  MEAL_PLAN:      "/api/meal-plan",
  ANALYZE:        "/api/analyze",
  PROFILES:       "/api/profiles",
  ACTIVE_PROFILE: "/api/active-profile",
  SUGGESTIONS:    "/api/suggestions",
  HEALTH:         "/api/health",
};

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNav();
  initChat();
  initDashboard();
  initMealPlanner();
  initFoodAnalyser();
  initFamilyProfiles();
  loadSuggestions();
  checkHealth();
  showWelcome();
});

// ═══════════════════════════════════════════════════════════
//  THEME  (Dark / Light)
// ═══════════════════════════════════════════════════════════
function initTheme() {
  const btn  = document.getElementById("themeToggle");
  const html = document.documentElement;

  const saved = localStorage.getItem("nutribot-theme") || "light";
  applyTheme(saved, btn, html);

  btn.addEventListener("click", () => {
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next, btn, html);
    localStorage.setItem("nutribot-theme", next);
  });
}

function applyTheme(theme, btn, html) {
  html.dataset.theme = theme;
  btn.innerHTML = theme === "dark"
    ? '<i class="bi bi-sun-fill"></i>'
    : '<i class="bi bi-moon-stars"></i>';
  btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION (tab switching)
// ═══════════════════════════════════════════════════════════
function initNav() {
  document.querySelectorAll("[data-tab]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      switchTab(link.dataset.tab);
      // close mobile nav
      const collapse = document.getElementById("navContent");
      if (collapse.classList.contains("show")) {
        bootstrap.Collapse.getInstance(collapse)?.hide();
      }
    });
  });
}

function switchTab(tabId) {
  // Sections
  document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add("active");

  // Nav links
  document.querySelectorAll("[data-tab]").forEach(l => {
    l.classList.toggle("active", l.dataset.tab === tabId);
  });

  if (tabId === "family") loadProfiles();
}

// ═══════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════
function initChat() {
  const input   = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearChatBtn");

  // Auto-resize textarea
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  // Send on Enter (not Shift+Enter)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener("click", sendMessage);

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Clear the entire conversation?")) return;
    await fetch(API.CHAT_CLEAR, { method: "POST" });
    document.getElementById("chatMessages").innerHTML = "";
    showWelcome();
    showToast("Conversation cleared", "success");
  });
}

function showWelcome() {
  const container = document.getElementById("chatMessages");
  // Only show if no messages exist
  if (container.children.length === 0) {
    container.innerHTML = `
      <div class="welcome-msg">
        <span class="welcome-emoji">🥗</span>
        <h3>Welcome to NutriBot!</h3>
        <p>Your AI-powered nutrition assistant powered by IBM Watsonx Granite. Ask me anything about diet, meal plans, calories, or Indian recipes.</p>
      </div>`;
  }
}

async function sendMessage() {
  const input   = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const message = input.value.trim();
  if (!message) return;

  // Remove welcome message
  const welcome = document.querySelector(".welcome-msg");
  if (welcome) welcome.remove();

  appendMessage("user", message);
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  showTyping(true);
  scrollChat();

  try {
    const res  = await fetchJSON(API.CHAT, "POST", { message });
    showTyping(false);
    if (res.error) {
      appendMessage("bot", `⚠️ ${res.error}`);
    } else {
      appendMessage("bot", res.response, res.ts);
    }
  } catch (err) {
    showTyping(false);
    appendMessage("bot", `⚠️ Network error: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
    scrollChat();
    input.focus();
  }
}

function appendMessage(role, content, ts = null) {
  const container = document.getElementById("chatMessages");
  const isUser    = role === "user";
  const timeStr   = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : now();

  const avatar  = isUser
    ? `<div class="msg-avatar user-av"><i class="bi bi-person-fill"></i></div>`
    : `<div class="msg-avatar bot-av"><i class="bi bi-robot"></i></div>`;

  const renderedContent = isUser
    ? escapeHtml(content).replace(/\n/g, "<br>")
    : marked.parse(content);

  const wrapper = document.createElement("div");
  wrapper.className = `msg-wrapper ${isUser ? "user" : "bot"}`;
  wrapper.innerHTML = `
    ${avatar}
    <div>
      <div class="msg-bubble">${renderedContent}</div>
      <div class="msg-ts">${timeStr}</div>
    </div>`;

  container.appendChild(wrapper);
}

function scrollChat() {
  const container = document.getElementById("chatMessages");
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

function showTyping(show) {
  document.getElementById("typingIndicator").classList.toggle("d-none", !show);
  if (show) scrollChat();
}

// ── Quick Suggestions ─────────────────────────────────────
async function loadSuggestions() {
  try {
    const tips = await fetchJSON(API.SUGGESTIONS, "GET");
    const list = document.getElementById("suggestionsList");
    list.innerHTML = "";
    tips.forEach(tip => {
      const el = document.createElement("div");
      el.className = "suggestion-item";
      el.textContent = tip;
      el.addEventListener("click", () => {
        document.getElementById("chatInput").value = tip;
        switchTab("chat");
        sendMessage();
      });
      list.appendChild(el);
    });
  } catch (_) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════
async function checkHealth() {
  const dot   = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  try {
    const res = await fetchJSON(API.HEALTH, "GET");
    if (res.ai_ready) {
      dot.className   = "status-dot online";
      label.textContent = `IBM Granite · ${res.model.split("/")[1] || res.model}`;
    } else {
      dot.className   = "status-dot offline";
      label.textContent = "AI not configured";
    }
  } catch (_) {
    dot.className   = "status-dot offline";
    label.textContent = "Backend offline";
  }
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — BMI & TDEE
// ═══════════════════════════════════════════════════════════
function initDashboard() {
  document.getElementById("calcBmiBtn").addEventListener("click", calcBMI);
  document.getElementById("calcTdeeBtn").addEventListener("click", calcTDEE);
}

async function calcBMI() {
  const weight = parseFloat(document.getElementById("bmiWeight").value);
  const height = parseFloat(document.getElementById("bmiHeight").value);

  if (!weight || !height) {
    showToast("Please enter weight and height", "warning"); return;
  }

  const btn = document.getElementById("calcBmiBtn");
  setLoading(btn, true, "Calculating…");

  try {
    const res = await fetchJSON(API.BMI, "POST", { weight, height });
    if (res.error) { showToast(res.error, "danger"); return; }

    const el = document.getElementById("bmiResult");
    el.innerHTML = `
      <div class="bmi-value" style="color:${res.color}">${res.bmi}</div>
      <div class="bmi-cat"  style="color:${res.color}">${res.category}</div>
      <div class="bmi-scale mt-2">
        <span class="bmi-s1" title="Underweight < 18.5"></span>
        <span class="bmi-s2" title="Normal 18.5–24.9"></span>
        <span class="bmi-s3" title="Overweight 25–29.9"></span>
        <span class="bmi-s4" title="Obese ≥ 30"></span>
      </div>
      <div class="mt-2 small text-muted">
        Underweight &lt;18.5 · Normal 18.5–24.9 · Overweight 25–29.9 · Obese ≥30
      </div>`;
    el.classList.remove("d-none");
  } catch (err) {
    showToast("Error: " + err.message, "danger");
  } finally {
    setLoading(btn, false, '<i class="bi bi-calculator me-1"></i> Calculate BMI');
  }
}

async function calcTDEE() {
  const age      = parseInt(document.getElementById("tdeeAge").value);
  const gender   = document.getElementById("tdeeGender").value;
  const weight   = parseFloat(document.getElementById("tdeeWeight").value);
  const height   = parseFloat(document.getElementById("tdeeHeight").value);
  const activity = document.getElementById("tdeeActivity").value;

  if (!age || !weight || !height) {
    showToast("Please fill in all fields", "warning"); return;
  }

  const btn = document.getElementById("calcTdeeBtn");
  setLoading(btn, true, "Calculating…");

  try {
    const res = await fetchJSON(API.TDEE, "POST", { age, gender, weight, height, activity });
    if (res.error) { showToast(res.error, "danger"); return; }

    const el = document.getElementById("tdeeResult");
    el.innerHTML = `
      <div class="tdee-grid">
        <div class="tdee-card">
          <div class="tdee-val text-primary">${res.bmr}</div>
          <div class="tdee-lbl">BMR</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">Base metabolic rate</div>
        </div>
        <div class="tdee-card highlight">
          <div class="tdee-val" style="color:var(--primary)">${res.tdee}</div>
          <div class="tdee-lbl">Maintenance</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">kcal/day (TDEE)</div>
        </div>
        <div class="tdee-card">
          <div class="tdee-val" style="color:#22c55e">${res.weight_loss}</div>
          <div class="tdee-lbl">Weight Loss</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">−500 kcal/day</div>
        </div>
        <div class="tdee-card">
          <div class="tdee-val" style="color:#f97316">${res.weight_gain}</div>
          <div class="tdee-lbl">Weight Gain</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">+300 kcal/day</div>
        </div>
        <div class="tdee-card" style="grid-column:span 2">
          <div style="font-size:.8rem;color:var(--text-muted);padding:.2rem">
            <strong>Protein target:</strong> ${Math.round(weight * 0.8)}–${Math.round(weight * 1.2)} g/day &nbsp;|&nbsp;
            <strong>Water:</strong> ~${(weight * 0.033).toFixed(1)} L/day
          </div>
        </div>
      </div>`;
    el.classList.remove("d-none");
  } catch (err) {
    showToast("Error: " + err.message, "danger");
  } finally {
    setLoading(btn, false, '<i class="bi bi-fire me-1"></i> Calculate Calories');
  }
}

// ═══════════════════════════════════════════════════════════
//  MEAL PLANNER
// ═══════════════════════════════════════════════════════════
function initMealPlanner() {
  document.getElementById("genPlanBtn").addEventListener("click", generatePlan);
}

async function generatePlan() {
  const days    = document.getElementById("planDays").value;
  const goal    = document.getElementById("planGoal").value;
  const diet    = document.getElementById("planDiet").value;
  const cuisine = document.getElementById("planCuisine").value;

  const btn = document.getElementById("genPlanBtn");
  setLoading(btn, true, "Generating…");

  const result = document.getElementById("mealPlanResult");
  result.innerHTML = `<div class="text-center py-4 text-muted"><span class="spinner" style="border-color:rgba(37,99,235,.3);border-top-color:var(--primary)"></span> Generating your personalised ${days}-day plan…</div>`;

  try {
    const res = await fetchJSON(API.MEAL_PLAN, "POST", { days, goal, diet_type: diet, cuisine });
    if (res.error) {
      result.innerHTML = `<div class="text-danger small">${escapeHtml(res.error)}</div>`; return;
    }
    result.innerHTML = `<div class="meal-plan-content">${marked.parse(res.plan)}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="text-danger small">Error: ${escapeHtml(err.message)}</div>`;
  } finally {
    setLoading(btn, false, '<i class="bi bi-magic me-1"></i> Generate Meal Plan');
  }
}

// ═══════════════════════════════════════════════════════════
//  FOOD ANALYSER
// ═══════════════════════════════════════════════════════════
function initFoodAnalyser() {
  document.getElementById("analyzeFoodBtn").addEventListener("click", () => {
    const food = document.getElementById("analyzeFood").value.trim();
    analyzeFood(food);
  });

  document.getElementById("analyzeFood").addEventListener("keydown", e => {
    if (e.key === "Enter") analyzeFood(e.target.value.trim());
  });
}

async function analyzeFood(food) {
  if (!food) { showToast("Please enter a food name", "warning"); return; }

  document.getElementById("analyzeFood").value = food;

  const btn    = document.getElementById("analyzeFoodBtn");
  const result = document.getElementById("analyzeResult");

  setLoading(btn, true, "Analysing…");
  result.innerHTML = `<div class="text-center py-4 text-muted"><span class="spinner" style="border-color:rgba(37,99,235,.3);border-top-color:var(--primary)"></span> Analysing nutrition for <em>${escapeHtml(food)}</em>…</div>`;

  try {
    const res = await fetchJSON(API.ANALYZE, "POST", { food });
    if (res.error) {
      result.innerHTML = `<div class="text-danger small">${escapeHtml(res.error)}</div>`; return;
    }
    result.innerHTML = `<div class="meal-plan-content">${marked.parse(res.analysis)}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="text-danger small">Error: ${escapeHtml(err.message)}</div>`;
  } finally {
    setLoading(btn, false, '<i class="bi bi-search me-1"></i> Analyse Nutrition');
  }
}

// ═══════════════════════════════════════════════════════════
//  FAMILY PROFILES
// ═══════════════════════════════════════════════════════════
function initFamilyProfiles() {
  document.getElementById("addProfileBtn").addEventListener("click", addProfile);
}

async function loadProfiles() {
  try {
    const profiles     = await fetchJSON(API.PROFILES, "GET");
    const activeData   = await fetchJSON(API.ACTIVE_PROFILE, "GET");
    renderProfiles(profiles, activeData);
  } catch (err) {
    document.getElementById("profilesList").innerHTML =
      `<p class="text-danger small">Failed to load profiles: ${escapeHtml(err.message)}</p>`;
  }
}

function renderProfiles(profiles, active) {
  const container = document.getElementById("profilesList");

  if (!profiles || profiles.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-people empty-icon"></i>
        <p>No family members added yet. Add your first member to get personalised nutrition advice!</p>
      </div>`;
    return;
  }

  container.innerHTML = "";
  profiles.forEach(p => {
    const isActive = active && active.id === p.id;
    const initial  = (p.name || "?")[0].toUpperCase();

    const card = document.createElement("div");
    card.className = `profile-card ${isActive ? "active-card" : ""}`;
    card.innerHTML = `
      <div class="profile-avatar">${initial}</div>
      <div class="profile-name">${escapeHtml(p.name)} ${isActive ? '<span style="font-size:.65rem;background:var(--primary);color:#fff;border-radius:4px;padding:1px 5px;vertical-align:middle">Active</span>' : ""}</div>
      <div class="profile-info">
        ${p.age ? `<div><strong>Age:</strong> ${p.age} y</div>` : ""}
        ${p.gender ? `<div><strong>Gender:</strong> ${capitalize(p.gender)}</div>` : ""}
        ${p.weight ? `<div><strong>Weight:</strong> ${p.weight} kg</div>` : ""}
        ${p.height ? `<div><strong>Height:</strong> ${p.height} cm</div>` : ""}
        ${p.diet_type ? `<div><strong>Diet:</strong> ${capitalize(p.diet_type)}</div>` : ""}
        ${p.goals ? `<div><strong>Goal:</strong> ${escapeHtml(p.goals)}</div>` : ""}
        ${p.conditions ? `<div><strong>Conditions:</strong> ${escapeHtml(p.conditions)}</div>` : ""}
      </div>
      <div class="profile-actions">
        <button class="btn-activate" onclick="activateProfile('${p.id}')">
          <i class="bi bi-person-check me-1"></i> Set Active
        </button>
        <button class="btn-delete" onclick="deleteProfile('${p.id}')" title="Remove profile">
          <i class="bi bi-trash3"></i>
        </button>
      </div>`;

    container.appendChild(card);
  });
}

async function addProfile() {
  const data = {
    name:       document.getElementById("pName").value.trim(),
    age:        document.getElementById("pAge").value,
    gender:     document.getElementById("pGender").value,
    weight:     document.getElementById("pWeight").value,
    height:     document.getElementById("pHeight").value,
    activity:   document.getElementById("pActivity").value,
    goals:      document.getElementById("pGoals").value.trim(),
    diet_type:  document.getElementById("pDiet").value,
    allergies:  document.getElementById("pAllergies").value.trim(),
    conditions: document.getElementById("pConditions").value.trim(),
    region:     document.getElementById("pRegion").value.trim(),
  };

  if (!data.name) { showToast("Please enter a name", "warning"); return; }

  const btn = document.getElementById("addProfileBtn");
  setLoading(btn, true, "Saving…");

  try {
    await fetchJSON(API.PROFILES, "POST", data);
    showToast(`Profile saved for ${data.name}!`, "success");
    // reset form
    ["pName","pAge","pWeight","pHeight","pGoals","pAllergies","pConditions","pRegion"].forEach(id => {
      document.getElementById(id).value = "";
    });
    loadProfiles();
  } catch (err) {
    showToast("Error saving profile: " + err.message, "danger");
  } finally {
    setLoading(btn, false, '<i class="bi bi-person-plus me-1"></i> Save Profile');
  }
}

async function activateProfile(id) {
  try {
    const res = await fetchJSON(`${API.PROFILES}/activate/${id}`, "POST");
    showToast(`${res.profile.name} is now the active profile!`, "success");
    loadProfiles();
    updateActiveProfileBadge(res.profile);
    updateSidebarProfile(res.profile);
  } catch (err) {
    showToast("Error: " + err.message, "danger");
  }
}

async function deleteProfile(id) {
  if (!confirm("Remove this profile?")) return;
  try {
    await fetchJSON(`${API.PROFILES}/${id}`, "DELETE");
    showToast("Profile removed", "success");
    loadProfiles();
  } catch (err) {
    showToast("Error: " + err.message, "danger");
  }
}

function updateActiveProfileBadge(profile) {
  const badge = document.getElementById("activeProfileBadge");
  if (profile && profile.name) {
    badge.textContent = `👤 ${profile.name}`;
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }
}

function updateSidebarProfile(profile) {
  const el = document.getElementById("sidebarProfile");
  if (!profile || !profile.name) {
    el.innerHTML = `<span class="text-muted small">No profile selected</span>`;
    return;
  }
  el.innerHTML = `
    <div style="font-weight:700;font-size:.85rem">${escapeHtml(profile.name)}</div>
    <div style="font-size:.75rem;color:var(--text-muted)">
      ${[profile.age ? profile.age + "y" : "", profile.gender ? capitalize(profile.gender) : "", profile.diet_type ? capitalize(profile.diet_type) : ""].filter(Boolean).join(" · ")}
    </div>`;
}

// Load active profile on page load
async function loadActiveProfile() {
  try {
    const p = await fetchJSON(API.ACTIVE_PROFILE, "GET");
    if (p && p.name) {
      updateActiveProfileBadge(p);
      updateSidebarProfile(p);
    }
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

// Fetch wrapper
async function fetchJSON(url, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Show toast notification
function showToast(message, type = "success") {
  const toast    = document.getElementById("appToast");
  const toastMsg = document.getElementById("toastMessage");
  const colours  = { success: "#16a34a", danger: "#dc2626", warning: "#d97706", info: "#0891b2" };

  toastMsg.textContent = message;
  toast.style.background = colours[type] || "#1e293b";

  const bsToast = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3000 });
  bsToast.show();
}

// Set button loading state
function setLoading(btn, loading, label) {
  btn.innerHTML  = loading ? `<span class="spinner"></span>${label}` : label;
  btn.disabled   = loading;
}

// Escape HTML for user content
function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// Capitalize first letter
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

// Current time string
function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Load active profile on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  loadActiveProfile();
});
