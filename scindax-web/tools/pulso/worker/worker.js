const TABLES = {
  EMPRESAS: 1148492,
  PARTICIPANTES: 1148493,
  ACOES: 1148495,
  OFENSIVAS: 1148496,
  EXECUCAO_ACOES: 1148497,
  EVIDENCIAS: 1148498
};

const BASEROW_API = "https://api.baserow.io";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return corsResponse(null, 204);
      }

      return await router(request, env, url);

    } catch (error) {
      console.error(error);

      return corsResponse(
        {
          error: "Erro interno do servidor"
        },
        500
      );
    }
  }
};

async function router(request, env, url) {

  const path = url.pathname.replace(/^\/api\/pulso/, "");

  if (path === "/auth/login" && request.method === "POST") {
    return await handleLogin(request, env);
  }

  if (path === "/participant/justificativa" && request.method === "GET") {
    return await handleDashboard(request, env);
  }

  if (path === "/participant/today-action" && request.method === "GET") {
    return await handleTodayAction(request, env);
  }

  if (path === "/participant/execute-action" && request.method === "POST") {
    return await handleExecuteAction(request, env);
  }

  if (path === "/participant/submit-evidence" && request.method === "POST") {
    return await handleSubmitEvidence(request, env);
  }

  if (path === "/participant/progress" && request.method === "GET") {
    return await handleProgress(request, env);
  }

  if (path === "/participant/timeline" && request.method === "GET") {
    return await handleTimeline(request, env);
  }

  if (path === "/participant/company" && request.method === "GET") {
    return await handleCompany(request, env);
  }

  if (path === "/debug/justificativa" && request.method === "GET") {
    return await handleDebugJustificativa(request, env);
  }

  return jsonResponse(
    {
      error: "Rota não encontrada"
    },
    404
  );
}

function getBaserowHeaders(env) {
  return {
    "Authorization": `Token ${env.BASEROW_TOKEN}`,
    "Content-Type": "application/json"
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://scindax.com.br",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Participant-Id"
  };
}

function corsResponse(data, status = 200) {
  return new Response(
    data === null ? null : JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders()
      }
    }
  );
}

function jsonResponse(data, status = 200) {
  return corsResponse(data, status);
}

function getParticipantId(request) {
  const participantId = request.headers.get("X-Participant-Id");

  if (!participantId) {
    return null;
  }

  const id = Number(participantId);

  if (!Number.isInteger(id)) {
    return null;
  }

  return id;
}

async function baserowFetch(env, path, options = {}) {

  const response = await fetch(
    `${BASEROW_API}${path}`,
    {
      ...options,
      headers: {
        ...getBaserowHeaders(env),
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Baserow error:", errorText);

    throw new Error("Erro na comunicação com o Baserow");
  }

  return response.json();
}

/* ============================================================
   LOGIN
============================================================ */

async function handleLogin(request, env) {

  const body = await request.json();

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return jsonResponse(
      {
        error: "Email e senha são obrigatórios"
      },
      400
    );
  }

  const url =
    `/api/database/rows/table/${TABLES.PARTICIPANTES}/` +
    `?user_field_names=true` +
    `&filter__E-mail__equal=${encodeURIComponent(email)}`;

  const data = await baserowFetch(env, url);

  if (!data.results || data.results.length === 0) {
    return jsonResponse(
      {
        error: "Email ou senha inválidos"
      },
      401
    );
  }

  const participant = data.results[0];

  /*
   * A validação real da senha será implementada
   * quando definirmos o mecanismo de autenticação.
   */

  return jsonResponse({
    success: true,
    participant: {
      id: participant.id,
      nome: participant.Nome,
      email: participant["E-mail"],
      empresa: participant.Empresa?.[0]?.value || null,
      empresa_id: participant.Empresa?.[0]?.id || null,
      papel: participant.Papel?.value || null,
      status: participant.Status?.value || null
    }
  });
}

/* ============================================================
   PARTICIPANTE
============================================================ */

async function getParticipant(id, env) {

  return await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.PARTICIPANTES}/${id}/?user_field_names=true`
  );
}

async function getEmpresa(id, env) {

  return await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.EMPRESAS}/${id}/?user_field_names=true`
  );
}

async function getOfensiva(id, env) {

  return await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.OFENSIVAS}/${id}/?user_field_names=true`
  );
}

async function getAcao(id, env) {

  return await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.ACOES}/${id}/?user_field_names=true`
  );
}

async function getAcoesDoParticipante(participantId, env) {

  const url =
    `/api/database/rows/table/${TABLES.EXECUCAO_ACOES}/` +
    `?user_field_names=true` +
    `&filter__Participante Responsável__link_row_has=${participantId}`;

  const data = await baserowFetch(env, url);

  if (!data.results) {
    return [];
  }

  const acoes = [];

  for (const exec of data.results) {

    if (!exec.Ação || exec.Ação.length === 0) {
      continue;
    }

    const acao = await getAcao(exec.Ação[0].id, env);

    if (!acao) {
      continue;
    }

    acoes.push({
      ...acao,
      executionId: exec.id,
      status: exec.Status?.value || "Não Iniciada",
      percentual: exec["Percentual de Conclusão"] || 0,
      isCompleted: exec.Status?.value === "Validada"
    });
  }

  return acoes;
}

