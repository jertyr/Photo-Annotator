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

  /* ---------- speech engine ----------
     Two quirks of SpeechSynthesis shape everything below.

     1. cancel() is asynchronous and messy. A speak() issued in the same task
        as a cancel() is silently dropped, and the cancelled utterance still
        fires end/error afterwards - so a naive handler advances the position
        for an utterance we already walked away from. Every (re)start takes a
        token; callbacks carrying a stale token are ignored, and the new
        utterance is queued in a later task.

     2. Chrome gives up part way through a long utterance (around 15 seconds).
        Sentences are therefore spoken in short chunks, and a watchdog picks
        playback back up if the engine drops it anyway. */

  var speech = {
    sents: [],      // [{el, text}] - one per sentence span in the article
    idx: 0,         // sentence currently being spoken
    chunks: [],     // that sentence, split into utterance-sized pieces
    chunkIdx: 0,
    playing: false,
    done: false,
    voice: null,
    rate: 1,
    token: 0,       // bumped on every (re)start, checked by every callback
    utter: null,    // live reference: engines have been known to GC these
    lastTick: 0,    // when audio last demonstrably progressed
    fails: 0,       // consecutive failures, reset by any chunk that completes
    note: "",       // what to tell the listener when something went wrong
    voiceSet: false,// whether a voice has been resolved (null is a real choice)
  };
  var watchdog = null;

  /* The pause()/resume() nudge exists for one browser only: desktop Chrome,
     which abandons a long utterance after about fifteen seconds. Everywhere
     else it does harm. Safari can stall for good on a resume() issued outside
     a user gesture, and on Android pause() frequently kills the utterance
     without resume() ever bringing it back, so the nudge becomes the thing
     that stops playback rather than the thing that saves it. Android speech
     is native and has no cut-off to work around. */
  var UA = navigator.userAgent || "";
  var NEEDS_NUDGE = /Chrome|Chromium|Edg\//.test(UA) &&
                    !/iPhone|iPad|iPod|Android|Mobile/i.test(UA);

  function playerEl() { return document.getElementById("player"); }

  function setupSpeech(ep) {
    speech.sents = Array.prototype.map.call(
      document.querySelectorAll("#article .sent"),
      function (el) { return { el: el, text: el.textContent.trim() }; }
    );
    speech.idx = 0;
    speech.chunks = [];
    speech.chunkIdx = 0;
    speech.playing = false;
    speech.done = false;
    speech.fails = 0;
    note("");

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

  function isEnglish(v) { return /^en(-|_|$)/i.test(v.lang); }
  function isLocal(v) { return v.localService === true; }
  function voiceName(v) { return v.name.replace(/ \(.*\)$/, ""); }

  /* DEFAULT_VOICE means "name no voice at all" and leave the choice to the
     engine, which follows the page language. It is the one setting that works
     everywhere, because it cannot name a voice the device cannot produce. */
  var DEFAULT_VOICE = "__default__";
  var badVoices = {};   // voiceURI -> true, once a voice has refused to speak here

  /* localService cannot be trusted to mean "this will work". Android lists
     every locale its TTS engine knows about, around ninety of them, all
     flagged as on-device, including the ones whose voice data was never
     downloaded. Those fail with synthesis-failed the moment you use them.
     Ordering therefore aims at the voice most likely to be installed: the
     one matching the browser's own language, then other English voices. */
  function orderVoices(voices) {
    var want = (navigator.language || "en-US").toLowerCase().replace(/_/g, "-");
    function rank(v) {
      var lang = (v.lang || "").toLowerCase().replace(/_/g, "-");
      var score = isLocal(v) ? 0 : 8;      // on desktop Chrome the online voices need a network
      if (lang === want) return score;
      if (lang.split("-")[0] === want.split("-")[0]) return score + 1;
      return score + (isEnglish(v) ? 2 : 4);
    }
    return voices.slice().sort(function (a, b) {
      return (rank(a) - rank(b)) || a.name.localeCompare(b.name);
    });
  }

  /* Voices we have not already watched fail, best first. */
  function candidateVoices() {
    return orderVoices(window.speechSynthesis.getVoices() || [])
      .filter(function (v) { return !badVoices[v.voiceURI]; });
  }

  function populateVoices() {
    var sel = document.getElementById("voice");
    if (!sel) return;
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return; // will be called again on voiceschanged
    var ordered = orderVoices(voices);
    var saved = localStorage.getItem("tangents.voice");

    if (!speech.voiceSet) {
      speech.voice = saved === DEFAULT_VOICE ? null
        : (ordered.filter(function (v) { return v.voiceURI === saved; })[0] || ordered[0] || null);
      speech.voiceSet = true;
    }
    var cur = speech.voice ? speech.voice.voiceURI : DEFAULT_VOICE;

    sel.innerHTML =
      '<option value="' + DEFAULT_VOICE + '"' + (cur === DEFAULT_VOICE ? " selected" : "") + ">" +
        "Device default</option>" +
      ordered.map(function (v) {
        return '<option value="' + escapeHtml(v.voiceURI) + '"' +
          (v.voiceURI === cur ? " selected" : "") + ">" +
          escapeHtml(voiceName(v) + (isLocal(v) ? "" : " (online)")) + "</option>";
      }).join("");

    // Keep hold of the live object for the chosen voice; getVoices() can hand
    // back fresh instances and a stale one will not speak.
    if (speech.voice) {
      speech.voice = ordered.filter(function (v) { return v.voiceURI === cur; })[0] || speech.voice;
    }
  }

  function useVoice(v) {
    speech.voice = v || null;
    speech.voiceSet = true;
    try { localStorage.setItem("tangents.voice", v ? v.voiceURI : DEFAULT_VOICE); }
    catch (e) { /* private mode */ }
    var sel = document.getElementById("voice");
    if (sel) sel.value = v ? v.voiceURI : DEFAULT_VOICE;
  }

  /* A voice that cannot synthesise here fails identically every time, so
     retrying it is pointless. Strike it off, take the next candidate, and
     when the named voices are exhausted hand the choice back to the engine. */
  function tryNextVoice() {
    if (!speech.voice) return false;          // already on the engine default
    var dead = speech.voice;
    badVoices[dead.voiceURI] = true;
    var next = candidateVoices()[0];
    if (next) {
      useVoice(next);
      note(voiceName(dead) + " will not speak on this device. Switched to " + voiceName(next) + ".");
    } else {
      useVoice(null);
      note("No named voice would speak here. Using the device's default voice.");
    }
    speech.fails = 0;
    return true;
  }

  function switchToLocalVoice(why) {
    if (!speech.voice || isLocal(speech.voice)) return false;
    var local = candidateVoices().filter(isLocal)[0];
    if (!local) return false;
    useVoice(local);
    speech.fails = 0;
    note(why + " Switched to " + voiceName(local) + ", which reads on your device.");
    return true;
  }

  /* Keep each utterance comfortably inside Chrome's cut-off window. Slower
     speech covers less text in the same number of seconds, so the character
     budget follows the rate. */
  function chunkLimit() {
    return Math.max(80, Math.round(150 * (speech.rate || 1)));
  }

  function chunkText(text) {
    var limit = chunkLimit();
    var rest = String(text || "").trim();
    var out = [];
    while (rest.length > limit) {
      var head = rest.slice(0, limit);
      var cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "),
                         head.lastIndexOf(": "), head.lastIndexOf("— "));
      if (cut < limit * 0.4) cut = head.lastIndexOf(" ");   // no clause break, any word will do
      cut = cut > 0 ? cut + 1 : limit;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  }

  /* Move the reading position to a sentence, without touching the audio. */
  function enterSentence(i) {
    speech.idx = i;
    speech.done = false;
    var item = speech.sents[i];
    speech.chunks = item ? chunkText(item.text) : [];
    speech.chunkIdx = 0;
    if (item) highlight(item.el);
    updateProgress();
    updateStatus();
  }

  /* Start (or restart) audio at the current position. */
  function speakCurrent() {
    if (!TTS || !speech.sents.length) return;
    if (speech.idx >= speech.sents.length) { finishArticle(); return; }
    if (!speech.chunks.length) enterSentence(speech.idx);

    var token = ++speech.token;
    var busy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    if (busy) window.speechSynthesis.cancel();
    // An utterance queued in the same task as cancel() never gets spoken, so
    // hand speak() to a later task and let the engine settle first.
    setTimeout(function () { speakChunk(token); }, busy ? 80 : 0);
    updateStatus();
  }

  function speakChunk(token) {
    if (token !== speech.token || !speech.playing) return;   // superseded

    if (speech.chunkIdx >= speech.chunks.length) {           // sentence finished
      if (speech.idx + 1 >= speech.sents.length) { finishArticle(); return; }
      enterSentence(speech.idx + 1);
    }
    var text = speech.chunks[speech.chunkIdx];
    if (!text) { speech.chunkIdx++; speakChunk(token); return; }

    var u = new SpeechSynthesisUtterance(text);
    if (speech.voice) { u.voice = speech.voice; u.lang = speech.voice.lang; }
    u.rate = speech.rate;
    u.onstart = function () { speech.lastTick = Date.now(); };
    u.onend = function () {
      if (token !== speech.token || !speech.playing) return;
      speech.lastTick = Date.now();
      speech.fails = 0;                    // a chunk got through: we are healthy
      speech.chunkIdx++;
      speakChunk(token);
    };
    u.onerror = function (e) {
      if (token !== speech.token || !speech.playing) return;
      // "interrupted"/"canceled" are our own cancel() landing late - the run
      // that replaced this one owns the position now, so leave it alone.
      var err = (e && e.error) || "";
      if (err === "interrupted" || err === "canceled") return;
      speech.lastTick = Date.now();
      if (err === "network" || err === "synthesis-failed" || err === "synthesis-unavailable" ||
          err === "audio-busy" || err === "audio-hardware" || !err) {
        speechFailed(err || "no audio");   // recoverable: do not lose the text
        return;
      }
      speech.chunkIdx++;                   // bad text rather than a bad engine
      speakChunk(token);
    };
    speech.utter = u;          // hold a reference so it survives until it ends
    speech.lastTick = Date.now();
    window.speechSynthesis.speak(u);
  }

  /* Re-speak the chunk we are already on, under a fresh token. */
  function restartChunk(delay) {
    var token = ++speech.token;
    setTimeout(function () { speakChunk(token); }, delay || 0);
  }

  /* Something ate the audio: a dropped request to an online voice, a stalled
     engine, a device that woke up unhappy. The text is not at fault, so retry
     the same chunk rather than skipping past it. If the failures keep coming
     and we are on an online voice, a weak connection is the likely culprit -
     move to an on-device voice and carry on from the same place. */
  function speechFailed(reason) {
    if (!speech.playing) return;
    speech.fails++;
    // One retry covers a transient blip. Beyond that the voice itself is the
    // suspect, and a voice that cannot speak will not start working.
    if (speech.fails <= 1) { restartChunk(300); return; }
    if (reason === "network" &&
        switchToLocalVoice("Trouble reaching the online voice.")) { restartChunk(200); return; }
    if (tryNextVoice()) { restartChunk(200); return; }
    if (speech.fails <= 4) { restartChunk(600 * (speech.fails - 1)); return; }
    note("Speech keeps failing here (" + reason + "). Press play to try again.");
    pause();
  }

  function note(msg) {
    speech.note = msg || "";
    var p = playerEl();
    if (!p) return;
    var el = p.querySelector(".p-note");
    if (el) { el.textContent = speech.note; el.style.display = speech.note ? "block" : "none"; }
  }

  function finishArticle() {
    speech.playing = false;
    speech.done = true;
    speech.chunks = [];
    speech.chunkIdx = 0;
    speech.token++;
    stopWatchdog();
    if (TTS) window.speechSynthesis.cancel();
    clearHighlight();
    setPlayIcon(false);
    speech.idx = 0;
    updateProgress();
    updateStatus();
  }

  function play() {
    if (!TTS || !speech.sents.length) return;
    if (speech.done) enterSentence(0);
    speech.playing = true;
    speech.done = false;
    speech.fails = 0;
    note("");
    // No point sending text to a server we cannot reach.
    if (navigator.onLine === false) switchToLocalVoice("You are offline.");
    setPlayIcon(true);
    startWatchdog();
    speakCurrent();
  }

  function pause() {
    speech.playing = false;
    speech.token++;            // orphan any callback still in flight
    setPlayIcon(false);
    stopWatchdog();
    if (TTS) window.speechSynthesis.cancel();
    updateStatus();
  }

  function stopSpeech() {
    speech.playing = false;
    speech.token++;
    stopWatchdog();
    if (TTS) window.speechSynthesis.cancel();
    clearHighlight();
    var p = playerEl();
    if (p) { p.classList.remove("visible"); setPlayIcon(false); }
  }

  function jump(delta) {
    if (!speech.sents.length) return;
    enterSentence(Math.max(0, Math.min(speech.sents.length - 1, speech.idx + delta)));
    if (speech.playing) speakCurrent();
  }

  function seekRatio(r) {
    if (!speech.sents.length) return;
    enterSentence(Math.max(0, Math.min(speech.sents.length - 1, Math.floor(r * speech.sents.length))));
    if (speech.playing) speakCurrent();
  }

  /* Safety net for everything the engine does behind our back: the ~15s
     cut-off, a resume() that never took, an utterance quietly dropped. */
  function startWatchdog() {
    stopWatchdog();
    speech.lastTick = Date.now();
    var ticks = 0;
    watchdog = setInterval(function () {
      if (!speech.playing || !TTS) return;
      ticks++;
      var s = window.speechSynthesis;
      if (s.paused) { s.resume(); return; }
      if (s.speaking) {
        // Chunks are short enough to finish well inside the cut-off, so the
        // nudge is only a backstop - often enough to matter, rare enough not
        // to chop up the audio.
        if (NEEDS_NUDGE && ticks % 6 === 0) { s.pause(); s.resume(); }
        return;
      }
      // Nothing speaking and nothing queued while we believe we are playing:
      // the utterance was dropped, or an online voice went quiet waiting on a
      // network that is not coming back.
      if (!s.pending && Date.now() - speech.lastTick > 2500) {
        speech.lastTick = Date.now();
        speechFailed("no audio");
      }
    }, 1000);
  }
  function stopWatchdog() { if (watchdog) { clearInterval(watchdog); watchdog = null; } }

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
    var state = speech.done ? "Finished" : (speech.playing ? "Reading" : "Paused");
    p.querySelector(".p-sub").textContent = total
      ? state + " · " + Math.min(speech.idx + 1, total) + " / " + total
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
        '<div class="p-note"></div>' +
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
      // A new rate means a new chunk size, so re-cut the current sentence
      // and pick it up from the top rather than mid-phrase.
      if (speech.playing) { enterSentence(speech.idx); speakCurrent(); }
    };
    p.querySelector("#voice").onchange = function () {
      var picked = this.value;
      var v = null;
      if (picked !== DEFAULT_VOICE) {
        v = (window.speechSynthesis.getVoices() || [])
          .filter(function (x) { return x.voiceURI === picked; })[0];
        if (!v) return;
        delete badVoices[v.voiceURI];   // they asked for it; give it another chance
      }
      useVoice(v);
      speech.fails = 0;
      note("");                // their choice wins; stop nagging about the last one
      if (speech.playing) { enterSentence(speech.idx); speakCurrent(); }
    };
  }

  if (TTS && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = function () {
      if (document.getElementById("voice")) populateVoices();
    };
  }

  // Losing the signal mid-episode only matters if the voice lives on a server.
  window.addEventListener("offline", function () {
    if (speech.playing && switchToLocalVoice("Connection dropped.")) restartChunk(0);
  });

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
