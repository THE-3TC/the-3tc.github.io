(function () {
  'use strict';

  // ── Dark mode ──────────────────────────────────────────────────
  var DARK_KEY = 'darkmode';
  var body     = document.body;
  var toggle   = document.getElementById('dark-mode-toggle');

  function applyDark(on) {
    body.classList.toggle('darkmode', on);
    try { localStorage.setItem(DARK_KEY, on ? '1' : '0'); } catch (e) {}
  }

  // Restore saved preference; fall back to system preference
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(DARK_KEY); } catch (e) {}
    if (saved === '1') { applyDark(true); }
    else if (saved === '0') { applyDark(false); }
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyDark(true);
    }
  }());

  if (toggle) {
    toggle.addEventListener('click', function () {
      applyDark(!body.classList.contains('darkmode'));
    });
  }

  // ── Mobile hamburger / overlay ─────────────────────────────────
  var hamburger = document.getElementById('hamburger');
  var overlay   = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!hamburger || !overlay) return;
    hamburger.classList.toggle('is-active', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    body.classList.toggle('menu-open', open);
  }

  if (hamburger && overlay) {
    hamburger.addEventListener('click', function () {
      setMenu(!overlay.classList.contains('open'));
    });
    overlay.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { setMenu(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setMenu(false); }
    });
  }

  // ── Scroll-in post title (single pages) ────────────────────────
  (function () {
    var stickyHeader = document.getElementById('sticky-post-header');
    if (!stickyHeader) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY || window.pageYOffset;
      stickyHeader.classList.toggle('is-visible', scrollY > 200);
    }, { passive: true });
  }());

  // ── Lightbox: any figure image opens full screen ───────────────
  var imgs = document.querySelectorAll('.post-body figure img');
  if (imgs.length) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.hidden = true;
    var full = document.createElement('img');
    var cap = document.createElement('p');
    cap.className = 'lightbox__caption';
    var close = document.createElement('button');
    close.className = 'lightbox__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    box.append(close, full, cap);
    document.body.appendChild(box);
    var lastFocus = null;

    function openBox(img) {
      lastFocus = img;
      full.src = img.currentSrc || img.src;
      full.alt = img.alt || '';
      var fc = img.closest('figure') && img.closest('figure').querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : '';
      cap.hidden = !cap.textContent;
      box.hidden = false;
      body.classList.add('lightbox-open');
      close.focus();
    }
    function closeBox() {
      if (box.hidden) return;
      box.hidden = true;
      body.classList.remove('lightbox-open');
      if (lastFocus) lastFocus.focus();
    }
    imgs.forEach(function (img) {
      img.classList.add('is-zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'View full size: ' + (img.alt || 'image'));
      img.addEventListener('click', function () { openBox(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBox(img); }
      });
    });
    box.addEventListener('click', function (e) { if (e.target !== full) closeBox(); });
    close.addEventListener('click', closeBox);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBox(); });
  }
}());
