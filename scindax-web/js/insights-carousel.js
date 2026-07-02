/* Carrossel automático da listagem de Insights: duplica os cards
   uma vez para permitir loop contínuo via CSS (translateX -50%). */
(function () {
    'use strict';

    function initCarousel() {
        const track = document.getElementById('insightsTrack');
        if (!track) return;

        const reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;

        const originalCards = Array.prototype.slice.call(track.children);
        if (originalCards.length < 2) return;

        originalCards.forEach(function (card) {
            const clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.querySelectorAll('a').forEach(function (a) {
                a.tabIndex = -1;
            });
            track.appendChild(clone);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }
})();
