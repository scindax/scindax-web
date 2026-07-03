/* ============================================================
 * worker.js — Cloudflare Worker do SCX PDF Tool
 * Contrato: SCX-SPEC-AI-001 e SCX-SPEC-ARC-001, seção 4.2.
 *
 * Único backend da aplicação. Responsável por:
 *   - validar o Turnstile em toda requisição;
 *   - controlar o limite diário de processamentos por IP (KV);
 *   - chamar a Workers AI (com fallback de modelo) para sugerir
 *     um nome de arquivo a partir de uma amostra de texto;
 *   - cachear sugestões repetidas (KV, TTL de 7 dias);
 *   - sanitizar o nome antes de devolvê-lo ao frontend;
 *   - opcionalmente registrar pares (amostra, nome aprovado) para
 *     fine-tuning futuro, aplicando filtros de dados sensíveis.
 *
 * Nenhum PDF ou binário passa por este Worker — apenas texto de
 * amostra (até 500 caracteres) e tokens de verificação.
 * ============================================================ */

const LIMITE_DIARIO_POR_IP = 20; // texto do banner fixo, SCX-SPEC-UX-001, seção 6.1
const TTL_CONTADOR_DIARIO_SEGUNDOS = 86400;
const TTL_CACHE_SUGESTAO_SEGUNDOS = 604800; // 7 dias, SCX-SPEC-AI-001, seção 4.2
const TTL_TREINAMENTO_SEGUNDOS = 2592000; // 30 dias, SCX-SPEC-AI-001, seção 6.4
const TAMANHO_MAXIMO_NOME = 50;
const TAMANHO_MAXIMO_AMOSTRA = 500;

const MODELO_PRINCIPAL = '@cf/microsoft/phi-3-mini-4k-instruct';
const MODELO_SECUNDARIO = '@cf/meta/llama-3-8b-instruct';

const PROMPT_SISTEMA =
    'Você é um assistente especializado em sugerir nomes para arquivos PDF. ' +
    'Sua tarefa é analisar o fragmento de texto fornecido e gerar um nome curto, descritivo e em snake_case, sem extensão. ' +
    'O nome deve conter apenas letras minúsculas, números e underscores (_). ' +
    'Não inclua espaços, acentos, caracteres especiais ou símbolos como &, %, $, etc. ' +
    'Responda APENAS com um objeto JSON no formato: { "suggestedName": "nome_aqui" }.';

export default {
    /**
     * Roteador principal do Worker.
     * @param {Request} request
     * @param {{ SCX_KV: KVNamespace, AI: any, TURNSTILE_SECRET_KEY: string, ALLOWED_ORIGIN: string }} env
     */
    async fetch(request, env) {
        const cabecalhosCors = construirCabecalhosCors(env.ALLOWED_ORIGIN);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: cabecalhosCors });
        }

        const url = new URL(request.url);

        try {
            if (url.pathname === '/check-limit' && request.method === 'GET') {
                return await tratarCheckLimit(request, env, cabecalhosCors);
            }

            if (url.pathname === '/suggest-name' && request.method === 'POST') {
                return await tratarSuggestName(request, env, cabecalhosCors);
            }

            if (url.pathname === '/training-feedback' && request.method === 'POST') {
                return await tratarTrainingFeedback(request, env, cabecalhosCors);
            }
        } catch (erroInesperado) {
            console.error('Erro inesperado no Worker:', erroInesperado);
            return respostaJson({ error: 'Erro interno.' }, 500, cabecalhosCors);
        }

        return respostaJson({ error: 'Rota não encontrada.' }, 404, cabecalhosCors);
    }
};

/* ============================================================
 * Rotas
 * ============================================================ */

/**
 * GET /check-limit — Verifica se o IP ainda possui cota diária.
 * Contrato: SCX-SPEC-AI-001, seção 2.1.
 */
