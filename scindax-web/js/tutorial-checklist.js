/* Checklist interativa da série "SCX Na Prática".
   - Progresso vive só em memória: recarregar a página zera tudo,
     de propósito (o objetivo é levar o leitor a concluir na hora).
   - Ao marcar todos os passos, desbloqueia a seção do Selo SCX Builder.
   - A cada mudança, dispara "tutorialProgress" no próprio elemento da lista
     para que outros módulos (ex.: js/gamify-widget.js) reajam sem precisar
     reler os checkboxes por conta própria — uma única fonte de verdade. */
(function () {
    'use strict';

    // Rótulos de progresso ("momentum"): reforço textual sem números de XP,
    // mantendo o tom do post em vez de introduzir jargão de jogo.
    const FAIXAS_DE_MOMENTUM = [
        { min: 0, texto: 'Começando' },
        { min: 34, texto: 'Pegando ritmo' },
        { min: 67, texto: 'Quase lá' },
        { min: 100, texto: 'Checklist completo' }
    ];

    function obterRotuloMomentum(pct) {
        let rotulo = FAIXAS_DE_MOMENTUM[0].texto;
        FAIXAS_DE_MOMENTUM.forEach(function (faixa) {
            if (pct >= faixa.min) rotulo = faixa.texto;
        });
        return rotulo;
    }

    /**
     * Emite uma pequena rajada de partículas de brilho a partir do ícone de
     * check recém-marcado, reaproveitando a mesma classe/keyframe CSS já
     * usados pelo botão do Scindax Lab (.scx-lab-particle / scxParticleDrift
     * em css/styles.css), só que originadas do passo concluído em vez do
     * botão fixo — é a mesma "poeira mágica", em outro gatilho.
     */
    function emitirParticulasDeConclusao(elementoOrigem) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const retangulo = elementoOrigem.getBoundingClientRect();
        const centroX = retangulo.left + retangulo.width / 2;
        const centroY = retangulo.top + retangulo.height / 2;
        const quantidade = 8;

        for (let i = 0; i < quantidade; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const distancia = 30 * (0.5 + Math.random() * 0.6);

            const particula = document.createElement('span');
            particula.className = 'scx-lab-particle';
            particula.style.left = centroX + 'px';
            particula.style.top = centroY + 'px';
            particula.style.setProperty('--scx-dx', (Math.cos(angulo) * distancia) + 'px');
            particula.style.setProperty('--scx-dy', (Math.sin(angulo) * distancia) + 'px');
            particula.style.animationDelay = (i * 20) + 'ms';

            document.body.appendChild(particula);
            particula.addEventListener('animationend', function () { particula.remove(); });
        }
    }

    function initChecklist() {
        const list = document.getElementById('tutorialChecklist');
        if (!list) return;

        const checkboxes = Array.prototype.slice.call(
            list.querySelectorAll('input[type="checkbox"]')
        );
        if (!checkboxes.length) return;

        const fill = document.getElementById('tutorialProgressFill');
        const label = document.getElementById('tutorialProgressLabel');
        const badgeSection = document.getElementById('tutorialBadgeSection');
        const lockedMsg = document.getElementById('tutorialLockedMsg');
        const unlockedForm = document.getElementById('tutorialBadgeForm');
        const total = checkboxes.length;

        function update() {
            const done = checkboxes.filter(function (cb) { return cb.checked; }).length;
            const pct = Math.round((done / total) * 100);

            checkboxes.forEach(function (cb) {
                const step = cb.closest('.tutorial-step');
                if (step) step.classList.toggle('is-done', cb.checked);
            });

            if (fill) fill.style.width = pct + '%';
            if (label) {
                label.textContent = done + ' de ' + total + ' passos concluídos (' + pct + '%), ' + obterRotuloMomentum(pct).toLowerCase() + '.';
            }

            const allDone = done === total;
            if (badgeSection) badgeSection.classList.toggle('is-locked', !allDone);
            if (lockedMsg) lockedMsg.style.display = allDone ? 'none' : 'block';
            if (unlockedForm) unlockedForm.style.display = allDone ? 'flex' : 'none';

            list.dispatchEvent(new CustomEvent('tutorialProgress', {
                detail: { done: done, total: total, pct: pct }
            }));
        }

        list.addEventListener('change', function (e) {
            if (!e.target || !e.target.matches('input[type="checkbox"]')) return;

            if (e.target.checked) {
                const icone = e.target.closest('.tutorial-step').querySelector('.tutorial-checkbox');
                emitirParticulasDeConclusao(icone || e.target);
            }
            update();
        });

        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChecklist);
    } else {
        initChecklist();
    }
})();
