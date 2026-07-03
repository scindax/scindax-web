/* ============================================================
 * app.js — Orquestração da aplicação
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("app.js").
 * Fluxo oficial: SCX-SPEC-IMP-001, seção 10.
 *
 * Este módulo não contém regra de negócio própria: ele conecta
 * os eventos emitidos pelos demais módulos (upload-manager,
 * page-grid, undo-manager) e orquestra o fluxo de processamento
 * (Turnstile → IA → pdf-lib → download).
 * ============================================================ */

import { UploadManager } from './upload-manager.js';
import { PageGrid } from './page-grid.js';
import { UndoManager } from './undo-manager.js';
import { construirPdf, extrairAmostraDeTexto } from './pdf-processor.js';
import { checkLimit, getSuggestion, enviarFeedbackDeTreinamento, ErroAiClient } from './ai-client.js';
import { baixarPdf, mostrarToast, sanitizarNomeArquivo, gerarNomeGenerico, gerarId } from './utils.js';

const CHAVE_LOCALSTORAGE_BOAS_VINDAS = 'scxPdfWelcomeSeen';

/**
 * Armazena todo o estado mutável da aplicação em um único objeto,
 * evitado variáveis soltas espalhadas pelo módulo.
 */
const estadoApp = {
    /** @type {Map<string, { id: string, nome: string, arrayBuffer: ArrayBuffer, documentoPdfJs: any, numPaginas: number }>} */
    registroArquivos: new Map(),
    /** @type {'ocioso'|'pronto-para-baixar'} */
    fluxoProcesso: 'ocioso',
    /** @type {{ bytes: Uint8Array, sugestaoNome: string } | null} */
    ultimoPdfGerado: null,
    turnstileWidgetId: null,
    resolverTokenPendente: null,
    rejeitarTokenPendente: null
};

let elementos = {};
let pageGrid;
let undoManager;
let uploadManager;

document.addEventListener('DOMContentLoaded', iniciar);

/**
 * Ponto de entrada: localiza os elementos do DOM, instancia os
 * módulos de domínio e liga todos os eventos entre eles.
 */
function iniciar() {
    elementos = mapearElementosDoDom();

    pageGrid = new PageGrid({ elementoGrid: elementos.grid, elementoVazio: elementos.gridVazio });
    undoManager = new UndoManager();
    uploadManager = new UploadManager({
        areaUpload: elementos.areaUpload,
        inputArquivo: elementos.inputArquivo,
        botaoSelecionar: elementos.botaoSelecionarArquivo
    });

    ligarEventosDeDominio();
    ligarEventosDaBarraDeFerramentas();
    ligarEventosDoRodape();
    ligarEventosDosModais();
    ligarAtalhosDeTeclado();
    exibirModalBoasVindasSeNecessario();

    // Estado inicial: nenhuma página carregada ainda, então a barra de
    // ferramentas e o rodapé devem começar escondidos e os botões que
    // dependem de seleção/conteúdo devem começar desabilitados.
    atualizarEstadoDosBotoesDeAcao();
}

/**
 * Centraliza todas as buscas por elementos do DOM usados pela
 * aplicação, para que o restante do código nunca chame
 * document.getElementById diretamente.
 * @returns {Record<string, HTMLElement>}
 */
