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

  function openMenu() {
    if (!hamburger || !overlay) return;
    hamburger.classList.add('is-active');
    hamburger.setAttribute('aria-expanded', 'true');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    body.classList.add('menu-open');
  }

  function closeMenu() {
    if (!hamburger || !overlay) return;
    hamburger.classList.remove('is-active');
    hamburger.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    body.classList.remove('menu-open');
  }

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      if (overlay.classList.contains('open')) { closeMenu(); }
      else { openMenu(); }
    });
  }

  // Close on overlay link click or Escape
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { closeMenu(); }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeMenu(); }
  });

  // ── Scroll-in logo logic (homepage mobile) ──────────────────────
  (function () {
    var logoHome = document.querySelector('.navbar-logo-home');
    if (!logoHome) return;

    var hasScrolled = false;
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 150) {
        if (!hasScrolled) {
          logoHome.classList.add('animate');
          hasScrolled = true;
        }
        logoHome.classList.add('is-visible');
      } else {
        logoHome.classList.remove('is-visible');
      }
    }, { passive: true });
  }());

  // ── Scroll-in post title logic (single pages) ───────────────────
  (function () {
    var stickyHeader = document.getElementById('sticky-post-header');
    if (!stickyHeader) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 200) {
        stickyHeader.classList.add('is-visible');
      } else {
        stickyHeader.classList.remove('is-visible');
      }
    }, { passive: true });
  }());
}());
