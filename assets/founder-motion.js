/* Founder section: scroll-triggered entrance + count-up numbers. Safe without JS / with reduced motion. */
(function () {
  'use strict';
  var sec = document.querySelector('.founder-feature'); if (!sec) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nums = sec.querySelectorAll('[data-count]');
  if (reduce || !('IntersectionObserver' in window)) return;      // content stays fully visible
  sec.classList.add('fx-ready');
  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10) || 0, t0 = null, dur = 1400;
    el.textContent = '0';
    function step(t) { if (!t0) t0 = t; var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(end * e); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (!en.isIntersecting) return; sec.classList.add('fx-in'); setTimeout(function () { nums.forEach(countUp); }, 600); io.disconnect(); });
  }, { threshold: 0.2 });
  io.observe(sec);
})();
