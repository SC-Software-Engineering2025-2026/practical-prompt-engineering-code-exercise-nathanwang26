// Simple Prompt Library: localStorage-backed
const STORAGE_KEY = "prompt_library.prompts";
const THEME_KEY = "prompt_library.theme";

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function loadPrompts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function savePrompts(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function renderPrompts() {
  const container = $("#promptsList");
  container.innerHTML = "";
  const prompts = loadPrompts().slice().reverse();
  if (prompts.length === 0) {
    container.innerHTML =
      '<div class="empty">No prompts yet — add one above.</div>';
    return;
  }

  prompts.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";

    const meta = document.createElement("div");
    meta.className = "meta";
    const h3 = document.createElement("h3");
    h3.textContent = p.title || "(untitled)";
    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = contentPreview(p.content, 16);
    meta.appendChild(h3);
    meta.appendChild(preview);

    const actions = document.createElement("div");
    actions.className = "actions";
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      deletePrompt(p.id);
    });
    actions.appendChild(del);

    card.appendChild(meta);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function contentPreview(text, words = 12) {
  if (!text) return "";
  const parts = text.trim().split(/\s+/);
  if (parts.length <= words) return text.trim();
  return parts.slice(0, words).join(" ") + "…";
}

function addPrompt(title, content) {
  const prompts = loadPrompts();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    content: content.trim(),
    created: Date.now(),
  };
  prompts.push(entry);
  savePrompts(prompts);
  renderPrompts();
}

function deletePrompt(id) {
  const prompts = loadPrompts().filter((p) => p.id !== id);
  savePrompts(prompts);
  renderPrompts();
}

function setupHandlers() {
  $("#savePrompt").addEventListener("click", () => {
    const title = $("#promptTitle").value;
    const content = $("#promptContent").value;
    if (!content.trim()) {
      alert("Prompt content cannot be empty.");
      return;
    }
    addPrompt(title || "(untitled)", content);
    $("#promptTitle").value = "";
    $("#promptContent").value = "";
  });

  $("#themeToggle").addEventListener("click", () => {
    const body = document.body;
    body.classList.toggle("dark");
    const isDark = body.classList.contains("dark");
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    updateThemeIcon();
  });
}

function applySavedTheme() {
  const t = localStorage.getItem(THEME_KEY) || "dark";
  if (t === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = $("#themeToggle");
  if (document.body.classList.contains("dark")) btn.textContent = "🌙";
  else btn.textContent = "☀️";
}

document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  setupHandlers();
  renderPrompts();
});
