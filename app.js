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
      (cards || '<p class="empty">No episodes here yet. New ones arrive automatically.</p>');

    Array.prototype.forEach.call(app.querySelectorAll(".filter-btn"), function (b) {
      b.onclick = function () { activeFilter = b.getAttribute("data-f"); renderLibrary(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll(".card"), function (c) {
      c.onclick = function () { location.hash = "#/ep/" + c.getAttribute("data-go"); };
    });
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
      sourcesHtml;

    document.getElementById("back").onclick = function () { location.hash = "#/"; };
    window.scrollTo(0, 0);
    setupSpeech(ep);
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