function mapearElementosDoDom() {
    const buscar = (id) => document.getElementById(id);

    return {
        areaUpload: buscar('scxUploadArea'),
        inputArquivo: buscar('scxFileInput'),
        botaoSelecionarArquivo: buscar('scxUploadTrigger'),

        toolbar: buscar('scxToolbar'),
        botaoSelecionarTodas: buscar('scxSelectAllBtn'),
        botaoDesmarcarTodas: buscar('scxClearSelectionBtn'),
        botaoExtrair: buscar('scxExtractBtn'),
        botaoExcluir: buscar('scxDeleteBtn'),
        botaoInverter: buscar('scxReverseBtn'),
        botaoDesfazer: buscar('scxUndoBtn'),
        botaoRefazer: buscar('scxRedoBtn'),
        contadorDesfazer: buscar('scxUndoCount'),
        contadorRefazer: buscar('scxRedoCount'),
        botaoLimparTudo: buscar('scxClearAllBtn'),

        grid: buscar('scxPageGrid'),
        gridVazio: buscar('scxGridEmpty'),

        footer: buscar('scxFooter'),
        inputNomeArquivo: buscar('scxFileNameInput'),
        botaoProcessar: buscar('scxProcessBtn'),

        overlayProgresso: buscar('scxProgressOverlay'),
        textoEtapaProgresso: buscar('scxProgressStep'),

        modalBoasVindas: buscar('scxWelcomeModal'),
        botaoAceitarBoasVindas: buscar('scxWelcomeAcceptBtn'),

        modalConfirmacao: buscar('scxConfirmModal'),
        tituloConfirmacao: buscar('scxConfirmTitle'),
        mensagemConfirmacao: buscar('scxConfirmMessage'),
        botaoConfirmarCancelar: buscar('scxConfirmCancelBtn'),
        botaoConfirmarAceitar: buscar('scxConfirmAcceptBtn'),

        widgetTurnstile: buscar('scxTurnstileWidget')
    };
}

/* ============================================================
 * Ligação de eventos entre módulos de domínio
 * ============================================================ */

function ligarEventosDeDominio() {
    uploadManager.addEventListener('filesLoaded', (evento) => aoReceberArquivos(evento.detail.arquivos));

    pageGrid.addEventListener('pageReordered', (evento) => aoMudarEstadoDaGrade(evento.detail.estado));
    pageGrid.addEventListener('pageDeleted', (evento) => aoMudarEstadoDaGrade(evento.detail.estado));
    pageGrid.addEventListener('selectionChanged', atualizarEstadoDosBotoesDeAcao);

    undoManager.addEventListener('undo', (evento) => pageGrid.restaurarEstado(evento.detail.estado));
    undoManager.addEventListener('redo', (evento) => pageGrid.restaurarEstado(evento.detail.estado));
    undoManager.addEventListener('historicoAtualizado', atualizarBotoesDeDesfazerRefazer);
}

/**
 * Trata o carregamento de novos arquivos: registra os arquivos e
 * suas páginas, adiciona à grade e cria um novo ponto no histórico
 * de desfazer/refazer.
 * @param {Array<{ id: string, nome: string, arrayBuffer: ArrayBuffer, documentoPdfJs: any, numPaginas: number }>} arquivos
 */
function aoReceberArquivos(arquivos) {
    const eraPrimeiroCarregamento = estadoApp.registroArquivos.size === 0;
    const novasPaginas = [];

    arquivos.forEach((arquivo) => {
        estadoApp.registroArquivos.set(arquivo.id, arquivo);
        for (let indice = 0; indice < arquivo.numPaginas; indice++) {
            novasPaginas.push({ id: gerarId(), fileId: arquivo.id, indiceOriginal: indice });
        }
    });

    pageGrid.adicionarPaginas(novasPaginas, estadoApp.registroArquivos);

    if (eraPrimeiroCarregamento) {
        undoManager.reiniciarCom(pageGrid.obterEstado());
    } else {
        undoManager.registrarEstado(pageGrid.obterEstado());
    }

    resetarFluxoDeProcessamento();
    atualizarEstadoDosBotoesDeAcao();

    const totalPaginas = arquivos.reduce((soma, arquivo) => soma + arquivo.numPaginas, 0);
    mostrarToast(`${arquivos.length} arquivo(s) carregado(s) — ${totalPaginas} página(s) no total.`, 'success');
}

/**
 * Trata qualquer mudança estrutural na grade (reordenar, excluir,
 * inverter) já aplicada pelo page-grid: registra o novo estado no
 * histórico e invalida um PDF previamente gerado, se houver.
 * @param {Array<any>} estado
 */
function aoMudarEstadoDaGrade(estado) {
    undoManager.registrarEstado(estado);
    resetarFluxoDeProcessamento();
    atualizarEstadoDosBotoesDeAcao();
}

