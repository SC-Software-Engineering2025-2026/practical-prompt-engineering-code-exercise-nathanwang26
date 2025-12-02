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

/* ---------------- Metadata functions (prompt journal) ---------------- */

function isValidISO(dt) {
  try {
    if (typeof dt !== "string") return false;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString() === dt;
  } catch (e) {
    return false;
  }
}

function validateModelName(name) {
  if (typeof name !== "string") throw new Error("Model name must be a string");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Model name cannot be empty");
  if (trimmed.length > 100)
    throw new Error("Model name must be at most 100 characters");
  return trimmed;
}

function estimateTokens(text, isCode) {
  try {
    if (typeof text !== "string") throw new Error("Text must be a string");
    const cleaned = text.trim();
    const word_count = cleaned ? cleaned.split(/\s+/).length : 0;
    const char_count = cleaned.length;

    let min = 0.75 * word_count;
    let max = 0.25 * char_count;

    if (isCode) {
      min *= 1.3;
      max *= 1.3;
    }

    // Round to nearest integer
    min = Math.round(min);
    max = Math.round(max);

    const tokens = Math.max(min, max);
    let confidence = "high";
    if (tokens < 1000) confidence = "high";
    else if (tokens <= 5000) confidence = "medium";
    else confidence = "low";

    return { min, max, confidence };
  } catch (err) {
    throw new Error("estimateTokens error: " + err.message);
  }
}

function trackModel(modelName, content) {
  try {
    const model = validateModelName(modelName);
    const createdAt = new Date().toISOString();
    const isCode = false; // default; UI may pass true
    const tokenEstimate = estimateTokens(content || "", isCode);
    const metadata = {
      model,
      createdAt,
      updatedAt: createdAt,
      tokenEstimate,
    };
    return metadata;
  } catch (err) {
    throw new Error("trackModel error: " + err.message);
  }
}

function updateTimestamps(metadata) {
  try {
    if (typeof metadata !== "object" || metadata === null)
      throw new Error("metadata must be an object");
    if (!isValidISO(metadata.createdAt))
      throw new Error("createdAt must be a valid ISO 8601 string");
    const updatedAt = new Date().toISOString();
    if (new Date(updatedAt) < new Date(metadata.createdAt))
      throw new Error("updatedAt cannot be earlier than createdAt");
    metadata.updatedAt = updatedAt;
    return metadata;
  } catch (err) {
    throw new Error("updateTimestamps error: " + err.message);
  }
}

/* ---------------- end Metadata functions ---------------- */

