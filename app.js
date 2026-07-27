/* Tangents - a personal listening library.
   Renders the episode library, an article reader, and a text-to-speech
   player built on the browser's SpeechSynthesis API. No build step, no
   dependencies. Episodes come from window.EPISODES (see episodes.js). */

(function () {
  "use strict";

  var EPISODES = (window.EPISODES || []).slice().sort(function (a, b) {
    return (b.date || "").localeCompare(a.date || "");
  });
  var byId = {};
  EPISODES.forEach(function (e) { byId[e.id] = e; });

  var app = document.getElementById("app");
  var TTS = ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window);

  var REPO = "jertyr/Photo-Annotator";   // where feedback issues get filed
  var FB_KEY = "tangents.feedback";

  /* ---------- tiny markdown -> HTML with sentence spans ---------- */

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return s;
  }

  function splitSentences(text) {
    var t = text.replace(/(\d)\.(\d)/g, "$1<DOT>$2"); // protect decimals
    // protect known abbreviations
    ["Mr", "Mrs", "Ms", "Dr", "St", "vs", "etc", "No", "Inc", "Co", "Jr", "Sr"]
      .forEach(function (a) {
        t = t.replace(new RegExp("\\b" + a + "\\.", "g"), a + "<DOT>");
      });
    // protect single-letter initials, e.g. "George S. Long"
    t = t.replace(/\b([A-Z])\./g, "$1<DOT>");
    var parts = t.split(/(?<=[.!?])\s+(?=[A-Z"“])/);
    return parts
      .map(function (p) { return p.replace(/<DOT>/g, ".").trim(); })
      .filter(Boolean);
  }

  function renderArticle(md) {
    var idx = 0;
    var blocks = md.trim().split(/\n\s*\n/);
    var html = "";
    blocks.forEach(function (b0) {
      var b = b0.trim();
      if (!b) return;
      var isH = b.indexOf("## ") === 0;
      var raw = isH ? b.slice(3).trim() : b.replace(/\n/g, " ");
      var inner = splitSentences(raw).map(function (s) {
        return '<span class="sent" data-i="' + (idx++) + '">' + inline(s) + "</span>";
      }).join(" ");
      html += isH ? "<h2>" + inner + "</h2>" : "<p>" + inner + "</p>";
    });
    return html;
  }

  /* ---------- feedback ----------
     Reactions are kept in localStorage so the site stays static. Sending them
     opens a pre-filled GitHub issue titled "[feedback] ...", which the research
     Routine reads on its next run and folds into feedback.md. That is the whole
     loop: react here, one tap to file, next episode knows about it. */

  var RATING_LABEL = { more: "More of this", ok: "Fine", less: "Not for me" };

  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(FB_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveFeedback(list) {
    try { localStorage.setItem(FB_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function pendingFeedback() {
    return loadFeedback().filter(function (f) { return !f.sent; });
  }
  function ratingFor(id) {
    var hits = loadFeedback().filter(function (f) { return f.ep === id && f.rating; });
    return hits.length ? hits[hits.length - 1].rating : null;
  }
  function recordFeedback(entry) {
    var list = loadFeedback();
    if (entry.rating) {
      // one live rating per episode; a new one replaces an unsent earlier one
      list = list.filter(function (f) {
        return !(f.ep === entry.ep && f.rating && !f.sent);
      });
    }
    entry.at = new Date().toISOString().slice(0, 10);
    list.push(entry);
    saveFeedback(list);
  }
  function markAllSent() {
    var list = loadFeedback();
    list.forEach(function (f) { f.sent = true; });
    saveFeedback(list);
  }
  function unmarkAllSent() {
    var list = loadFeedback();
    list.forEach(function (f) { delete f.sent; });
    saveFeedback(list);
  }

  function feedbackIssueUrl() {
    var items = pendingFeedback();
    if (!items.length) return null;
    var lines = ["Sent from the Tangents reader.", ""];
    items.forEach(function (f) {
      var ep = f.ep && byId[f.ep];
      var where = ep ? ep.title : "general";
      if (f.rating) lines.push("- **" + RATING_LABEL[f.rating] + "** on _" + where + "_ (" + f.at + ")");
      if (f.note) lines.push("- **Request** from _" + where + "_ (" + f.at + "): " + f.note);
    });
    var title = "[feedback] " + items.length + " item" + (items.length === 1 ? "" : "s") + " from the reader";
    return "https://github.com/" + REPO + "/issues/new?title=" +
      encodeURIComponent(title) + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function renderSendStrip(el) {
    if (!el) return;
    var n = pendingFeedback().length;
    if (!n) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<a class="fb-link" id="fbGo" href="#">Send ' + n + " item" + (n === 1 ? "" : "s") +
        " to Tangents &#8594;</a>" +
      '<p class="fb-hint">Opens a pre-filled GitHub issue. Submitting it is what feeds the next episode.</p>';
    el.querySelector("#fbGo").onclick = function (e) {
      e.preventDefault();
      var url = feedbackIssueUrl();
      if (!url) return;
      window.open(url, "_blank", "noopener");
      markAllSent();
      el.innerHTML = '<p class="fb-hint">Opened GitHub. ' +
        '<a href="#" id="fbUndo">Did not submit it? Put it back.</a></p>';
      el.querySelector("#fbUndo").onclick = function (ev) {
        ev.preventDefault();
        unmarkAllSent();
        renderSendStrip(el);
      };
    };
  }

  function noteBox(taId, btnId, statusId, label) {
    return '<textarea id="' + taId + '" class="fb-note" rows="2" placeholder="' + label + '"></textarea>' +
      '<div class="fb-actions"><button class="fb-save" id="' + btnId + '">Add</button>' +
      '<span class="fb-status" id="' + statusId + '"></span></div>';
  }

  function wireNoteBox(taId, btnId, statusId, epId, sendEl) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = function () {
      var ta = document.getElementById(taId);
      var v = (ta.value || "").trim();
      if (!v) return;
      recordFeedback({ ep: epId, note: v });
      ta.value = "";
      document.getElementById(statusId).textContent = "Saved.";
      renderSendStrip(sendEl);
    };
  }

  /* ---------- views ---------- */

  var activeFilter = "all";

  function badge(cat) {
    var label = cat === "wild" ? "Wild card" : "In your wheelhouse";
    return '<span class="badge ' + (cat === "wild" ? "wild" : "close") + '">' + label + "</span>";
  }

  function fmtDate(d) {
    var parts = (d || "").split("-");
    if (parts.length !== 3) return d || "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[+parts[1] - 1] + " " + (+parts[2]) + ", " + parts[0];
  }

  function renderLibrary() {
    stopSpeech();
    var list = EPISODES.filter(function (e) {
      return activeFilter === "all" || e.category === activeFilter;
    });
    var cards = list.map(function (e) {
      return (
        '<article class="card" data-go="' + e.id + '">' +
          '<div class="card-top">' + badge(e.category) +
            '<span class="card-meta">' + fmtDate(e.date) + " &middot; " +
            (e.readingTimeMin || 10) + " min listen</span>" +
          "</div>" +
          "<h2>" + escapeHtml(e.title) + "</h2>" +
          (e.subtitle ? '<p class="sub">' + escapeHtml(e.subtitle) + "</p>" : "") +
          '<p class="sum">' + escapeHtml(e.summary || "") + "</p>" +
          '<div class="listen-hint">&#9654; Listen</div>' +
        "</article>"
      );
    }).join("");

    app.innerHTML =
      '<p class="lib-intro">Fresh research briefings, chosen for you and read aloud. ' +
        'Mostly things near what you already love, with the occasional wild card to pull you somewhere new.</p>' +
      '<div class="filters">' +
        filterBtn("all", "All") +
        filterBtn("close", "In your wheelhouse") +
        filterBtn("wild", "Wild cards") +
      "</div>" +
      (cards || '<p class="empty">No episodes here yet. New ones arrive automatically.</p>') +
      '<div class="feedback lib-feedback">' +
        "<h3>Want something specific?</h3>" +
        '<p class="fb-lead">Anything you add here steers what gets written next.</p>' +
        noteBox("ideaNote", "ideaSave", "ideaStatus", "A topic you want an episode on.") +
        '<div class="fb-send" id="fbSend"></div>' +
      "</div>";

    Array.prototype.forEach.call(app.querySelectorAll(".filter-btn"), function (b) {
      b.onclick = function () { activeFilter = b.getAttribute("data-f"); renderLibrary(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll(".card"), function (c) {
      c.onclick = function () { location.hash = "#/ep/" + c.getAttribute("data-go"); };
    });

    var sendEl = document.getElementById("fbSend");
    wireNoteBox("ideaNote", "ideaSave", "ideaStatus", null, sendEl);
    renderSendStrip(sendEl);
  }

  function filterBtn(val, label) {
    return '<button class="filter-btn ' + (activeFilter === val ? "active" : "") +
      '" data-f="' + val + '">' + label + "</button>";
  }

  function renderReader(ep) {
    stopSpeech();
    var sourcesHtml = "";
    if (ep.sources && ep.sources.length) {
      sourcesHtml =
        '<div class="sources"><h3>Sources</h3><ol>' +
        ep.sources.map(function (s) {
          return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' +
            escapeHtml(s.title) + "</a></li>";
        }).join("") + "</ol></div>";
    }

    app.innerHTML =
      '<button class="back-link" id="back">&#8592; All episodes</button>' +
      '<div class="reader-head">' +
        badge(ep.category) +
        "<h1>" + escapeHtml(ep.title) + "</h1>" +
        (ep.subtitle ? '<p class="sub">' + escapeHtml(ep.subtitle) + "</p>" : "") +
        '<p class="meta">' + fmtDate(ep.date) + " &middot; " +
          (ep.readingTimeMin || 10) + " min listen &middot; " +
          (ep.topics || []).map(escapeHtml).join(", ") + "</p>" +
      "</div>" +
      '<div class="article" id="article">' + renderArticle(ep.body) + "</div>" +
      sourcesHtml +
      feedbackPanel(ep);

    document.getElementById("back").onclick = function () { location.hash = "#/"; };
    window.scrollTo(0, 0);
    wireFeedbackPanel(ep);
    setupSpeech(ep);
  }

  function feedbackPanel(ep) {
    var current = ratingFor(ep.id);
    function btn(val) {
      return '<button class="fb-btn' + (current === val ? " on" : "") + '" data-r="' + val + '">' +
        RATING_LABEL[val] + "</button>";
    }
    return '<div class="feedback" id="feedback">' +
      "<h3>Was this one for you?</h3>" +
      '<div class="fb-row">' + btn("more") + btn("ok") + btn("less") + "</div>" +
      noteBox("fbNote", "fbSave", "fbStatus", "Want a follow-up, or something else entirely? Say so here.") +
      '<div class="fb-send" id="fbSend"></div>' +
    "</div>";
  }

  function wireFeedbackPanel(ep) {
    var box = document.getElementById("feedback");
    if (!box) return;
    var sendEl = document.getElementById("fbSend");
    var btns = box.querySelectorAll(".fb-btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.onclick = function () {
        recordFeedback({ ep: ep.id, rating: b.getAttribute("data-r") });
        Array.prototype.forEach.call(btns, function (o) { o.classList.remove("on"); });
        b.classList.add("on");
        document.getElementById("fbStatus").textContent = "Saved.";
        renderSendStrip(sendEl);
      };
    });
    wireNoteBox("fbNote", "fbSave", "fbStatus", ep.id, sendEl);
    renderSendStrip(sendEl);
  }

  /* ---------- speech engine ---------- */

  var speech = {
    sents: [],   // array of {el, text}
    idx: 0,
    playing: false,
    voice: null,
    rate: 1,
  };
  var keepAlive = null;

  function playerEl() { return document.getElementById("player"); }

  function setupSpeech(ep) {
    speech.sents = Array.prototype.map.call(
      document.querySelectorAll("#article .sent"),
      function (el) { return { el: el, text: el.textContent.trim() }; }
    );
    speech.idx = 0;
    speech.playing = false;

    var p = playerEl();
    p.querySelector(".p-title").textContent = ep.title;
    p.classList.add("visible");
    updateProgress();
    updateStatus();

    if (!TTS) {
      p.querySelector(".no-tts").style.display = "block";
      p.querySelector(".player-controls").style.opacity = "0.45";
      p.querySelector(".play").disabled = true;
      return;
    }
    speech.rate = parseFloat(localStorage.getItem("tangents.rate") || "1") || 1;
    var rateInput = p.querySelector("#rate");
    rateInput.value = speech.rate;
    p.querySelector("#rateVal").textContent = speech.rate.toFixed(2) + "x";
    populateVoices();
  }

  function populateVoices() {
    var sel = document.getElementById("voice");
    if (!sel) return;
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return; // will be called again on voiceschanged
    var en = voices.filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    var rest = voices.filter(function (v) { return !/^en(-|_|$)/i.test(v.lang); });
    var ordered = en.concat(rest);
    var saved = localStorage.getItem("tangents.voice");
    sel.innerHTML = ordered.map(function (v) {
      return '<option value="' + v.voiceURI + '"' +
        (v.voiceURI === saved ? " selected" : "") + ">" +
        escapeHtml(v.name.replace(/ \(.*\)$/, "")) + "</option>";
    }).join("");
    speech.voice = ordered.filter(function (v) { return v.voiceURI === sel.value; })[0] || ordered[0];
  }

  function speakCurrent() {
    if (!TTS) return;
    if (speech.idx >= speech.sents.length) { stopSpeech(); speech.idx = 0; updateProgress(); updateStatus(); return; }
    window.speechSynthesis.cancel();
    var item = speech.sents[speech.idx];
    highlight(item.el);
    var u = new SpeechSynthesisUtterance(item.text);
    if (speech.voice) { u.voice = speech.voice; u.lang = speech.voice.lang; }
    u.rate = speech.rate;
    u.onend = function () {
      if (!speech.playing) return;
      speech.idx++;
      updateProgress();
      speakCurrent();
    };
    u.onerror = function () { /* skip a bad utterance */ if (speech.playing) { speech.idx++; speakCurrent(); } };
    window.speechSynthesis.speak(u);
    updateStatus();
  }

  function play() {
    if (!TTS || !speech.sents.length) return;
    speech.playing = true;
    setPlayIcon(true);
    startKeepAlive();
    speakCurrent();
  }

  function pause() {
    speech.playing = false;
    setPlayIcon(false);
    stopKeepAlive();
    if (TTS) window.speechSynthesis.cancel();
    updateStatus();
  }

  function stopSpeech() {
    speech.playing = false;
    stopKeepAlive();
    if (TTS) window.speechSynthesis.cancel();
    clearHighlight();
    var p = playerEl();
    if (p) { p.classList.remove("visible"); setPlayIcon(false); }
  }

  function jump(delta) {
    speech.idx = Math.max(0, Math.min(speech.sents.length - 1, speech.idx + delta));
    updateProgress();
    if (speech.playing) speakCurrent(); else { highlight(speech.sents[speech.idx].el); updateStatus(); }
  }

  function seekRatio(r) {
    if (!speech.sents.length) return;
    speech.idx = Math.max(0, Math.min(speech.sents.length - 1, Math.floor(r * speech.sents.length)));
    updateProgress();
    if (speech.playing) speakCurrent(); else { highlight(speech.sents[speech.idx].el); updateStatus(); }
  }

  /* Chrome stops long synthesis after ~15s; nudge it to keep going. */
  function startKeepAlive() {
    stopKeepAlive();
    keepAlive = setInterval(function () {
      if (speech.playing && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 9000);
  }
  function stopKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null; } }

  function highlight(el) {
    clearHighlight();
    if (!el) return;
    el.classList.add("speaking");
    var r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 160) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  function clearHighlight() {
    Array.prototype.forEach.call(document.querySelectorAll(".sent.speaking"),
      function (e) { e.classList.remove("speaking"); });
  }

  function updateProgress() {
    var p = playerEl(); if (!p) return;
    var total = speech.sents.length || 1;
    var pct = Math.min(100, (speech.idx / total) * 100);
    p.querySelector(".progress-fill").style.width = pct + "%";
  }
  function updateStatus() {
    var p = playerEl(); if (!p) return;
    var total = speech.sents.length;
    p.querySelector(".p-sub").textContent = total
      ? (speech.playing ? "Reading" : "Paused") + " · " + Math.min(speech.idx + 1, total) + " / " + total
      : "";
  }
  function setPlayIcon(playing) {
    var b = document.querySelector(".play");
    if (b) b.innerHTML = playing ? "&#10073;&#10073;" : "&#9654;";
  }

  /* ---------- player DOM (built once) ---------- */

  function buildPlayer() {
    var p = document.createElement("div");
    p.className = "player";
    p.id = "player";
    p.innerHTML =
      '<div class="inner">' +
        '<div class="progress-track" id="track"><div class="progress-fill"></div></div>' +
        '<div class="player-controls">' +
          '<button class="pbtn" id="prev" title="Back a sentence">&#9198;</button>' +
          '<button class="pbtn play" title="Play / pause">&#9654;</button>' +
          '<button class="pbtn" id="next" title="Forward a sentence">&#9197;</button>' +
          '<div class="p-status"><div class="p-title"></div><div class="p-sub"></div></div>' +
          '<div class="p-settings">' +
            '<span class="rate-wrap">speed <input type="range" id="rate" min="0.6" max="1.6" step="0.05" value="1"><span id="rateVal">1.00x</span></span>' +
            '<label class="voice-label" style="font-size:.72rem;color:var(--ink-faint)">voice</label>' +
            '<select id="voice" title="Voice"></select>' +
          "</div>" +
        "</div>" +
        '<div class="no-tts">Your browser will not read aloud here. Try Chrome or Safari, or read along below.</div>' +
      "</div>";
    document.body.appendChild(p);

    p.querySelector(".play").onclick = function () { speech.playing ? pause() : play(); };
    p.querySelector("#prev").onclick = function () { jump(-1); };
    p.querySelector("#next").onclick = function () { jump(1); };
    p.querySelector("#track").onclick = function (e) {
      var rect = this.getBoundingClientRect();
      seekRatio((e.clientX - rect.left) / rect.width);
    };
    p.querySelector("#rate").oninput = function () {
      speech.rate = parseFloat(this.value);
      p.querySelector("#rateVal").textContent = speech.rate.toFixed(2) + "x";
      localStorage.setItem("tangents.rate", speech.rate);
      if (speech.playing) speakCurrent();
    };
    p.querySelector("#voice").onchange = function () {
      var voices = window.speechSynthesis.getVoices() || [];
      speech.voice = voices.filter(function (v) { return v.voiceURI === this.value; }.bind(this))[0] || null;
      if (speech.voice) localStorage.setItem("tangents.voice", speech.voice.voiceURI);
      if (speech.playing) speakCurrent();
    };
  }

  if (TTS && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = function () {
      if (document.getElementById("voice")) populateVoices();
    };
  }

  /* ---------- routing ---------- */

  function route() {
    var m = location.hash.match(/^#\/ep\/(.+)$/);
    if (m && byId[m[1]]) renderReader(byId[m[1]]);
    else renderLibrary();
  }

  document.querySelector(".site-header .inner").onclick = function () { location.hash = "#/"; };
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", stopSpeech);

  buildPlayer();
  route();
})();