/* ============================================================
 * Barra de ferramentas
 * ============================================================ */

function ligarEventosDaBarraDeFerramentas() {
    elementos.botaoSelecionarTodas.addEventListener('click', () => pageGrid.selecionarTodas());
    elementos.botaoDesmarcarTodas.addEventListener('click', () => pageGrid.desmarcarTodas());

    elementos.botaoExtrair.addEventListener('click', aoClicarExtrairSelecionados);

    elementos.botaoExcluir.addEventListener('click', () => {
        const idsSelecionados = pageGrid.obterIdsSelecionados();
        confirmarAcao({
            titulo: 'Excluir páginas selecionadas',
            mensagem: `Tem certeza que deseja excluir ${idsSelecionados.length} página(s)? Esta ação pode ser desfeita com Ctrl+Z.`,
            aoConfirmar: () => pageGrid.removerPaginas(idsSelecionados)
        });
    });

    elementos.botaoInverter.addEventListener('click', () => pageGrid.inverterOrdem());

    elementos.botaoDesfazer.addEventListener('click', () => undoManager.desfazer());
    elementos.botaoRefazer.addEventListener('click', () => undoManager.refazer());

    elementos.botaoLimparTudo.addEventListener('click', () => {
        confirmarAcao({
            titulo: 'Limpar tudo',
            mensagem: 'Isso removerá todos os arquivos e páginas carregados nesta sessão. Deseja continuar?',
            aoConfirmar: () => {
                pageGrid.limparTudo();
                estadoApp.registroArquivos.clear();
                undoManager.reiniciarCom([]);
                resetarFluxoDeProcessamento();
                atualizarEstadoDosBotoesDeAcao();
            }
        });
    });
}

/**
 * Habilita/desabilita os botões da barra de ferramentas e do
 * rodapé conforme o total de páginas e a seleção atual, e mostra
 * ou esconde a barra de ferramentas e o rodapé quando a grade
 * fica vazia.
 */
function atualizarEstadoDosBotoesDeAcao() {
    const totalPaginas = pageGrid.obterEstado().length;
    const totalSelecionadas = pageGrid.obterIdsSelecionados().length;

    elementos.toolbar.hidden = totalPaginas === 0;
    elementos.footer.hidden = totalPaginas === 0;

    elementos.botaoExtrair.disabled = totalSelecionadas === 0;
    elementos.botaoExcluir.disabled = totalSelecionadas === 0;
    elementos.botaoInverter.disabled = totalPaginas < 2;
    elementos.botaoLimparTudo.disabled = totalPaginas === 0;
    elementos.botaoProcessar.disabled = totalPaginas === 0;
}

function atualizarBotoesDeDesfazerRefazer(evento) {
    const { podeDesfazer, podeRefazer, contadorDesfazer, contadorRefazer } = evento.detail;

    elementos.botaoDesfazer.disabled = !podeDesfazer;
    elementos.botaoRefazer.disabled = !podeRefazer;
    elementos.contadorDesfazer.textContent = contadorDesfazer > 0 ? `(${contadorDesfazer})` : '';
    elementos.contadorRefazer.textContent = contadorRefazer > 0 ? `(${contadorRefazer})` : '';
}

/**
 * Ação rápida "Extrair selecionados": gera e baixa imediatamente um
 * novo PDF apenas com as páginas marcadas, sem afetar a grade atual.
 */
async function aoClicarExtrairSelecionados() {
    const idsSelecionados = new Set(pageGrid.obterIdsSelecionados());
    const paginasSelecionadas = pageGrid.obterEstado().filter((pagina) => idsSelecionados.has(pagina.id));

    if (paginasSelecionadas.length === 0) {
        mostrarToast('Selecione ao menos uma página para extrair.', 'warning');
        return;
    }

    const resultado = await executarPipelineDeProcessamento(paginasSelecionadas);
    if (resultado) {
        baixarPdf(resultado.bytes, resultado.sugestaoNome);
        mostrarToast('PDF extraído e baixado com sucesso!', 'success');
    }
}

