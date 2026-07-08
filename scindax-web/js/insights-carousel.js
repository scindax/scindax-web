/* Carrossel da listagem de Insights.
   - Duplica os cards uma vez para permitir loop contínuo.
   - Sem o mouse em cima, rola automaticamente. Com o mouse em cima, a
     posição horizontal do cursor controla a direção e a velocidade:
     lado direito avança, lado esquerdo retrocede.
   - Botão de alternância troca entre carrossel e lista empilhada,
     com a preferência salva em localStorage. */
(function () {
    'use strict';

    const VIEW_STORAGE_KEY = 'scindax-insights-view';
    const AUTO_SPEED = 0.45;
    const MAX_HOVER_SPEED = 2.4;

    let viewport = null;
    let track = null;
    let reduceMotion = false;
    let paused = false;
    let offset = 0;
    let hovering = false;
    let pointerRatio = 0.5;
    let halfWidth = 0;
    let listenersLigados = false;
    let animationId = null;

    /**
     * Remove clones de uma execução anterior e recria a duplicação usada
     * para o loop contínuo, a partir dos cards "reais" atuais na track.
     * Chamável várias vezes com segurança (ex.: depois que um script
     * externo injeta novos cards, como o loader de TNP) sem duplicar
     * listeners nem recomeçar o loop de animação.
     */
    function clonarParaLoop() {
        Array.prototype.slice.call(track.querySelectorAll('[data-scx-clone="true"]')).forEach(function (el) {
            el.remove();
        });

        const cartoesOriginais = Array.prototype.slice.call(track.children);
        if (cartoesOriginais.length > 1 && !reduceMotion) {
            cartoesOriginais.forEach(function (card) {
                const clone = card.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.setAttribute('data-scx-clone', 'true');
                clone.querySelectorAll('a').forEach(function (a) {
                    a.tabIndex = -1;
                });
                track.appendChild(clone);
            });
        }

        measure();
    }

    function measure() {
        halfWidth = track.scrollWidth / 2;
    }

    function onPointerMove(e) {
        const rect = viewport.getBoundingClientRect();
        if (rect.width <= 0) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        pointerRatio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    }

    function tick() {
        if (!paused && halfWidth > 0) {
            let speed = AUTO_SPEED;
            if (hovering) {
                const centered = pointerRatio - 0.5;
                speed = centered * MAX_HOVER_SPEED * 2;
            }
            offset += speed;
            if (offset >= halfWidth) offset -= halfWidth;
            if (offset < 0) offset += halfWidth;
            track.style.transform = 'translateX(' + (-offset) + 'px)';
        }
        animationId = document.hidden ? null : requestAnimationFrame(tick);
    }

    function initCarousel() {
        viewport = document.getElementById('insightsCarousel');
        track = document.getElementById('insightsTrack');
        if (!viewport || !track) return;

        reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        paused = reduceMotion;

        clonarParaLoop();

        if (!listenersLigados) {
            listenersLigados = true;
            viewport.addEventListener('mouseenter', function () { hovering = true; });
            viewport.addEventListener('mouseleave', function () { hovering = false; });
            viewport.addEventListener('mousemove', onPointerMove);
            window.addEventListener('resize', measure, { passive: true });
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden && animationId === null) {
                    animationId = requestAnimationFrame(tick);
                }
            });
            initViewToggle(viewport, function (isStacked) {
                paused = isStacked || reduceMotion;
            });
            animationId = requestAnimationFrame(tick);
        }
    }

    function initViewToggle(viewport, onChange) {
        const buttons = document.querySelectorAll('.view-toggle-btn');
        if (!buttons.length) return;

        function applyView(view) {
            const isStacked = view === 'stacked';
            viewport.classList.toggle('is-stacked', isStacked);
            buttons.forEach(function (btn) {
                const active = btn.getAttribute('data-view') === view;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            onChange(isStacked);
            try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch (e) { /* ignore */ }
        }

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                applyView(btn.getAttribute('data-view'));
            });
        });

        let saved = 'carousel';
        try { saved = localStorage.getItem(VIEW_STORAGE_KEY) || 'carousel'; } catch (e) { /* ignore */ }
        applyView(saved);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }

    /**
     * Exposto para scripts externos (ex.: js/tnp-loader.js) que inserem
     * novos cards na track depois da inicialização inicial e precisam
     * que o loop de clones/medição seja refeito.
     */
    window.ScxInsightsCarousel = { refresh: clonarParaLoop };
})();
