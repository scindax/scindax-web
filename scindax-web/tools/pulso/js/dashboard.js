let dashboardData = null;
let currentAction = null;

async function loadDashboard() {
  try {
    const data = await apiDashboard();

    dashboardData = data;
    currentAction = data.todayAction || null;

    renderDashboard(data);

  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);

    const participantId =
      localStorage.getItem("pulso_participant_id");

    if (!participantId) {
      showLogin();
      return;
    }

    showDashboardError(error.message);
  }
}

function renderDashboard(data) {
  renderParticipant(data);
  renderProgress(data);
  renderTodayAction(data.todayAction);
  renderStats(data.stats);
}

function renderParticipant(data) {
  const participant = data.participant || {};
  const company = data.empresa || {};

  const name = participant.nome || "Participante";

  setText("user-name", name);
  setText("company-name", company.nome || "Empresa");

  const greeting = document.getElementById(
    "greeting-text"
  );

  if (greeting) {
    greeting.innerHTML =
      `Olá, <span class="highlight">${escapeHtml(name)}</span>`;
  }
}

function renderProgress(data) {
  const progress = data.progress || {};

  const total = Number(progress.total || 0);
  const completed = Number(progress.concluidas || 0);
  const percentage = Number(
    progress.percentual || 0
  );

  setText(
    "progress-count",
    `${completed} de ${total}`
  );

  setText(
    "progress-percent",
    `${percentage}%`
  );

  const fill =
    document.getElementById("progress-fill");

  if (fill) {
    fill.style.width =
      `${Math.min(Math.max(percentage, 0), 100)}%`;
  }
}

function renderTodayAction(action) {
  const card =
    document.getElementById(
      "today-action-card"
    );

  if (!action) {
    currentAction = null;

    setText(
      "action-title",
      "Nenhuma ação disponível"
    );

    setText(
      "action-description",
      "Não há ações disponíveis no momento."
    );

    setText(
      "action-objective",
      ""
    );

    setText(
      "action-day",
      "Dia 00"
    );

    setText(
      "action-week",
      "Semana 0"
    );

    const button =
      document.getElementById(
        "action-primary-btn"
      );

    if (button) {
      button.disabled = true;
    }

    return;
  }

  currentAction = action;

  setText(
    "action-day",
    getDayLabel(action.dia)
  );

  setText(
    "action-week",
    getWeekLabel(action.semana)
  );

  setText(
    "action-title",
    action.titulo || "Ação"
  );

  setText(
    "action-description",
    action.descricao || ""
  );

  const objective =
    document.querySelector(
      "#action-objective span"
    );

  if (objective) {
    objective.textContent =
      action.objetivo || "—";
  }

  const status =
    document.getElementById(
      "action-status"
    );

  if (status) {
    status.textContent =
      getStatusLabel(action.status);

    status.className =
      `action-status status-${normalizeStatus(action.status)}`;
  }

  const button =
    document.getElementById(
      "action-primary-btn"
    );

  if (!button) return;

  button.disabled =
    action.isCompleted === true;

  button.textContent =
    action.isCompleted
      ? "Ação concluída"
      : "Executar ação";

  if (!button.dataset.listener) {
    button.addEventListener(
      "click",
      openExecutionModal
    );

    button.dataset.listener = "true";
  }

  if (card) {
    card.dataset.actionId =
      action.id || "";
  }
}

function renderStats(stats) {
  stats = stats || {};

  setText(
    "stat-concluidas",
    formatNumber(stats.concluidas || 0)
  );

  setText(
    "stat-pendentes",
    formatNumber(stats.pendentes || 0)
  );

  setText(
    "stat-validacao",
    formatNumber(stats.emValidacao || 0)
  );
}

function normalizeStatus(status) {
  if (!status) return "default";

  return status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function showDashboardError(message) {
  const status =
    document.getElementById(
      "action-status"
    );

  if (status) {
    status.textContent =
      message || "Erro ao carregar dados.";

    status.className =
      "action-status error";
  }
}

/* ============================================================
   MODAL DE EXECUÇÃO
============================================================ */

function openExecutionModal() {
  if (!currentAction) return;

  const modal =
    document.getElementById(
      "execution-modal"
    );

  if (!modal) return;

  setText(
    "modal-action-title",
    currentAction.titulo || ""
  );

  const comment =
    document.getElementById(
      "execution-comment"
    );

  if (comment) {
    comment.value = "";
  }

  showStatus(
    "execution-status",
    "",
    "info"
  );

  modal.classList.add("active");
}

function closeExecutionModal() {
  const modal =
    document.getElementById(
      "execution-modal"
    );

  if (modal) {
    modal.classList.remove("active");
  }
}

async function saveExecution() {
  if (!currentAction) return;

  const comment =
    document.getElementById(
      "execution-comment"
    )?.value.trim() || "";

  const status =
    document.getElementById(
      "execution-status"
    );

  const button =
    document.getElementById(
      "modal-save-execution"
    );

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    const response =
      await apiExecuteAction(
        currentAction.executionId,
        comment
      );

    if (!response.success) {
      throw new Error(
        "Não foi possível salvar a execução."
      );
    }

    showStatus(
      "execution-status",
      "Execução salva.",
      "success"
    );

    await loadDashboard();

  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent =
        error.message ||
        "Erro ao salvar execução.";

      status.className =
        "execution-status error";
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "Salvar execução";
    }
  }
}

