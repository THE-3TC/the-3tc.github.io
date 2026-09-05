(function () {
  'use strict';

  var body      = document.body;
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
}());
