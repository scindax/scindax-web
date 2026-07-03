/* ============================================================
 * Scindax Lab — página de apresentação
 * Especificação: SCX-SPEC-LAB-001, seção 4.3.
 *
 * Responsável apenas pela transição de "cortina" ao clicar em
 * um botão de acesso a uma ferramenta do Lab, mantendo a
 * sensação de experiência mágica entre as páginas.
 * ============================================================ */
(function () {
    'use strict';

    var DURACAO_TRANSICAO_MS = 380;

    /**
     * Cria a camada de cortina (inicialmente transparente) e a
     * insere no final do <body>.
     * @returns {HTMLElement}
     */
    function criarCortina() {
        var cortina = document.createElement('div');
        cortina.className = 'lab-curtain';
        document.body.appendChild(cortina);
        return cortina;
    }

    /**
     * Intercepta o clique nos botões de acesso às ferramentas do Lab
     * para exibir a transição de cortina antes de navegar.
     * @param {HTMLElement} cortina
     */
    function ativarTransicaoDeSaida(cortina) {
        var botoesDeAcesso = document.querySelectorAll('.lab-tool-btn');

        botoesDeAcesso.forEach(function (botao) {
            botao.addEventListener('click', function (evento) {
                var destino = botao.getAttribute('href');
                if (!destino) {
                    return;
                }

                evento.preventDefault();
                cortina.classList.add('lab-curtain--active');

                window.setTimeout(function () {
                    window.location.href = destino;
                }, DURACAO_TRANSICAO_MS);
            });
        });
    }

    function iniciar() {
        var cortina = criarCortina();
        ativarTransicaoDeSaida(cortina);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
