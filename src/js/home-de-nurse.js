(function () {
  'use strict';

  // =========================
  // Config
  // =========================
  var REVEAL_SELECTOR = '.hdn-reveal';
  var INVIEW_CLASS = 'is-inview';

  var HERO_SELECTOR = '.hdn-hero';
  var LOADER_ID = 'hdnLoader';

  var IO_OPTIONS = { rootMargin: '0px 0px -10% 0px', threshold: 0.05 };

  var HEADER_OFFSET = 10;

  // Loading time
  var MIN_SHOW = 1600;
  var FAILSAFE = 6000;
  var LOADER_FADE_MS = 600;

  // =========================
  // State
  // =========================
  var revealEnabled = false;
  var heroGate = false;
  var heroEls = [];

  var io = null;
  var observed = new WeakSet();

  // =========================
  // Utils
  // =========================
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function isInViewport(el) {
    if (!el || el.nodeType !== 1) return false;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom >= 0 && r.top <= vh * 0.9;
  }

  function reveal(el) {
    if (!el || el.classList.contains(INVIEW_CLASS)) return;

    if (heroGate && el.getAttribute('data-hdn-hero') === '1') return;

    el.classList.add(INVIEW_CLASS);
    if (io) io.unobserve(el);
  }

  function observe(el) {
    if (!el || observed.has(el)) return;
    observed.add(el);
    if (io) io.observe(el);
  }

  function refreshReveal() {
    qsa(REVEAL_SELECTOR).forEach(function (el) {
      if (el.classList.contains(INVIEW_CLASS)) return;
      if (heroGate && el.getAttribute('data-hdn-hero') === '1') return;
      if (isInViewport(el)) reveal(el);
    });
  }

  // =========================
  // Reveal (IntersectionObserver + MutationObserver)
  // =========================
  function initRevealSystem() {
    var targets = qsa(REVEAL_SELECTOR);

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!revealEnabled) return;
          reveal(entry.target);
        });
      }, IO_OPTIONS);

      targets.forEach(observe);
    } else {
      io = null;
    }

    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function (mutations) {
        if (!io) return;
        mutations.forEach(function (m) {
          m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function (node) {
            if (!node || node.nodeType !== 1) return;

            if (node.matches && node.matches(REVEAL_SELECTOR)) {
              observe(node);
            }
            if (node.querySelectorAll) {
              qsa(REVEAL_SELECTOR, node).forEach(observe);
            }
          });
        });

        if (revealEnabled) requestAnimationFrame(refreshReveal);
      });

      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // =========================
  // HERO reveal after loading
  // =========================
  function prepareHeroGate() {
    var hero = document.querySelector(HERO_SELECTOR);
    if (!hero) return;

    heroEls = qsa(REVEAL_SELECTOR, hero);

    heroEls.forEach(function (el) {
      el.setAttribute('data-hdn-hero', '1');
    });

    heroGate = heroEls.length > 0;
  }

  function runHeroReveal() {
    if (!heroGate || heroEls.length === 0) {
      heroGate = false;
      return;
    }

    heroEls.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add(INVIEW_CLASS);
        if (io) io.unobserve(el);
        el.removeAttribute('data-hdn-hero');
      }, i * 120);
    });

    var total = heroEls.length * 120 + 220;
    setTimeout(function () {
      heroGate = false;
      refreshReveal();
    }, total);
  }

  function enableReveal() {
    revealEnabled = true;

    if (!('IntersectionObserver' in window)) {
      qsa(REVEAL_SELECTOR).forEach(function (el) { el.classList.add(INVIEW_CLASS); });
      return;
    }

    refreshReveal();
  }

  // =========================
  // Smooth scroll for in-page anchors
  // =========================
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      if (a.hasAttribute('data-no-smooth')) return;

      var id = a.getAttribute('href');
      if (!id || id === '#') return;

      var el = document.querySelector(id);
      if (!el) return;

      e.preventDefault();

      var top = el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
      window.scrollTo({ top: top, behavior: 'smooth' });

      history.replaceState(null, '', id);
    });
  }

  // =========================
  // Loading
  // =========================
  function initLoading() {
    var loader = document.getElementById(LOADER_ID);

    if (!loader) {
      enableReveal();
      return;
    }

    document.documentElement.classList.add('hdn-is-loading');

    try {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    } catch (err) {}

    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);

    var start = Date.now();
    var done = false;
    var failTimer = null;

    function finishOnce() {
      if (done) return;
      done = true;

      if (failTimer) clearTimeout(failTimer);

      var elapsed = Date.now() - start;
      var wait = Math.max(0, MIN_SHOW - elapsed);

      setTimeout(function () {
        loader.classList.add('is-hide');
        document.documentElement.classList.remove('hdn-is-loading');

        setTimeout(function () {
          if (loader && loader.parentNode) loader.parentNode.removeChild(loader);

          enableReveal();
          runHeroReveal();
          setTimeout(refreshReveal, 300);

        }, LOADER_FADE_MS);
      }, wait);
    }

    // loadで1回だけ
    if (document.readyState === 'complete') finishOnce();
    else window.addEventListener('load', finishOnce, { once: true });

    // 保険（1回だけ）
    failTimer = setTimeout(finishOnce, FAILSAFE);
  }

  // =========================
  // Boot
  // =========================
  initRevealSystem();
  prepareHeroGate();
  initSmoothScroll();
  initLoading();

})();
