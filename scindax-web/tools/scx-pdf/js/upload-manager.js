/* ============================================================
 * upload-manager.js — Gerenciamento de entrada de arquivos
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("upload-manager.js").
 * Interações: SCX-SPEC-UX-001, seção 2.1.
 *
 * Responsável por capturar PDFs via arrastar-e-soltar ou seleção
 * manual, validá-los e carregá-los com PDF.js. Emite o evento
 * "filesLoaded" com os arquivos prontos para renderização.
 * ============================================================ */

import { validarArquivoPdf, gerarId, mostrarToast } from './utils.js';

export class UploadManager extends EventTarget {
    /**
     * @param {{ areaUpload: HTMLElement, inputArquivo: HTMLInputElement, botaoSelecionar: HTMLElement }} elementos
     */
    constructor(elementos) {
        super();
        this.areaUpload = elementos.areaUpload;
        this.inputArquivo = elementos.inputArquivo;
        this.botaoSelecionar = elementos.botaoSelecionar;

        this._configurarWorkerPdfJs();
        this._ligarEventos();
    }

    /**
     * Aponta o worker do PDF.js para o mesmo CDN da biblioteca principal,
     * exigido para que a renderização de páginas rode fora da thread
     * principal (SCX-SPEC-IMP-001, seção 5 — Performance).
     */
    _configurarWorkerPdfJs() {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js';
    }

    _ligarEventos() {
        this.botaoSelecionar.addEventListener('click', () => this.inputArquivo.click());

        this.inputArquivo.addEventListener('change', (evento) => {
            this._processarListaDeArquivos(evento.target.files);
            // Permite selecionar o mesmo arquivo novamente em uma próxima vez.
            evento.target.value = '';
        });

        ['dragenter', 'dragover'].forEach((nomeEvento) => {
            this.areaUpload.addEventListener(nomeEvento, (evento) => {
                evento.preventDefault();
                this.areaUpload.classList.add('scx-upload--dragover');
            });
        });

        ['dragleave', 'drop'].forEach((nomeEvento) => {
            this.areaUpload.addEventListener(nomeEvento, (evento) => {
                evento.preventDefault();
                this.areaUpload.classList.remove('scx-upload--dragover');
            });
        });

        this.areaUpload.addEventListener('drop', (evento) => {
            this._processarListaDeArquivos(evento.dataTransfer.files);
        });
    }

    /**
     * Valida e carrega cada arquivo da lista informada. Arquivos
     * inválidos geram um toast de erro e são ignorados; os válidos
     * são carregados com PDF.js em paralelo.
     * @param {FileList} listaDeArquivos
     */
    async _processarListaDeArquivos(listaDeArquivos) {
        const arquivosPdf = Array.from(listaDeArquivos).filter((arquivo) => {
            const resultado = validarArquivoPdf(arquivo);
            if (!resultado.valido) {
                mostrarToast(resultado.motivo, 'error');
            }
            return resultado.valido;
        });

        if (arquivosPdf.length === 0) {
            return;
        }

        const carregamentos = await Promise.allSettled(
            arquivosPdf.map((arquivo) => this._carregarArquivo(arquivo))
        );

        const arquivosCarregados = carregamentos
            .filter((resultado) => resultado.status === 'fulfilled')
            .map((resultado) => resultado.value);

        carregamentos
            .filter((resultado) => resultado.status === 'rejected')
            .forEach((resultado) => {
                mostrarToast(`Não foi possível ler um dos arquivos: ${resultado.reason?.message || 'erro desconhecido'}`, 'error');
            });

        if (arquivosCarregados.length > 0) {
            this.dispatchEvent(new CustomEvent('filesLoaded', { detail: { arquivos: arquivosCarregados } }));
        }
    }

    /**
     * Lê um único arquivo como ArrayBuffer e o abre com PDF.js para
     * obter o número de páginas e um documento pronto para renderizar
     * miniaturas sob demanda (lazy loading fica a cargo do page-grid).
     * @param {File} arquivo
     * @returns {Promise<{ id: string, nome: string, arrayBuffer: ArrayBuffer, documentoPdfJs: any, numPaginas: number }>}
     */
    async _carregarArquivo(arquivo) {
        const arrayBuffer = await arquivo.arrayBuffer();

        // PDF.js pode assumir posse do buffer que recebe; usamos uma cópia
        // para que os bytes originais permaneçam intactos para o pdf-lib.
        const bufferParaPdfJs = arrayBuffer.slice(0);
        const documentoPdfJs = await window.pdfjsLib.getDocument({ data: bufferParaPdfJs }).promise;

        return {
            id: gerarId(),
            nome: arquivo.name,
            arrayBuffer,
            documentoPdfJs,
            numPaginas: documentoPdfJs.numPages
        };
    }
}
