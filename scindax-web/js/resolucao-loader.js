/* Cards de "Em correção" na listagem de Insights.
   Lê insights/EM_RESOLUCAO.txt (lista de posts com problema conhecido,
   mantida manualmente) e, pra cada slug listado, injeta um card padrão
   avisando que aquele conteúdo está temporariamente indisponível —
   sem link pra página real, até o problema ser resolvido. Espelha o
   mesmo mecanismo de js/tnp-loader.js (mesma lógica, sentido inverso:
   aqui a página já existe, só não deve ser promovida enquanto o
   problema não for corrigido). Assim que a linha sair da lista, o card
   padrão some sozinho — não é preciso mexer em insights/index.html. */
(function () {
    'use strict';

    const URL_LISTA_RESOLUCAO = '/insights/EM_RESOLUCAO.txt';
    const EXCERPT_PADRAO = 'Este conteúdo está temporariamente indisponível enquanto corrigimos um problema técnico. Volte em breve.';

    /**
     * @param {string} linha
     * @returns {{ slug: string, titulo: string, motivo: string } | null}
     */
    function interpretarLinha(linha) {
        const bruta = linha.trim();
        if (!bruta || bruta.startsWith('#')) return null;

        const partes = bruta.split('|');
        const slug = partes[0].trim();
        if (!slug) return null;

        const titulo = partes[1] ? partes[1].trim() : slug;
        const motivo = partes[2] ? partes[2].trim() : EXCERPT_PADRAO;
        return { slug, titulo, motivo };
    }

    function criarCardResolucao(item) {
        const article = document.createElement('article');
        article.className = 'insight-card is-resolving';
        article.setAttribute('data-resolucao-slug', item.slug);

        const bg = document.createElement('div');
        bg.className = 'tnp-card-bg';
        bg.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'tnp-card-content';
        content.innerHTML =
            '<div class="tnp-live-badge"><span class="tnp-live-dot" aria-hidden="true"></span>Em correção</div>' +
            '<div class="tnp-spinner-wrap"><div class="tnp-spinner"></div></div>' +
            '<h2 class="insight-card-title"></h2>' +
            '<p class="insight-card-excerpt"></p>';
        content.querySelector('.insight-card-title').textContent = item.titulo;
        content.querySelector('.insight-card-excerpt').textContent = item.motivo;

        article.appendChild(bg);
        article.appendChild(content);
        return article;
    }

    /** Remove o card real do mesmo slug, se já existir estático no HTML,
     * pra nunca mostrar os dois (o de correção e o normal) ao mesmo tempo. */
    function removerCardRealSeExistir(track, slug) {
        const links = track.querySelectorAll(
            '.insight-card:not([data-scx-clone]) a.insight-version-link[href*="/insights/' + slug + '/"]'
        );
        links.forEach(function (link) {
            const card = link.closest('.insight-card');
            if (card && !card.hasAttribute('data-resolucao-slug')) card.remove();
        });
    }

    async function iniciar() {
        const track = document.getElementById('insightsTrack');
        if (!track) return;

        let texto;
        try {
            const resposta = await fetch(URL_LISTA_RESOLUCAO, { cache: 'no-store' });
            if (!resposta.ok) return;
            texto = await resposta.text();
        } catch (erro) {
            return;
        }

        const itens = texto.split('\n').map(interpretarLinha).filter(Boolean);
        if (itens.length === 0) return;

        itens.forEach(function (item) {
            removerCardRealSeExistir(track, item.slug);
            track.appendChild(criarCardResolucao(item));
        });

        if (window.ScxInsightsCarousel && typeof window.ScxInsightsCarousel.refresh === 'function') {
            window.ScxInsightsCarousel.refresh();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
