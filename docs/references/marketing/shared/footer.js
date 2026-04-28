/* ═══════════════════════════════════════════════════════
   LexiVault — footer.js · 공통 푸터 주입
   사용법: <div id="lv-footer"></div>
           <script src="../shared/footer.js" defer></script>
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FOOTER_HTML = `
<footer class="footer" role="contentinfo">
  <div class="container">
    <div class="footer-grid">

      <!-- 브랜드 -->
      <div class="footer-brand">
        <div class="footer-logo">
          <div class="footer-logo-mark" aria-hidden="true">
            <span class="footer-logo-l">L</span>
          </div>
          <span class="footer-logo-name">LexiVault</span>
        </div>
        <p class="footer-tagline">
          영어 원문 기반 AI 학습 플랫폼.<br>
          원문 하나로 완성하는 어휘력.
        </p>
        <div class="footer-socials" aria-label="소셜 링크">
          <a href="#" class="footer-social" aria-label="Twitter/X">𝕏</a>
          <a href="#" class="footer-social" aria-label="Instagram">📷</a>
          <a href="#" class="footer-social" aria-label="YouTube">▶</a>
        </div>
      </div>

      <!-- 학습 모듈 -->
      <div class="footer-col">
        <div class="footer-col-title">학습 모듈</div>
        <div class="footer-links">
          <a href="TextViewer_v3.html" class="footer-link">TextViewer</a>
          <a href="#" class="footer-link">LexiVault 단어장</a>
          <a href="Flashcard.html" class="footer-link">Flashcard</a>
          <a href="SpellForge.html" class="footer-link">SpellForge</a>
          <a href="WordBlitz_Jungle.html" class="footer-link">WordBlitz</a>
          <a href="ScriptQuiz.html" class="footer-link">ScriptQuiz</a>
          <a href="Dashboard_Web.html" class="footer-link">Dashboard</a>
        </div>
      </div>

      <!-- 서비스 -->
      <div class="footer-col">
        <div class="footer-col-title">서비스</div>
        <div class="footer-links">
          <a href="Landing.html#pricing" class="footer-link">요금제</a>
          <a href="Landing.html#faq" class="footer-link">FAQ</a>
          <a href="#" class="footer-link">
            업데이트
            <span class="footer-link-badge">NEW</span>
          </a>
          <a href="#" class="footer-link">로드맵</a>
          <a href="#" class="footer-link">블로그</a>
        </div>
      </div>

      <!-- 약관 -->
      <div class="footer-col">
        <div class="footer-col-title">약관 & 정책</div>
        <div class="footer-links">
          <a href="#" class="footer-link">이용약관</a>
          <a href="#" class="footer-link">개인정보처리방침</a>
          <a href="#" class="footer-link">쿠키 정책</a>
          <a href="#" class="footer-link">고객 지원</a>
          <a href="Signup.html" class="footer-link">계정 만들기</a>
        </div>
      </div>

    </div><!-- /footer-grid -->

    <div class="footer-bottom">
      <p class="footer-copy">© 2025 LexiVault. All rights reserved.</p>
      <nav class="footer-legal" aria-label="법적 링크">
        <a href="#" class="footer-legal-link">이용약관</a>
        <a href="#" class="footer-legal-link">개인정보</a>
        <a href="#" class="footer-legal-link">쿠키</a>
      </nav>
    </div>

  </div>
</footer>
  `.trim();

  function injectFooter() {
    const mount = document.getElementById('lv-footer');
    if (mount) mount.innerHTML = FOOTER_HTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