/* ============================================================
 * Rodapé: nome sugerido + processar/baixar
 * ============================================================ */

function ligarEventosDoRodape() {
    elementos.botaoProcessar.addEventListener('click', aoClicarProcessarOuBaixar);
}

async function aoClicarProcessarOuBaixar() {
    if (estadoApp.fluxoProcesso === 'ocioso') {
        const paginasAtuais = pageGrid.obterEstado();
        const resultado = await executarPipelineDeProcessamento(paginasAtuais);

        if (resultado) {
            estadoApp.ultimoPdfGerado = resultado;
            estadoApp.fluxoProcesso = 'pronto-para-baixar';
            preencherCampoDeNomeComSugestao(resultado.sugestaoNome);
            transformarBotaoEmBaixar();
        }
        return;
    }

    // Segundo clique: baixa o PDF já construído, respeitando o nome editado pelo usuário.
    const nomeFinal = elementos.inputNomeArquivo.value.trim() || estadoApp.ultimoPdfGerado.sugestaoNome;
    baixarPdf(estadoApp.ultimoPdfGerado.bytes, nomeFinal);

    enviarFeedbackDeTreinamento({
        textSample: estadoApp.ultimoPdfGerado.amostraDeTexto || '',
        aiSuggestion: estadoApp.ultimoPdfGerado.sugestaoNome,
        userFinalName: sanitizarNomeArquivo(nomeFinal),
        approved: true
    });

    exibirConfirmacaoDeBaixado();
}

/**
 * Executa o pipeline completo de processamento descrito em
 * SCX-SPEC-ARC-001, seção 3.2: verificação Turnstile, checagem de
 * limite diário, sugestão de nome via IA e construção do PDF.
 * @param {Array<any>} paginas lista ordenada de páginas a incluir no PDF
 * @returns {Promise<{ bytes: Uint8Array, sugestaoNome: string, amostraDeTexto: string } | null>} null se o fluxo foi interrompido
 */
async function executarPipelineDeProcessamento(paginas) {
    mostrarProgresso('Verificando segurança...');

    try {
        const token = await obterTokenTurnstile();
        const limite = await checkLimit(token);

        if (!limite.allowed) {
            esconderProgresso();
            mostrarToast(limite.message || 'Limite diário atingido. Volte amanhã para usar novamente.', 'warning');
            return null;
        }

        atualizarEtapaDeProgresso('Gerando sugestão de nome...');
        const amostraDeTexto = await extrairAmostraDeTexto(paginas, estadoApp.registroArquivos);
        const sugestaoNome = await obterSugestaoDeNomeComFallback(amostraDeTexto, token);

        atualizarEtapaDeProgresso('Montando seu PDF...');
        const bytes = await construirPdf(paginas, estadoApp.registroArquivos);

        esconderProgresso();
        return { bytes, sugestaoNome, amostraDeTexto };
    } catch (erro) {
        esconderProgresso();
        tratarErroDoPipeline(erro);
        return null;
    }
}

/**
 * Solicita a sugestão de nome à IA; em caso de falha, aplica o
 * fallback obrigatório de nome genérico sem interromper o fluxo
 * (SCX-SPEC-IMP-001, seção 13).
 * @param {string} amostraDeTexto
 * @param {string} token
 * @returns {Promise<string>}
 */
async function obterSugestaoDeNomeComFallback(amostraDeTexto, token) {
    try {
        const resposta = await getSuggestion(amostraDeTexto, token);

        if (resposta.fallback) {
            mostrarToast('A sugestão de nome não pôde ser carregada, mas seu PDF está pronto com um nome genérico.', 'warning');
        }

        return sanitizarNomeArquivo(resposta.suggestedName);
    } catch (erro) {
        mostrarToast('A sugestão de nome não pôde ser carregada, mas seu PDF está pronto com um nome genérico.', 'warning');
        return gerarNomeGenerico();
    }
}

