/* ═══════════════════════════════════════════════════════
   LexiVault — nav.js · 공통 네비게이션 컨트롤러
   사용법: <script src="../shared/nav.js" defer></script>
   옵션:  window.NAV_CONFIG = { activePage: 'features' }
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 설정 ── */
  const CFG = window.NAV_CONFIG || {};
  const LINKS = [
    { href: '#how',      label: '사용법' },
    { href: '#features', label: '기능' },
    { href: '#pricing',  label: '요금제' },
    { href: '#faq',      label: 'FAQ' },
  ];

  /* ── HTML 주입 ── */
  function injectNav() {
    const mount = document.getElementById('lv-nav');
    if (!mount) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    mount.innerHTML = `
<nav class="nav" id="mainNav" role="navigation" aria-label="주 네비게이션">
  <div class="container">
    <div class="nav-inner">

      <!-- 로고 -->
      <a href="Landing.html" class="nav-logo" aria-label="LexiVault 홈">
        <div class="nav-logo-mark" aria-hidden="true">
          <span class="nav-logo-l">L</span>
        </div>
        <span class="nav-logo-name">LexiVault</span>
      </a>

      <!-- 데스크톱 링크 -->
      <div class="nav-links" role="list">
        ${LINKS.map(l => `
          <a href="${l.href}" class="nav-link${CFG.activePage === l.label ? ' active' : ''}"
             role="listitem">${l.label}</a>
        `).join('')}
      </div>

      <!-- 액션 -->
      <div class="nav-actions">
        <button class="nav-theme" id="navThemeBtn"
          aria-label="다크모드 전환" title="다크모드 전환">
          ${isDark ? '☀️' : '🌙'}
        </button>
        <a href="Login.html" class="btn-ghost">로그인</a>
        <a href="Signup.html" class="btn-nav-primary">무료 시작</a>
        <button class="nav-hamburger" id="navHamburger"
          aria-label="메뉴 열기" aria-expanded="false" aria-controls="mobileMenu">
          <span></span><span></span><span></span>
        </button>
      </div>

    </div>
  </div>
</nav>

<!-- 모바일 드롭다운 -->
<div class="mobile-menu" id="mobileMenu" role="menu" aria-hidden="true">
  ${LINKS.map(l => `<a href="${l.href}" class="mobile-link" role="menuitem">${l.label}</a>`).join('')}
  <div class="mobile-divider" aria-hidden="true"></div>
  <a href="Login.html" class="mobile-link" role="menuitem">로그인</a>
  <a href="Signup.html" class="mobile-cta" role="menuitem">무료로 시작하기 →</a>
</div>
    `.trim();
  }

  /* ── 테마 토글 ── */
  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const btn = document.getElementById('navThemeBtn');
    if (btn) btn.textContent = isDark ? '🌙' : '☀️';
    try { localStorage.setItem('lv-theme', isDark ? 'light' : 'dark'); } catch(_) {}
  }

  /* ── 저장된 테마 적용 ── */
  function applyStoredTheme() {
    try {
      const saved = localStorage.getItem('lv-theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
    } catch(_) {}
  }

  /* ── 스크롤 → nav 섀도우 + active link ── */
  function onScroll() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 20);

    /* 섹션별 active link 업데이트 */
    const sections = document.querySelectorAll('section[id], div[id]');
    let current = '';
    sections.forEach(sec => {
      const top = sec.getBoundingClientRect().top;
      if (top <= 90) current = sec.id;
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === '#' + current);
    });
  }

  /* ── 햄버거 ── */
  function initHamburger() {
    const btn = document.getElementById('navHamburger');
    const menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    function toggle(force) {
      const open = force !== undefined ? force : !btn.classList.contains('open');
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
      menu.setAttribute('aria-hidden', !open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    btn.addEventListener('click', () => toggle());

    /* 링크 클릭 시 닫기 */
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => toggle(false));
    });

    /* 외부 클릭 시 닫기 */
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) toggle(false);
    });

    /* ESC */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') toggle(false);
    });
  }

  /* ── 초기화 ── */
  function init() {
    applyStoredTheme();
    injectNav();
    initHamburger();
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* 테마 버튼 이벤트 */
    const themeBtn = document.getElementById('navThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    /* 전역 노출 */
    window.lvToggleTheme = toggleTheme;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
