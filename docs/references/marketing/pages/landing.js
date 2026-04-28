/* ═══════════════════════════════════════════════════════════════
   Vocaflow — landing.js  ·  Landing íì´ì§ ì ì© ì¤í¬ë¦½í¸
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ═════════════════════════════════════
     1. ì¤í¬ë¡¤ IntersectionObserver
  ═════════════════════════════════════ */
  function initScrollAnim() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (e.target.classList.contains('stats-row')) countUpStats();
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.obs').forEach(el => io.observe(el));
  }

  /* ═════════════════════════════════════
     2. íµê³ ì¹´ì´í¸ì
  ═════════════════════════════════════ */
  function countUpStats() {
    document.querySelectorAll('.stat-num[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      const dur    = 900;
      const start  = performance.now();
      function tick(now) {
        const t    = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(ease * target) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ═════════════════════════════════════
     3. FAQ ìì½ëì¸
  ═════════════════════════════════════ */
  window.toggleFaq = function (btn) {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  };

  /* ═════════════════════════════════════
     4. ìê¸ì  í ê¸
  ═════════════════════════════════════ */
  window.switchPricing = function (chk) {
    const annual = chk.checked;
    document.getElementById('lblMonthly').classList.toggle('active', !annual);
    document.getElementById('lblAnnual').classList.toggle('active', annual);

    const updates = [
      { id: 'proPrice',  m: '9,900',  a: '99,000' },
      { id: 'teamPrice', m: '7,900',  a: '69,000' },
      { id: 'proPeriod', m: '/ ì · ì¸ì ë  í´ì§ ê°ë¥', a: '/ ë · 2ê°ì ë¬´ë£' },
      { id: 'teamPeriod',m: '5ì¸ ì´ì · ìê° ê²°ì ',    a: '5ì¸ ì´ì · ì°ê° ê²°ì ' },
    ];
    updates.forEach(({ id, m, a }) => {
      const el = document.getElementById(id);
      if (!el) return;
      /* íë¦½ ì ëë©ì´ì */
      el.style.transform = 'translateY(-6px)';
      el.style.opacity   = '0';
      setTimeout(() => {
        el.textContent     = annual ? a : m;
        el.style.transform = 'translateY(0)';
        el.style.opacity   = '1';
        el.style.transition = 'transform .25s var(--ease-out), opacity .25s';
      }, 150);
    });
  };

  /* ═════════════════════════════════════
     5. ëª©ì íì´í ì ëë©ì´ì
  ═════════════════════════════════════ */
  function initMockupTyping() {
    const sentences = [
      'Evolution is one of the most important concepts in biology.',
      'Natural selection drives the diversity of living organisms.',
      'DNA analysis confirms evolutionary relationships between species.',
    ];
    let si = 0;
    const textEl = document.querySelector('.ml-textarea');
    if (!textEl) return;

    function typeSentence(text) {
      let i = 0;
      function type() {
        if (i <= text.length) {
          const cursor = i < text.length
            ? '<span style="display:inline-block;width:1.5px;height:1em;background:var(--p);vertical-align:text-bottom;animation:blink .7s step-end infinite;margin-left:1px"></span>'
            : '';
          textEl.innerHTML = text.slice(0, i) + cursor;
          i++;
          setTimeout(type, 38 + Math.random() * 22);
        } else {
          setTimeout(() => {
            si = (si + 1) % sentences.length;
            setTimeout(() => typeSentence(sentences[si]), 600);
          }, 2600);
        }
      }
      type();
    }

    const heroEl = document.querySelector('.hero');
    if (!heroEl) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setTimeout(() => typeSentence(sentences[0]), 1400);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(heroEl);
  }

  /* ═════════════════════════════════════
     6. SP Bar ë· ìí ì ëë©ì´ì
  ═════════════════════════════════════ */
  function initSpBar() {
    const dots = document.querySelectorAll('.mp-dot');
    if (!dots.length) return;
    let cur = 1;
    setInterval(() => {
      dots.forEach((d, i) => {
        d.classList.remove('active', 'done');
        if (i < cur)       d.classList.add('done');
        else if (i === cur) d.classList.add('active');
      });
      cur++;
      if (cur >= dots.length) { cur = 0; dots.forEach(d => d.classList.remove('done')); }
    }, 1900);
  }

  /* ═════════════════════════════════════
     7. ë¶ëë¬ì´ ìµì»¤ ì¤í¬ë¡¤
  ═════════════════════════════════════ */
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id  = a.getAttribute('href').slice(1);
        const tgt = document.getElementById(id);
        if (!tgt) return;
        e.preventDefault();
        const top = tgt.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  /* ═════════════════════════════════════
     8. ì´ê¸°í
  ═════════════════════════════════════ */
  function init() {
    initScrollAnim();
    initMockupTyping();
    initSpBar();
    initAnchorScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
