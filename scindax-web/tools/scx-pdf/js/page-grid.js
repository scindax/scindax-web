/* ============================================================
 * page-grid.js — Grade de miniaturas
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("page-grid.js").
 * Interações: SCX-SPEC-UX-001, seções 2.2 a 2.4.
 *
 * Renderiza as miniaturas das páginas carregadas (com lazy
 * loading), e gerencia seleção, exclusão e reordenação via
 * arrastar-e-soltar (SortableJS). É a fonte da verdade sobre a
 * ordem e seleção atuais enquanto a grade está na tela.
 * ============================================================ */

const LARGURA_MINIATURA_PX = 220; // resolução de renderização do canvas; o CSS controla o tamanho exibido

export class PageGrid extends EventTarget {
    /**
     * @param {{ elementoGrid: HTMLElement, elementoVazio: HTMLElement }} elementos
     */
    constructor(elementos) {
        super();
        this.elementoGrid = elementos.elementoGrid;
        this.elementoVazio = elementos.elementoVazio;

        /** @type {Array<{ id: string, fileId: string, indiceOriginal: number, selecionada: boolean }>} */
        this.paginas = [];
        /** @type {Map<string, { id: string, nome: string, documentoPdfJs: any }>} */
        this.registroArquivos = new Map();

        this.ultimoIndiceClicado = null;

        this._criarObservadorDeInterseccao();
        this._criarSortable();
    }

