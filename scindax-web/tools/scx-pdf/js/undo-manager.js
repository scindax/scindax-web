/* ============================================================
 * undo-manager.js — Histórico de ações (padrão Memento)
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("undo-manager.js").
 * Regras: SCX-SPEC-UX-001, seção 2.5.
 *
 * Registra "fotografias" (mementos) do estado da grade de páginas
 * a cada ação relevante (mover, excluir, inverter ordem), permitindo
 * desfazer e refazer. Limite de 20 ações guardadas em memória.
 * ============================================================ */

const LIMITE_HISTORICO = 20;

export class UndoManager extends EventTarget {
    constructor() {
        super();
        /** @type {Array<any>} pilha de estados (mementos) já registrados */
        this.historico = [];
        /** @type {number} índice do estado atualmente aplicado na grade */
        this.indiceAtual = -1;
    }

    /**
     * Registra um novo estado no histórico, a partir do estado atual
     * da grade (chamado pelo app.js ANTES de aplicar a mudança, ou
     * logo após, desde que sempre reflita o estado resultante).
     * Descarta qualquer "futuro" de redo pendente, respeitando o
     * limite de 20 ações.
     * @param {any} estado estrutura serializável (ex.: lista de páginas)
     */
    registrarEstado(estado) {
        const copiaEstado = estruturaClonada(estado);

        // Remove qualquer redo pendente antes de registrar a nova ação.
        this.historico = this.historico.slice(0, this.indiceAtual + 1);
        this.historico.push(copiaEstado);

        if (this.historico.length > LIMITE_HISTORICO) {
            this.historico.shift();
        }

        this.indiceAtual = this.historico.length - 1;
        this._notificarMudancaDeContadores();
    }

    /**
     * Reinicia o histórico com um único estado inicial, descartando
     * tudo que veio antes. Útil ao carregar novos arquivos.
     * @param {any} estado
     */
    reiniciarCom(estado) {
        this.historico = [estruturaClonada(estado)];
        this.indiceAtual = 0;
        this._notificarMudancaDeContadores();
    }

    /**
     * Desfaz a última ação, retornando o estado anterior.
     * Dispara o evento "undo" com o estado restaurado no detalhe.
     * @returns {any|null} o estado restaurado, ou null se não houver o que desfazer
     */
    desfazer() {
        if (!this.podeDesfazer()) {
            return null;
        }

        this.indiceAtual -= 1;
        const estadoRestaurado = estruturaClonada(this.historico[this.indiceAtual]);
        this._notificarMudancaDeContadores();
        this.dispatchEvent(new CustomEvent('undo', { detail: { estado: estadoRestaurado } }));
        return estadoRestaurado;
    }

    /**
     * Refaz a última ação desfeita, retornando o estado seguinte.
     * Dispara o evento "redo" com o estado restaurado no detalhe.
     * @returns {any|null} o estado restaurado, ou null se não houver o que refazer
     */
    refazer() {
        if (!this.podeRefazer()) {
            return null;
        }

        this.indiceAtual += 1;
        const estadoRestaurado = estruturaClonada(this.historico[this.indiceAtual]);
        this._notificarMudancaDeContadores();
        this.dispatchEvent(new CustomEvent('redo', { detail: { estado: estadoRestaurado } }));
        return estadoRestaurado;
    }

    /** @returns {boolean} true se existe uma ação anterior para desfazer */
    podeDesfazer() {
        return this.indiceAtual > 0;
    }

    /** @returns {boolean} true se existe uma ação futura para refazer */
    podeRefazer() {
        return this.indiceAtual < this.historico.length - 1;
    }

    /** @returns {number} quantidade de ações disponíveis para desfazer */
    contadorDesfazer() {
        return Math.max(0, this.indiceAtual);
    }

    /** @returns {number} quantidade de ações disponíveis para refazer */
    contadorRefazer() {
        return Math.max(0, this.historico.length - 1 - this.indiceAtual);
    }

    /**
     * Notifica ouvintes (app.js) de que os contadores de desfazer/refazer
     * mudaram, para que a barra de ferramentas possa ser atualizada.
     */
    _notificarMudancaDeContadores() {
        this.dispatchEvent(new CustomEvent('historicoAtualizado', {
            detail: {
                podeDesfazer: this.podeDesfazer(),
                podeRefazer: this.podeRefazer(),
                contadorDesfazer: this.contadorDesfazer(),
                contadorRefazer: this.contadorRefazer()
            }
        }));
    }
}

/**
 * Clona uma estrutura de dados simples (arrays/objetos serializáveis)
 * para que os mementos guardados não sejam afetados por mutações
 * posteriores do estado ativo na grade.
 * @param {any} estado
 * @returns {any}
 */
function estruturaClonada(estado) {
    return JSON.parse(JSON.stringify(estado));
}
