(function () {
  'use strict';

  var SITE = 'https://mdimrankhanalpha.github.io/Omniletter/';
  var RAW_URL = 'https://raw.githubusercontent.com/mdimrankhanalpha/Omniletter/main/post.txt';
  var AVATAR = 'https://raw.githubusercontent.com/mdimrankhanalpha/Omniletter/main/file_0000000031dc81f5b9c4b218e22bc747.png';
  var BATCH = 15;
  var BASE = document.currentScript ? new URL('./', document.currentScript.src).href : location.href;
  var VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov)(\?|#|$)/i;

  var app = document.getElementById('app');

  /* ---------- helpers ---------- */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function empty(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function safeUrl(u) {
    if (!u) return null;
    try {
      var x = new URL(u, BASE);
      return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : null;
    } catch (e) { return null; }
  }
  function extLink(url, label) {
    var a = el('a', 'ext');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
  }
  function broken(msg, url) {
    var d = el('div', 'broken');
    d.setAttribute('role', 'status');
    d.appendChild(document.createTextNode(msg + ' '));
    if (url) {
      var a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = 'Open the link directly';
      d.appendChild(a);
    }
    return d;
  }
  function caption(fig, text) {
    if (!text) return;
    var c = el('figcaption');
    c.textContent = text;
    fig.appendChild(c);
  }

  /* ---------- routing ---------- */

  var params = new URLSearchParams(location.search);
  var postId = params.get('post');
  var wantsFeed = params.has('alpha72') ||
    /^#\/?alpha72\/?$/i.test(location.hash) ||
    /\/alpha72\/?$/i.test(location.pathname);

  if (postId !== null) showPost(postId.trim());
  else if (wantsFeed) showFeed();
  /* otherwise: blank page, nothing is rendered or fetched */

  /* ---------- loading and parsing post.txt ---------- */

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  }
  function loadText() {
    return fetchText(RAW_URL).catch(function () {
      return fetchText(new URL('post.txt', BASE).href);
    });
  }

  var START = /^\(-\s*post\s*-\)$/i;
  var END = /^\(-\s*end\s*-\)$/i;
  var TAG = /^\[(image|video|audio|file|link)\s*:\s*(.+?)\s*\]$/i;
  var HEAD = /^(id|date)\s*:\s*(.*)$/i;

  function parseMedia(kind, body) {
    var parts = body.split('|').map(function (s) { return s.trim(); });
    var b = { type: kind.toLowerCase(), url: parts.shift(), text: [] };
    parts.forEach(function (p) {
      var m = /^(full|poster)\s*=\s*(.+)$/i.exec(p);
      if (m) b[m[1].toLowerCase()] = m[2].trim();
      else b.text.push(p);
    });
    return b;
  }

  function parse(raw) {
    var lines = raw.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    var posts = [], seen = {}, cur = null, para = [], inHead = false, skipped = 0;

    function flush() {
      if (cur && para.length) cur.blocks.push({ type: 'text', text: para.join('\n') });
      para = [];
    }
    function close() {
      flush();
      if (cur) {
        var key = cur.id.toLowerCase();
        if (key && seen[key]) skipped++;
        else { if (key) seen[key] = true; posts.push(cur); }
      }
      cur = null;
    }

    lines.forEach(function (line) {
      var t = line.trim();
      if (START.test(t)) { close(); cur = { id: '', date: '', blocks: [] }; inHead = true; return; }
      if (!cur) return;
      if (END.test(t)) { close(); return; }
      if (inHead) {
        var h = HEAD.exec(t);
        if (h) { cur[h[1].toLowerCase()] = h[2].trim(); return; }
        if (t === '') return;
        inHead = false;
      }
      if (t === '') { flush(); return; }
      var m = TAG.exec(t);
      if (m) { flush(); cur.blocks.push(parseMedia(m[1], m[2])); return; }
      para.push(line.replace(/\s+$/, ''));
    });
    close();
    if (skipped) console.warn('Omniletter: ' + skipped + ' post(s) ignored because their id repeats an earlier id.');
    return posts;
  }

  /* ---------- copy permanent link ---------- */

  function legacyCopy(text) {
    var a = document.createElement('textarea');
    a.value = text;
    a.setAttribute('readonly', '');
    a.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(a);
    a.select();
    a.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(a);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
        function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function permalink(id) { return SITE + '?post=' + encodeURIComponent(id); }

  function copyControl(id) {
    var wrap = el('div', 'post-foot');
    var btn = el('button', 'btn');
    btn.type = 'button';
    btn.textContent = 'Copy Permanent Link';
    var status = el('span', 'copy-status');
    status.setAttribute('role', 'status');
    btn.addEventListener('click', function () {
      var url = permalink(id);
      status.textContent = '';
      copyText(url).then(function (ok) {
        if (ok) status.textContent = 'Link copied.';
        else window.prompt('Copy this link:', url);
      });
    });
    wrap.appendChild(btn);
    wrap.appendChild(status);
    return wrap;
  }

  /* ---------- blocks ---------- */

  function textBlock(t) {
    var p = el('p', 'text');
    var re = /https?:\/\/[^\s<>"]+/g, last = 0, m;
    while ((m = re.exec(t))) {
      var u = m[0].replace(/[.,;:!?)\]]+$/, '');
      if (m.index > last) p.appendChild(document.createTextNode(t.slice(last, m.index)));
      var a = document.createElement('a');
      a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = u;
      p.appendChild(a);
      last = m.index + u.length;
      re.lastIndex = last;
    }
    if (last < t.length) p.appendChild(document.createTextNode(t.slice(last)));
    return p;
  }

  function imageBlock(b) {
    var fig = el('figure', 'media');
    var src = safeUrl(b.url);
    if (!src) { fig.appendChild(broken('This image link is not valid.')); return fig; }
    var full = safeUrl(b.full) || src;
    var alt = b.text[0] || '';
    var btn = el('button', 'img-open');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View image full screen' + (alt ? ': ' + alt : ''));
    var img = new Image();
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = alt;
    img.addEventListener('error', function () {
      empty(fig);
      fig.appendChild(broken('This image could not be loaded.', src));
      caption(fig, b.text[1]);
    });
    img.src = src;
    btn.appendChild(img);
    btn.addEventListener('click', function () { openViewer(img.currentSrc || src, full, alt, btn); });
    fig.appendChild(btn);
    caption(fig, b.text[1]);
    return fig;
  }

  function youtube(u) {
    var x, id = null, short = false, m;
    try { x = new URL(u); } catch (e) { return null; }
    var h = x.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be') {
      id = x.pathname.slice(1).split('/')[0];
    } else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if ((m = /^\/shorts\/([\w-]+)/.exec(x.pathname))) { id = m[1]; short = true; }
      else if ((m = /^\/(?:embed|live|v)\/([\w-]+)/.exec(x.pathname))) id = m[1];
      else if (x.pathname === '/watch') id = x.searchParams.get('v');
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    var embed = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&autoplay=1';
    var t = x.searchParams.get('t') || x.searchParams.get('start');
    if (t && /^\d+s?$/.test(t)) embed += '&start=' + parseInt(t, 10);
    return {
      short: short,
      embed: embed,
      watch: short ? 'https://www.youtube.com/shorts/' + id : 'https://www.youtube.com/watch?v=' + id
    };
  }

  function videoBlock(b) {
    var fig = el('figure', 'media');
    var url = safeUrl(b.url);
    var cap = b.text[0] || '';
    if (!url) { fig.appendChild(broken('This video link is not valid.')); return fig; }

    var yt = youtube(url);
    if (yt) {
      if (yt.short) fig.className += ' short';
      var wrap = el('div', 'yt-wrap');
      var box = el('div', 'yt');
      var play = el('button', 'btn');
      play.type = 'button';
      play.textContent = yt.short ? 'Play YouTube Short' : 'Play YouTube video';
      play.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.src = yt.embed;
        f.title = cap || 'YouTube video';
        f.allow = 'fullscreen; picture-in-picture; encrypted-media';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        empty(box);
        box.appendChild(f);
      });
      box.appendChild(play);
      wrap.appendChild(box);
      fig.appendChild(wrap);
      fig.appendChild(extLink(yt.watch, 'Open on YouTube'));
    } else if (VIDEO_EXT.test(url)) {
      var v = document.createElement('video');
      v.controls = true;
      v.preload = 'none';
      v.setAttribute('playsinline', '');
      var poster = safeUrl(b.poster);
      if (poster) v.poster = poster;
      v.addEventListener('error', function () {
        empty(fig);
        fig.appendChild(broken('This video could not be played.', url));
        caption(fig, cap);
      });
      v.src = url;
      fig.appendChild(v);
    } else {
      fig.appendChild(extLink(url, 'Watch video' + (cap ? ': ' + cap : '')));
      return fig;
    }
    caption(fig, cap);
    return fig;
  }

  function audioBlock(b) {
    var fig = el('figure', 'media');
    var url = safeUrl(b.url);
    if (!url) { fig.appendChild(broken('This audio link is not valid.')); return fig; }
    var a = document.createElement('audio');
    a.controls = true;
    a.preload = 'none';
    a.addEventListener('error', function () {
      empty(fig);
      fig.appendChild(broken('This audio could not be played.', url));
      caption(fig, b.text[0]);
    });
    a.src = url;
    fig.appendChild(a);
    caption(fig, b.text[0]);
    return fig;
  }

  function fileBlock(b) {
    var p = el('p', 'file');
    var url = safeUrl(b.url);
    if (!url) { p.appendChild(broken('This file link is not valid.')); return p; }
    var a = document.createElement('a');
    a.href = url; a.download = ''; a.rel = 'noopener noreferrer';
    a.textContent = 'Download: ' + (b.text[0] || decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || url));
    p.appendChild(a);
    return p;
  }

  function linkBlock(b) {
    var p = el('p', 'file');
    var url = safeUrl(b.url);
    if (!url) { p.appendChild(broken('This link is not valid.')); return p; }
    p.appendChild(extLink(url, b.text[0] || url));
    return p;
  }

  function postEl(p) {
    var a = el('article', 'post');
    if (p.id) a.id = p.id;
    if (p.date) {
      var d = el('p', 'date');
      d.textContent = p.date;
      a.appendChild(d);
    }
    p.blocks.forEach(function (b) {
      var node;
      if (b.type === 'text') node = textBlock(b.text);
      else if (b.type === 'image') node = imageBlock(b);
      else if (b.type === 'video') node = videoBlock(b);
      else if (b.type === 'audio') node = audioBlock(b);
      else if (b.type === 'file') node = fileBlock(b);
      else node = linkBlock(b);
      a.appendChild(node);
    });
    if (p.id) a.appendChild(copyControl(p.id));
    else {
      var n = el('p', 'copy-status');
      n.textContent = 'This letter has no id: line, so it has no permanent link.';
      a.appendChild(n);
    }
    return a;
  }

  function divider() {
    var d = el('div', 'divider');
    d.setAttribute('role', 'separator');
    var s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '(- -)';
    d.appendChild(s);
    return d;
  }

  function note(msg) {
    var p = el('p', 'note');
    p.setAttribute('role', 'status');
    p.textContent = msg;
    return p;
  }

  /* ---------- pages ---------- */

  function showFeed() {
    document.body.className = 'letters';
    document.title = 'Omniletter';

    var mast = el('header', 'mast');
    var av = new Image();
    av.alt = 'Omniletter, the postman';
    av.addEventListener('error', function () { av.hidden = true; });
    av.src = AVATAR;
    var h1 = el('h1');
    h1.textContent = 'Omniletter';
    mast.appendChild(av);
    mast.appendChild(h1);
    app.appendChild(mast);

    var list = el('div', 'feed');
    var wait = note('Delivering letters\u2026');
    app.appendChild(wait);
    app.appendChild(list);

    loadText().then(parse).then(function (posts) {
      app.removeChild(wait);
      if (!posts.length) { app.appendChild(note('No letters have been delivered yet.')); return; }
      var order = posts.slice().reverse(); /* file is oldest-first; feed is newest-first */
      var shown = 0;
      var moreWrap = el('div', 'more-wrap');
      var more = el('button', 'btn');
      more.type = 'button';
      more.textContent = 'Show older letters';
      moreWrap.appendChild(more);

      function renderMore() {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < BATCH && shown < order.length; i++, shown++) {
          if (shown > 0) frag.appendChild(divider());
          frag.appendChild(postEl(order[shown]));
        }
        list.appendChild(frag);
        moreWrap.hidden = shown >= order.length;
      }
      more.addEventListener('click', renderMore);
      app.appendChild(moreWrap);
      renderMore();
    }).catch(function () {
      if (wait.parentNode) app.removeChild(wait);
      app.appendChild(note('The letters could not be loaded. Check your connection and try again.'));
    });
  }

  function showPost(id) {
    document.body.className = 'letters';
    document.title = 'Omniletter';
    var wait = note('Delivering letter\u2026');
    app.appendChild(wait);
    loadText().then(parse).then(function (posts) {
      app.removeChild(wait);
      var key = id.toLowerCase();
      var found = null;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id && posts[i].id.toLowerCase() === key) { found = posts[i]; break; }
      }
      if (found) app.appendChild(postEl(found));
      else app.appendChild(note('This letter could not be found.'));
    }).catch(function () {
      if (wait.parentNode) app.removeChild(wait);
      app.appendChild(note('The letter could not be loaded. Check your connection and try again.'));
    });
  }

  /* ---------- image viewer ---------- */

  var vw = null; /* viewer parts, built on first use */
  var sc = 1, tx = 0, ty = 0, token = 0;

  function buildViewer() {
    var root = el('div', 'viewer');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Image viewer');
    root.hidden = true;

    var stage = el('div', 'v-stage');
    var img = document.createElement('img');
    img.draggable = false;
    stage.appendChild(img);

    var bar = el('div', 'v-bar');
    function button(label, aria, fn) {
      var b = el('button', 'btn');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }
    button('\u2212', 'Zoom out', function () { zoomBy(1 / 1.5); });
    button('+', 'Zoom in', function () { zoomBy(1.5); });
    button('Reset', 'Restore normal view', function () { resetView(); });
    var fsBtn = null;
    if (document.fullscreenEnabled && root.requestFullscreen) {
      fsBtn = button('Fullscreen', 'Toggle fullscreen', function () {
        var p = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      });
    }
    var closeBtn = button('Close', 'Close image viewer', function () { closeViewer(false); });

    root.appendChild(stage);
    root.appendChild(bar);
    document.body.appendChild(root);

    vw = { root: root, stage: stage, img: img, closeBtn: closeBtn, buttons: bar.querySelectorAll('button'),
           full: null, fullLoaded: false, opener: null };

    /* pointer handling: drag to pan, pinch to zoom, double-tap to toggle */
    var ptrs = {}, count = 0, pinch = null, multi = false, lastTap = 0, lastX = 0, lastY = 0;

    function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
    function rel(x, y) {
      var r = stage.getBoundingClientRect();
      return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
    }

    stage.addEventListener('pointerdown', function (e) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      count++;
      if (count >= 2) {
        multi = true;
        var q = pts();
        pinch = { d: Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y) || 1, s: sc };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId];
      if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > 8) p.moved = true;
      if (pinch && count >= 2) {
        var q = pts();
        var d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
        var c = rel((q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2);
        zoomAt(pinch.s * d / pinch.d, c.x, c.y);
      } else if (count === 1 && sc > 1) {
        tx += dx; ty += dy;
        clampPan(); applyView();
      }
    });
    function endPointer(e) {
      var p = ptrs[e.pointerId];
      if (!p) return;
      delete ptrs[e.pointerId];
      count = Math.max(0, count - 1);
      if (count < 2) pinch = null;
      if (e.type === 'pointerup' && !p.moved && !multi) {
        var now = Date.now();
        if (now - lastTap < 320 && Math.abs(e.clientX - lastX) < 30 && Math.abs(e.clientY - lastY) < 30) {
          var c = rel(e.clientX, e.clientY);
          if (sc > 1) resetView(); else zoomAt(2.5, c.x, c.y);
          lastTap = 0;
        } else {
          lastTap = now; lastX = e.clientX; lastY = e.clientY;
        }
      }
      if (count === 0) multi = false;
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var c = rel(e.clientX, e.clientY);
      zoomAt(sc * (e.deltaY < 0 ? 1.15 : 1 / 1.15), c.x, c.y);
    }, { passive: false });

    root.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') { closeViewer(false); e.preventDefault(); }
      else if (k === '+' || k === '=') zoomBy(1.5);
      else if (k === '-' || k === '_') zoomBy(1 / 1.5);
      else if (k === '0') resetView();
      else if (sc > 1 && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) {
        if (k === 'ArrowLeft') tx += 60;
        if (k === 'ArrowRight') tx -= 60;
        if (k === 'ArrowUp') ty += 60;
        if (k === 'ArrowDown') ty -= 60;
        clampPan(); applyView(); e.preventDefault();
      } else if (k === 'Tab') {
        var b = vw.buttons, first = b[0], last = b[b.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    });
  }

  function applyView() {
    vw.img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
  }
  function clampPan() {
    var mx = Math.max(0, (vw.img.clientWidth * sc - vw.stage.clientWidth) / 2);
    var my = Math.max(0, (vw.img.clientHeight * sc - vw.stage.clientHeight) / 2);
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  }
  function resetView() { sc = 1; tx = 0; ty = 0; applyView(); }
  function zoomAt(ns, px, py) {
    ns = Math.min(8, Math.max(1, ns));
    if (ns > 1) loadFull();
    var ratio = ns / sc;
    tx = px - (px - tx) * ratio;
    ty = py - (py - ty) * ratio;
    sc = ns;
    if (sc < 1.001) { sc = 1; tx = 0; ty = 0; }
    clampPan(); applyView();
  }
  function zoomBy(f) { zoomAt(sc * f, 0, 0); }

  /* the high-resolution file is requested only when the visitor first zooms in */
  function loadFull() {
    if (!vw.full || vw.fullLoaded) return;
    vw.fullLoaded = true;
    var mine = token, src = vw.full, big = new Image();
    big.onload = function () { if (mine === token) vw.img.src = src; };
    big.src = src;
  }

  function openViewer(preview, full, alt, opener) {
    if (!vw) buildViewer();
    token++;
    sc = 1; tx = 0; ty = 0; applyView();
    vw.full = full !== preview ? full : null;
    vw.fullLoaded = false;
    vw.opener = opener;
    vw.img.alt = alt || '';
    vw.img.src = preview;
    vw.root.hidden = false;
    document.documentElement.classList.add('noscroll');
    history.pushState({ omniViewer: 1 }, '');
    vw.closeBtn.focus();
  }

  function closeViewer(fromPop) {
    if (!vw || vw.root.hidden) return;
    vw.root.hidden = true;
    token++;
    vw.img.removeAttribute('src');
    document.documentElement.classList.remove('noscroll');
    if (document.fullscreenElement && document.exitFullscreen) {
      var p = document.exitFullscreen();
      if (p && p.catch) p.catch(function () {});
    }
    if (!fromPop && history.state && history.state.omniViewer) history.back();
    if (vw.opener && document.contains(vw.opener)) vw.opener.focus();
  }

  window.addEventListener('popstate', function () { closeViewer(true); });
})();
