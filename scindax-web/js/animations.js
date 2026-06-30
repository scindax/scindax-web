/* Animações de entrada das seções via IntersectionObserver.
   Elementos .fade-in-up recebem .visible ao entrarem na viewport. */
(function () {
    'use strict';

    function initScrollReveal() {
        const targets = document.querySelectorAll('.fade-in-up');
        if (!targets.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -60px 0px', threshold: 0.1 });

        targets.forEach(el => observer.observe(el));
    }

    window.ScindaxAnimations = { init: initScrollReveal };
})();
