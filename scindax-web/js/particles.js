/* Sistema de partículas do hero (Canvas 2D).
   Deriva livre, atração/cor de prisma por ângulo do mouse, brilho com
   inércia e explosão radial ao clique. */
(function () {
    'use strict';

    function initParticleField() {
        const container = document.getElementById('heroCanvasContainer');
        if (!container) return;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        let width, height, dpr;
        let particlesArray = [];
        let mouseX = null,
            mouseY = null;
        let mouseActive = false;
        let time = 0;
        let animationId;

        const PARTICLE_COUNT = 2000;
        const MOUSE_RADIUS = 260;
        const ORBIT_RADIUS = 80;
        const GRAVITY_STRENGTH = 0.016;
        const DRIFT_SPEED = 0.12;
        const SIZE_MIN = 0.3;
        const SIZE_MAX = 1.6;

        const darkColors = [
            { r: 60, g: 62, b: 70 },
            { r: 50, g: 52, b: 62 },
            { r: 55, g: 57, b: 67 },
            { r: 65, g: 67, b: 73 }
        ];

        function hslToRgb(h, s, l) {
            h /= 360;
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }
            return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        }

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * DRIFT_SPEED;
                this.vy = (Math.random() - 0.5) * DRIFT_SPEED;
                this.baseSize = Math.random() * (SIZE_MAX - SIZE_MIN) + SIZE_MIN;
                this.size = this.baseSize;
                this.baseColor = darkColors[Math.floor(Math.random() * darkColors.length)];
                this.color = { ...this.baseColor };
                this.baseAlpha = Math.random() * 0.5 + 0.3;
                this.alpha = this.baseAlpha;
                this.glow = 0;
                this.morphFactor = 0;
                this.angle = Math.random() * Math.PI * 2;
                this.explosionLife = 0;
                this.explosionMaxLife = 2.2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.x += Math.sin(this.angle + time * 0.01) * 0.015;
                this.y += Math.cos(this.angle + time * 0.013) * 0.015;

                if (this.x < -30) this.x = width + 30;
                if (this.x > width + 30) this.x = -30;
                if (this.y < -30) this.y = height + 30;
                if (this.y > height + 30) this.y = -30;

                let influence = 0;
                if (mouseActive && mouseX !== null && this.explosionLife <= 0) {
                    const dx = mouseX - this.x;
                    const dy = mouseY - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_RADIUS) {
                        influence = 1 - dist / MOUSE_RADIUS;
                        influence = influence * influence * (3 - 2 * influence);

                        const targetRadius = ORBIT_RADIUS;
                        const radialForce = GRAVITY_STRENGTH * (dist - targetRadius) / targetRadius;
                        this.vx += (dx / dist) * radialForce * influence;
                        this.vy += (dy / dist) * radialForce * influence;
                        this.vx *= 0.997;
                        this.vy *= 0.997;

                        const angle = Math.atan2(dy, dx);
                        const hue = ((angle + Math.PI) / (Math.PI * 2)) * 360;
                        const targetPrismColor = hslToRgb(hue, 0.9, 0.75);
                        const mixSpeed = 0.1;
                        this.color.r += (targetPrismColor.r - this.color.r) * mixSpeed * influence;
                        this.color.g += (targetPrismColor.g - this.color.g) * mixSpeed * influence;
                        this.color.b += (targetPrismColor.b - this.color.b) * mixSpeed * influence;

                        this.size += (this.baseSize + influence * 1.8 - this.size) * 0.08;
                        this.alpha += (this.baseAlpha + influence * 0.5 - this.alpha) * 0.08;
                    }
                }

                this.glow += (influence - this.glow) * 0.07;
                this.morphFactor += (influence - this.morphFactor) * 0.1;

                if (influence < 0.01 && this.explosionLife <= 0) {
                    this.vx *= 0.997;
                    this.vy *= 0.997;
                    this.color.r += (this.baseColor.r - this.color.r) * 0.05;
                    this.color.g += (this.baseColor.g - this.color.g) * 0.05;
                    this.color.b += (this.baseColor.b - this.color.b) * 0.05;
                    this.size += (this.baseSize - this.size) * 0.05;
                    this.alpha += (this.baseAlpha - this.alpha) * 0.05;
                }

                if (this.explosionLife > 0) {
                    this.explosionLife -= 0.013;
                    this.vx *= 0.97;
                    this.vy *= 0.97;
                    const t = Math.max(0, this.explosionLife / this.explosionMaxLife);
                    this.alpha = this.baseAlpha + (this.explosionPeakAlpha - this.baseAlpha) * t;
                    this.size = this.baseSize + (this.explosionPeakSize - this.baseSize) * t;
                    this.color.r += (this.baseColor.r - this.color.r) * 0.04;
                    this.color.g += (this.baseColor.g - this.color.g) * 0.04;
                    this.color.b += (this.baseColor.b - this.color.b) * 0.04;
                    this.glow = Math.max(this.glow, t * 0.85);
                    this.morphFactor = t * 0.7;
                    if (this.explosionLife <= 0) {
                        this.explosionLife = 0;
                        this.morphFactor = 0;
                        this.glow = 0;
                        this.color = { ...this.baseColor };
                        this.alpha = this.baseAlpha;
                    }
                }
            }

            draw(ctx) {
                ctx.save();
                ctx.translate(this.x, this.y);
                if (this.morphFactor > 0.01) {
                    const angle = Math.PI / 4 * this.morphFactor;
                    ctx.rotate(angle);
                    const stretch = 1.0 + this.morphFactor * 1.0;
                    ctx.scale(1.0 / stretch, stretch);
                }
                if (this.glow > 0.05) {
                    ctx.shadowBlur = this.glow * 15;
                    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 1.6})`;
                } else {
                    ctx.shadowBlur = 0;
                }
                ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            explode(originX, originY) {
                const angle = Math.atan2(this.y - originY, this.x - originX) || Math.random() * Math.PI * 2;
                const speed = 1.2 + Math.random() * 3;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.explosionLife = this.explosionMaxLife;
                const hue = Math.random() * 360;
                const prismColor = hslToRgb(hue, 1.0, 0.75);
                this.color = prismColor;
                this.explosionPeakAlpha = 0.9;
                this.explosionPeakSize = this.baseSize + 1.8 + Math.random() * 1.4;
                this.glow = 0.85;
                this.morphFactor = 0.8;
            }
        }

        function initParticles() {
            particlesArray = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particlesArray.push(new Particle());
            }
        }

        function resizeCanvas() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = container.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            initParticles();
        }

        function animate(timestamp) {
            time = timestamp * 0.001;
            ctx.fillStyle = 'rgba(10, 10, 11, 0.14)';
            ctx.fillRect(0, 0, width, height);

            for (let p of particlesArray) {
                p.update();
                p.draw(ctx);
            }
            animationId = requestAnimationFrame(animate);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
            mouseActive = true;
        });
        canvas.addEventListener('mouseleave', () => { mouseActive = false; });
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                mouseX = e.touches[0].clientX - rect.left;
                mouseY = e.touches[0].clientY - rect.top;
                mouseActive = true;
            }
        }, { passive: true });
        canvas.addEventListener('touchend', () => { mouseActive = false; });
        canvas.addEventListener('touchcancel', () => { mouseActive = false; });

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const radius = 200;
            for (let p of particlesArray) {
                const dx = p.x - clickX, dy = p.y - clickY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < radius && Math.random() < 0.55) {
                    p.explode(clickX, clickY);
                }
            }
        });

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        animationId = requestAnimationFrame(animate);
        window.addEventListener('beforeunload', () => { if (animationId) cancelAnimationFrame(animationId); });
    }

    window.ScindaxParticles = { init: initParticleField };
})();
