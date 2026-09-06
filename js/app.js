/* Steady Kit — local-only wellness tools (not therapy) */
(function () {
  "use strict";

  const STORAGE = {
    mood: "steadykit_mood_history",
    journal: "steadykit_journal",
    tasks: "steadykit_done_tasks",
  };

  const MOOD_LABELS = {
    1: "Very low",
    2: "Low",
    3: "Okay",
    4: "Good",
    5: "Steady",
  };

  const SELF_TALK = [
    "This feeling is temporary. I can take one small step.",
    "I do not have to fix everything today. Small is enough.",
    "I am allowed to rest without earning it.",
    "Hard days do not make me a failure.",
    "I can be kind to myself the way I would be to a friend.",
    "Noticing how I feel is already a form of care.",
    "I can start again in the next five minutes.",
    "My worth is not measured by productivity.",
  ];

  const MICRO_TASKS = [
    { id: "water", title: "Drink a glass of water", hint: "2 minutes" },
    { id: "window", title: "Open a window or step outside", hint: "3 minutes" },
    { id: "stretch", title: "Stretch your shoulders and neck", hint: "2 minutes" },
    { id: "wash", title: "Wash your face or hands mindfully", hint: "3 minutes" },
    { id: "tidy", title: "Tidy one small surface", hint: "5 minutes" },
    { id: "message", title: "Send one short kind message", hint: "2 minutes" },
    { id: "music", title: "Play one calm or lift track", hint: "3 minutes" },
    { id: "breathe", title: "Do 4 rounds of box breathing", hint: "4 minutes" },
    { id: "shoes", title: "Put on shoes (even if you stay in)", hint: "1 minute" },
    { id: "snack", title: "Eat a small snack if you have not eaten", hint: "5 minutes" },
  ];

  const VOICE_SCRIPTS = [
    "You showed up. That counts. Take one gentle step next.",
    "You do not need to feel ready. Just begin with something tiny.",
    "Breathe in slowly. Breathe out slowly. You are here, and that is enough for this moment.",
    "Low energy days are real. Choose one small act of care, then rest if you need to.",
    "Steady does not mean perfect. It means returning, again and again, with kindness.",
  ];

  /* ---------- Mood ---------- */
  let selectedMood = null;

  function loadMoodHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.mood) || "[]");
    } catch {
      return [];
    }
  }

  function saveMoodHistory(list) {
    localStorage.setItem(STORAGE.mood, JSON.stringify(list));
  }

  function renderMoodUI() {
    const scale = document.getElementById("mood-scale");
    if (!scale) return;
    scale.innerHTML = "";
    const faces = ["😫", "😔", "😐", "🙂", "🌿"];
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mood-btn" + (selectedMood === i ? " selected" : "");
      btn.setAttribute("aria-label", "Mood " + i + ": " + MOOD_LABELS[i]);
      btn.innerHTML = "<span>" + faces[i - 1] + "</span><small>" + i + "</small>";
      btn.addEventListener("click", function () {
        selectedMood = i;
        renderMoodUI();
      });
      scale.appendChild(btn);
    }
  }

  function renderMoodHistory() {
    const history = loadMoodHistory().slice().reverse();
    const list = document.getElementById("mood-history");
    const chart = document.getElementById("mood-chart");
    if (!list || !chart) return;

    list.innerHTML = "";
    if (history.length === 0) {
      list.innerHTML = "<li>No check-ins yet. Your notes stay on this device only.</li>";
    } else {
      history.slice(0, 20).forEach(function (entry) {
        const li = document.createElement("li");
        const d = new Date(entry.ts);
        const when = d.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        li.innerHTML =
          "<strong>" +
          MOOD_LABELS[entry.mood] +
          " (" +
          entry.mood +
          "/5)</strong> · " +
          when +
          (entry.note
            ? "<br><span style='color:var(--muted)'>" +
              escapeHtml(entry.note) +
              "</span>"
            : "");
        list.appendChild(li);
      });
    }

    const recent = loadMoodHistory().slice(-14);
    chart.innerHTML = "";
    if (recent.length === 0) {
      chart.innerHTML =
        '<p style="margin:0;color:var(--muted);font-size:0.9rem">Chart appears after your first check-in.</p>';
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "bar-chart";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "Mood history bar chart");
    recent.forEach(function (entry) {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = (entry.mood / 5) * 100 + "%";
      bar.title = MOOD_LABELS[entry.mood] + " — " + new Date(entry.ts).toLocaleDateString();
      wrap.appendChild(bar);
    });
    chart.appendChild(wrap);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initMood() {
    renderMoodUI();
    renderMoodHistory();
    const form = document.getElementById("mood-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!selectedMood) {
        alert("Please choose a mood from 1 to 5.");
        return;
      }
      const note = (document.getElementById("mood-note").value || "").trim().slice(0, 280);
      const history = loadMoodHistory();
      history.push({ mood: selectedMood, note: note, ts: Date.now() });
      if (history.length > 100) history.splice(0, history.length - 100);
      saveMoodHistory(history);
      if (selectedMood <= 2) {
        var nudge = document.getElementById("mood-crisis-nudge");
        if (nudge) nudge.hidden = false;
      }
      document.getElementById("mood-note").value = "";
      selectedMood = null;
      renderMoodUI();
      renderMoodHistory();
    });
    const clearBtn = document.getElementById("clear-mood");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (confirm("Clear all mood check-ins stored on this device?")) {
          localStorage.removeItem(STORAGE.mood);
          renderMoodHistory();
        }
      });
    }
  }

  /* ---------- Coping deck ---------- */
  let talkIndex = 0;
  let breathTimer = null;
  let breathPhase = "idle";
  let breathSeconds = 0;
  let breathRoundsLeft = 0;

  function showDeck(id) {
    document.querySelectorAll(".deck-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "deck-" + id);
    });
    document.querySelectorAll(".deck-tabs button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.deck === id);
    });
  }

  function updateBreathUI() {
    const display = document.getElementById("breath-timer");
    const phaseEl = document.getElementById("breath-phase");
    const circle = document.getElementById("breath-circle");
    if (!display || !phaseEl || !circle) return;
    const m = String(Math.floor(breathSeconds / 60)).padStart(1, "0");
    const s = String(breathSeconds % 60).padStart(2, "0");
    display.textContent = m + ":" + s;
    const labels = {
      idle: "Ready when you are",
      inhale: "Breathe in…",
      hold1: "Hold…",
      exhale: "Breathe out…",
      hold2: "Hold…",
    };
    phaseEl.textContent = labels[breathPhase] || "";
    circle.className = "breath-circle";
    if (breathPhase === "inhale") circle.classList.add("inhale");
    else if (breathPhase === "hold1") circle.classList.add("hold");
    else if (breathPhase === "exhale" || breathPhase === "hold2") circle.classList.add("exhale");
  }

  function stopBreathing() {
    if (breathTimer) clearInterval(breathTimer);
    breathTimer = null;
    breathPhase = "idle";
    breathSeconds = 0;
    breathRoundsLeft = 0;
    updateBreathUI();
  }

  function startBoxBreathing() {
    stopBreathing();
    breathRoundsLeft = 4;
    const sequence = [
      { phase: "inhale", secs: 4 },
      { phase: "hold1", secs: 4 },
      { phase: "exhale", secs: 4 },
      { phase: "hold2", secs: 4 },
    ];
    let step = 0;
    breathPhase = sequence[0].phase;
    breathSeconds = sequence[0].secs;
    updateBreathUI();

    breathTimer = setInterval(function () {
      breathSeconds -= 1;
      if (breathSeconds <= 0) {
        step += 1;
        if (step >= sequence.length) {
          step = 0;
          breathRoundsLeft -= 1;
          if (breathRoundsLeft <= 0) {
            stopBreathing();
            document.getElementById("breath-phase").textContent =
              "Done. Notice how you feel — no right answer.";
            return;
          }
        }
        breathPhase = sequence[step].phase;
        breathSeconds = sequence[step].secs;
      }
      updateBreathUI();
    }, 1000);
  }

  function initDeck() {
    document.querySelectorAll(".deck-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showDeck(btn.dataset.deck);
      });
    });
    showDeck("ground");

    const talkEl = document.getElementById("self-talk-text");
    if (talkEl) talkEl.textContent = SELF_TALK[0];
    const nextTalk = document.getElementById("next-talk");
    if (nextTalk) {
      nextTalk.addEventListener("click", function () {
        talkIndex = (talkIndex + 1) % SELF_TALK.length;
        talkEl.textContent = SELF_TALK[talkIndex];
      });
    }

    const startBtn = document.getElementById("start-breath");
    const stopBtn = document.getElementById("stop-breath");
    if (startBtn) startBtn.addEventListener("click", startBoxBreathing);
    if (stopBtn) stopBtn.addEventListener("click", stopBreathing);
    updateBreathUI();
  }

  /* ---------- Micro-tasks ---------- */
  function loadDoneTasks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.tasks) || "{}");
    } catch {
      return {};
    }
  }

  function saveDoneTasks(obj) {
    localStorage.setItem(STORAGE.tasks, JSON.stringify(obj));
  }

  function initTasks() {
    const grid = document.getElementById("task-grid");
    const pickBtn = document.getElementById("pick-task");
    if (!grid) return;

    function render() {
      const done = loadDoneTasks();
      const today = new Date().toDateString();
      grid.innerHTML = "";
      MICRO_TASKS.forEach(function (t) {
        const isDone = done[t.id] === today;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-card" + (isDone ? " done" : "");
        btn.innerHTML =
          "<strong>" +
          escapeHtml(t.title) +
          "</strong><span>" +
          escapeHtml(t.hint) +
          (isDone ? " · done today" : "") +
          "</span>";
        btn.addEventListener("click", function () {
          const d = loadDoneTasks();
          if (d[t.id] === today) delete d[t.id];
          else d[t.id] = today;
          saveDoneTasks(d);
          render();
        });
        grid.appendChild(btn);
      });
    }

    render();
    if (pickBtn) {
      pickBtn.addEventListener("click", function () {
        const today = new Date().toDateString();
        const done = loadDoneTasks();
        const open = MICRO_TASKS.filter(function (t) {
          return done[t.id] !== today;
        });
        const pool = open.length ? open : MICRO_TASKS;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const highlight = document.getElementById("picked-task");
        if (highlight) {
          highlight.textContent =
            "Try this: " + pick.title + " (" + pick.hint + "). One is enough.";
        }
      });
    }
  }

  /* ---------- Voice ---------- */
  function speak(text) {
    if (!window.speechSynthesis) {
      alert("Voice is not supported in this browser. You can still read the scripts on screen.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function initVoice() {
    const list = document.getElementById("voice-scripts");
    if (!list) return;
    VOICE_SCRIPTS.forEach(function (script, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = script;
      btn.addEventListener("click", function () {
        speak(script);
      });
      list.appendChild(btn);
    });
    const stop = document.getElementById("stop-voice");
    if (stop) {
      stop.addEventListener("click", function () {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      });
    }
  }

  /* ---------- Journal ---------- */
  function loadJournal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.journal) || "[]");
    } catch {
      return [];
    }
  }

  function saveJournal(entries) {
    localStorage.setItem(STORAGE.journal, JSON.stringify(entries));
  }

  function renderJournal() {
    const list = document.getElementById("journal-list");
    if (!list) return;
    const entries = loadJournal().slice().reverse();
    list.innerHTML = "";
    if (!entries.length) {
      list.innerHTML = "<li>No entries yet. Private to this browser.</li>";
      return;
    }
    entries.slice(0, 30).forEach(function (e) {
      const li = document.createElement("li");
      li.innerHTML =
        "<strong>" +
        new Date(e.ts).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }) +
        "</strong><br>" +
        escapeHtml(e.text);
      list.appendChild(li);
    });
  }

  function initJournal() {
    renderJournal();
    const form = document.getElementById("journal-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const ta = document.getElementById("journal-text");
      const text = (ta.value || "").trim().slice(0, 2000);
      if (!text) return;
      const entries = loadJournal();
      entries.push({ text: text, ts: Date.now() });
      if (entries.length > 80) entries.splice(0, entries.length - 80);
      saveJournal(entries);
      ta.value = "";
      renderJournal();
    });
    const clearBtn = document.getElementById("clear-journal");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (confirm("Clear all journal entries on this device?")) {
          localStorage.removeItem(STORAGE.journal);
          renderJournal();
        }
      });
    }
  }

  /* ---------- First-run crisis / age gate ---------- */
  const GATE_KEY = "steadykit_gate_v1";

  function initGate() {
    const gate = document.getElementById("first-run-gate");
    const accept = document.getElementById("gate-accept");
    if (!gate || !accept) return;
    try {
      if (localStorage.getItem(GATE_KEY) === "1") return;
    } catch (_) {}
    gate.hidden = false;
    accept.addEventListener("click", function () {
      try {
        localStorage.setItem(GATE_KEY, "1");
      } catch (_) {}
      gate.hidden = true;
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initGate();
    initMood();
    initDeck();
    initTasks();
    initVoice();
    initJournal();
  });
})();
