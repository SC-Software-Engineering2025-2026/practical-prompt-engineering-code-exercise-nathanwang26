// Simple Prompt Library: localStorage-backed with 5-star rating
const STORAGE_KEY = "prompt_library.prompts";
const THEME_KEY = "prompt_library.theme";

let currentFilter = null; // e.g. 'top-rated'

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
  let prompts = loadPrompts().slice().reverse();

  if (currentFilter === "top-rated") {
    prompts = prompts.filter((p) => (p.rating || 0) >= 4.0);
  }

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

    // Rating area
    const ratingWrap = document.createElement("div");
    ratingWrap.className = "rating";
    const starsContainer = document.createElement("div");
    starsContainer.className = "stars";
    ratingWrap.appendChild(starsContainer);
    const label = document.createElement("div");
    label.className = "rating-label";
    label.textContent = `${(p.rating || 0).toFixed(1)} (${p.ratingCount || 0})`;
    ratingWrap.appendChild(label);
    meta.appendChild(ratingWrap);

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

    // Render the star controls for this prompt
    renderStars(starsContainer, p);
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
    // rating metadata
    rating: 0,
    ratingCount: 0,
    userRating: 0,
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

function setRating(promptId, newRating) {
  const prompts = loadPrompts();
  const p = prompts.find((x) => x.id === promptId);
  if (!p) return;

  const prevUserRating = p.userRating || 0;
  const prevCount = p.ratingCount || 0;
  const prevTotal = (p.rating || 0) * prevCount;

  if (!prevUserRating) {
    // new rater
    p.ratingCount = prevCount + 1;
    p.userRating = newRating;
    p.rating = (prevTotal + newRating) / p.ratingCount;
  } else {
    // update existing user's rating
    p.userRating = newRating;
    p.rating = (prevTotal - prevUserRating + newRating) / p.ratingCount;
  }

  // normalize to one decimal
  p.rating = Math.round((p.rating || 0) * 10) / 10;

  savePrompts(prompts);
  renderPrompts();
  document.dispatchEvent(
    new CustomEvent("rating:changed", {
      detail: { id: promptId, rating: p.rating },
    })
  );
}

function renderStars(container, prompt) {
  container.innerHTML = "";
  const current = prompt.userRating || Math.round(prompt.rating || 0);

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.className = "star";
    if (i <= current) star.classList.add("filled");
    star.type = "button";
    star.dataset.value = i;
    star.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
    star.setAttribute("aria-pressed", (i <= current).toString());

    star.addEventListener("click", () => {
      setRating(prompt.id, i);
    });

    star.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        const prev = star.previousElementSibling;
        if (prev) prev.focus();
      }
      if (e.key === "ArrowRight") {
        const next = star.nextElementSibling;
        if (next) next.focus();
      }
      if (e.key === "Enter" || e.key === " ") star.click();
    });

    // hover preview
    star.addEventListener("mouseover", () => {
      Array.from(container.children).forEach((s, idx) => {
        s.classList.toggle("filled", idx < i);
      });
    });
    star.addEventListener("mouseout", () => {
      Array.from(container.children).forEach((s, idx) => {
        s.classList.toggle("filled", idx < current);
      });
    });

    // text content star glyph
    star.textContent = "★";
    container.appendChild(star);
  }
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

  const topBtn = $("#filterTopRated");
  const clearBtn = $("#clearFilter");
  if (topBtn)
    topBtn.addEventListener("click", () => {
      currentFilter = "top-rated";
      renderPrompts();
    });
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      currentFilter = null;
      renderPrompts();
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