function renderPrompts() {
  const container = $("#promptsList");
  container.innerHTML = "";
  let prompts = loadPrompts().slice();

  if (currentFilter === "top-rated") {
    prompts = prompts.filter((p) => (p.rating || 0) >= 4.0);
  }

  // ensure backwards compatibility: convert numeric created to ISO in metadata if missing
  prompts.forEach((p) => {
    if (p.metadata && p.metadata.createdAt) return;
    if (p.created) {
      try {
        p.metadata = p.metadata || {};
        p.metadata.createdAt = new Date(p.created).toISOString();
        p.metadata.updatedAt = p.metadata.createdAt;
      } catch (e) {
        p.metadata = p.metadata || {};
      }
    }
  });

  // sort by createdAt descending
  prompts.sort((a, b) => {
    const aDate =
      a.metadata && a.metadata.createdAt
        ? new Date(a.metadata.createdAt)
        : new Date(0);
    const bDate =
      b.metadata && b.metadata.createdAt
        ? new Date(b.metadata.createdAt)
        : new Date(0);
    return bDate - aDate;
  });

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

    // Metadata display (model, timestamps, token estimate)
    if (p.metadata) {
      const mdRow = document.createElement("div");
      mdRow.className = "metadata-row";

      const modelSpan = document.createElement("span");
      modelSpan.className = "meta-model";
      modelSpan.textContent = `Model: ${p.metadata.model}`;
      mdRow.appendChild(modelSpan);

      const created = p.metadata.createdAt;
      const updated = p.metadata.updatedAt;
      const createdSpan = document.createElement("span");
      createdSpan.className = "meta-created";
      try {
        createdSpan.textContent = `Created: ${new Date(
          created
        ).toLocaleString()}`;
      } catch (e) {
        createdSpan.textContent = `Created: ${created}`;
      }
      mdRow.appendChild(createdSpan);

      if (updated && updated !== created) {
        const updatedSpan = document.createElement("span");
        updatedSpan.className = "meta-updated";
        try {
          updatedSpan.textContent = `Updated: ${new Date(
            updated
          ).toLocaleString()}`;
        } catch (e) {
          updatedSpan.textContent = `Updated: ${updated}`;
        }
        mdRow.appendChild(updatedSpan);
      }

      if (p.metadata.tokenEstimate) {
        const te = p.metadata.tokenEstimate;
        const badge = document.createElement("span");
        badge.className = `token-badge token-${te.confidence}`;
        badge.textContent = `Tokens ≈ ${te.min}-${te.max} (${te.confidence})`;
        mdRow.appendChild(badge);
      }

      meta.appendChild(mdRow);
    }

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

    // Notes button with badge
    const notesBtn = document.createElement("button");
    notesBtn.className = "notes-btn";
    notesBtn.type = "button";
    notesBtn.dataset.promptId = p.id;
    notesBtn.innerHTML = "📝";
    const count = (p.notes && p.notes.length) || 0;
    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "notes-badge";
      badge.textContent = count;
      notesBtn.appendChild(badge);
    }
    notesBtn.addEventListener("click", () => openNotes(p.id));
    actions.appendChild(notesBtn);

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
  // create metadata with try/catch to ensure validation
  let metadata = null;
  try {
    const modelName = (document.getElementById("modelName") || {}).value || "";
    const isCode = !!(document.getElementById("isCode") || {}).checked;
    // use estimateTokens with actual isCode flag
    const tokenEstimate = estimateTokens(content, isCode);
    const nowISO = new Date().toISOString();
    metadata = {
      model: validateModelName(modelName || "(unspecified)"),
      createdAt: nowISO,
      updatedAt: nowISO,
      tokenEstimate,
    };
  } catch (err) {
    // bubble up for UI to handle
    throw err;
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    content: content.trim(),
    created: Date.now(),
    metadata,
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

/* ---------------- Notes feature ---------------- */

function ensureNotesArray(prompt) {
  if (!prompt.notes) prompt.notes = [];
}

function openNotes(promptId) {
  const prompts = loadPrompts();
  const p = prompts.find((x) => x.id === promptId);
  if (!p) return;
  ensureNotesArray(p);

  const panel = document.getElementById("notesPanel");
  panel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "notes-header";
  const title = document.createElement("h3");
  title.id = "notesTitle";
  title.textContent = `Notes — ${p.title || "(untitled)"}`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeNotes);
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "notes-list";
  panel.appendChild(list);

  function buildNoteItem(note) {
    const item = document.createElement("div");
    item.className = "note-item";
    const text = document.createElement("div");
    text.className = "note-text";
    text.textContent = note.text;
    item.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "note-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      enterEditMode(note, item, promptId);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this note?")) return;
      deleteNote(promptId, note.id);
    });
    actions.appendChild(edit);
    actions.appendChild(del);
    item.appendChild(actions);
    return item;
  }

  if (p.notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No notes yet — add one below.";
    list.appendChild(empty);
  } else {
    p.notes
      .slice()
      .reverse()
      .forEach((n) => list.appendChild(buildNoteItem(n)));
  }

  // new note area
  const newWrap = document.createElement("div");
  newWrap.className = "new-note";
  const ta = document.createElement("textarea");
  ta.placeholder = "Write a note...";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn primary";
  addBtn.textContent = "Add Note";
  addBtn.addEventListener("click", () => {
    const text = ta.value.trim();
    if (!text) return;
    try {
      addNote(promptId, text);
      // reopen to refresh
      openNotes(promptId);
    } catch (err) {
      showNotesError(panel, "Unable to save note.");
    }
  });
  newWrap.appendChild(ta);
  newWrap.appendChild(addBtn);
  panel.appendChild(newWrap);

  const err = document.createElement("div");
  err.className = "notes-error";
  panel.appendChild(err);

  // backdrop
  const existingBackdrop = document.querySelector(".notes-backdrop");
  if (!existingBackdrop) {
    const bd = document.createElement("div");
    bd.className = "notes-backdrop";
    bd.addEventListener("click", closeNotes);
    document.body.appendChild(bd);
  }

  panel.hidden = false;
  document.body.classList.add("notes-open");

  // keyboard close
  function onKey(e) {
    if (e.key === "Escape") closeNotes();
  }
  panel._onKey = onKey;
  document.addEventListener("keydown", onKey);
}