/* ============================================================
   MODAL DE EVIDÊNCIA
============================================================ */

function openEvidenceModal() {
  if (!currentAction) return;

  closeExecutionModal();

  const modal =
    document.getElementById(
      "evidence-modal"
    );

  if (!modal) return;

  const description =
    document.getElementById(
      "evidence-description"
    );

  if (description) {
    description.value = "";
  }

  const file =
    document.getElementById(
      "evidence-file"
    );

  if (file) {
    file.value = "";
  }

  const fileInfo =
    document.getElementById(
      "file-info"
    );

  if (fileInfo) {
    fileInfo.textContent = "";
  }

  showStatus(
    "evidence-status",
    "",
    "info"
  );

  modal.classList.add("active");
}

function closeEvidenceModal() {
  const modal =
    document.getElementById(
      "evidence-modal"
    );

  if (modal) {
    modal.classList.remove("active");
  }
}

async function submitEvidence() {
    const executionId = currentAction?.executionId;

    const description = document
        .getElementById("evidence-description")
        .value
        .trim();

    const fileInput = document.getElementById("evidence-file");
    const file = fileInput?.files?.[0] || null;

    const selectedTypes = [
        ...document.querySelectorAll(
            'input[name="evidence-type"]:checked'
        )
    ].map(input => Number(input.value));

    const button = document.getElementById(
        "evidence-submit-btn"
    );

    const status = document.getElementById(
        "evidence-status"
    );

    if (!description) {
        status.textContent =
            "Descreva a evidência.";
        return;
    }

    if (!selectedTypes.length) {
        status.textContent =
            "Selecione o tipo da evidência.";
        return;
    }

    button.disabled = true;
    status.textContent = "Enviando...";

    try {
        await apiSubmitEvidence(
            executionId,
            description,
            selectedTypes,
            file
        );

        status.textContent =
            "Evidência enviada com sucesso.";

        document.getElementById(
            "evidence-description"
        ).value = "";

        document.querySelectorAll(
            'input[name="evidence-type"]'
        ).forEach(input => {
            input.checked = false;
        });

        if (fileInput) {
            fileInput.value = "";
        }

        setTimeout(() => {
            closeEvidenceModal();
            loadDashboard();
        }, 1000);

    } catch (error) {
        console.error(
            "Erro ao enviar evidência:",
            error
        );

        status.textContent =
            error.message ||
            "Erro ao enviar evidência.";
    } finally {
        button.disabled = false;
    }
}

/* ============================================================
   EVENTOS
============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const closeExecution =
      document.getElementById(
        "modal-close"
      );

    if (closeExecution) {
      closeExecution.addEventListener(
        "click",
        closeExecutionModal
      );
    }

    const closeEvidence =
      document.getElementById(
        "evidence-modal-close"
      );

    if (closeEvidence) {
      closeEvidence.addEventListener(
        "click",
        closeEvidenceModal
      );
    }

    const saveButton =
      document.getElementById(
        "modal-save-execution"
      );

    if (saveButton) {
      saveButton.addEventListener(
        "click",
        saveExecution
      );
    }

    const evidenceButton =
      document.getElementById(
        "modal-submit-evidence"
      );

    if (evidenceButton) {
      evidenceButton.addEventListener(
        "click",
        openEvidenceModal
      );
    }

    const submitEvidenceButton =
      document.getElementById(
        "evidence-submit-btn"
      );

    if (submitEvidenceButton) {
      submitEvidenceButton.addEventListener(
        "click",
        submitEvidence
      );
    }

    const fileInput =
      document.getElementById(
        "evidence-file"
      );

    if (fileInput) {
      fileInput.addEventListener(
        "change",
        handleFileSelection
      );
    }
  }
);

function handleFileSelection(event) {

  const file =
    event.target.files?.[0];

  const info =
    document.getElementById(
      "file-info"
    );

  if (!info) return;

  if (!file) {
    info.textContent = "";
    return;
  }

  info.textContent =
    `${file.name} • ${formatFileSize(file.size)}`;
}

function formatFileSize(bytes) {

  if (!bytes) return "0 KB";

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}