    /**
     * Configura o IntersectionObserver responsável pelo lazy loading:
     * a miniatura só é desenhada no canvas quando o card entra na
     * área visível (SCX-SPEC-IMP-001, seção 5 — Performance).
     */
    _criarObservadorDeInterseccao() {
        this.observador = new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    this._renderizarMiniatura(entrada.target);
                    this.observador.unobserve(entrada.target);
                }
            });
        }, { rootMargin: '200px 0px' });
    }

    /**
     * Inicializa o SortableJS sobre o container da grade, permitindo
     * reordenar os cards por arrastar-e-soltar (com suporte a toque).
     */
    _criarSortable() {
        this.sortable = new window.Sortable(this.elementoGrid, {
            animation: 180,
            filter: 'input[type="checkbox"]',
            preventOnFilter: false,
            ghostClass: 'scx-page-card--ghost',
            chosenClass: 'scx-page-card--dragging',
            onEnd: () => this._sincronizarOrdemComDom()
        });
    }

    /**
     * Adiciona páginas de arquivos recém-carregados ao final da grade,
     * mesclando o registro de arquivos (necessário para renderizar as
     * miniaturas e exibir o nome de origem de cada página).
     * @param {Array<{ id: string, fileId: string, indiceOriginal: number }>} novasPaginas
     * @param {Map<string, any>} novoRegistroArquivos
     */
    adicionarPaginas(novasPaginas, novoRegistroArquivos) {
        novoRegistroArquivos.forEach((arquivo, idArquivo) => this.registroArquivos.set(idArquivo, arquivo));
        this.paginas = this.paginas.concat(
            novasPaginas.map((pagina) => ({ ...pagina, selecionada: false }))
        );
        this._renderizar();
    }

    /**
     * Retorna uma cópia leve e serializável do estado atual (ordem e
     * seleção), usada pelo app.js para montar snapshots do undo-manager
     * e para saber quais páginas incluir ao gerar o PDF final.
     * @returns {Array<{ id: string, fileId: string, indiceOriginal: number, selecionada: boolean }>}
     */
    obterEstado() {
        return this.paginas.map((pagina) => ({ ...pagina }));
    }

    /**
     * Restaura um estado previamente salvo (usado pelo Undo/Redo).
     * O registro de arquivos é preservado, pois os binários carregados
     * não são afetados por mudanças de ordem/seleção/exclusão.
     * @param {Array<{ id: string, fileId: string, indiceOriginal: number, selecionada: boolean }>} estado
     */
    restaurarEstado(estado) {
        this.paginas = estado.map((pagina) => ({ ...pagina }));
        this._renderizar();
    }

    /** @returns {string[]} ids das páginas atualmente selecionadas */
    obterIdsSelecionados() {
        return this.paginas.filter((pagina) => pagina.selecionada).map((pagina) => pagina.id);
    }

    /** Marca todas as páginas como selecionadas e notifica os ouvintes. */
    selecionarTodas() {
        this.paginas.forEach((pagina) => { pagina.selecionada = true; });
        this._atualizarClassesDeSelecao();
        this._notificarSelecao();
    }

    /** Desmarca todas as páginas e notifica os ouvintes. */
    desmarcarTodas() {
        this.paginas.forEach((pagina) => { pagina.selecionada = false; });
        this._atualizarClassesDeSelecao();
        this._notificarSelecao();
    }

    /** Inverte a ordem de todas as páginas da grade e re-renderiza. */
    inverterOrdem() {
        this.paginas.reverse();
        this._renderizar();
        this.dispatchEvent(new CustomEvent('pageReordered', { detail: { estado: this.obterEstado() } }));
    }

    /** Remove todas as páginas e limpa o registro de arquivos carregados. */
    limparTudo() {
        this.paginas = [];
        this.registroArquivos.clear();
        this._renderizar();
    }

    /**
     * Remove as páginas informadas com uma animação de saída (fade +
     * escala) antes de retirá-las do DOM e do estado interno.
     * @param {string[]} idsParaRemover
     */
    async removerPaginas(idsParaRemover) {
        const conjuntoIds = new Set(idsParaRemover);
        const cards = Array.from(this.elementoGrid.querySelectorAll('.scx-page-card'))
            .filter((card) => conjuntoIds.has(card.dataset.id));

        await Promise.all(cards.map((card) => this._animarSaida(card)));

        this.paginas = this.paginas.filter((pagina) => !conjuntoIds.has(pagina.id));
        this._renderizar();
        this.dispatchEvent(new CustomEvent('pageDeleted', { detail: { estado: this.obterEstado() } }));
    }

    /**
     * Aplica a classe de animação de remoção e resolve a Promise
     * quando a transição CSS termina (com um tempo limite de segurança).
     * @param {HTMLElement} card
     * @returns {Promise<void>}
     */
    _animarSaida(card) {
        return new Promise((resolver) => {
            card.classList.add('scx-page-card--removing');
            const finalizar = () => resolver();
            card.addEventListener('transitionend', finalizar, { once: true });
            window.setTimeout(finalizar, 320); // tempo limite de segurança, caso o evento não dispare
        });
    }

    /**
     * Após um arrastar-e-soltar, lê a ordem atual dos cards no DOM
     * (já reorganizada pelo SortableJS) e sincroniza o array interno.
     */
    _sincronizarOrdemComDom() {
        const idsNaOrdemDoDom = Array.from(this.elementoGrid.querySelectorAll('.scx-page-card'))
            .map((card) => card.dataset.id);

        const mapaPorId = new Map(this.paginas.map((pagina) => [pagina.id, pagina]));
        this.paginas = idsNaOrdemDoDom.map((id) => mapaPorId.get(id));

        this._atualizarNumerosDePagina();
        this.dispatchEvent(new CustomEvent('pageReordered', { detail: { estado: this.obterEstado() } }));
    }

    /** Reconstrói toda a grade a partir do estado interno atual (this.paginas). */
    _renderizar() {
        this.elementoGrid.innerHTML = '';

        this.paginas.forEach((pagina, indice) => {
            const card = this._criarCard(pagina, indice);
            this.elementoGrid.appendChild(card);
            this.observador.observe(card);
        });

        this.elementoVazio.hidden = this.paginas.length > 0;
    }

    /**
     * Cria o elemento DOM de um card de página, com checkbox, canvas
     * (miniatura ainda não desenhada) e metadados de origem.
     * @param {{ id: string, fileId: string, indiceOriginal: number, selecionada: boolean }} pagina
     * @param {number} indice posição atual da página na grade
     * @returns {HTMLElement}
     */
    _criarCard(pagina, indice) {
        const arquivo = this.registroArquivos.get(pagina.fileId);

        const card = document.createElement('div');
        card.className = 'scx-page-card' + (pagina.selecionada ? ' scx-page-card--selected' : '');
        card.dataset.id = pagina.id;
        card.setAttribute('role', 'listitem');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'scx-page-checkbox';
        checkbox.checked = pagina.selecionada;
        checkbox.setAttribute('aria-label', `Selecionar página ${indice + 1}`);
        checkbox.addEventListener('click', (evento) => this._aoClicarCheckbox(evento, pagina.id, indice));

        const canvas = document.createElement('canvas');
        canvas.className = 'scx-page-thumb';

        const meta = document.createElement('div');
        meta.className = 'scx-page-meta';

        const numeroPagina = document.createElement('span');
        numeroPagina.className = 'scx-page-number';
        numeroPagina.textContent = `Página ${indice + 1}`;

        const origem = document.createElement('span');
        origem.className = 'scx-page-origin';
        origem.textContent = arquivo ? arquivo.nome : '';
        origem.title = arquivo ? `${arquivo.nome} · página original ${pagina.indiceOriginal + 1}` : '';

        meta.appendChild(numeroPagina);
        meta.appendChild(origem);
        card.appendChild(checkbox);
        card.appendChild(canvas);
        card.appendChild(meta);

        return card;
    }

    /**
     * Lida com o clique em uma checkbox de página, incluindo o suporte
     * a Shift + Clique para seleção por intervalo (SCX-SPEC-UX-001,
     * seção 2.4 — funcionalidade avançada bônus).
     * @param {MouseEvent} evento
     * @param {string} idPagina
     * @param {number} indice
     */
    _aoClicarCheckbox(evento, idPagina, indice) {
        const marcado = evento.target.checked;

        if (evento.shiftKey && this.ultimoIndiceClicado !== null) {
            const inicio = Math.min(this.ultimoIndiceClicado, indice);
            const fim = Math.max(this.ultimoIndiceClicado, indice);
            for (let i = inicio; i <= fim; i++) {
                this.paginas[i].selecionada = marcado;
            }
        } else {
            const pagina = this.paginas.find((item) => item.id === idPagina);
            pagina.selecionada = marcado;
        }

        this.ultimoIndiceClicado = indice;
        this._atualizarClassesDeSelecao();
        this._notificarSelecao();
    }

    /** Atualiza a classe visual de destaque e o estado da checkbox de cada card. */
    _atualizarClassesDeSelecao() {
        this.elementoGrid.querySelectorAll('.scx-page-card').forEach((card) => {
            const pagina = this.paginas.find((item) => item.id === card.dataset.id);
            card.classList.toggle('scx-page-card--selected', Boolean(pagina?.selecionada));
            const checkbox = card.querySelector('.scx-page-checkbox');
            if (checkbox) {
                checkbox.checked = Boolean(pagina?.selecionada);
            }
        });
    }

    /** Atualiza apenas o rótulo "Página N" de cada card após uma reordenação. */
    _atualizarNumerosDePagina() {
        this.elementoGrid.querySelectorAll('.scx-page-card').forEach((card, indice) => {
            const numero = card.querySelector('.scx-page-number');
            if (numero) {
                numero.textContent = `Página ${indice + 1}`;
            }
        });
    }

    _notificarSelecao() {
        this.dispatchEvent(new CustomEvent('selectionChanged', {
            detail: { selecionadas: this.obterIdsSelecionados(), total: this.paginas.length }
        }));
    }

    /**
     * Desenha a miniatura de uma página no canvas do card, usando
     * PDF.js. Só é chamado quando o card entra na área visível.
     * @param {HTMLElement} card
     */
    async _renderizarMiniatura(card) {
        const pagina = this.paginas.find((item) => item.id === card.dataset.id);
        const arquivo = pagina && this.registroArquivos.get(pagina.fileId);
        const canvas = card.querySelector('canvas.scx-page-thumb');

        if (!pagina || !arquivo || !canvas) {
            return;
        }

        try {
            const paginaPdfJs = await arquivo.documentoPdfJs.getPage(pagina.indiceOriginal + 1);
            const escala = LARGURA_MINIATURA_PX / paginaPdfJs.getViewport({ scale: 1 }).width;
            const viewport = paginaPdfJs.getViewport({ scale: escala });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const contexto = canvas.getContext('2d');
            await paginaPdfJs.render({ canvasContext: contexto, viewport }).promise;
        } catch (erro) {
            // Falha isolada de uma miniatura não deve interromper as demais.
            console.error('Falha ao renderizar miniatura da página', erro);
        }
    }
}