/**
 * Traduz erros do pipeline (majoritariamente do ai-client) em toasts
 * compreensíveis, seguindo a tabela de fallbacks de SCX-SPEC-AI-001,
 * seção 7. Falhas na verificação Turnstile interrompem o fluxo; as
 * demais são absorvidas antes de chegar aqui.
 * @param {Error} erro
 */
function tratarErroDoPipeline(erro) {
    if (erro instanceof ErroTurnstileLocal || (erro instanceof ErroAiClient && erro.codigo === 'turnstile_invalido')) {
        mostrarToast('Falha na verificação humana. Tente novamente.', 'error');
        return;
    }

    mostrarToast('Não foi possível verificar o limite diário no momento. Tente novamente em instantes.', 'error');
}

/**
 * Preenche o campo de nome com a sugestão recebida e aplica o
 * destaque visual momentâneo (SCX-SPEC-UX-001, seção 8).
 * @param {string} sugestaoNome
 */
function preencherCampoDeNomeComSugestao(sugestaoNome) {
    elementos.inputNomeArquivo.value = sugestaoNome;
    elementos.inputNomeArquivo.classList.remove('scx-footer-input--suggested');
    // Força reflow para que a animação possa ser reaplicada em sugestões consecutivas.
    void elementos.inputNomeArquivo.offsetWidth;
    elementos.inputNomeArquivo.classList.add('scx-footer-input--suggested');
}

function transformarBotaoEmBaixar() {
    elementos.botaoProcessar.textContent = '📥 Baixar';
}

/** Exibe brevemente "✅ Baixado!" no botão principal antes de voltar ao estado inicial. */
function exibirConfirmacaoDeBaixado() {
    elementos.botaoProcessar.textContent = '✅ Baixado!';
    elementos.botaoProcessar.classList.add('scx-process-btn--success');

    window.setTimeout(() => {
        resetarFluxoDeProcessamento();
    }, 1600);
}

/** Retorna o botão principal e o estado de processamento ao ponto inicial. */
function resetarFluxoDeProcessamento() {
    estadoApp.fluxoProcesso = 'ocioso';
    estadoApp.ultimoPdfGerado = null;
    elementos.botaoProcessar.textContent = '📥 Processar e baixar';
    elementos.botaoProcessar.classList.remove('scx-process-btn--success');
}

/* ============================================================
 * Barra de progresso
 * ============================================================ */

function mostrarProgresso(etapaTexto) {
    elementos.textoEtapaProgresso.textContent = etapaTexto;
    elementos.overlayProgresso.hidden = false;
}

function atualizarEtapaDeProgresso(etapaTexto) {
    elementos.textoEtapaProgresso.textContent = etapaTexto;
}

function esconderProgresso() {
    elementos.overlayProgresso.hidden = true;
}

/* ============================================================
 * Modais (boas-vindas e confirmação genérica)
 * ============================================================ */

function ligarEventosDosModais() {
    elementos.botaoAceitarBoasVindas.addEventListener('click', () => {
        elementos.modalBoasVindas.hidden = true;
        window.localStorage.setItem(CHAVE_LOCALSTORAGE_BOAS_VINDAS, '1');
    });
}

function exibirModalBoasVindasSeNecessario() {
    const jaVisualizado = window.localStorage.getItem(CHAVE_LOCALSTORAGE_BOAS_VINDAS);
    elementos.modalBoasVindas.hidden = Boolean(jaVisualizado);
}

/**
 * Exibe o modal de confirmação genérico com o título e a mensagem
 * informados, executando o callback apenas se o usuário confirmar.
 * @param {{ titulo: string, mensagem: string, aoConfirmar: () => void }} opcoes
 */
