/* Bike TV — roda no navegador da TV LG (webOS).
 * Sem async/await, spread, ?. ou ?? : TVs de 2019 usam Chromium 53. */
(function () {
  'use strict';

  // ---------- teclas do controle LG (e do teclado, para testar no Mac) ----------
  var KEY = {
    OK: [13, 32], LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40],
    BACK: [461, 27, 8], RED: [403, 82], GREEN: [404, 71],
    PLAY: [415], PAUSE: [19], PLAYPAUSE: [10252, 179], CH_UP: [33], CH_DOWN: [34],
  };
  function is(k, name) { return KEY[name].indexOf(k) !== -1; }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 2600);
  }

  // ---------- estado ----------
  // Publicado (https, GitHub Pages): ajustes chegam no #cfg= do app da TV e treinos ficam na TV.
  // Servido pelo Mac (http): tudo vem da API do server.js.
  var HOSTED = location.protocol === 'https:';
  var cfg = { pulsoidToken: '', age: 35, weightKg: 80, sex: 'male', restingHr: 60 };
  var videos = [];
  var vIndex = 0;
  var player = null;
  var playerReady = false;
  var unmuted = false;

  var mode = 'idle'; // idle | running | paused | summary
  var elapsed = 0;   // segundos de pedal
  var lastTick = 0;
  var kcal = 0;
  var kcalFromHr = false;
  var hrSum = 0, hrN = 0, hrMax = 0;
  var zoneSecs = [0, 0, 0, 0, 0];
  var hrHistory = []; // {t: elapsed, hr}

  var hr = null, hrAt = 0;
  var HR_STALE_MS = 15000;

  function maxHr() { return Math.round(208 - 0.7 * cfg.age); }
  function zoneOf(bpm) {
    var p = bpm / maxHr();
    if (p >= 0.9) return 5;
    if (p >= 0.8) return 4;
    if (p >= 0.7) return 3;
    if (p >= 0.6) return 2;
    return 1;
  }
  function currentHr() { return hr && Date.now() - hrAt < HR_STALE_MS ? hr : null; }

  // kcal por minuto: Keytel et al. (2005) com FC; sem FC usa MET 6,8 (bike ergométrica moderada)
  function kcalPerMin(bpm) {
    var w = cfg.weightKg, a = cfg.age, v;
    if (bpm) {
      v = cfg.sex === 'female'
        ? (-20.4022 + 0.4472 * bpm - 0.1263 * w + 0.074 * a) / 4.184
        : (-55.0969 + 0.6309 * bpm + 0.1988 * w + 0.2017 * a) / 4.184;
      return Math.max(v, 1);
    }
    return 6.8 * 3.5 * w / 200;
  }

  // ---------- treino ----------
  function start() {
    if (mode === 'summary') reset();
    mode = 'running';
    lastTick = Date.now();
    document.body.className = '';
    $('splash').className = 'overlay';
    if (playerReady) {
      if (!unmuted) { player.unMute(); player.setVolume(100); unmuted = true; }
      player.playVideo();
    }
  }
  function pause() {
    mode = 'paused';
    document.body.className = 'paused';
    $('splash-title').textContent = 'Pausado';
    $('splash-sub').innerHTML = 'Aperte <b>OK</b> para continuar.';
    $('splash').className = 'overlay show';
  }
  function reset() {
    elapsed = 0; kcal = 0; kcalFromHr = false;
    hrSum = 0; hrN = 0; hrMax = 0; zoneSecs = [0, 0, 0, 0, 0]; hrHistory = [];
    $('splash-title').textContent = 'Bora pedalar?';
    $('splash-sub').innerHTML = 'Aperte <b>OK</b> para começar o treino.';
    render();
  }
  function finish() {
    if (elapsed < 5) { reset(); mode = 'idle'; $('summary').className = 'overlay'; $('splash').className = 'overlay show'; return; }
    mode = 'summary';
    document.body.className = '';
    $('splash').className = 'overlay';
    var avg = hrN ? Math.round(hrSum / hrN) : null;
    $('s-time').textContent = fmtTime(elapsed);
    $('s-avg').textContent = avg || '--';
    $('s-max').textContent = hrMax || '--';
    $('s-kcal').textContent = Math.round(kcal);
    var total = zoneSecs.reduce(function (a, b) { return a + b; }, 0);
    var html = '';
    if (total) {
      for (var i = 0; i < 5; i++) {
        if (zoneSecs[i]) html += '<span style="width:' + (100 * zoneSecs[i] / total) + '%;background:var(--z' + (i + 1) + ')"></span>';
      }
    }
    $('s-zones').innerHTML = html;
    $('summary').className = 'overlay show';
    var session = {
      startedAt: new Date(Date.now() - elapsed * 1000).toISOString(),
      seconds: Math.round(elapsed), avgHr: avg, maxHr: hrMax || null,
      kcal: Math.round(kcal), kcalFromHr: kcalFromHr, zoneSeconds: zoneSecs,
      video: videos[vIndex] ? videos[vIndex].title : null,
    };
    if (HOSTED) {
      var all = [];
      try { all = JSON.parse(store('bike.sessions') || '[]'); } catch (e) {}
      all.push(session);
      store('bike.sessions', JSON.stringify(all.slice(-200)));
      return;
    }
    fetch('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    }).catch(function () {});
  }

  function tick() {
    var now = Date.now();
    if (mode === 'running') {
      var dt = Math.min((now - lastTick) / 1000, 5);
      elapsed += dt;
      var bpm = currentHr();
      kcal += kcalPerMin(bpm) * dt / 60;
      if (bpm) {
        kcalFromHr = true;
        hrSum += bpm * dt; hrN += dt;
        if (bpm > hrMax) hrMax = bpm;
        zoneSecs[zoneOf(bpm) - 1] += dt;
        var last = hrHistory[hrHistory.length - 1];
        if (!last || elapsed - last.t >= 2) hrHistory.push({ t: elapsed, hr: bpm });
        while (hrHistory.length && elapsed - hrHistory[0].t > 600) hrHistory.shift();
      }
    }
    lastTick = now;
    render();
  }

  // ---------- render ----------
  var ZONE_NAMES = ['', 'Aquecimento', 'Leve', 'Moderada', 'Forte', 'Máxima'];
  function render() {
    var d = new Date();
    $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    $('m-time').textContent = fmtTime(elapsed);

    var bpm = currentHr();
    var z = bpm ? zoneOf(bpm) : 0;
    $('m-hr').textContent = bpm || '--';
    document.documentElement.style.setProperty('--zone', z ? 'var(--z' + z + ')' : 'var(--z1)');
    $('heart').className = bpm ? 'heart beat' : 'heart';
    if (bpm) $('heart').style.animationDuration = (60 / bpm) + 's';
    $('m-zone').textContent = z ? 'Zona ' + z + ' · ' + ZONE_NAMES[z] + ' · ' + Math.round(100 * bpm / maxHr()) + '%' : 'Zona —';
    var bars = $('zone-bar').children;
    for (var i = 0; i < bars.length; i++) bars[i].className = (i + 1) <= z ? 'on' : '';

    var avg = hrN ? Math.round(hrSum / hrN) : null;
    $('m-avgmax').textContent = (avg || '--') + ' / ' + (hrMax || '--');
    $('m-kcal').textContent = Math.round(kcal);
    $('m-kcal-src').textContent = kcalFromHr ? 'kcal pela frequência' : 'kcal estimadas';
    drawChart();
  }

  function drawChart() {
    var c = $('chart'), ctx = c.getContext('2d');
    var W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    var m = maxHr(), lo = Math.round(m * 0.45), hi = m;
    function y(v) { return H - 6 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (H - 12); }
    // faixas de zona
    var cols = ['#8fa3b8', '#3fd0a0', '#f3d23b', '#ff8a2a', '#ff3d4f'];
    var edges = [0.45, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.07;
      ctx.fillRect(0, y(m * edges[i + 1]), W, y(m * edges[i]) - y(m * edges[i + 1]));
    }
    ctx.globalAlpha = 1;
    if (hrHistory.length < 2) {
      ctx.fillStyle = 'rgba(244,247,242,0.35)';
      ctx.font = '600 22px "Barlow Condensed", sans-serif';
      ctx.fillText(currentHr() ? 'Coletando…' : 'Sem dados de frequência', 12, H / 2 + 8);
      return;
    }
    var t1 = hrHistory[hrHistory.length - 1].t, t0 = Math.max(0, t1 - 600);
    function x(t) { return (t - t0) / Math.max(60, t1 - t0) * (W - 4) + 2; }
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var j = 1; j < hrHistory.length; j++) {
      var a = hrHistory[j - 1], b = hrHistory[j];
      ctx.strokeStyle = cols[zoneOf(b.hr) - 1];
      ctx.beginPath(); ctx.moveTo(x(a.t), y(a.hr)); ctx.lineTo(x(b.t), y(b.hr)); ctx.stroke();
    }
  }

  // ---------- Pulsoid (Apple Watch) ----------
  var ws = null, wsRetry = 0, wsTimer = null;
  function setHrStatus(cls, text) {
    $('hr-status').className = 'pill ' + cls;
    $('hr-status-text').textContent = text;
  }
  function connectPulsoid() {
    if (!cfg.pulsoidToken) { setHrStatus('off', 'Sem Apple Watch'); return; }
    if (ws) { try { ws.close(); } catch (e) {} }
    setHrStatus('wait', 'Conectando ao relógio…');
    ws = new WebSocket('wss://dev.pulsoid.net/api/v1/data/real_time?access_token=' + encodeURIComponent(cfg.pulsoidToken));
    ws.onopen = function () { wsRetry = 0; setHrStatus('wait', 'Aguardando batimentos…'); };
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        var v = msg && msg.data && msg.data.heart_rate;
        if (v) { hr = v; hrAt = Date.now(); setHrStatus('on', 'Apple Watch'); }
      } catch (e) {}
    };
    ws.onclose = function (ev) {
      if (ev.code === 4001 || ev.code === 4003 || ev.code === 1008) { setHrStatus('err', 'Token Pulsoid inválido'); return; }
      setHrStatus('err', 'Relógio desconectado');
      clearTimeout(wsTimer);
      wsTimer = setTimeout(connectPulsoid, Math.min(30000, 1000 * Math.pow(2, wsRetry++)));
    };
  }
  setInterval(function () {
    if (cfg.pulsoidToken && hr && Date.now() - hrAt > HR_STALE_MS && $('hr-status').className.indexOf('on') !== -1) {
      setHrStatus('wait', 'Sem sinal do relógio');
    }
  }, 3000);

  // ---------- YouTube ----------
  function showVideoInfo() {
    var v = videos[vIndex];
    if (!v) return;
    $('now-title').textContent = v.title;
    $('now-place').textContent = (v.place || '') + (v.length ? ' · ' + v.length : '');
  }
  function loadVideo(i) {
    if (!videos.length) return;
    vIndex = (i + videos.length) % videos.length;
    store('bike.vIndex', String(vIndex));
    showVideoInfo();
    if (playerReady) player.loadVideoById(videos[vIndex].id);
  }

  window.onYouTubeIframeAPIReady = function () {
    var boot = function () {
      if (!videos.length) { setTimeout(boot, 200); return; }
      var playerVars = {
        autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1, fs: 0,
        iv_load_policy: 3, disablekb: 1, modestbranding: 1,
      };
      // instalado na TV a página é file:// e não tem origin válido
      if (/^https?:/.test(location.origin)) playerVars.origin = location.origin;
      player = new YT.Player('player', {
        videoId: videos[vIndex].id,
        host: 'https://www.youtube.com',
        playerVars: playerVars,
        events: {
          onReady: function () {
            playerReady = true;
            var f = player.getIframe();
            f.setAttribute('tabindex', '-1');
            player.playVideo();
            if (mode === 'running' && !unmuted) { player.unMute(); player.setVolume(100); unmuted = true; }
          },
          onStateChange: function (e) {
            if (e.data === 0) loadVideo(vIndex + 1); // terminou
          },
          onError: function (e) {
            toast('Vídeo indisponível (erro ' + e.data + '), pulando…');
            setTimeout(function () { loadVideo(vIndex + 1); }, 1500);
          },
        },
      });
    };
    boot();
  };

  // mantém o foco na página (não no iframe), senão o controle para de responder
  window.addEventListener('blur', function () { setTimeout(function () { window.focus(); }, 50); });

  // ---------- menu ----------
  var menuItems = [], menuSel = 0;
  function buildMenu() {
    menuItems = [];
    if (mode === 'running') menuItems.push({ label: '⏸  Pausar treino', act: pause });
    else if (mode !== 'summary') menuItems.push({ label: mode === 'paused' ? '▶  Continuar treino' : '▶  Começar treino', act: start });
    if (mode === 'running' || mode === 'paused') menuItems.push({ label: '■  Finalizar treino', act: finish, cls: 'danger' });
    menuItems.push({ sep: true });
    videos.forEach(function (v, i) {
      menuItems.push({ label: v.title, meta: (v.place || '') + ' · ' + (v.length || ''), playing: i === vIndex, act: function () { loadVideo(i); } });
    });
    menuSel = 0;
    for (var i = 0; i < menuItems.length; i++) if (menuItems[i].playing) { menuSel = i; break; }
    renderMenu();
  }
  function renderMenu() {
    var list = $('menu-list');
    var visible = 11, start = Math.max(0, Math.min(menuSel - 5, menuItems.length - visible));
    var html = '';
    for (var i = start; i < Math.min(menuItems.length, start + visible); i++) {
      var it = menuItems[i];
      if (it.sep) { html += '<li class="sep"></li>'; continue; }
      var cls = [];
      if (i === menuSel) cls.push('sel');
      if (it.playing) cls.push('playing');
      if (it.cls) cls.push(it.cls);
      html += '<li class="' + cls.join(' ') + '"><span>' + (it.playing ? '♪  ' : '') + esc(it.label) + '</span>' +
        (it.meta ? '<span class="meta">' + esc(it.meta) + '</span>' : '') + '</li>';
    }
    list.innerHTML = html;
  }
  function moveMenu(d) {
    var n = menuItems.length, i = menuSel;
    do { i = (i + d + n) % n; } while (menuItems[i].sep);
    menuSel = i;
    renderMenu();
  }
  function menuOpen() { return $('menu').className.indexOf('show') !== -1; }
  function openMenu() { buildMenu(); $('menu').className = 'overlay show'; }
  function closeMenu() { $('menu').className = 'overlay'; }

  // ---------- controle remoto ----------
  var hudHidden = false;
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (menuOpen()) {
      if (is(k, 'UP')) moveMenu(-1);
      else if (is(k, 'DOWN')) moveMenu(1);
      else if (is(k, 'OK')) { var it = menuItems[menuSel]; closeMenu(); if (it && it.act) it.act(); }
      else if (is(k, 'BACK')) closeMenu();
      e.preventDefault();
      return;
    }
    if (mode === 'summary') {
      if (is(k, 'OK')) { $('summary').className = 'overlay'; reset(); start(); }
      else if (is(k, 'DOWN')) openMenu();
      e.preventDefault();
      return;
    }
    if (is(k, 'OK') || is(k, 'PLAYPAUSE')) { mode === 'running' ? pause() : start(); }
    else if (is(k, 'PLAY')) { if (mode !== 'running') start(); }
    else if (is(k, 'PAUSE')) { if (mode === 'running') pause(); }
    else if (is(k, 'RIGHT') || is(k, 'CH_UP')) { loadVideo(vIndex + 1); toast('▶ ' + videos[vIndex].title); }
    else if (is(k, 'LEFT') || is(k, 'CH_DOWN')) { loadVideo(vIndex - 1); toast('◀ ' + videos[vIndex].title); }
    else if (is(k, 'DOWN') || is(k, 'BACK')) openMenu();
    else if (is(k, 'UP')) {
      hudHidden = !hudHidden;
      $('hud').className = hudHidden ? 'hidden' : '';
      $('top').className = hudHidden ? 'hidden' : '';
    }
    else if (is(k, 'RED')) { if (mode === 'running' || mode === 'paused') finish(); }
    else if (is(k, 'GREEN')) { reset(); mode = 'idle'; document.body.className = ''; $('splash').className = 'overlay show'; }
    else return;
    e.preventDefault();
  });

  // ---------- boot ----------
  function applyConfig(c) {
    for (var k in c) if (c.hasOwnProperty(k)) cfg[k] = c[k];
    connectPulsoid();
  }
  function applyVideos(list) {
    videos = list || [];
    var saved = parseInt(store('bike.vIndex'), 10);
    vIndex = isNaN(saved) ? Math.floor(Math.random() * videos.length) : saved % videos.length;
    showVideoInfo();
  }
  function hashConfig() {
    var m = /[#&]cfg=([^&]*)/.exec(location.hash);
    var raw = m ? decodeURIComponent(m[1]) : store('bike.cfg');
    if (m) {
      store('bike.cfg', raw);
      // tira o token da barra de endereço
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }
    try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
  }
  if (HOSTED) {
    applyConfig(hashConfig());
    getJson('videos.json').then(applyVideos);
  } else {
    getJson('/api/config').then(applyConfig).catch(function () { setHrStatus('err', 'Sem config'); });
    getJson('/api/videos').then(applyVideos);
  }

  // ?demo simula batimentos para testar o painel sem relógio
  if (/[?&]demo\b/.test(location.search)) {
    setInterval(function () {
      hr = Math.round(118 + 32 * Math.sin(Date.now() / 40000) + Math.random() * 4);
      hrAt = Date.now();
      setHrStatus('on', 'Demo');
    }, 1000);
  }

  render();
  setInterval(tick, 1000);
})();