/* ============================================================
   DASHBOARD
============================================================ */

async function handleDashboard(request, env) {

  const participantId = getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const participant = await getParticipant(participantId, env);

  if (!participant) {
    return jsonResponse(
      {
        error: "Participante não encontrado"
      },
      404
    );
  }

  let empresa = null;

  if (participant.Empresa?.length) {
    empresa = await getEmpresa(
      participant.Empresa[0].id,
      env
    );
  }

  const acoes = await getAcoesDoParticipante(
    participantId,
    env
  );

  let ofensiva = null;

  if (participant.OFENSIVAS?.length) {
    ofensiva = await getOfensiva(
      participant.OFENSIVAS[0].id,
      env
    );
  }

  const progress = calculateProgress(acoes);

  const todayAction = getTodayAction(acoes);

  return jsonResponse({
    participant: {
      id: participant.id,
      nome: participant.Nome,
      email: participant["E-mail"]
    },

    empresa: empresa
      ? {
          id: empresa.id,
          nome: empresa["Nome da Empresa"],
          fantasia: empresa["Nome Fantasia"] || null,
          perfil: empresa["Perfil Empresarial"]?.value || null,
          status: empresa.Status?.value || null
        }
      : null,

    ofensiva: ofensiva
      ? {
          id: ofensiva.id,
          nome: ofensiva["Nome da Ofensiva"],
          status: ofensiva.Status?.value || null
        }
      : null,

    progress,

    todayAction: todayAction
      ? {
          id: todayAction.id,
          codigo: todayAction["Código da Ação"],
          titulo: todayAction.Título,
          descricao: todayAction.Descrição,
          objetivo: todayAction.Objetivo,
          dia: todayAction.Dia,
          semana: todayAction.Semana?.value || null,
          status: todayAction.status,
          isCompleted: todayAction.isCompleted,
          executionId: todayAction.executionId
        }
      : null,

    stats: {
      total: acoes.length,
      concluidas: acoes.filter(a => a.isCompleted).length,
      pendentes: acoes.filter(
        a => a.status === "Não Iniciada"
      ).length,
      emValidacao: acoes.filter(
        a => a.status === "Enviada"
      ).length
    }
  });
}

/* ============================================================
   AÇÃO DO DIA
============================================================ */

function getTodayAction(acoes) {

  if (!acoes.length) {
    return null;
  }

  const pendentes = acoes
    .filter(a => !a.isCompleted)
    .sort(
      (a, b) =>
        (a.Dia || 0) - (b.Dia || 0)
    );

  if (pendentes.length) {
    return pendentes[0];
  }

  return [...acoes].sort(
    (a, b) =>
      (b.Dia || 0) - (a.Dia || 0)
  )[0];
}

async function handleTodayAction(request, env) {

  const participantId = getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const acoes = await getAcoesDoParticipante(
    participantId,
    env
  );

  const action = getTodayAction(acoes);

  if (!action) {
    return jsonResponse(
      {
        error: "Nenhuma ação encontrada"
      },
      404
    );
  }

  return jsonResponse({
    action
  });
}

/* ============================================================
   EXECUÇÃO
============================================================ */

async function handleExecuteAction(request, env) {

  const participantId = getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const body = await request.json();

  const executionId = Number(body.executionId);
  const comment = body.comment || "";

  if (!Number.isInteger(executionId)) {
    return jsonResponse(
      {
        error: "ID da execução é obrigatório"
      },
      400
    );
  }

  const executions =
    await getAcoesDoParticipante(
      participantId,
      env
    );

  const executionExists =
    executions.some(
      action => action.executionId === executionId
    );

  if (!executionExists) {
    return jsonResponse(
      {
        error: "Execução não pertence ao participante"
      },
      403
    );
  }

  const url =
    `/api/database/rows/table/${TABLES.EXECUCAO_ACOES}/${executionId}/` +
    `?user_field_names=true`;

  const data = await baserowFetch(
    env,
    url,
    {
      method: "PATCH",
      body: JSON.stringify({
        "Comentário do Participante": comment
      })
    }
  );

  return jsonResponse({
    success: true,
    execution: data
  });
}

/* ============================================================
   EVIDÊNCIA
============================================================ */