function confirmarAcao({ titulo, mensagem, aoConfirmar }) {
    elementos.tituloConfirmacao.textContent = titulo;
    elementos.mensagemConfirmacao.textContent = mensagem;
    elementos.modalConfirmacao.hidden = false;

    const fechar = () => { elementos.modalConfirmacao.hidden = true; };

    const aoCancelar = () => {
        fechar();
        limparListeners();
    };

    const aoAceitar = () => {
        fechar();
        limparListeners();
        aoConfirmar();
    };

    function limparListeners() {
        elementos.botaoConfirmarCancelar.removeEventListener('click', aoCancelar);
        elementos.botaoConfirmarAceitar.removeEventListener('click', aoAceitar);
    }

    elementos.botaoConfirmarCancelar.addEventListener('click', aoCancelar);
    elementos.botaoConfirmarAceitar.addEventListener('click', aoAceitar);
}

/* ============================================================
 * Atalhos de teclado (Ctrl+Z / Ctrl+Y)
 * ============================================================ */

function ligarAtalhosDeTeclado() {
    // Tratado de forma síncrona: preventDefault() só tem efeito se chamado
    // durante o próprio despacho do evento, então não deve ser adiado (debounce).
    document.addEventListener('keydown', aoPressionarTecla);
}

/**
 * Trata Ctrl+Z (desfazer) e Ctrl+Y / Ctrl+Shift+Z (refazer), exceto
 * quando o foco está no campo de nome — ali o undo nativo do
 * navegador deve continuar funcionando normalmente.
 * @param {KeyboardEvent} evento
 */
function aoPressionarTecla(evento) {
    const teclaModificadora = evento.ctrlKey || evento.metaKey;
    if (!teclaModificadora || document.activeElement === elementos.inputNomeArquivo) {
        return;
    }

    const tecla = evento.key.toLowerCase();

    if (tecla === 'z' && !evento.shiftKey) {
        evento.preventDefault();
        undoManager.desfazer();
    } else if (tecla === 'y' || (tecla === 'z' && evento.shiftKey)) {
        evento.preventDefault();
        undoManager.refazer();
    }
}

/* ============================================================
 * Cloudflare Turnstile
 * ============================================================ */

/**
 * Chamada automaticamente pelo script do Turnstile assim que a API
 * estiver pronta (parâmetro ?onload= na tag <script>, SCX-SPEC-AI-001).
 * Renderiza o widget e conecta seus callbacks à promessa pendente de
 * obterTokenTurnstile(). A ausência total de interface visual depende
 * do Site Key ser do tipo "Invisible", configurado no painel da
 * Cloudflare — aqui apenas garantimos que o desafio só é dispachado
 * quando explicitamente solicitado (execution: 'execute'), nunca
 * automaticamente ao carregar a página.
 */
window.scxOnTurnstileReady = function scxOnTurnstileReady() {
    estadoApp.turnstileWidgetId = window.turnstile.render(elementos.widgetTurnstile || document.getElementById('scxTurnstileWidget'), {
        sitekey: document.getElementById('scxTurnstileWidget').dataset.sitekey,
        execution: 'execute',
        callback: (token) => {
            if (estadoApp.resolverTokenPendente) {
                estadoApp.resolverTokenPendente(token);
            }
        },
        'error-callback': () => {
            if (estadoApp.rejeitarTokenPendente) {
                estadoApp.rejeitarTokenPendente(new ErroTurnstileLocal('Falha ao validar a verificação de segurança.'));
            }
        }
    });
};

class ErroTurnstileLocal extends Error {}

/**
 * Solicita um novo token do Turnstile, reexecutando o widget
 * invisível (tokens são de uso único). Rejeita se o widget ainda
 * não tiver sido renderizado.
 * @returns {Promise<string>}
 */
function obterTokenTurnstile() {
    return new Promise((resolver, rejeitar) => {
        if (estadoApp.turnstileWidgetId === null || !window.turnstile) {
            rejeitar(new ErroTurnstileLocal('Verificação de segurança ainda não está pronta. Tente novamente em instantes.'));
            return;
        }

        estadoApp.resolverTokenPendente = resolver;
        estadoApp.rejeitarTokenPendente = rejeitar;

        window.turnstile.reset(estadoApp.turnstileWidgetId);
        window.turnstile.execute(estadoApp.turnstileWidgetId);
    });
}
