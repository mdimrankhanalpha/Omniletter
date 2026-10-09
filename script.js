/*
  OMNILETTER
  Two experiences only:
    1. Profile page (normal URL). Searching the secret phrase reveals the feed on the same page.
    2. A single standalone letter at  ?post=ID
  Content comes from post.txt: posts are separated by a line containing only "-".
  The top post in the file is the newest. IDs are automatic: photo file name, or serial number.

  NOTE: the search phrase is a discreet interface feature, NOT security.
  Anyone can read this public file. Random IDs make links hard to guess,
  they do not make public content private.
*/
(function () {
  'use strict';

  var PHOTO = 'https://github.com/mdimrankhanalpha/Omniletter/blob/main/file_0000000031dc81f5b9c4b218e22bc747.png';
  var POST_RAW = 'https://raw.githubusercontent.com/mdimrankhanalpha/Omniletter/main/post.txt';
  var POST_LOCAL = 'post.txt';
  // SHA-256 of the phrase, so it is not sitting in plain text (obscurity only, not protection)
  var PHRASE_HASH = 'e3f333a84b62e21100e3b3060450ae1bdd274997cf120ebb8999e6462b0c7694';

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* ---------- URLs ---------- */

  // Ordinary github.com/.../blob/... file links become raw file links. Everything else is untouched.
  function rawUrl(u) {
    var m = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/([^?#]+)(?:[?#].*)?$/i.exec(u);
    return m ? 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3] + '/' + m[4] : u;
  }

  function cleanUrl(u) {
    u = (u || '').trim();
    if (!u || /^(javascript|data|vbscript):/i.test(u)) return '';
    return rawUrl(u);
  }

  function permalink(id) {
    return location.href.split(/[?#]/)[0] + '?post=' + encodeURIComponent(id);
  }

  /* ---------- Loading and parsing post.txt ---------- */

  var cache = null;

  function fetchText() {
    return fetch(POST_RAW, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('raw'); return r.text(); })
      .catch(function () {
        return fetch(POST_LOCAL, { cache: 'no-cache' })
          .then(function (r) { if (!r.ok) throw new Error('local'); return r.text(); });
      });
  }

  // The whole file must be downloaded and parsed to find one post (one text file = one request).
  function loadPosts() {
    if (!cache) {
      cache = fetchText().then(parsePosts).catch(function (e) { cache = null; throw e; });
    }
    return cache;
  }

  // A post boundary is a line that is ONLY a hyphen. (The older "(- Post -)" line is still accepted.)
  var DIVIDER = /^(?:-|\s*\(-\s*Post\s*-\))[ \t]*$/i;
  var KEY = /^\s*(ID|TITLE|DATE|TEXT|IMAGE|VIDEO|AUDIO|FILE|THUMB|CAPTION)\s*:\s?(.*)$/i;
  var MEDIA = { IMAGE: 'image', VIDEO: 'video', AUDIO: 'audio', FILE: 'file' };

  function parsePosts(text) {
    var lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    var posts = [], cur = [];

    function endPost() {
      var c = cur;
      cur = [];
      if (!c.join('').trim()) return;              // empty chunk (e.g. repeated dividers): no fake post
      posts.push(parsePost(c));
    }

    lines.forEach(function (line) {
      if (DIVIDER.test(line)) endPost();           // whole-line match only
      else cur.push(line);
    });
    endPost();                                     // last post needs no trailing divider
    assignIds(posts);
    return posts;                                  // file order: top of the file = newest = shown first
  }

  function parsePost(lines) {
    var post = { id: '', title: '', date: '', blocks: [] };
    var text = null;

    function flush() {
      if (text) {
        var s = text.join('\n').trim();
        if (s) post.blocks.push({ type: 'text', text: s });
        text = null;
      }
    }

    lines.forEach(function (line) {
      var m = KEY.exec(line);
      if (m) {
        var k = m[1].toUpperCase(), v = m[2].trim();
        if (k === 'ID') { post.id = v; return; }
        if (k === 'TITLE') { post.title = v; return; }
        if (k === 'DATE') { post.date = v; return; }
        if (k === 'TEXT') { flush(); text = [m[2]]; return; }
        if (MEDIA[k]) { flush(); post.blocks.push({ type: MEDIA[k], url: v }); return; }
        // THUMB / CAPTION belong to the media line just above them
        var b = post.blocks[post.blocks.length - 1];
        if (!text && b && b.type !== 'text') {
          if (k === 'CAPTION' && !b.caption) { b.caption = v; return; }
          if (k === 'THUMB' && (b.type === 'image' || b.type === 'video') && !b.thumb) { b.thumb = v; return; }
        }
        // otherwise fall through: keep the line as text rather than dropping it
      }
      if (!text) {
        if (!line.trim()) return;
        text = [];
      }
      text.push(line);
    });
    flush();
    return post;
  }

  /* ---------- Rendering ---------- */

  function linkify(parent, str) {
    var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
    while ((m = re.exec(str))) {
      var url = m[0].replace(/[.,;:!?)\]]+$/, '');
      parent.appendChild(document.createTextNode(str.slice(last, m.index)));
      var a = el('a', '', url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      parent.appendChild(a);
      last = m.index + url.length;
      re.lastIndex = last;
    }
    parent.appendChild(document.createTextNode(str.slice(last)));
  }

  function withCaption(node, caption) {
    if (!caption) return node;
    var f = el('figure');
    f.appendChild(node);
    f.appendChild(el('figcaption', '', caption));
    return f;
  }

  function renderBlock(b) {
    if (b.type === 'text') {
      var frag = document.createDocumentFragment();
      b.text.split(/\n\s*\n/).forEach(function (para) {
        var p = el('p');
        linkify(p, para.trim());
        frag.appendChild(p);
      });
      return frag;
    }
    var box = el('div', 'media ' + b.type);
    if (b.type === 'image') box.appendChild(renderImage(b));
    else if (b.type === 'video') box.appendChild(renderVideo(b));
    else if (b.type === 'audio') box.appendChild(renderAudio(b));
    else box.appendChild(renderFile(b));
    return box;
  }

  function renderImage(b) {
    var full = cleanUrl(b.url);
    if (!full) return el('div', 'note', 'Image unavailable');
    var thumb = cleanUrl(b.thumb) || full;
    var wrap = el('div');
    var btn = el('button', 'imgbtn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View image full size');
    var img = new Image();
    img.alt = b.caption || 'Image';
    img.loading = 'lazy';
    img.decoding = 'async';
    var triedFull = thumb === full;
    img.onerror = function () {
      if (!triedFull) { triedFull = true; img.src = full; return; }
      var n = el('div', 'note');
      n.appendChild(document.createTextNode('Image unavailable. '));
      var a = el('a', '', 'Open link');
      a.href = full; a.target = '_blank'; a.rel = 'noopener noreferrer';
      n.appendChild(a);
      wrap.replaceChild(n, btn);
    };
    img.src = thumb;
    btn.appendChild(img);
    btn.onclick = function () { openViewer(full, thumb, b.caption); };
    wrap.appendChild(btn);
    return withCaption(wrap, b.caption);
  }

  function secs(t) {
    if (/^\d+$/.test(t)) return +t;
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
    return m ? (m[1] | 0) * 3600 + (m[2] | 0) * 60 + (m[3] | 0) : 0;
  }

  function ytInfo(u) {
    try {
      var x = new URL(u), h = x.hostname.replace(/^(www|m|music)\./, ''), id = null, short = false;
      var p = x.pathname.split('/').filter(Boolean);
      if (h === 'youtu.be') id = p[0];
      else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
        if (p[0] === 'shorts') { id = p[1]; short = true; }
        else if (p[0] === 'embed' || p[0] === 'live' || p[0] === 'v') id = p[1];
        else if (p[0] === 'watch') id = x.searchParams.get('v');
      }
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { id: id, short: short, start: secs(x.searchParams.get('t') || x.searchParams.get('start') || '') };
    } catch (e) { return null; }
  }

  function renderVideo(b) {
    var url = cleanUrl(b.url);
    if (!url) return el('div', 'note', 'Video unavailable');
    var wrap = el('div');
    var yt = ytInfo(url);
    var linkText = 'Open video in new tab';

    if (yt) {
      linkText = 'Open on YouTube';
      var frame = el('div', 'yt' + (yt.short ? ' short' : ''));
      var play = el('button', 'yt-play', 'Play video');
      play.type = 'button';
      play.onclick = function () {
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + yt.id + '?autoplay=1&rel=0&playsinline=1' + (yt.start ? '&start=' + yt.start : '');
        f.title = b.caption || 'Video';
        f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        f.setAttribute('allowfullscreen', '');
        f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        frame.replaceChild(f, play);
      };
      frame.appendChild(play);
      wrap.appendChild(frame);
    } else {
      var v = document.createElement('video');
      v.controls = true;
      v.preload = 'none';
      v.setAttribute('playsinline', '');
      if (b.thumb) v.poster = cleanUrl(b.thumb);
      v.src = url;
      v.addEventListener('loadedmetadata', function () {
        if (v.videoWidth && v.videoHeight) v.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
      });
      v.addEventListener('error', function () {
        if (!wrap.querySelector('.note')) wrap.appendChild(el('div', 'note', 'This video could not be played here.'));
      });
      wrap.appendChild(v);
    }

    var p = el('p', 'medialink');
    var a = el('a', '', linkText);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    p.appendChild(a);
    wrap.appendChild(p);
    return withCaption(wrap, b.caption);
  }

  function renderAudio(b) {
    var url = cleanUrl(b.url);
    if (!url) return el('div', 'note', 'Audio unavailable');
    var wrap = el('div');
    var a = document.createElement('audio');
    a.controls = true;
    a.preload = 'none';
    a.src = url;
    a.addEventListener('error', function () {
      if (wrap.querySelector('.note')) return;
      var n = el('div', 'note');
      n.appendChild(document.createTextNode('Audio could not be played here. '));
      var l = el('a', '', 'Open link');
      l.href = url; l.target = '_blank'; l.rel = 'noopener noreferrer';
      n.appendChild(l);
      wrap.appendChild(n);
    });
    wrap.appendChild(a);
    return withCaption(wrap, b.caption);
  }

  function renderFile(b) {
    var url = cleanUrl(b.url);
    if (!url) return el('div', 'note', 'File unavailable');
    var name = url.split(/[?#]/)[0].split('/').pop();
    try { name = decodeURIComponent(name); } catch (e) { /* keep raw name */ }
    var a = el('a', 'filelink', 'Download: ' + (b.caption || name || 'file'));
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('download', '');
    return a;
  }

  /* ---------- Copy permanent link ---------- */

  function legacyCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, t.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return legacyCopy(t); });
    }
    return Promise.resolve(legacyCopy(t));
  }

  function copyButton(id) {
    var wrap = el('div', 'post-foot');
    var btn = el('button', 'copy', 'Copy Permanent Link');
    btn.type = 'button';
    var status = el('span', 'copied');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var timer;
    btn.onclick = function () {
      var link = permalink(id);
      copyText(link).then(function (ok) {
        if (!ok) { window.prompt('Copy this link:', link); return; }
        status.textContent = 'Link copied';
        clearTimeout(timer);
        timer = setTimeout(function () { status.textContent = ''; }, 2500);
      });
    };
    wrap.appendChild(btn);
    wrap.appendChild(status);
    // Full ID printed in full (selectable) so it can always be copied by hand
    wrap.appendChild(el('p', 'pid', id));
    return wrap;
  }

  function renderPost(post, isLetter) {
    var art = el('div', 'post');
    if (post.title) art.appendChild(el(isLetter ? 'h1' : 'h2', 'post-title', post.title));
    if (post.date) art.appendChild(el('p', 'post-date', post.date));
    post.blocks.forEach(function (b) { art.appendChild(renderBlock(b)); });
    if (!isLetter) {
      art.appendChild(copyButton(post.id));
    }
    return art;
  }

  /* ---------- Image viewer (zoom, pan, fullscreen) ---------- */

  var viewer = null;

  function openViewer(full, thumb, caption) {
    if (!viewer) viewer = buildViewer();
    viewer.show(full, thumb, caption);
  }

  function buildViewer() {
    var root = el('div', 'viewer');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Image viewer');
    root.innerHTML =
      '<div class="v-bar">' +
      '<button type="button" data-act="out" aria-label="Zoom out">\u2212</button>' +
      '<button type="button" data-act="in" aria-label="Zoom in">+</button>' +
      '<button type="button" data-act="reset">Reset</button>' +
      '<button type="button" data-act="full">Fullscreen</button>' +
      '<button type="button" data-act="close">Close</button>' +
      '</div>' +
      '<div class="v-stage"><img alt="" draggable="false"><p class="v-msg" hidden>Image unavailable</p></div>' +
      '<p class="v-cap" hidden></p>';
    document.body.appendChild(root);

    var stage = root.querySelector('.v-stage');
    var img = stage.querySelector('img');
    var msg = root.querySelector('.v-msg');
    var cap = root.querySelector('.v-cap');
    var fsBtn = root.querySelector('[data-act="full"]');
    var closeBtn = root.querySelector('[data-act="close"]');

    var MAX = 8;
    var s = 1, x = 0, y = 0, token = 0, lastFocus = null, prevOverflow = '';
    var pts = {}, count = 0, moved = false, startX = 0, startY = 0, lastTap = 0, tapX = 0, tapY = 0;

    var reqFs = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!reqFs) fsBtn.hidden = true;
    function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }

    function clamp() {
      var nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
      var f = Math.min(stage.clientWidth / nw, stage.clientHeight / nh);
      var mx = Math.max(0, (nw * f * s - stage.clientWidth) / 2);
      var my = Math.max(0, (nh * f * s - stage.clientHeight) / 2);
      x = Math.min(mx, Math.max(-mx, x));
      y = Math.min(my, Math.max(-my, y));
    }
    function apply() {
      clamp();
      img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
      stage.classList.toggle('zoomed', s > 1);
    }
    // cx, cy are relative to the stage centre
    function zoomAt(ns, cx, cy) {
      ns = Math.min(MAX, Math.max(1, ns));
      var k = ns / s;
      x = cx - (cx - x) * k;
      y = cy - (cy - y) * k;
      s = ns;
      if (s === 1) { x = 0; y = 0; }
      apply();
    }
    function rel(px, py) {
      var r = stage.getBoundingClientRect();
      return { x: px - r.left - r.width / 2, y: py - r.top - r.height / 2 };
    }
    function reset() { s = 1; x = 0; y = 0; apply(); }
    function hyp(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }
    function ptList() { return Object.keys(pts).map(function (k) { return pts[k]; }); }

    stage.addEventListener('pointerdown', function (e) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      count = Object.keys(pts).length;
      if (count === 1) { moved = false; startX = e.clientX; startY = e.clientY; }
      else moved = true;
    });

    stage.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId];
      if (!p) return;
      if (count === 2) {
        var a = ptList();
        var d0 = hyp(a[0], a[1]), mx0 = (a[0].x + a[1].x) / 2, my0 = (a[0].y + a[1].y) / 2;
        p.x = e.clientX; p.y = e.clientY;
        var b = ptList();
        var d1 = hyp(b[0], b[1]), mx1 = (b[0].x + b[1].x) / 2, my1 = (b[0].y + b[1].y) / 2;
        x += mx1 - mx0; y += my1 - my0;
        var c = rel(mx1, my1);
        zoomAt(d0 ? s * d1 / d0 : s, c.x, c.y);
        return;
      }
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 8) moved = true;
      if (s > 1) {
        x += e.clientX - p.x; y += e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        apply();
      } else { p.x = e.clientX; p.y = e.clientY; }
    });

    function up(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      count = Object.keys(pts).length;
      if (e.type === 'pointerup' && count === 0 && !moved) {
        var now = Date.now();
        if (now - lastTap < 320 && Math.abs(e.clientX - tapX) + Math.abs(e.clientY - tapY) < 40) {
          var c = rel(e.clientX, e.clientY);
          zoomAt(s > 1 ? 1 : 2.5, c.x, c.y);   // double-tap / double-click
          lastTap = 0;
        } else { lastTap = now; tapX = e.clientX; tapY = e.clientY; }
      }
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var c = rel(e.clientX, e.clientY);
      zoomAt(s * Math.exp(-e.deltaY * 0.0015), c.x, c.y);
    }, { passive: false });

    root.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'in') zoomAt(s * 1.5, 0, 0);
      else if (act === 'out') zoomAt(s / 1.5, 0, 0);
      else if (act === 'reset') reset();
      else if (act === 'close') close();
      else if (act === 'full') {
        if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { var pr = reqFs.call(root); if (pr && pr.catch) pr.catch(function () {}); }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (root.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomAt(s * 1.5, 0, 0);
      else if (e.key === '-') zoomAt(s / 1.5, 0, 0);
      else if (e.key === '0') reset();
    });
    window.addEventListener('resize', function () { if (!root.hidden) apply(); });
    document.addEventListener('fullscreenchange', function () { if (!root.hidden) apply(); });

    img.onerror = function () { img.hidden = true; msg.hidden = false; };

    function close() {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      root.hidden = true;
      token++;
      img.removeAttribute('src');
      document.body.style.overflow = prevOverflow;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    return {
      show: function (full, thumb, caption) {
        lastFocus = document.activeElement;
        prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        pts = {}; count = 0; lastTap = 0;
        s = 1; x = 0; y = 0;
        img.style.transform = '';
        img.hidden = false; msg.hidden = true;
        img.alt = caption || 'Image';
        cap.textContent = caption || '';
        cap.hidden = !caption;
        root.hidden = false;
        var my = ++token;
        if (thumb && thumb !== full) {
          // show the small one at once, swap in the full-size one when it has loaded
          img.src = thumb;
          var hi = new Image();
          hi.onload = function () { if (my === token) { img.src = full; } };
          hi.src = full;
        } else {
          img.src = full;
        }
        closeBtn.focus();
      }
    };
  }

  /* ---------- Page one: profile and discreet search ---------- */

  function sha256(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function profileMode() {
    var photo = $('photo');
    photo.onerror = function () { photo.parentNode.hidden = true; };
    photo.src = rawUrl(PHOTO);

    var form = $('search'), input = $('q'), msg = $('smsg'), feed = $('feed');
    var revealed = false;

    input.addEventListener('input', function () { msg.textContent = ''; });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      if (!(window.crypto && crypto.subtle)) { msg.textContent = 'Search is unavailable right now.'; return; }
      sha256(v).then(function (h) {
        if (h === PHRASE_HASH) { reveal(); }
        else { msg.textContent = 'No results for \u201C' + v + '\u201D.'; }
      });
    });

    function reveal() {
      if (revealed) { input.value = ''; return; }
      revealed = true;
      input.value = '';
      input.blur();
      msg.textContent = '';
      document.body.classList.add('revealed');
      feed.hidden = false;
      feed.appendChild(el('p', 'error', 'Delivering letters\u2026'));
      loadPosts().then(function (posts) {
        feed.textContent = '';
        if (!posts.length) { feed.appendChild(el('p', 'error', 'No letters have been delivered yet.')); return; }
        var frag = document.createDocumentFragment();
        posts.forEach(function (p) { frag.appendChild(renderPost(p, false)); });
        feed.appendChild(frag);
        feed.scrollIntoView();
      }).catch(function () {
        feed.textContent = '';
        feed.appendChild(el('p', 'error', 'The letters could not be loaded. Please try again.'));
        revealed = false;
      });
    }
  }

  /* ---------- Page two: one standalone letter ---------- */

  function postMode(id) {
    $('profile').hidden = true;
    var box = $('letter');
    box.hidden = false;
    box.appendChild(el('p', 'error', 'Opening letter\u2026'));
    var want = id.toLowerCase();

    loadPosts().then(function (posts) {
      var found = null;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id && posts[i].id.toLowerCase() === want) { found = posts[i]; break; }
      }
      box.textContent = '';
      if (!found) { box.appendChild(el('p', 'error', 'This letter could not be found.')); return; }
      document.title = found.title || 'A letter';
      box.appendChild(renderPost(found, true));
      box.appendChild(el('p', 'sign', '\u2014 Omniletter'));
    }).catch(function () {
      box.textContent = '';
      box.appendChild(el('p', 'error', 'This letter could not be loaded.'));
    });
  }

  /* ---------- Automatic permanent IDs (no manual work) ---------- */
  // 1. An "ID:" line in the post, if you ever write one, always wins.
  // 2. Otherwise a post with a photo uses the photo's file name:  photo.jpg -> ?post=photo
  // 3. Otherwise (text only) the post's serial number counted from the OLDEST post: 1, 2, 3 ...
  //    New posts go at the top, so older posts keep their number and their link.
  // If two posts would get the same ID, the older one keeps it and the newer one gets "-2", "-3"...

  function slug(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function photoName(p) {
    for (var i = 0; i < p.blocks.length; i++) {
      var b = p.blocks[i];
      if (b.type !== 'image' || !b.url) continue;
      var name = b.url.split(/[?#]/)[0].split('/').pop();
      try { name = decodeURIComponent(name); } catch (e) { /* keep raw name */ }
      var s = slug(name.replace(/\.[^.]*$/, ''));
      if (s) return s;
    }
    return '';
  }

  function assignIds(posts) {
    var used = {}, total = posts.length;
    for (var i = total - 1; i >= 0; i--) {          // oldest (bottom of file) first
      var p = posts[i];
      var base = p.id || photoName(p) || String(total - i);
      var id = base, k = 2;
      while (used[id.toLowerCase()]) id = base + '-' + (k++);
      used[id.toLowerCase()] = true;
      p.id = id;
    }
  }

  /* ---------- Start ---------- */

  var id = new URLSearchParams(location.search).get('post');
  if (id !== null) postMode(id.trim()); else profileMode();

})();
