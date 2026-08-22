var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/worker.js
var LIMITE_DIARIO_POR_IP = 20;
var TTL_CONTADOR_DIARIO_SEGUNDOS = 86400;
var TTL_CACHE_SUGESTAO_SEGUNDOS = 604800;
var TTL_TREINAMENTO_SEGUNDOS = 2592e3;
var TAMANHO_MAXIMO_NOME = 50;
var TAMANHO_MAXIMO_AMOSTRA = 500;
var MODELO_PRINCIPAL = "@cf/microsoft/phi-3-mini-4k-instruct";
var MODELO_SECUNDARIO = "@cf/meta/llama-3-8b-instruct";
var PROMPT_SISTEMA = 'Voc\xEA \xE9 um assistente especializado em sugerir nomes para arquivos PDF. Sua tarefa \xE9 analisar o fragmento de texto fornecido e gerar um nome curto, descritivo e em snake_case, sem extens\xE3o. O nome deve conter apenas letras min\xFAsculas, n\xFAmeros e underscores (_). N\xE3o inclua espa\xE7os, acentos, caracteres especiais ou s\xEDmbolos como &, %, $, etc. Responda APENAS com um objeto JSON no formato: { "suggestedName": "nome_aqui" }.';
var worker_default = {
  /**
   * Roteador principal do Worker.
   * @param {Request} request
   * @param {{ SCX_KV: KVNamespace, AI: any, TURNSTILE_SECRET_KEY: string, ALLOWED_ORIGIN: string }} env
   */
  async fetch(request, env) {
    const cabecalhosCors = construirCabecalhosCors(env.ALLOWED_ORIGIN);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cabecalhosCors });
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === "/check-limit" && request.method === "GET") {
        return await tratarCheckLimit(request, env, cabecalhosCors);
      }
      if (url.pathname === "/suggest-name" && request.method === "POST") {
        return await tratarSuggestName(request, env, cabecalhosCors);
      }
      if (url.pathname === "/training-feedback" && request.method === "POST") {
        return await tratarTrainingFeedback(request, env, cabecalhosCors);
      }
    } catch (erroInesperado) {
      console.error("Erro inesperado no Worker:", erroInesperado);
      return respostaJson({ error: "Erro interno." }, 500, cabecalhosCors);
    }
    return respostaJson({ error: "Rota n\xE3o encontrada." }, 404, cabecalhosCors);
  }
};
async function tratarCheckLimit(request, env, cabecalhosCors) {
  const token = request.headers.get("X-Turnstile-Token");
  const ip = obterIpDoCliente(request);
  const turnstileValido = await validarTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileValido) {
    return respostaJson({ error: "Falha na verifica\xE7\xE3o humana." }, 403, cabecalhosCors);
  }
  const contagemAtual = await obterContagemDiaria(env.SCX_KV, ip);
  if (contagemAtual >= LIMITE_DIARIO_POR_IP) {
    return respostaJson({ allowed: false, message: "Limite di\xE1rio atingido" }, 429, cabecalhosCors);
  }
  return respostaJson({ allowed: true, count: contagemAtual }, 200, cabecalhosCors);
}
__name(tratarCheckLimit, "tratarCheckLimit");
async function tratarSuggestName(request, env, cabecalhosCors) {
  const token = request.headers.get("X-Turnstile-Token");
  const ip = obterIpDoCliente(request);
  const turnstileValido = await validarTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileValido) {
    return respostaJson({ error: "Falha na verifica\xE7\xE3o humana." }, 403, cabecalhosCors);
  }
  const contagemAtual = await obterContagemDiaria(env.SCX_KV, ip);
  if (contagemAtual >= LIMITE_DIARIO_POR_IP) {
    return respostaJson({ allowed: false, message: "Limite di\xE1rio atingido" }, 429, cabecalhosCors);
  }
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return respostaJson({ error: "Corpo da requisi\xE7\xE3o inv\xE1lido." }, 400, cabecalhosCors);
  }
  const textSample = sanitizarAmostra(corpo.textSample);
  if (!textSample) {
    return respostaJson({ error: "textSample ausente ou vazio." }, 400, cabecalhosCors);
  }
  const chaveCache = `suggestion:${await gerarHash(textSample)}`;
  const sugestaoEmCache = await env.SCX_KV.get(chaveCache);
  if (sugestaoEmCache) {
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
__name(tratarSuggestName, "tratarSuggestName");
async function tratarTrainingFeedback(request, env, cabecalhosCors) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return respostaJson({ ok: false }, 400, cabecalhosCors);
  }
  const textSample = sanitizarAmostra(corpo.textSample);
  const aiSuggestion = sanitizarNomeSugerido(corpo.aiSuggestion || "");
  const userFinalName = sanitizarNomeSugerido(corpo.userFinalName || "");
  if (contemDadoSensivel(textSample) || contemDadoSensivel(userFinalName)) {
    return respostaJson({ ok: true }, 200, cabecalhosCors);
  }
  const chave = `training:${Date.now()}:${await gerarHash(textSample)}`;
  const registro = { textSample, aiSuggestion, userFinalName, approved: Boolean(corpo.approved) };
  await env.SCX_KV.put(chave, JSON.stringify(registro), { expirationTtl: TTL_TREINAMENTO_SEGUNDOS });
  return respostaJson({ ok: true }, 200, cabecalhosCors);
}
__name(tratarTrainingFeedback, "tratarTrainingFeedback");
async function validarTurnstile(token, chaveSecreta, ip) {
  if (!token) {
    return false;
  }
  const parametros = new URLSearchParams();
  parametros.append("secret", chaveSecreta);
  parametros.append("response", token);
  parametros.append("remoteip", ip);
  const resposta = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: parametros
  });
  const resultado = await resposta.json();
  return resultado.success === true;
}
__name(validarTurnstile, "validarTurnstile");
function obterChaveContagem(ip) {
  const hoje = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return `count:${ip}:${hoje}`;
}
__name(obterChaveContagem, "obterChaveContagem");
async function obterContagemDiaria(kv, ip) {
  const valor = await kv.get(obterChaveContagem(ip));
  return valor ? parseInt(valor, 10) : 0;
}
__name(obterContagemDiaria, "obterContagemDiaria");
async function incrementarContagemDiaria(kv, ip, contagemAtual) {
  await kv.put(obterChaveContagem(ip), String(contagemAtual + 1), {
    expirationTtl: TTL_CONTADOR_DIARIO_SEGUNDOS
  });
}
__name(incrementarContagemDiaria, "incrementarContagemDiaria");
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
__name(consultarWorkersAiComFallback, "consultarWorkersAiComFallback");
async function consultarModelo(ai, modelo, textSample) {
  const resposta = await ai.run(modelo, {
    messages: [
      { role: "system", content: PROMPT_SISTEMA },
      { role: "user", content: `Texto extra\xEDdo do PDF: ${textSample}` }
    ],
    max_tokens: 50
  });
  const textoGerado = resposta?.response || "";
  return extrairNomeSugeridoDoTexto(textoGerado);
}
__name(consultarModelo, "consultarModelo");
function extrairNomeSugeridoDoTexto(textoGerado) {
  try {
    const objeto = JSON.parse(textoGerado.trim());
    if (objeto && typeof objeto.suggestedName === "string") {
      return objeto.suggestedName;
    }
  } catch {
    const correspondencia = textoGerado.match(/"suggestedName"\s*:\s*"([^"]+)"/);
    if (correspondencia) {
      return correspondencia[1];
    }
  }
  return null;
}
__name(extrairNomeSugeridoDoTexto, "extrairNomeSugeridoDoTexto");
function gerarNomeGenerico() {
  const agora = /* @__PURE__ */ new Date();
  const pad = /* @__PURE__ */ __name((numero) => String(numero).padStart(2, "0"), "pad");
  const carimbo = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}_${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
  return `documento_organizado_${carimbo}`;
}
__name(gerarNomeGenerico, "gerarNomeGenerico");
var MAPA_ACENTOS = {
  "\xE1": "a",
  "\xE0": "a",
  "\xE3": "a",
  "\xE2": "a",
  "\xE4": "a",
  "\xE9": "e",
  "\xE8": "e",
  "\xEA": "e",
  "\xEB": "e",
  "\xED": "i",
  "\xEC": "i",
  "\xEE": "i",
  "\xEF": "i",
  "\xF3": "o",
  "\xF2": "o",
  "\xF5": "o",
  "\xF4": "o",
  "\xF6": "o",
  "\xFA": "u",
  "\xF9": "u",
  "\xFB": "u",
  "\xFC": "u",
  "\xE7": "c",
  "\xF1": "n"
};
function sanitizarNomeSugerido(nomeOriginal) {
  if (!nomeOriginal || typeof nomeOriginal !== "string") {
    return gerarNomeGenerico();
  }
  let nome = nomeOriginal.toLowerCase().split("").map((caractere) => MAPA_ACENTOS[caractere] || caractere).join("");
  nome = nome.trim().replace(/\s+/g, "_");
  nome = nome.replace(/[^a-z0-9_]/g, "");
  nome = nome.replace(/_+/g, "_");
  nome = nome.replace(/^_+|_+$/g, "");
  if (nome.length > TAMANHO_MAXIMO_NOME) {
    nome = nome.slice(0, TAMANHO_MAXIMO_NOME).replace(/_+$/g, "");
  }
  return nome || gerarNomeGenerico();
}
__name(sanitizarNomeSugerido, "sanitizarNomeSugerido");
function sanitizarAmostra(textoOriginal) {
  if (!textoOriginal || typeof textoOriginal !== "string") {
    return "";
  }
  return textoOriginal.replace(/[\x00-\x1F\x7F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO_AMOSTRA);
}
__name(sanitizarAmostra, "sanitizarAmostra");
function contemDadoSensivel(texto) {
  if (!texto) {
    return false;
  }
  const padroes = [
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
    // CPF
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
    // CNPJ
    /\bR\$\s?\d+([.,]\d+)?\b/i,
    // valores monetários em reais
    /\b\d{5}-?\d{3}\b/
    // CEP
  ];
  return padroes.some((padrao) => padrao.test(texto));
}
__name(contemDadoSensivel, "contemDadoSensivel");
function obterIpDoCliente(request) {
  return request.headers.get("CF-Connecting-IP") || "ip-desconhecido";
}
__name(obterIpDoCliente, "obterIpDoCliente");
async function gerarHash(texto) {
  const bytesCodificados = new TextEncoder().encode(texto);
  const bufferHash = await crypto.subtle.digest("SHA-256", bytesCodificados);
  return Array.from(new Uint8Array(bufferHash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(gerarHash, "gerarHash");
function construirCabecalhosCors(origemPermitida) {
  return {
    "Access-Control-Allow-Origin": origemPermitida || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token"
  };
}
__name(construirCabecalhosCors, "construirCabecalhosCors");
function respostaJson(corpo, status, cabecalhosCors) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", ...cabecalhosCors }
  });
}
__name(respostaJson, "respostaJson");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
