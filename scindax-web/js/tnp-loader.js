/* Cards de "Título Não Postado" (TNP) na listagem de Insights.
   Lê insights/TNP_POP.txt (lista de posts futuros mantida manualmente)
   e, para cada slug que ainda não tem página real publicada, injeta um
   card de placeholder "em produção" na track do carrossel. Assim que a
   página passa a existir de fato, o card correspondente some sozinho —
   não é preciso editar a lista na hora de publicar. */
(function () {
    'use strict';

    const URL_LISTA_TNP = '/insights/TNP_POP.txt';

    /**
     * @param {string} linha
     * @returns {{ slug: string, titulo: string } | null}
     */
    function interpretarLinha(linha) {
        const bruta = linha.trim();
        if (!bruta || bruta.startsWith('#')) return null;

        const partes = bruta.split('|');
        const slug = partes[0].trim();
        if (!slug) return null;

        const titulo = partes[1] ? partes[1].trim() : sluglizarParaTitulo(slug);
        return { slug, titulo };
    }

    function sluglizarParaTitulo(slug) {
        return slug
            .split('-')
            .filter(Boolean)
            .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
            .join(' ');
    }

    /**
     * Verifica se /insights/<slug>/ já existe como página publicada.
     * Em caso de falha de rede na própria checagem, assume que "já existe"
     * (fail-safe): é preferível deixar de mostrar um card TNP a arriscar
     * duplicar um artigo que na verdade já foi publicado.
     * @param {string} slug
     * @returns {Promise<boolean>}
     */
    async function jaPublicado(slug) {
        try {
            const resposta = await fetch('/insights/' + encodeURIComponent(slug) + '/', {
                method: 'HEAD',
                cache: 'no-store'
            });
            return resposta.ok;
        } catch (erro) {
            return true;
        }
    }

    function criarCardTnp(item) {
        const article = document.createElement('article');
        article.className = 'insight-card is-tnp';

        const bg = document.createElement('div');
        bg.className = 'tnp-card-bg';
        bg.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'tnp-card-content';
        content.innerHTML =
            '<div class="tnp-live-badge"><span class="tnp-live-dot" aria-hidden="true"></span>Em produção</div>' +
            '<div class="tnp-spinner-wrap"><div class="tnp-spinner"></div></div>' +
            '<h2 class="insight-card-title"></h2>' +
            '<p class="insight-card-excerpt">Esse conteúdo está sendo escrito pela nossa equipe agora. Volte em breve para conferir.</p>' +
            '<div class="tnp-progress"><div class="tnp-progress-fill"></div></div>';
        content.querySelector('.insight-card-title').textContent = item.titulo;

        article.appendChild(bg);
        article.appendChild(content);
        return article;
    }

    async function iniciar() {
        const track = document.getElementById('insightsTrack');
        if (!track) return;

        let texto;
        try {
            const resposta = await fetch(URL_LISTA_TNP, { cache: 'no-store' });
            if (!resposta.ok) return;
            texto = await resposta.text();
        } catch (erro) {
            return;
        }

        const itens = texto.split('\n').map(interpretarLinha).filter(Boolean);
        if (itens.length === 0) return;

        const verificacoes = await Promise.all(itens.map(async (item) => ({
            item,
            publicado: await jaPublicado(item.slug)
        })));

        const pendentes = verificacoes.filter((v) => !v.publicado).map((v) => v.item);
        if (pendentes.length === 0) return;

        pendentes.forEach((item) => track.appendChild(criarCardTnp(item)));

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
