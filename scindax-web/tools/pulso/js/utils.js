function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent =
    value ?? "";
}

function formatNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "0";
  }

  return number.toLocaleString("pt-BR");
}

function getDayLabel(day) {
  const value = Number(day);

  if (!Number.isFinite(value) || value <= 0) {
    return "Dia 00";
  }

  return `Dia ${String(value).padStart(2, "0")}`;
}

function getWeekLabel(week) {
  if (!week) {
    return "Semana 0";
  }

  if (
    typeof week === "string" &&
    week.toLowerCase().startsWith("semana")
  ) {
    return week;
  }

  return `Semana ${week}`;
}

function getStatusLabel(status) {
  if (!status) {
    return "";
  }

  const labels = {
    "Não Iniciada": "Não iniciada",
    "Em Andamento": "Em andamento",
    "Enviada": "Em validação",
    "Validada": "Validada",
    "Recusada": "Recusada"
  };

  return labels[status] || status;
}

function showStatus(
  elementId,
  message,
  type = "info"
) {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  element.textContent =
    message || "";

  element.className =
    `${elementId} ${type}`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStoredParticipant() {
  try {
    const data =
      localStorage.getItem(
        "pulso_participant"
      );

    return data
      ? JSON.parse(data)
      : null;

  } catch {
    return null;
  }
}

function isLoggedIn() {
  return Boolean(
    localStorage.getItem(
      "pulso_participant_id"
    )
  );
}