/* ============================================================
 * pdf-processor.js — Construção do PDF final
 * Contrato: SCX-SPEC-IMP-001, seção 8 ("pdf-processor.js").
 *
 * Usa pdf-lib para copiar, na ordem informada, as páginas dos
 * arquivos originais para um novo documento PDF — todo o
 * processamento acontece localmente, sem envio de binários a
 * nenhum servidor (SCX-SPEC-ARC-001, seção 2).
 * ============================================================ */

import { truncarAmostraDeTexto } from './utils.js';

/**
 * Constrói um novo PDF a partir da lista ordenada de páginas,
 * copiando cada página do seu arquivo de origem via pdf-lib.
 * @param {Array<{ id: string, fileId: string, indiceOriginal: number }>} paginas lista ordenada (já filtrada, se for extração)
 * @param {Map<string, { arrayBuffer: ArrayBuffer }>} registroArquivos
 * @returns {Promise<Uint8Array>}
 */
export async function construirPdf(paginas, registroArquivos) {
    const documentoFinal = await window.PDFLib.PDFDocument.create();

    // Agrupa por arquivo de origem para minimizar quantas vezes cada
    // PDF de origem precisa ser carregado e copiado pelo pdf-lib.
    const documentosOrigemPorArquivo = new Map();

    for (const pagina of paginas) {
        let documentoOrigem = documentosOrigemPorArquivo.get(pagina.fileId);

        if (!documentoOrigem) {
            const arquivo = registroArquivos.get(pagina.fileId);
            documentoOrigem = await window.PDFLib.PDFDocument.load(arquivo.arrayBuffer);
            documentosOrigemPorArquivo.set(pagina.fileId, documentoOrigem);
        }

        const [paginaCopiada] = await documentoFinal.copyPages(documentoOrigem, [pagina.indiceOriginal]);
        documentoFinal.addPage(paginaCopiada);
    }

    return documentoFinal.save();
}

/**
 * Extrai uma amostra de texto da primeira página do documento final
 * (respeitando a ordem atual definida pelo usuário), usada para
 * solicitar a sugestão de nome à IA. Nenhum outro conteúdo do PDF é
 * lido ou enviado (SCX-SPEC-AI-001, seção 2.2).
 * @param {Array<{ fileId: string, indiceOriginal: number }>} paginas lista ordenada
 * @param {Map<string, { documentoPdfJs: any }>} registroArquivos
 * @returns {Promise<string>} texto truncado a 500 caracteres, ou string vazia se não houver páginas
 */
export async function extrairAmostraDeTexto(paginas, registroArquivos) {
    const primeiraPagina = paginas[0];
    if (!primeiraPagina) {
        return '';
    }

    const arquivo = registroArquivos.get(primeiraPagina.fileId);
    const paginaPdfJs = await arquivo.documentoPdfJs.getPage(primeiraPagina.indiceOriginal + 1);
    const conteudoDeTexto = await paginaPdfJs.getTextContent();

    const textoCompleto = conteudoDeTexto.items.map((item) => item.str).join(' ');
    return truncarAmostraDeTexto(textoCompleto, 500);
}