async function tratarCheckLimit(request, env, cabecalhosCors) {
    const token = request.headers.get('X-Turnstile-Token');
    const ip = obterIpDoCliente(request);

    const turnstileValido = await validarTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!turnstileValido) {
        return respostaJson({ error: 'Falha na verificação humana.' }, 403, cabecalhosCors);
    }

    const contagemAtual = await obterContagemDiaria(env.SCX_KV, ip);

    if (contagemAtual >= LIMITE_DIARIO_POR_IP) {
        return respostaJson({ allowed: false, message: 'Limite diário atingido' }, 429, cabecalhosCors);
    }

    return respostaJson({ allowed: true, count: contagemAtual }, 200, cabecalhosCors);
}

/**
 * POST /suggest-name — Gera (ou recupera do cache) uma sugestão de
 * nome de arquivo a partir de uma amostra de texto.
 * Contrato: SCX-SPEC-AI-001, seção 2.2.
 */
async function tratarSuggestName(request, env, cabecalhosCors) {
    const token = request.headers.get('X-Turnstile-Token');
    const ip = obterIpDoCliente(request);

    const turnstileValido = await validarTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!turnstileValido) {
        return respostaJson({ error: 'Falha na verificação humana.' }, 403, cabecalhosCors);
    }

    const contagemAtual = await obterContagemDiaria(env.SCX_KV, ip);
    if (contagemAtual >= LIMITE_DIARIO_POR_IP) {
        return respostaJson({ allowed: false, message: 'Limite diário atingido' }, 429, cabecalhosCors);
    }

    let corpo;
    try {
        corpo = await request.json();
    } catch {
        return respostaJson({ error: 'Corpo da requisição inválido.' }, 400, cabecalhosCors);
    }

    const textSample = sanitizarAmostra(corpo.textSample);
    if (!textSample) {
        return respostaJson({ error: 'textSample ausente ou vazio.' }, 400, cabecalhosCors);
    }

    const chaveCache = `suggestion:${await gerarHash(textSample)}`;
    const sugestaoEmCache = await env.SCX_KV.get(chaveCache);

    if (sugestaoEmCache) {
        // Sugestão em cache: não conta como uso diário (SCX-SPEC-AI-001, seção 4.3).
        return respostaJson({ suggestedName: sugestaoEmCache }, 200, cabecalhosCors);
    }

    const resultadoIa = await consultarWorkersAiComFallback(env.AI, textSample);
    const nomeSanitizado = sanitizarNomeSugerido(resultadoIa.suggestedName);

    await env.SCX_KV.put(chaveCache, nomeSanitizado, { expirationTtl: TTL_CACHE_SUGESTAO_SEGUNDOS });
    await incrementarContagemDiaria(env.SCX_KV, ip, contagemAtual);

    const corpoResposta = { suggestedName: nomeSanitizado };
    if (resultadoIa.fallback) {
        corpoResposta.fallback = true;
    }

    return respostaJson(corpoResposta, 200, cabecalhosCors);
}

/**
 * POST /training-feedback — Registra, de forma opcional e best-effort,
 * o par (amostra, nome aprovado) para futuro fine-tuning, descartando
 * silenciosamente qualquer conteúdo que pareça sensível.
 * Contrato: SCX-SPEC-AI-001, seção 6.
 */
async function tratarTrainingFeedback(request, env, cabecalhosCors) {
    let corpo;
    try {
        corpo = await request.json();
    } catch {
        return respostaJson({ ok: false }, 400, cabecalhosCors);
    }

    const textSample = sanitizarAmostra(corpo.textSample);
    const aiSuggestion = sanitizarNomeSugerido(corpo.aiSuggestion || '');
    const userFinalName = sanitizarNomeSugerido(corpo.userFinalName || '');

    if (contemDadoSensivel(textSample) || contemDadoSensivel(userFinalName)) {
        // Descarte silencioso: o usuário nunca é notificado (SCX-SPEC-AI-001, seção 6.3).
        return respostaJson({ ok: true }, 200, cabecalhosCors);
    }

    const chave = `training:${Date.now()}:${await gerarHash(textSample)}`;
    const registro = { textSample, aiSuggestion, userFinalName, approved: Boolean(corpo.approved) };

    await env.SCX_KV.put(chave, JSON.stringify(registro), { expirationTtl: TTL_TREINAMENTO_SEGUNDOS });

    return respostaJson({ ok: true }, 200, cabecalhosCors);
}

