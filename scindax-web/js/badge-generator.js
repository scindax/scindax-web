/* Gerador do Selo SCX Builder — série "SCX Na Prática".
   100% client-side (canvas), sem back-end e sem custo, coerente com o
   tema do próprio tutorial. Reutilizável: o título e a conquista vêm
   dos atributos data-badge-title / data-badge-achievement da seção. */
(function () {
    'use strict';

    const WIDTH = 1200;
    const HEIGHT = 630;

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        for (let i = 0; i < words.length; i++) {
            const test = line + words[i] + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line.trim());
                line = words[i] + ' ';
            } else {
                line = test;
            }
        }
        lines.push(line.trim());
        lines.forEach(function (l, i) {
            ctx.fillText(l, x, y + i * lineHeight);
        });
        return lines.length;
    }

    function drawBadge(canvas, opts) {
        const ctx = canvas.getContext('2d');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;

        const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        grad.addColorStop(0, '#0a0a12');
        grad.addColorStop(1, '#0c1230');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const glow = ctx.createRadialGradient(WIDTH * 0.8, HEIGHT * 0.15, 20, WIDTH * 0.8, HEIGHT * 0.15, 500);
        glow.addColorStop(0, 'rgba(91, 111, 245, 0.35)');
        glow.addColorStop(1, 'rgba(91, 111, 245, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.strokeStyle = 'rgba(255, 215, 107, 0.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

        // Selo circular
        const cx = 130, cy = 130, r = 58;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 107, 0.12)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffd76b';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 22, cy);
        ctx.lineTo(cx - 6, cy + 18);
        ctx.lineTo(cx + 26, cy - 20);
        ctx.strokeStyle = '#ffd76b';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = '#ffd76b';
        ctx.font = '600 20px Inter, sans-serif';
        ctx.fillText('SCX NA PRÁTICA', 210, 118);

        ctx.fillStyle = '#eef1ff';
        ctx.font = '800 42px Inter, sans-serif';
        ctx.fillText(opts.badgeTitle || 'Selo SCX Builder', 210, 160);

        ctx.fillStyle = '#c7d0ff';
        ctx.font = '300 22px Inter, sans-serif';
        wrapText(ctx, opts.achievement || '', 90, 260, WIDTH - 180, 32);

        ctx.strokeStyle = 'rgba(91, 111, 245, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(90, 400);
        ctx.lineTo(WIDTH - 90, 400);
        ctx.stroke();

        ctx.fillStyle = '#6b6b75';
        ctx.font = '400 16px Inter, sans-serif';
        ctx.fillText('CONCEDIDO A', 90, 440);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 40px Inter, sans-serif';
        ctx.fillText((opts.name || 'Builder').slice(0, 40), 90, 490);

        ctx.fillStyle = '#8b98f5';
        ctx.font = '400 16px Inter, sans-serif';
        ctx.fillText(opts.dateLabel || '', 90, 530);

        ctx.fillStyle = '#6b6b75';
        ctx.font = '400 15px Inter, sans-serif';
        ctx.fillText(opts.sourceLabel || 'scindax.com.br/insights', 90, HEIGHT - 48);
    }

    function fontsReady() {
        if (document.fonts && document.fonts.ready) {
            return Promise.race([
                document.fonts.ready,
                new Promise(function (resolve) { setTimeout(resolve, 400); })
            ]);
        }
        return Promise.resolve();
    }

    function initBadge() {
        const section = document.getElementById('tutorialBadgeSection');
        const form = document.getElementById('tutorialBadgeForm');
        if (!section || !form) return;

        const nameInput = document.getElementById('badgeNameInput');
        const generateBtn = document.getElementById('badgeGenerateBtn');
        const preview = document.getElementById('badgePreview');
        const canvas = document.getElementById('badgeCanvas');
        const downloadBtn = document.getElementById('badgeDownloadBtn');
        const shareBtn = document.getElementById('badgeShareBtn');
        if (!nameInput || !generateBtn || !canvas) return;

        const badgeTitle = section.getAttribute('data-badge-title') || 'Selo SCX Builder';
        const achievement = section.getAttribute('data-badge-achievement') || '';

        function toggleGenerateEnabled() {
            generateBtn.disabled = nameInput.value.trim().length === 0;
        }
        nameInput.addEventListener('input', toggleGenerateEnabled);
        toggleGenerateEnabled();

        generateBtn.addEventListener('click', function () {
            const name = nameInput.value.trim();
            if (!name) return;

            const dateLabel = new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            });

            fontsReady().then(function () {
                drawBadge(canvas, {
                    name: name,
                    badgeTitle: badgeTitle,
                    achievement: achievement,
                    dateLabel: dateLabel,
                    sourceLabel: window.location.hostname + '/insights'
                });
                if (preview) preview.classList.add('is-visible');
                canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                const link = document.createElement('a');
                link.download = 'selo-scx-builder.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', function () {
                const url = encodeURIComponent(window.location.href);
                window.open(
                    'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
                    '_blank',
                    'noopener'
                );
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBadge);
    } else {
        initBadge();
    }
})();
