/* ============================================================
 * utils.js — Funções utilitárias compartilhadas
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("utils.js").
 *
 * Centraliza sanitização de nomes, download de arquivos, toasts,
 * debounce, geração de identificadores e validações usadas pelos
 * demais módulos do SCX PDF Tool.
 * ============================================================ */

const DURACAO_TOAST_PADRAO_MS = 4500;
const TAMANHO_MAXIMO_ARQUIVO_BYTES = 50 * 1024 * 1024; // 50 MB (SCX-SPEC-ARC-001, seção 2)
const TAMANHO_MAXIMO_NOME = 50; // SCX-SPEC-AI-001, seção 5.2

const MAPA_ACENTOS = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
};

/**
 * Remove acentos de uma string substituindo cada caractere
 * acentuado pelo seu equivalente sem acento.
 * @param {string} texto
 * @returns {string}
 */
function removerAcentos(texto) {
    return texto
        .toLowerCase()
        .split('')
        .map((caractere) => MAPA_ACENTOS[caractere] || caractere)
        .join('');
}

/**
 * Sanitiza um nome de arquivo sugerido (pela IA ou pelo usuário)
 * conforme as regras obrigatórias de SCX-SPEC-AI-001, seção 5.2:
 * minúsculas, sem acentos, sem espaços, apenas [a-z0-9_], sem
 * underscores duplicados ou nas extremidades, máximo 50 caracteres.
 * @param {string} nomeOriginal
 * @returns {string}
 */
export function sanitizarNomeArquivo(nomeOriginal) {
    if (!nomeOriginal || typeof nomeOriginal !== 'string') {
        return 'documento_organizado';
    }

    let nome = removerAcentos(nomeOriginal.trim());
    nome = nome.replace(/\s+/g, '_');
    nome = nome.replace(/[^a-z0-9_]/g, '');
    nome = nome.replace(/_+/g, '_');
    nome = nome.replace(/^_+|_+$/g, '');

    if (nome.length > TAMANHO_MAXIMO_NOME) {
        nome = nome.slice(0, TAMANHO_MAXIMO_NOME).replace(/_+$/g, '');
    }

    return nome || 'documento_organizado';
}

/**
 * Gera o nome de fallback genérico exigido quando a IA falha
 * (SCX-SPEC-AI-001, seção 2.2): documento_organizado_{timestamp}.
 * @returns {string}
 */
export function gerarNomeGenerico() {
    const agora = new Date();
    const pad = (numero) => String(numero).padStart(2, '0');
    const carimbo = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}_` +
        `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
    return `documento_organizado_${carimbo}`;
}

/**
 * Cria um Blob a partir do PDF gerado e dispara o download no
 * navegador via um elemento <a> temporário.
 * @param {Uint8Array} bytesPdf
 * @param {string} nomeArquivo nome sem extensão; a extensão .pdf é adicionada aqui
 */
export function baixarPdf(bytesPdf, nomeArquivo) {
    const nomeSanitizado = sanitizarNomeArquivo(nomeArquivo);
    const blob = new Blob([bytesPdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeSanitizado}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Libera a URL do objeto após o navegador iniciar o download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exibe uma notificação toast temporária no canto inferior direito.
 * @param {string} mensagem
 * @param {'info'|'success'|'error'|'warning'} [tipo]
 * @param {number} [duracaoMs]
 */
export function mostrarToast(mensagem, tipo = 'info', duracaoMs = DURACAO_TOAST_PADRAO_MS) {
    const container = document.getElementById('scxToastContainer');
    if (!container) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `scx-toast scx-toast--${tipo}`;
    toast.textContent = mensagem;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('scx-toast--closing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duracaoMs);
}

/**
 * Retorna uma versão "debounced" da função informada, adiando sua
 * execução até que `esperaMs` tenha se passado sem novas chamadas.
 * @param {Function} fn
 * @param {number} esperaMs
 * @returns {Function}
 */
export function debounce(fn, esperaMs) {
    let temporizador = null;
    return function versaoComEspera(...argumentos) {
        window.clearTimeout(temporizador);
        temporizador = window.setTimeout(() => fn.apply(this, argumentos), esperaMs);
    };
}

/**
 * Gera um identificador único para páginas e arquivos carregados.
 * Usa crypto.randomUUID quando disponível, com fallback simples.
 * @returns {string}
 */
export function gerarId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Valida se um arquivo enviado pelo usuário é um PDF elegível para
 * processamento (tipo e tamanho máximo de 50 MB).
 * @param {File} arquivo
 * @returns {{ valido: boolean, motivo?: string }}
 */
export function validarArquivoPdf(arquivo) {
    const pareceSerPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');

    if (!pareceSerPdf) {
        return { valido: false, motivo: `O arquivo "${arquivo.name}" não é um PDF válido.` };
    }

    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
        return { valido: false, motivo: `O arquivo "${arquivo.name}" excede o limite de 50 MB.` };
    }

    return { valido: true };
}

/**
 * Limita uma amostra de texto ao tamanho máximo aceito pela API de
 * sugestão de nome, removendo caracteres de controle (SCX-SPEC-AI-001,
 * seção 2.2 e SCX-SPEC-ARC-001, seção 4.3).
 * @param {string} texto
 * @param {number} [tamanhoMaximo]
 * @returns {string}
 */
export function truncarAmostraDeTexto(texto, tamanhoMaximo = 500) {
    if (!texto) {
        return '';
    }
    // eslint-disable-next-line no-control-regex
    const textoLimpo = texto.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim();
    return textoLimpo.slice(0, tamanhoMaximo);
}