/* ============================================================
 * Turnstile
 * ============================================================ */

/**
 * Valida um token do Cloudflare Turnstile junto à API de verificação.
 * @param {string|null} token
 * @param {string} chaveSecreta
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function validarTurnstile(token, chaveSecreta, ip) {
    if (!token) {
        return false;
    }

    const parametros = new URLSearchParams();
    parametros.append('secret', chaveSecreta);
    parametros.append('response', token);
    parametros.append('remoteip', ip);

    const resposta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: parametros
    });

    const resultado = await resposta.json();
    return resultado.success === true;
}

/* ============================================================
 * Limite diário (Workers KV)
 * ============================================================ */

function obterChaveContagem(ip) {
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `count:${ip}:${hoje}`;
}

async function obterContagemDiaria(kv, ip) {
    const valor = await kv.get(obterChaveContagem(ip));
    return valor ? parseInt(valor, 10) : 0;
}

async function incrementarContagemDiaria(kv, ip, contagemAtual) {
    await kv.put(obterChaveContagem(ip), String(contagemAtual + 1), {
        expirationTtl: TTL_CONTADOR_DIARIO_SEGUNDOS
    });
}

/* ============================================================
 * Workers AI (com fallback de modelo)
 * ============================================================ */

/**
 * Consulta a Workers AI com o modelo principal e, em caso de falha,
 * tenta o modelo secundário antes de recorrer ao nome genérico.
 * Contrato: SCX-SPEC-AI-001, seções 3 e 7.
 * @param {any} ai binding env.AI
 * @param {string} textSample
 * @returns {Promise<{ suggestedName: string, fallback?: boolean }>}
 */
async function consultarWorkersAiComFallback(ai, textSample) {
    for (const modelo of [MODELO_PRINCIPAL, MODELO_SECUNDARIO]) {
        try {
            const nome = await consultarModelo(ai, modelo, textSample);
            if (nome) {
                return { suggestedName: nome };
            }
        } catch (erro) {
            console.error(`Falha ao consultar o modelo ${modelo}:`, erro);
        }
    }

    return { suggestedName: gerarNomeGenerico(), fallback: true };
}

/**
 * Executa a inferência em um único modelo e extrai o campo
 * "suggestedName" da resposta em JSON.
 * @param {any} ai
 * @param {string} modelo
 * @param {string} textSample
 * @returns {Promise<string|null>}
 */
async function consultarModelo(ai, modelo, textSample) {
    const resposta = await ai.run(modelo, {
        messages: [
            { role: 'system', content: PROMPT_SISTEMA },
            { role: 'user', content: `Texto extraído do PDF: ${textSample}` }
        ],
        max_tokens: 50
    });

    const textoGerado = resposta?.response || '';
    return extrairNomeSugeridoDoTexto(textoGerado);
}

/**
 * Extrai o valor de "suggestedName" da saída do modelo, tolerando
 * texto extra ao redor do JSON esperado.
 * @param {string} textoGerado
 * @returns {string|null}
 */
function extrairNomeSugeridoDoTexto(textoGerado) {
    try {
        const objeto = JSON.parse(textoGerado.trim());
        if (objeto && typeof objeto.suggestedName === 'string') {
            return objeto.suggestedName;
        }
    } catch {
        // Modelo pode envolver o JSON em texto adicional; tenta extrair via regex.
        const correspondencia = textoGerado.match(/"suggestedName"\s*:\s*"([^"]+)"/);
        if (correspondencia) {
            return correspondencia[1];
        }
    }
    return null;
}

