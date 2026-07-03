/* Checklist interativa da série "SCX Na Prática".
   - Progresso vive só em memória: recarregar a página zera tudo,
     de propósito (o objetivo é levar o leitor a concluir na hora).
   - Ao marcar todos os passos, desbloqueia a seção do Selo SCX Builder. */
(function () {
    'use strict';

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
                label.textContent = done + ' de ' + total + ' passos concluídos (' + pct + '%)';
            }

            const allDone = done === total;
            if (badgeSection) badgeSection.classList.toggle('is-locked', !allDone);
            if (lockedMsg) lockedMsg.style.display = allDone ? 'none' : 'block';
            if (unlockedForm) unlockedForm.style.display = allDone ? 'flex' : 'none';
        }

        list.addEventListener('change', function (e) {
            if (e.target && e.target.matches('input[type="checkbox"]')) update();
        });

        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChecklist);
    } else {
        initChecklist();
    }
})();