function closeNotes() {
  const panel = document.getElementById("notesPanel");
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = "";
  const bd = document.querySelector(".notes-backdrop");
  if (bd) bd.remove();
  document.body.classList.remove("notes-open");
  if (panel._onKey) document.removeEventListener("keydown", panel._onKey);
}

function showNotesError(panel, msg) {
  const err = panel.querySelector(".notes-error");
  if (err) err.textContent = msg;
}

function addNote(promptId, text) {
  const prompts = loadPrompts();
  const p = prompts.find((x) => x.id === promptId);
  if (!p) throw new Error("Prompt not found");
  ensureNotesArray(p);
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  p.notes.push(note);
  try {
    savePrompts(prompts);
  } catch (e) {
    throw e;
  }
}

function enterEditMode(note, itemEl, promptId) {
  itemEl.innerHTML = "";
  const ta = document.createElement("textarea");
  ta.value = note.text;
  ta.style.minHeight = "72px";
  const actions = document.createElement("div");
  actions.className = "note-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";
  save.addEventListener("click", () => {
    const newText = ta.value.trim();
    if (!newText) return;
    try {
      updateNote(promptId, note.id, newText);
      openNotes(promptId);
    } catch (err) {
      const panel = document.getElementById("notesPanel");
      showNotesError(panel, "Unable to save note.");
    }
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => openNotes(promptId));
  actions.appendChild(save);
  actions.appendChild(cancel);
  itemEl.appendChild(ta);
  itemEl.appendChild(actions);
}

function updateNote(promptId, noteId, newText) {
  const prompts = loadPrompts();
  const p = prompts.find((x) => x.id === promptId);
  if (!p) throw new Error("Prompt not found");
  ensureNotesArray(p);
  const n = p.notes.find((x) => x.id === noteId);
  if (!n) throw new Error("Note not found");
  n.text = newText;
  n.updatedAt = Date.now();
  try {
    savePrompts(prompts);
  } catch (e) {
    throw e;
  }
}

function deleteNote(promptId, noteId) {
  const prompts = loadPrompts();
  const p = prompts.find((x) => x.id === promptId);
  if (!p) return;
  ensureNotesArray(p);
  p.notes = p.notes.filter((x) => x.id !== noteId);
  try {
    savePrompts(prompts);
    // refresh UI
    renderPrompts();
    openNotes(promptId);
  } catch (e) {
    const panel = document.getElementById("notesPanel");
    showNotesError(panel, "Unable to delete note.");
  }
}

/* ---------------- end Notes feature ---------------- */

function setupHandlers() {
  $("#savePrompt").addEventListener("click", () => {
    const title = $("#promptTitle").value;
    const content = $("#promptContent").value;
    if (!content.trim()) {
      alert("Prompt content cannot be empty.");
      return;
    }
    try {
      addPrompt(title || "(untitled)", content);
      $("#promptTitle").value = "";
      $("#promptContent").value = "";
      const mn = document.getElementById("modelName");
      if (mn) mn.value = "";
      const cb = document.getElementById("isCode");
      if (cb) cb.checked = false;
    } catch (err) {
      alert(
        "Unable to save prompt: " + (err && err.message ? err.message : err)
      );
    }
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