/**
 * Gera o nome de fallback obrigatório quando toda a cadeia de IA falha.
 * @returns {string}
 */
function gerarNomeGenerico() {
    const agora = new Date();
    const pad = (numero) => String(numero).padStart(2, '0');
    const carimbo = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}_` +
        `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
    return `documento_organizado_${carimbo}`;
}

/* ============================================================
 * Sanitização e validação
 * ============================================================ */

const MAPA_ACENTOS = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
};

/**
 * Sanitiza o nome retornado pela IA antes de devolvê-lo ao frontend.
 * Contrato: SCX-SPEC-AI-001, seção 5.2 (regras obrigatórias).
 * @param {string} nomeOriginal
 * @returns {string}
 */
function sanitizarNomeSugerido(nomeOriginal) {
    if (!nomeOriginal || typeof nomeOriginal !== 'string') {
        return gerarNomeGenerico();
    }

    let nome = nomeOriginal
        .toLowerCase()
        .split('')
        .map((caractere) => MAPA_ACENTOS[caractere] || caractere)
        .join('');

    nome = nome.trim().replace(/\s+/g, '_');
    nome = nome.replace(/[^a-z0-9_]/g, '');
    nome = nome.replace(/_+/g, '_');
    nome = nome.replace(/^_+|_+$/g, '');

    if (nome.length > TAMANHO_MAXIMO_NOME) {
        nome = nome.slice(0, TAMANHO_MAXIMO_NOME).replace(/_+$/g, '');
    }

    return nome || gerarNomeGenerico();
}

/**
 * Limita e limpa a amostra de texto recebida do frontend antes de
 * qualquer uso (cache, IA ou armazenamento).
 * @param {string} textoOriginal
 * @returns {string}
 */
function sanitizarAmostra(textoOriginal) {
    if (!textoOriginal || typeof textoOriginal !== 'string') {
        return '';
    }
    // eslint-disable-next-line no-control-regex
    return textoOriginal.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_MAXIMO_AMOSTRA);
}

/**
 * Detecta padrões de dados pessoais sensíveis (CPF, CNPJ, valores
 * monetários) para descarte silencioso de feedback de treinamento.
 * Contrato: SCX-SPEC-AI-001, seção 6.3.
 * @param {string} texto
 * @returns {boolean}
 */
function contemDadoSensivel(texto) {
    if (!texto) {
        return false;
    }

    const padroes = [
        /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
        /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, // CNPJ
        /\bR\$\s?\d+([.,]\d+)?\b/i, // valores monetários em reais
        /\b\d{5}-?\d{3}\b/ // CEP
    ];

    return padroes.some((padrao) => padrao.test(texto));
}

/* ============================================================
 * Utilitários de infraestrutura
 * ============================================================ */

function obterIpDoCliente(request) {
    return request.headers.get('CF-Connecting-IP') || 'ip-desconhecido';
}

/**
 * Gera um hash estável do texto para uso como chave de cache/KV.
 * A especificação (SCX-SPEC-AI-001, seção 4.2) pede MD5, mas o
 * runtime de Workers não expõe MD5 nativamente via Web Crypto —
 * usamos SHA-256 (mesmo papel de chave opaca e não reversível,
 * sem qualquer implicação de segurança para este uso de cache).
 * @param {string} texto
 * @returns {Promise<string>}
 */
async function gerarHash(texto) {
    const bytesCodificados = new TextEncoder().encode(texto);
    const bufferHash = await crypto.subtle.digest('SHA-256', bytesCodificados);
    return Array.from(new Uint8Array(bufferHash))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function construirCabecalhosCors(origemPermitida) {
    return {
        'Access-Control-Allow-Origin': origemPermitida || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token'
    };
}

function respostaJson(corpo, status, cabecalhosCors) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { 'Content-Type': 'application/json', ...cabecalhosCors }
    });
}
