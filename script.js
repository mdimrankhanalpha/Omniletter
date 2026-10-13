/*
  OMNILETTER
  Two experiences only:
    1. Profile page (normal URL). Searching the secret phrase reveals the feed on the same page.
    2. A single standalone letter at  ?post=ID
  Content comes from post.txt: posts are separated by a line containing only "-".
  The top post in the file is the newest. Links are automatic: each post gets a long unguessable code made from its content.

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

  // Secret salt for private link codes. Change it to anything you like, but changing it changes ALL links.
  var LINK_SALT = 'omniletter-7f3a9c1e5b2d48a6-q8Zr2Lx';

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
    var m = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|raw)\/([^\/]+)\/([^?#]+)(?:[?#].*)?$/i.exec(u);
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
  var KEY = /^\s*(ID|TITLE|DATE|TEXT|IMAGES?|PHOTOS?|PICTURES?|PICS?|VIDEOS?|AUDIOS?|FILE|THUMB|CAPTION)\s*:\s?(.*)$/i;
  var MEDIA = { IMAGE: 'image', IMAGES: 'image', PHOTO: 'image', PHOTOS: 'image', PICTURE: 'image', PICTURES: 'image', PIC: 'image', PICS: 'image',
                VIDEO: 'video', VIDEOS: 'video', AUDIO: 'audio', AUDIOS: 'audio', FILE: 'file' };

  // Find every link on a line. "only" is true when the line holds nothing but links
  // (separators like spaces, commas, | and markdown ![x](link) are all accepted).
  var URL_RE = /https?:\/\/[^\s<>"',;|]+/g;
  function lineUrls(line) {
    var s = line.trim().replace(/!?\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, ' $1 ');
    var urls = (s.match(URL_RE) || []).map(function (u) { return u.replace(/[.:!?)\]]+$/, ''); });
    var rest = s.replace(URL_RE, ' ').replace(/[\s,;|()<>\[\]]+/g, '');
    return { urls: urls, only: urls.length > 0 && rest === '' };
  }

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
    return assignIds(posts);                       // file order: top of the file = newest = shown first
  }

  function parsePost(lines) {
    var post = { id: '', title: '', date: '', blocks: [], raw: lines.join('\n').replace(/\s+/g, ' ').trim() };
    var text = null;
    var pending = null;                      // {type, strict}: following bare link lines inherit this media type

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
        if (k === 'ID') { return; }          // IDs are automatic now; any ID line is ignored
        if (k === 'TITLE') { post.title = v; return; }
        if (k === 'DATE') { post.date = v; return; }
        if (k === 'TEXT') { flush(); text = [m[2]]; return; }
        if (MEDIA[k]) {
          flush();
          var li = lineUrls(v);
          if (li.urls.length > 1 && li.only) {
            li.urls.forEach(function (u) { post.blocks.push({ type: MEDIA[k], url: u }); });   // several links on one line
          } else if (v) post.blocks.push({ type: MEDIA[k], url: v });
          // links on the following lines belong to this key too (IMAGE: then one link per line)
          pending = { type: MEDIA[k], strict: !v };
          return;
        }
        // THUMB / CAPTION belong to the media line just above them
        var b = post.blocks[post.blocks.length - 1];
        if (!text && b && b.type !== 'text') {
          if (k === 'CAPTION' && !b.caption) { b.caption = v; return; }
          if (k === 'THUMB' && (b.type === 'image' || b.type === 'video') && !b.thumb) { b.thumb = v; return; }
        }
        // otherwise fall through: keep the line as text rather than dropping it
      }
      if (pending && !text) {
        if (!line.trim()) return;
        var pl = lineUrls(line);
        if (pl.only && (pending.strict || pl.urls.every(urlKind))) {
          pl.urls.forEach(function (u) {
            post.blocks.push({ type: pending.strict ? pending.type : urlKind(u), url: u });
          });
          return;
        }
        pending = null;
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

  // Decide what a bare link points to, from its file extension (or YouTube)
  function urlKind(u) {
    var path = u.split(/[?#]/)[0];
    if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(path)) return 'image';
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(path) || ytInfo(u)) return 'video';
    if (/\.(mp3|m4a|wav|ogg|oga|aac|flac)$/i.test(path)) return 'audio';
    return '';
  }

  function renderBlock(b) {
    if (b.type === 'text') {
      var frag = document.createDocumentFragment();
      b.text.split(/\n\s*\n/).forEach(function (para) {
        var buf = [];
        function flushText() {
          var t = buf.join('\n').trim();
          buf = [];
          if (!t) return;
          var p = el('p');
          linkify(p, t);
          frag.appendChild(p);
        }
        para.split('\n').forEach(function (line) {
          var li = lineUrls(line);
          var kinds = li.urls.map(urlKind);
          if (li.only && kinds.every(Boolean)) {         // line holds only photo/video/audio links
            flushText();
            li.urls.forEach(function (u, n) { frag.appendChild(renderBlock({ type: kinds[n], url: u })); });
          } else buf.push(line);
        });
        flushText();
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

  /* ---------- Fast, priority-aware image loading ----------
     - Photos on screen load first (high priority); photos just off screen load next,
       nearest first, a few at a time, so they never fight the one being viewed.
     - Scrolling far away cancels photos that have not finished, so bandwidth goes to what is watched.
     - Photos are fetched as small, correctly-sized WebP copies (never upscaled, never cropped).
       Any failure falls back to the original file. Tapping a photo still opens the original. */

  var PROXY = 'https://wsrv.nl/';
  var proxyFails = 0;
  var SIZES = [320, 480, 640, 800, 1000, 1280, 1600];
  var LIMIT = 3, activeLow = 0, queue = [];
  var VIS = null, NEAR = null;

  function canResize(u) {
    return proxyFails < 2 && /^https?:\/\//i.test(u) && !/\.(gif|svg)$/i.test(u.split(/[?#]/)[0]);
  }

  function resized(u, px) {
    var w = SIZES[SIZES.length - 1];
    for (var i = 0; i < SIZES.length; i++) { if (px <= SIZES[i]) { w = SIZES[i]; break; } }
    return PROXY + '?url=' + encodeURIComponent(u) + '&w=' + w + '&we&output=webp&q=80';
  }

  function release(s) { if (s.counted) { s.counted = false; activeLow--; } }

  function begin(s) {
    if (s.state) return;
    s.state = 1;
    if (!s.hi) { s.counted = true; activeLow++; }
    var px = Math.ceil((s.btn.clientWidth || 600) * Math.min(window.devicePixelRatio || 1, 1.5));
    s.cur = s.thumb || (canResize(s.full) ? resized(s.full, px) : s.full);
    s.img.setAttribute('fetchpriority', s.hi ? 'high' : 'low');
    s.img.src = s.cur;
  }

  function pump() {
    while (activeLow < LIMIT && queue.length) {
      var mid = window.innerHeight / 2, bi = 0, bd = Infinity;
      for (var i = 0; i < queue.length; i++) {
        var d = Math.abs(queue[i].btn.getBoundingClientRect().top - mid);
        if (d < bd) { bd = d; bi = i; }
      }
      var s = queue.splice(bi, 1)[0];
      if (!s.state) begin(s);
    }
  }

  function want(s, high) {
    if (s.state === 2) return;
    if (s.state === 1) {
      if (high && !s.hi) { s.hi = true; s.img.setAttribute('fetchpriority', 'high'); }
      return;
    }
    if (high) {
      var q = queue.indexOf(s);
      if (q >= 0) queue.splice(q, 1);
      s.hi = true;
      begin(s);
    } else if (queue.indexOf(s) < 0) { queue.push(s); pump(); }
  }

  function dequeue(s) {
    var q = queue.indexOf(s);
    if (q >= 0) queue.splice(q, 1);
    if (s.state === 1 && !s.vis) {            // scrolled far away before it finished: cancel it
      s.img.removeAttribute('src');
      release(s);
      s.state = 0; s.hi = false; s.cur = '';
      pump();
    }
  }

  function settle(s) {
    if (!s.img.getAttribute('src')) return;
    release(s);
    s.state = 2;
    s.btn.classList.add('ready');
    var item = s.btn.closest ? s.btn.closest('.gitem') : null;
    if (item && s.img.naturalWidth && s.img.naturalHeight) {
      item.style.flexGrow = (s.img.naturalWidth / s.img.naturalHeight).toFixed(4);   // equal-height row, nothing cropped
    }
    if (VIS) { VIS.unobserve(s.btn); NEAR.unobserve(s.btn); }
    pump();
  }

  function failed(s, wrap) {
    if (!s.img.getAttribute('src')) return;   // cancelled on purpose
    if (s.cur !== s.full) {
      if (s.cur.indexOf(PROXY) === 0) proxyFails++;
      s.cur = s.full;
      s.img.src = s.full;                      // fall back to the original file
      return;
    }
    release(s);
    s.state = 2;
    if (VIS) { VIS.unobserve(s.btn); NEAR.unobserve(s.btn); }
    var n = el('div', 'note');
    n.appendChild(document.createTextNode('Image unavailable. '));
    var a = el('a', '', 'Open link');
    a.href = s.full; a.target = '_blank'; a.rel = 'noopener noreferrer';
    n.appendChild(a);
    if (s.btn.parentNode === wrap) wrap.replaceChild(n, s.btn);
    pump();
  }

  if ('IntersectionObserver' in window) {
    VIS = new IntersectionObserver(function (entries) {
      var ins = [];
      entries.forEach(function (e) {
        var s = e.target._slot;
        if (!s) return;
        s.vis = e.isIntersecting;
        if (e.isIntersecting) ins.push(e);
      });
      ins.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; })
         .forEach(function (e) { want(e.target._slot, true); });
    }, { rootMargin: '0px' });
    NEAR = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = e.target._slot;
        if (!s) return;
        if (e.isIntersecting) want(s, false); else dequeue(s);
      });
    }, { rootMargin: '1500px 0px' });
  }

  function track(s) {
    s.btn._slot = s;
    if (!VIS) { s.hi = true; begin(s); return; }   // very old browser: just load
    VIS.observe(s.btn);
    NEAR.observe(s.btn);
  }

  function renderImage(b) {
    var full = cleanUrl(b.url);
    if (!full) return el('div', 'note', 'Image unavailable');
    var wrap = el('div');
    var btn = el('button', 'imgbtn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View image full size');
    var img = new Image();
    img.alt = b.caption || 'Image';
    img.decoding = 'async';
    var slot = { full: full, thumb: cleanUrl(b.thumb), btn: btn, img: img, state: 0, hi: false, counted: false, vis: false, cur: '' };
    img.onload = function () { settle(slot); };
    img.onerror = function () { failed(slot, wrap); };
    btn.appendChild(img);
    btn._imageSlot = slot;
    btn._imageCaption = b.caption || '';
    btn.onclick = function () {
      // Photos in the same post form a gallery; navigation never changes the post URL.
      var post = btn.closest('.post');
      var buttons = post ? Array.prototype.slice.call(post.querySelectorAll('.imgbtn')) : [btn];
      var gallery = buttons.map(function (button) {
        var item = button._imageSlot;
        return item ? { full: item.full, thumb: item.state === 2 && item.cur !== item.full ? item.cur : '', caption: button._imageCaption || '' } : null;
      }).filter(Boolean);
      var index = buttons.indexOf(btn);
      openViewer(full, slot.state === 2 && slot.cur !== full ? slot.cur : '', b.caption, gallery, Math.max(0, index));
    };
    wrap.appendChild(btn);
    track(slot);
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
    return wrap;
  }

  // Photos that sit one after another become rows of at most 3, side by side, each at its own proportions.
  // 1 photo stays on its own; 2 or 3 share one row; a 4th starts the next row of the same post.
  function groupImages(container) {
    var kids = Array.prototype.slice.call(container.children), run = [];
    function closeRun() {
      for (var i = 0; i < run.length; i += 3) {
        var chunk = run.slice(i, i + 3);
        if (chunk.length < 2) continue;                  // a lone photo is not grouped
        var g = el('div', 'media-group n' + chunk.length);
        container.insertBefore(g, chunk[0]);
        chunk.forEach(function (box) { box.className = 'gitem'; g.appendChild(box); });
      }
      run = [];
    }
    kids.forEach(function (k) {
      if (k.classList && k.classList.contains('media') && k.classList.contains('image')) run.push(k);
      else closeRun();
    });
    closeRun();
  }

  function renderPost(post, isLetter) {
    var art = el('div', 'post');
    // Permanent-link pages show only the requested post and its media;
    // copy controls belong only to the private homepage/feed.
    if (!isLetter) art.appendChild(copyButton(post.id));
    if (post.title) art.appendChild(el(isLetter ? 'h1' : 'h2', 'post-title', post.title));
    if (post.date) art.appendChild(el('p', 'post-date', post.date));
    post.blocks.forEach(function (b) { art.appendChild(renderBlock(b)); });
    groupImages(art);
    return art;
  }

  /* ---------- Image viewer (zoom, pan, fullscreen) ---------- */

  var viewer = null;

  function openViewer(full, thumb, caption, gallery, index) {
    if (!viewer) viewer = buildViewer();
    viewer.show(full, thumb, caption, gallery || [{ full: full, thumb: thumb, caption: caption || '' }], index || 0);
  }

  function buildViewer() {
    var root = el('div', 'viewer');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Image viewer');
    root.innerHTML =
      '<button class="v-side v-prev" type="button" data-act="prev" aria-label="Previous photo">‹</button>' +
      '<button class="v-side v-next" type="button" data-act="next" aria-label="Next photo">›</button>' +
      '<button class="v-menu-toggle" type="button" data-act="menu" aria-expanded="false">Photo options ☰</button>' +
      '<div class="v-bar" hidden>' +
      '<button type="button" data-act="rotate">Rotate 90°</button>' +
      '<button type="button" data-act="reading">Reading: Off</button>' +
      '<button type="button" data-act="dark">Dark mode: Off</button>' +
      '<button type="button" data-act="reset">Reset</button>' +
      '<button type="button" data-act="full">Fullscreen</button>' +
      '<button type="button" data-act="close">Close</button>' +
      '</div>' +
      '<div class="v-stage"><img alt="" draggable="false"><p class="v-msg" hidden>Image unavailable</p></div>' +
      '<div class="v-bottom"><button type="button" data-act="out" aria-label="Zoom out">−</button><button type="button" data-act="in" aria-label="Zoom in">+</button></div>' +
      '<p class="v-cap" hidden></p>';
    document.body.appendChild(root);

    var stage = root.querySelector('.v-stage');
    var img = stage.querySelector('img');
    var msg = root.querySelector('.v-msg');
    var cap = root.querySelector('.v-cap');
    var fsBtn = root.querySelector('[data-act="full"]');
    var closeBtn = root.querySelector('[data-act="close"]');

    var MAX = 8;
    var gallery = [], galleryIndex = 0, photoStates = Object.create(null);
    function stateKey() { return galleryIndex; }
    function savePhotoState() { photoStates[stateKey()] = { rotation: rotation, reading: reading, dark: dark, s: s, x: x, y: y }; }
    function restorePhotoState() { var st = photoStates[stateKey()]; rotation = st ? st.rotation : 0; reading = st ? st.reading : false; dark = st ? st.dark : false; s = st ? st.s : 1; x = st ? st.x : 0; y = st ? st.y : 0; }
    var s = 1, x = 0, y = 0, token = 0, lastFocus = null, prevOverflow = '', rotation = 0, reading = false, dark = false, controlsHidden = false;
    var pts = {}, count = 0, moved = false, startX = 0, startY = 0, lastTap = 0, tapX = 0, tapY = 0;
    var viewerHistoryOpen = false, closingFromPopstate = false;

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
      img.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rotation + 'deg) scale(' + s + ')';
      // Fit the complete image inside the viewer even after a 90°/270° rotation.
      var sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      var nw = img.naturalWidth || sw, nh = img.naturalHeight || sh;
      var sideways = Math.abs(rotation % 180) === 90;
      var boxW = sideways ? sh : sw, boxH = sideways ? sw : sh;
      var fit = Math.min(boxW / nw, boxH / nh);
      img.style.width = Math.max(1, nw * fit) + 'px';
      img.style.height = Math.max(1, nh * fit) + 'px';
      img.style.filter = (reading ? 'brightness(1.22) contrast(1.5) ' : '') + (dark ? 'invert(1) hue-rotate(180deg)' : '');
      root.classList.toggle('controls-hidden', controlsHidden);
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
      else if (act === 'reset') { reset(); rotation = 0; reading = false; dark = false; updateFilterButtons(); apply(); }
      else if (act === 'menu') { var bar = root.querySelector('.v-bar'); bar.hidden = !bar.hidden; e.target.setAttribute('aria-expanded', String(!bar.hidden)); }
      else if (act === 'rotate') { rotation = (rotation + 90) % 360; reset(); apply(); }
      else if (act === 'reading') { reading = !reading; updateFilterButtons(); apply(); }
      else if (act === 'dark') { dark = !dark; updateFilterButtons(); apply(); }
      else if (e.target === img || e.target === stage) { controlsHidden = !controlsHidden; apply(); }
      else if (act === 'prev') changePhoto(-1);
      else if (act === 'next') changePhoto(1);
      else if (act === 'close') close();
      else if (act === 'full') {
        if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { var pr = reqFs.call(root); if (pr && pr.catch) pr.catch(function () {}); }
      }
    });

    window.addEventListener('popstate', function () {
      if (!root.hidden) {
        closingFromPopstate = true;
        viewerHistoryOpen = false;
        close();
        closingFromPopstate = false;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (root.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') changePhoto(-1);
      else if (e.key === 'ArrowRight') changePhoto(1);
      else if (e.key === '+' || e.key === '=') zoomAt(s * 1.5, 0, 0);
      else if (e.key === '-') zoomAt(s / 1.5, 0, 0);
      else if (e.key === '0') reset();
    });
    window.addEventListener('resize', function () { if (!root.hidden) apply(); });
    document.addEventListener('fullscreenchange', function () { if (!root.hidden) apply(); });

    img.onerror = function () { img.hidden = true; msg.hidden = false; };

    function updateFilterButtons() {
      root.querySelector('[data-act="reading"]').textContent = 'Reading: ' + (reading ? 'On' : 'Off');
      root.querySelector('[data-act="dark"]').textContent = 'Dark mode: ' + (dark ? 'On' : 'Off');
    }

    function changePhoto(step) {
      if (!gallery.length || gallery.length < 2) return;
      savePhotoState();
      galleryIndex = (galleryIndex + step + gallery.length) % gallery.length;
      restorePhotoState();
      var item = gallery[galleryIndex];
      controlsHidden = false; updateFilterButtons(); token++; img.hidden = false; msg.hidden = true;
      img.alt = item.caption || 'Image'; cap.textContent = item.caption || ''; cap.hidden = !item.caption;
      var my = token;
      if (item.thumb && item.thumb !== item.full) { img.src = item.thumb; var hi = new Image(); hi.onload = function () { if (my === token) img.src = item.full; }; hi.src = item.full; }
      else img.src = item.full;
      root.querySelector('[data-act="prev"]').hidden = gallery.length < 2;
      root.querySelector('[data-act="next"]').hidden = gallery.length < 2;
    }

    function close() {
      if (root.hidden) return;
      if (viewerHistoryOpen && !closingFromPopstate) {
        viewerHistoryOpen = false;
        history.back();
      }
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      root.hidden = true;
      token++;
      img.removeAttribute('src');
      document.body.style.overflow = prevOverflow;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    return {
      show: function (full, thumb, caption, items, index) {
        gallery = items || [{ full: full, thumb: thumb, caption: caption || '' }];
        galleryIndex = index || 0;
        root.querySelector('[data-act="prev"]').hidden = gallery.length < 2;
        root.querySelector('[data-act="next"]').hidden = gallery.length < 2;
        lastFocus = document.activeElement;
        prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        pts = {}; count = 0; lastTap = 0; photoStates = Object.create(null); rotation = 0; reading = false; dark = false; controlsHidden = false; updateFilterButtons();
        s = 1; x = 0; y = 0;
        img.style.transform = '';
        img.hidden = false; msg.hidden = true;
        img.alt = caption || 'Image';
        cap.textContent = caption || '';
        cap.hidden = !caption;
        root.hidden = false;
        // Make the phone/browser Back button close the viewer first, returning
        // to the same post instead of leaving the website.
        if (!viewerHistoryOpen) {
          try { history.pushState({ omniletterViewer: true }, '', location.href); viewerHistoryOpen = true; } catch (e) {}
        }
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

    input.addEventListener('input', function () {
      msg.textContent = '';
      // Only when the exact phrase has been typed: start fetching early so the reveal feels instant.
      // Nothing is requested for any other text, so the hidden page stays hidden.
      var v = input.value.trim();
      if (v && window.crypto && crypto.subtle) sha256(v).then(function (h) { if (h === PHRASE_HASH) warm(); });
    });

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

    var warmed = false;
    function warm() {
      if (warmed) return;
      warmed = true;
      ['https://raw.githubusercontent.com', 'https://wsrv.nl'].forEach(function (h) {
        var l = document.createElement('link');
        l.rel = 'preconnect'; l.href = h;
        document.head.appendChild(l);
      });
      loadPosts().catch(function () { /* the real attempt on submit will report it */ });
    }

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
        // first posts at once, the rest in small batches so the page never freezes
        var i = 0;
        function batch() {
          var frag = document.createDocumentFragment(), end = Math.min(i + (i === 0 ? 4 : 12), posts.length), first = i === 0;
          for (; i < end; i++) frag.appendChild(renderPost(posts[i], false));
          feed.appendChild(frag);
          if (first && typeof feed.scrollIntoView === 'function') feed.scrollIntoView({ block: 'start', behavior: 'auto' });
          if (i < posts.length) setTimeout(batch, 0);
        }
        batch();
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
        var ids = posts[i].ids || [posts[i].id];
        if (ids.some(function (candidate) { return candidate && candidate.toLowerCase() === want; })) {
          found = posts[i]; break;
        }
      }
      box.textContent = '';
      if (!found) { box.appendChild(el('p', 'error', 'This letter could not be found.')); return; }
      document.title = found.title || 'A letter';
      box.appendChild(renderPost(found, true));
    }).catch(function () {
      box.textContent = '';
      box.appendChild(el('p', 'error', 'This letter could not be loaded.'));
    });
  }

  /* ---------- Automatic private link codes ---------- */
  // Nothing to write in post.txt. Each post's code is a hash of (secret salt + its own content),
  // so codes are long, random-looking and cannot be guessed (no 1, 2, 3 or photo names).
  // The same post always gets the same code, so permanent links keep working.
  // Editing a post's text changes its code. Adding new posts at the top never changes old codes.

  function fallbackHash(str) {                       // only used if crypto.subtle is missing
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x1234abcd;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822519);
    }
    return [h1, h2, h3].map(function (n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }).join('');
  }

  function hashHex(str) {
    if (window.crypto && crypto.subtle) return sha256(str);
    return Promise.resolve(fallbackHash(str));
  }

  function assignIds(posts) {
    /*
      Preserve existing SHA-256 IDs on HTTPS and also recognize IDs created by
      the older non-crypto fallback. Do not rotate LINK_SALT or change the
      SHA-256 ID format: existing permanent links must continue to resolve.
    */
    var input = posts.map(function (p) { return LINK_SALT + '|' + p.raw; });
    return Promise.all(input.map(function (v) {
      if (window.crypto && crypto.subtle) return sha256(v);
      return Promise.resolve(null);
    })).then(function (shaHashes) {
      var shaUsed = Object.create(null), fallbackUsed = Object.create(null);
      var shaIds = new Array(posts.length), fallbackIds = new Array(posts.length);

      // Resolve collisions oldest-first, matching the original collision rule.
      for (var i = posts.length - 1; i >= 0; i--) {
        if (shaHashes[i]) {
          var sh = shaHashes[i].slice(0, 24), sk = 2, sid = sh;
          while (shaUsed[sid]) sid = sh + '-' + (sk++);
          shaUsed[sid] = true;
          shaIds[i] = sid;
        }

        var fh = fallbackHash(input[i]).slice(0, 24), fk = 2, fid = fh;
        while (fallbackUsed[fid]) fid = fh + '-' + (fk++);
        fallbackUsed[fid] = true;
        fallbackIds[i] = fid;
      }

      posts.forEach(function (post, i) {
        // SHA-256 stays primary on normal HTTPS hosting, so working links do
        // not change. Fallback IDs remain primary only where crypto is absent.
        post.id = shaIds[i] || fallbackIds[i];
        post.ids = [post.id, shaIds[i], fallbackIds[i]].filter(function (v, n, a) {
          return !!v && a.indexOf(v) === n;
        });
      });
      return posts;
    });
  }

  /* ---------- Start ---------- */

  var id = new URLSearchParams(location.search).get('post');
  if (id !== null) postMode(id.trim()); else profileMode();

})();
