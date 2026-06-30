/* Bootstrap da aplicação: configura o link da AMES, preenche o ano do
   rodapé e inicializa os módulos (partículas, navegação, animações). */
(function () {
    'use strict';

    // Link do formulário AMES. Vazio ("") exibe um aviso temporário no clique.
    const AMES_FORM_URL = 'https://tally.so/r/zxgZo1';

    function showAmesToast() {
        const toast = document.createElement('div');
        toast.textContent = 'A AMES estará disponível em breve. Entre em contato: contato@scindax.com.br';
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '1rem 2rem',
            borderRadius: '10px',
            fontFamily: 'var(--font-inter)',
            fontSize: '0.85rem',
            border: '1px solid var(--border-subtle)',
            zIndex: '9999',
            opacity: '0',
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
            maxWidth: '90vw',
            textAlign: 'center'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    function configureAmesLinks() {
        document.querySelectorAll('[data-ames-link]').forEach(function (link) {
            if (AMES_FORM_URL) {
                link.href = AMES_FORM_URL;
                link.target = '_blank';
                link.rel = 'noopener';
            } else {
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    showAmesToast();
                });
            }
        });
    }

    function setFooterYear() {
        const el = document.getElementById('currentYear');
        if (el) el.textContent = new Date().getFullYear();
    }

    function boot() {
        configureAmesLinks();
        setFooterYear();
        if (window.ScindaxNavigation) window.ScindaxNavigation.init();
        if (window.ScindaxAnimations) window.ScindaxAnimations.init();
        if (window.ScindaxParticles) window.ScindaxParticles.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