async function handleSubmitEvidence(request, env) {

  const participantId = getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const body = await request.json();

  const executionId = Number(body.executionId);
  const description = body.description?.trim();

  if (!executionId || !description) {
    return jsonResponse(
      {
        error: "ID da execução e descrição são obrigatórios"
      },
      400
    );
  }

  const participant =
    await getParticipant(
      participantId,
      env
    );

  if (!participant) {
    return jsonResponse(
      {
        error: "Participante não encontrado"
      },
      404
    );
  }

  const executions =
    await getAcoesDoParticipante(
      participantId,
      env
    );

  const executionExists =
    executions.some(
      action =>
        action.executionId === executionId
    );

  if (!executionExists) {
    return jsonResponse(
      {
        error: "Execução não pertence ao participante"
      },
      403
    );
  }

  const payload = {
    "Descrição": description,
    "Tipo de Evidência": 7302786,
    "Data de Envio":
      new Date().toISOString().split("T")[0],
    "Status de Validação": 7302793,
    "Execução da Ação": [executionId],
    "Participante": [participantId],
    "Empresa": participant.Empresa || [],
    "Ofensiva": participant.OFENSIVAS || []
  };

  const data = await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.EVIDENCIAS}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

  await baserowFetch(
    env,
    `/api/database/rows/table/${TABLES.EXECUCAO_ACOES}/${executionId}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify({
        Status: 7302782
      })
    }
  );

  return jsonResponse({
    success: true,
    evidence: data,
    message:
      "Evidência enviada com sucesso! Aguardando validação."
  });
}

/* ============================================================
   PROGRESSO
============================================================ */

function calculateProgress(acoes) {

  const total = acoes.length;

  const concluidas =
    acoes.filter(
      a => a.isCompleted
    ).length;

  return {
    total,
    concluidas,
    percentual:
      total
        ? Math.round(
            (concluidas / total) * 100
          )
        : 0,
    restantes:
      total - concluidas
  };
}

async function handleProgress(request, env) {

  const participantId =
    getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const acoes =
    await getAcoesDoParticipante(
      participantId,
      env
    );

  const progress =
    calculateProgress(acoes);

  const semanas = {};

  for (const acao of acoes) {

    const semana =
      acao.Semana?.value ||
      "Semana 1";

    if (!semanas[semana]) {
      semanas[semana] = {
        total: 0,
        concluidas: 0
      };
    }

    semanas[semana].total++;

    if (acao.isCompleted) {
      semanas[semana].concluidas++;
    }
  }

  return jsonResponse({
    progress,
    semanas,
    acoes: acoes.map(a => ({
      id: a.id,
      titulo: a.Título,
      dia: a.Dia,
      semana: a.Semana?.value || null,
      status: a.status,
      isCompleted: a.isCompleted
    }))
  });
}

/* ============================================================
   TIMELINE
============================================================ */

async function handleTimeline(request, env) {

  const participantId =
    getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const acoes =
    await getAcoesDoParticipante(
      participantId,
      env
    );

  const timeline = {};

  for (const acao of acoes) {

    const semana =
      acao.Semana?.value ||
      "Semana 1";

    if (!timeline[semana]) {
      timeline[semana] = [];
    }

    timeline[semana].push({
      dia: acao.Dia,
      titulo: acao.Título,
      status: acao.status,
      isCompleted: acao.isCompleted
    });
  }

  for (const semana in timeline) {

    timeline[semana].sort(
      (a, b) =>
        (a.dia || 0) -
        (b.dia || 0)
    );
  }

  return jsonResponse({
    timeline
  });
}

/* ============================================================
   EMPRESA
============================================================ */

async function handleCompany(request, env) {

  const participantId =
    getParticipantId(request);

  if (!participantId) {
    return jsonResponse(
      {
        error: "Não autorizado"
      },
      401
    );
  }

  const participant =
    await getParticipant(
      participantId,
      env
    );

  if (
    !participant ||
    !participant.Empresa?.length
  ) {
    return jsonResponse(
      {
        error: "Empresa não encontrada"
      },
      404
    );
  }

  const empresa =
    await getEmpresa(
      participant.Empresa[0].id,
      env
    );

  let ofensiva = null;

  if (participant.OFENSIVAS?.length) {
    ofensiva =
      await getOfensiva(
        participant.OFENSIVAS[0].id,
        env
      );
  }

  return jsonResponse({
    empresa: {
      id: empresa.id,
      nome: empresa["Nome da Empresa"],
      fantasia:
        empresa["Nome Fantasia"] || null,
      perfil:
        empresa["Perfil Empresarial"]?.value ||
        null,
      segmento:
        empresa.Segmento || null,
      cidade:
        empresa.Cidade || null,
      estado:
        empresa.Estado || null,
      status:
        empresa.Status?.value || null,
      dataCadastro:
        empresa["Data de Cadastro"] || null
    },

    ofensiva: ofensiva
      ? {
          id: ofensiva.id,
          nome:
            ofensiva["Nome da Ofensiva"],
          dataInicio:
            ofensiva["Data de Início"],
          dataTermino:
            ofensiva["Data de Término"]
        }
      : null
  });
}

async function handleDebugJustificativa(request, env) {
  const data = await baserowFetch(
    env,
    "/api/database/fields/table/1152435/"
  );

  return jsonResponse(data);
}