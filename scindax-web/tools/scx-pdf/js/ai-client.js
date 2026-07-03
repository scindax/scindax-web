/* ============================================================
 * ai-client.js — Comunicação com o Cloudflare Worker
 * Contrato: SCX-SPEC-AI-001, seções 2 e 9.
 *
 * Único ponto do frontend que fala com a rede: envia apenas o
 * token do Turnstile e, no máximo, uma amostra de texto de até
 * 500 caracteres — nunca o PDF ou qualquer binário do usuário.
 * ============================================================ */

// Substitua pela URL publicada do Worker (wrangler.toml → routes/workers.dev).
const WORKER_BASE_URL = 'https://scx-pdf-worker.SEU_SUBDOMINIO.workers.dev';

const TEMPO_LIMITE_REQUISICAO_MS = 6000; // um pouco acima do timeout de 5s da IA no Worker (SCX-SPEC-AI-001, seção 7)

/**
 * Erro específico para falhas de comunicação com o Worker, carregando
 * um código estável que o app.js usa para escolher a mensagem de
 * toast adequada (SCX-SPEC-UX-001, seção 8).
 */
export class ErroAiClient extends Error {
    constructor(mensagem, codigo) {
        super(mensagem);
        this.name = 'ErroAiClient';
        this.codigo = codigo;
    }
}

/**
 * Executa uma requisição fetch com timeout, para que uma IA ou rede
 * lenta nunca trave a interface indefinidamente.
 * @param {string} url
 * @param {RequestInit} opcoes
 * @returns {Promise<Response>}
 */
async function buscarComTempoLimite(url, opcoes) {
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), TEMPO_LIMITE_REQUISICAO_MS);

    try {
        return await fetch(url, { ...opcoes, signal: controlador.signal });
    } finally {
        window.clearTimeout(temporizador);
    }
}

/**
 * Verifica se o usuário ainda possui cota diária disponível.
 * Contrato: SCX-SPEC-AI-001, seção 2.1.
 * @param {string} turnstileToken - Token gerado pelo Turnstile.
 * @returns {Promise<{ allowed: boolean, count: number, message?: string }>}
 */
export async function checkLimit(turnstileToken) {
    let resposta;

    try {
        resposta = await buscarComTempoLimite(`${WORKER_BASE_URL}/check-limit`, {
            method: 'GET',
            headers: { 'X-Turnstile-Token': turnstileToken }
        });
    } catch (erroDeRede) {
        throw new ErroAiClient('Não foi possível verificar o limite diário.', 'rede_indisponivel');
    }

    if (resposta.status === 403) {
        throw new ErroAiClient('Falha na verificação humana.', 'turnstile_invalido');
    }

    // Para 200 (permitido) e 429 (limite excedido) o corpo já vem no formato esperado.
    return resposta.json();
}

/**
 * Solicita uma sugestão de nome ao Worker a partir de uma amostra de
 * texto extraída da primeira página do documento.
 * Contrato: SCX-SPEC-AI-001, seção 2.2.
 * @param {string} textSample - Texto extraído (máx. 500 caracteres).
 * @param {string} turnstileToken - Token do Turnstile.
 * @returns {Promise<{ suggestedName: string, fallback?: boolean }>}
 */
export async function getSuggestion(textSample, turnstileToken) {
    let resposta;

    try {
        resposta = await buscarComTempoLimite(`${WORKER_BASE_URL}/suggest-name`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Turnstile-Token': turnstileToken
            },
            body: JSON.stringify({ textSample })
        });
    } catch (erroDeRede) {
        throw new ErroAiClient('A sugestão de nome não pôde ser carregada.', 'rede_indisponivel');
    }

    if (resposta.status === 403) {
        throw new ErroAiClient('Falha na verificação humana.', 'turnstile_invalido');
    }

    if (resposta.status === 429) {
        throw new ErroAiClient('Limite diário atingido.', 'limite_excedido');
    }

    if (!resposta.ok) {
        throw new ErroAiClient('A IA está com alta demanda no momento.', 'falha_ia');
    }

    return resposta.json();
}

/**
 * Envia, de forma opcional e não bloqueante, o par (amostra de
 * texto, nome final escolhido) para futuro fine-tuning do modelo
 * de sugestão de nomes. Falhas aqui nunca devem impactar o usuário.
 * Contrato: SCX-SPEC-AI-001, seção 6.2.
 * @param {{ textSample: string, aiSuggestion: string, userFinalName: string, approved: boolean }} payload
 */
export function enviarFeedbackDeTreinamento(payload) {
    fetch(`${WORKER_BASE_URL}/training-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {
        // Coleta é best-effort: nenhuma falha aqui deve gerar toast ou bloquear o fluxo.
    });
}
