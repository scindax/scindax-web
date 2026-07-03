/* ============================================================
 * Scindax Lab — botão lateral de entrada
 * Especificação: SCX-SPEC-LAB-001, seção 3.
 *
 * Injeta o botão flutuante no DOM, dispara a animação de
 * "revelação por poeira mágica" 1.5s após o carregamento da
 * página e gera as partículas de brilho ao redor do botão.
 * ============================================================ */
(function () {
    'use strict';

    var REVEAL_DELAY_MS = 1500;
    var PARTICLE_COUNT = 14;
    var PARTICLE_SPREAD_PX = 46;
    var LAB_URL = '/lab/';

    /**
     * Cria e insere o elemento <a> do botão do Lab no final do <body>.
     * @returns {HTMLAnchorElement}
     */
    function criarBotao() {
        var botao = document.createElement('a');
        botao.href = LAB_URL;
        botao.className = 'scx-lab-btn';
        botao.setAttribute('aria-label', 'Scindax Lab — Ferramentas experimentais');
        botao.setAttribute('title', 'Scindax Lab — Ferramentas experimentais');

        var icone = document.createElement('span');
        icone.setAttribute('aria-hidden', 'true');
        icone.textContent = '✨';

        var rotulo = document.createElement('span');
        rotulo.className = 'scx-lab-btn-label';
        rotulo.textContent = 'Lab';

        botao.appendChild(icone);
        botao.appendChild(rotulo);
        document.body.appendChild(botao);
        return botao;
    }

    /**
     * Gera partículas de "poeira mágica" ao redor do botão, cada uma
     * com direção e atraso aleatórios, removendo-as do DOM ao final
     * da própria animação CSS.
     * @param {HTMLElement} botao
     */
    function emitirParticulas(botao) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        var rect = botao.getBoundingClientRect();
        var centroX = rect.left + rect.width / 2;
        var centroY = rect.top + rect.height / 2;

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            criarParticula(centroX, centroY, i);
        }
    }

    /**
     * Cria uma única partícula posicionada no centro do botão e a
     * anima em uma direção aleatória dentro de um círculo.
     * @param {number} centroX
     * @param {number} centroY
     * @param {number} indice usado para escalonar o atraso de disparo
     */
    function criarParticula(centroX, centroY, indice) {
        var angulo = Math.random() * Math.PI * 2;
        var distancia = PARTICLE_SPREAD_PX * (0.5 + Math.random() * 0.5);
        var deslocamentoX = Math.cos(angulo) * distancia;
        var deslocamentoY = Math.sin(angulo) * distancia;

        var particula = document.createElement('span');
        particula.className = 'scx-lab-particle';
        particula.style.left = centroX + 'px';
        particula.style.top = centroY + 'px';
        particula.style.setProperty('--scx-dx', deslocamentoX + 'px');
        particula.style.setProperty('--scx-dy', deslocamentoY + 'px');
        particula.style.animationDelay = (indice * 25) + 'ms';

        document.body.appendChild(particula);

        // Remove a partícula do DOM assim que a animação termina, evitando acúmulo de nós.
        particula.addEventListener('animationend', function () {
            particula.remove();
        });
    }

    /**
     * Dispara a revelação: adiciona a classe que ativa a animação CSS
     * do botão e emite as partículas de brilho ao redor dele.
     * @param {HTMLElement} botao
     */
    function revelar(botao) {
        botao.classList.add('scx-lab-btn--visible');
        emitirParticulas(botao);
    }

    function iniciar() {
        var botao = criarBotao();
        window.setTimeout(function () {
            revelar(botao);
        }, REVEAL_DELAY_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
