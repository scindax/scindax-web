/* Fundo animado da listagem de Insights: pontos que se conectam como
   neurônios. Mais nós vão surgindo conforme o usuário rola a página. */
(function () {
    'use strict';

    function initNetwork() {
        const container = document.getElementById('insightsNetwork');
        if (!container) return;

        const reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const TOTAL_NODES = 55;
        const MIN_VISIBLE = 12;
        const CONNECT_DIST = 150;
        const DRIFT_SPEED = 0.1;

        let width, height, dpr;
        let nodes = [];
        let animationId;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }

        function makeNode() {
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * DRIFT_SPEED,
                vy: (Math.random() - 0.5) * DRIFT_SPEED,
                r: Math.random() * 1.1 + 0.7,
                opacity: 0,
                targetOpacity: Math.random() * 0.3 + 0.22
            };
        }

        function initNodes() {
            nodes = [];
            for (let i = 0; i < TOTAL_NODES; i++) nodes.push(makeNode());
        }

        function visibleCount() {
            const doc = document.documentElement;
            const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);
            const progress = Math.min(window.scrollY / scrollable, 1);
            return Math.min(TOTAL_NODES, Math.round(MIN_VISIBLE + progress * (TOTAL_NODES - MIN_VISIBLE)));
        }

        function step(animate) {
            const count = visibleCount();

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                const target = i < count ? n.targetOpacity : 0;
                n.opacity = animate ? n.opacity + (target - n.opacity) * 0.03 : target;

                if (animate) {
                    n.x += n.vx;
                    n.y += n.vy;
                    if (n.x < 0) n.x = width;
                    if (n.x > width) n.x = 0;
                    if (n.y < 0) n.y = height;
                    if (n.y > height) n.y = 0;
                }
            }

            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < count; i++) {
                for (let j = i + 1; j < count; j++) {
                    const a = nodes[i], b = nodes[j];
                    if (a.opacity < 0.02 || b.opacity < 0.02) continue;
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECT_DIST) {
                        const alpha = (1 - dist / CONNECT_DIST) * Math.min(a.opacity, b.opacity) * 0.5;
                        ctx.strokeStyle = 'rgba(122, 132, 175, ' + alpha + ')';
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.opacity < 0.02) continue;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(158, 168, 210, ' + n.opacity + ')';
                ctx.fill();
            }
        }

        function animate() {
            step(true);
            animationId = requestAnimationFrame(animate);
        }

        window.addEventListener('resize', resize, { passive: true });
        resize();
        initNodes();

        if (reduceMotion) {
            step(false);
        } else {
            animationId = requestAnimationFrame(animate);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNetwork);
    } else {
        initNetwork();
    }
})();
