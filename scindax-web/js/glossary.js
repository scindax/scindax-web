/* ============================================================
 * glossary.js — Dicionário interno de termos técnicos
 *
 * Opt-in: só ativa se houver ao menos um elemento
 * .glossary-term[data-term] na página. Dois recursos:
 *   1) Tooltip acessível ao passar o mouse ou focar (teclado) em
 *      um termo marcado no corpo do artigo.
 *   2) Painel lateral alternável, fixo à direita e centralizado
 *      verticalmente, listando só os termos que aparecem nesta
 *      página (CSS esconde o painel em telas estreitas — sobra
 *      só o tooltip inline).
 * ============================================================ */
(function () {
    'use strict';

    // Dicionário central. Só os termos efetivamente usados na página
    // (via data-term) entram no painel — nada de lista fixa e genérica.
    const DICIONARIO = {
        worker: 'Função que roda na borda da rede (perto de quem está usando o site), em vez de em um servidor central único.',
        kv: 'Um "banco de dados" bem simples, de chave e valor, feito para leituras rápidas — aqui guarda contador de uso e sugestões já calculadas.',
        turnstile: 'Verificação que confirma que quem está usando o site é uma pessoa, não um robô, sem exigir que a pessoa resolva um desafio visual.',
        edge: 'Borda da rede: os pontos mais próximos do usuário final, em vez de um servidor central único e distante.',
        hash: 'Um "resumo" curto e único gerado a partir de um texto, usado aqui para não pedir a mesma resposta duas vezes à IA.',
        arraybuffer: 'Formato de dados binário bruto usado para ler o conteúdo de um arquivo diretamente no navegador.',
        cors: 'Regra de segurança do navegador que decide quais sites têm permissão para chamar uma API a partir de outro domínio.',
        fallback: 'Um plano B automático, acionado quando a opção principal falha, para o sistema continuar funcionando.',
        cache: 'Guardar uma resposta já calculada para reaproveitar depois, evitando refazer o mesmo trabalho (ou pagar por ele de novo).',
        binding: 'A ligação, configurada no painel, entre o código do Worker e um recurso externo (como o banco KV ou o modelo de IA).',
        ttl: 'Tempo de vida de um dado guardado, depois do qual ele expira e é descartado automaticamente.',
        sanitização: 'Processo de limpar um texto, removendo caracteres inválidos ou perigosos, antes de usá-lo ou exibi-lo.'
    };

    function iniciar() {
        const termos = Array.prototype.slice.call(document.querySelectorAll('.glossary-term[data-term]'));
        if (!termos.length) return;

        const tooltip = criarTooltip();
        document.body.appendChild(tooltip);
        prepararTermos(termos, tooltip);

        const termosUnicos = coletarTermosUnicos(termos);
        if (!termosUnicos.length) return;

        const painel = criarPainel(termosUnicos);
        document.body.appendChild(painel);

        const alternador = criarAlternador();
        document.body.appendChild(alternador);

        alternador.addEventListener('click', function () {
            const aberto = painel.classList.toggle('glossary-panel--open');
            alternador.setAttribute('aria-expanded', String(aberto));
        });
    }

    /**
     * Torna cada termo focável e acessível, e liga os eventos de
     * hover/foco que mostram o tooltip posicionado dinamicamente.
     */
    function prepararTermos(termos, tooltip) {
        termos.forEach(function (termo, indice) {
            const chave = normalizarChave(termo.getAttribute('data-term'));
            const definicao = DICIONARIO[chave];
            if (!definicao) return;

            termo.tabIndex = 0;
            termo.setAttribute('role', 'button');
            const idTooltip = 'glossaryTooltip';
            termo.setAttribute('aria-describedby', idTooltip);

            const mostrar = function () { posicionarEExibirTooltip(tooltip, termo, definicao); };
            const esconder = function () { tooltip.classList.remove('glossary-tooltip--visible'); };

            termo.addEventListener('mouseenter', mostrar);
            termo.addEventListener('mouseleave', esconder);
            termo.addEventListener('focus', mostrar);
            termo.addEventListener('blur', esconder);
        });
    }

    function criarTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'glossaryTooltip';
        tooltip.className = 'glossary-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        return tooltip;
    }

    /**
     * Posiciona o tooltip acima do termo, com JS (não só CSS), para
     * poder corrigir o alinhamento perto das bordas da tela.
     */
    function posicionarEExibirTooltip(tooltip, termo, definicao) {
        tooltip.textContent = definicao;
        tooltip.classList.add('glossary-tooltip--visible');

        const retanguloTermo = termo.getBoundingClientRect();
        const larguraTooltip = tooltip.offsetWidth;

        let esquerda = retanguloTermo.left + retanguloTermo.width / 2 - larguraTooltip / 2;
        const margemMinima = 12;
        esquerda = Math.max(margemMinima, Math.min(esquerda, window.innerWidth - larguraTooltip - margemMinima));

        tooltip.style.left = esquerda + 'px';
        tooltip.style.top = (retanguloTermo.top + window.scrollY - tooltip.offsetHeight - 10) + 'px';
    }

    function coletarTermosUnicos(termos) {
        const vistos = new Set();
        const resultado = [];

        termos.forEach(function (termo) {
            const chave = normalizarChave(termo.getAttribute('data-term'));
            if (vistos.has(chave) || !DICIONARIO[chave]) return;
            vistos.add(chave);
            resultado.push({ chave: chave, rotulo: termo.textContent.trim(), definicao: DICIONARIO[chave] });
        });

        return resultado;
    }

    function criarPainel(termosUnicos) {
        const painel = document.createElement('aside');
        painel.className = 'glossary-panel';
        painel.id = 'glossaryPanel';
        painel.setAttribute('aria-label', 'Glossário de termos técnicos deste artigo');

        const itens = termosUnicos.map(function (termo) {
            return '<li><strong>' + termo.rotulo + '</strong><span>' + termo.definicao + '</span></li>';
        }).join('');

        painel.innerHTML = '<h2 class="glossary-panel-title">Glossário</h2><ul class="glossary-panel-list">' + itens + '</ul>';
        return painel;
    }

    function criarAlternador() {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'glossary-toggle';
        botao.id = 'glossaryToggle';
        botao.setAttribute('aria-expanded', 'false');
        botao.setAttribute('aria-controls', 'glossaryPanel');
        botao.setAttribute('title', 'Mostrar ou esconder o glossário');
        botao.innerHTML = '<span aria-hidden="true">📖</span>';
        return botao;
    }

    function normalizarChave(chave) {
        return (chave || '').trim().toLowerCase();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
