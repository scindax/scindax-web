/* ============================================================
 * gamify-widget.js — Widget flutuante da série "SCX Na Prática"
 *
 * Opt-in: só ativa em páginas que já tenham o checklist interativo
 * (#tutorialChecklist). Não duplica conteúdo — lê os títulos dos
 * passos direto do DOM já existente e escuta o evento
 * "tutorialProgress" disparado por js/tutorial-checklist.js, então
 * há uma única fonte de verdade sobre o progresso.
 *
 * Dois estados visuais, com a mesma linguagem do botão do Scindax
 * Lab (revelação por brilho, formato circular):
 *   1) Inline, no topo do artigo — card com botão de abrir o painel.
 *   2) Flutuante, canto inferior direito — reaparece assim que o
 *      card do topo sai da tela (IntersectionObserver), respirando
 *      e balançando continuamente até ser clicado.
 * ============================================================ */
(function () {
    'use strict';

    function iniciar() {
        const checklist = document.getElementById('tutorialChecklist');
        const ancoraTopo = document.querySelector('.article-audience');
        if (!checklist || !ancoraTopo) return;

        const passos = coletarPassos(checklist);
        if (!passos.length) return;

        const cardInline = criarCardInline();
        ancoraTopo.insertAdjacentElement('afterend', cardInline);

        const botaoFlutuante = criarBotaoFlutuante();
        document.body.appendChild(botaoFlutuante);

        const painel = criarPainel(passos);
        document.body.appendChild(painel);

        ligarAberturaDoPainel(cardInline, botaoFlutuante, painel);
        ligarTransicaoDeEstado(cardInline, botaoFlutuante);
        ligarSincroniaDeProgresso(checklist, painel, botaoFlutuante);
        revelarCardInline(cardInline);
    }

    /**
     * Lê os títulos dos passos já renderizados no checklist real do
     * post, para o painel do widget espelhar sem duplicar conteúdo.
     * @param {HTMLElement} checklist
     * @returns {Array<{ titulo: string, elemento: HTMLElement }>}
     */
    function coletarPassos(checklist) {
        return Array.prototype.slice.call(checklist.querySelectorAll('.tutorial-step')).map(function (step) {
            const titulo = step.querySelector('.tutorial-step-title');
            return { titulo: titulo ? titulo.textContent.trim() : '', elemento: step };
        });
    }

    function criarCardInline() {
        const card = document.createElement('div');
        card.className = 'gamify-widget-inline';
        card.id = 'gamifyInlineCard';
        card.innerHTML =
            '<span class="gamify-widget-inline-icon" aria-hidden="true">🎮</span>' +
            '<span class="gamify-widget-inline-text">' +
            '<strong>Este post é um desafio interativo.</strong> Acompanhe seu progresso e desbloqueie o Selo SCX Builder ao final.' +
            '</span>' +
            '<button type="button" class="gamify-widget-inline-btn" id="gamifyInlineBtn">Abrir painel de progresso</button>';
        return card;
    }

    function criarBotaoFlutuante() {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'gamify-widget-fab';
        botao.id = 'gamifyFloatingBtn';
        botao.setAttribute('aria-label', 'Abrir painel de progresso do desafio');
        botao.setAttribute('title', 'Progresso do desafio');
        botao.innerHTML = '<span aria-hidden="true">🎮</span>';
        return botao;
    }

    /**
     * Monta o painel compacto: barra de progresso, lista somente
     * leitura dos passos (clicar rola até o passo real no artigo) e
     * uma chamada para o selo quando tudo estiver concluído.
     * @param {Array<{ titulo: string, elemento: HTMLElement }>} passos
     */
    function criarPainel(passos) {
        const painel = document.createElement('div');
        painel.className = 'gamify-widget-panel';
        painel.id = 'gamifyPanel';
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-label', 'Progresso do desafio interativo');

        const itens = passos.map(function (passo, indice) {
            return '<li class="gamify-panel-item" data-gamify-index="' + indice + '">' +
                '<span class="gamify-panel-item-check" aria-hidden="true"></span>' +
                '<span class="gamify-panel-item-title">' + passo.titulo + '</span>' +
                '</li>';
        }).join('');

        painel.innerHTML =
            '<div class="gamify-panel-header">' +
            '<span>Seu progresso</span>' +
            '<button type="button" class="gamify-panel-close" id="gamifyPanelClose" aria-label="Fechar painel">✕</button>' +
            '</div>' +
            '<div class="gamify-panel-track"><div class="gamify-panel-fill" id="gamifyPanelFill"></div></div>' +
            '<p class="gamify-panel-status" id="gamifyPanelStatus">Começando</p>' +
            '<ul class="gamify-panel-list" id="gamifyPanelList">' + itens + '</ul>' +
            '<a href="#tutorialBadgeSection" class="gamify-panel-reward" id="gamifyPanelReward" hidden>🏆 Selo pronto, ver selo →</a>';

        painel.querySelectorAll('.gamify-panel-item').forEach(function (item, indice) {
            item.addEventListener('click', function () {
                passos[indice].elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        return painel;
    }

    function ligarAberturaDoPainel(cardInline, botaoFlutuante, painel) {
        const fechar = painel.querySelector('#gamifyPanelClose');
        const abrir = function () { painel.classList.add('gamify-widget-panel--open'); };
        const esconder = function () { painel.classList.remove('gamify-widget-panel--open'); };

        cardInline.querySelector('#gamifyInlineBtn').addEventListener('click', abrir);
        botaoFlutuante.addEventListener('click', abrir);
        fechar.addEventListener('click', esconder);

        document.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape') esconder();
        });
    }

    /**
     * Alterna entre o card inline (topo) e o botão flutuante (canto
     * inferior direito) conforme o card do topo entra/sai da tela.
     */
    function ligarTransicaoDeEstado(cardInline, botaoFlutuante) {
        const observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                botaoFlutuante.classList.toggle('gamify-widget-fab--visible', !entrada.isIntersecting);
            });
        }, { threshold: 0 });

        observador.observe(cardInline);
    }

    /**
     * Escuta o evento "tutorialProgress" disparado pelo checklist real
     * (js/tutorial-checklist.js) e mantém o painel e o botão flutuante
     * sincronizados, sem reimplementar a contagem de passos concluídos.
     */
    function ligarSincroniaDeProgresso(checklist, painel, botaoFlutuante) {
        const preenchimento = painel.querySelector('#gamifyPanelFill');
        const status = painel.querySelector('#gamifyPanelStatus');
        const recompensa = painel.querySelector('#gamifyPanelReward');
        const itensDoPainel = Array.prototype.slice.call(painel.querySelectorAll('.gamify-panel-item'));
        const passosReais = Array.prototype.slice.call(checklist.querySelectorAll('.tutorial-step'));

        const FAIXAS = [
            { min: 0, texto: 'Começando' },
            { min: 34, texto: 'Pegando ritmo' },
            { min: 67, texto: 'Quase lá' },
            { min: 100, texto: 'Concluído' }
        ];

        checklist.addEventListener('tutorialProgress', function (evento) {
            const pct = evento.detail.pct;

            preenchimento.style.width = pct + '%';

            let rotulo = FAIXAS[0].texto;
            FAIXAS.forEach(function (faixa) { if (pct >= faixa.min) rotulo = faixa.texto; });
            status.textContent = rotulo;

            itensDoPainel.forEach(function (item, indice) {
                const concluido = passosReais[indice] && passosReais[indice].classList.contains('is-done');
                item.classList.toggle('gamify-panel-item--done', Boolean(concluido));
            });

            const completo = pct === 100;
            recompensa.hidden = !completo;
            botaoFlutuante.classList.toggle('gamify-widget-fab--completo', completo);
        });
    }

    /** Revela o card do topo com a mesma linguagem visual do botão do Lab. */
    function revelarCardInline(cardInline) {
        window.requestAnimationFrame(function () {
            cardInline.classList.add('gamify-widget-inline--visible');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
