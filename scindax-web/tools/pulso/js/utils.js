function formatDate(date) {
  if (!date) return "";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toLocaleDateString("pt-BR");
}

function formatNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "0";
  }

  return number.toLocaleString("pt-BR");
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent =
    value === null ||
    value === undefined ||
    value === ""
      ? "—"
      : value;
}

function setDisplay(id, visible) {
  const element = document.getElementById(id);

  if (!element) return;

  element.style.display =
    visible ? "" : "none";
}

function showElement(id) {
  setDisplay(id, true);
}

function hideElement(id) {
  setDisplay(id, false);
}

function calculatePercentage(completed, total) {
  if (!total) return 0;

  return Math.round(
    (Number(completed) / Number(total)) * 100
  );
}

function getStatusLabel(status) {
  const labels = {
    "Não Iniciada": "Não iniciada",
    "Em Andamento": "Em andamento",
    "Enviada": "Em validação",
    "Validada": "Concluída",
    "Recusada": "Recusada"
  };

  return labels[status] || status || "Não iniciada";
}

function getWeekLabel(week) {
  if (!week) return "Semana 1";

  return week;
}

function getDayLabel(day) {
  if (!day) return "Dia 00";

  return `Dia ${String(day).padStart(2, "0")}`;
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

function showError(elementId, message) {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  element.textContent = message || "";
  element.classList.toggle(
    "visible",
    Boolean(message)
  );
}

function showStatus(elementId, message, type = "info") {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  element.textContent = message || "";

  element.className =
    `${element.className
      .replace(/\b(success|error|info|warning)\b/g, "")
      .trim()} ${type}`.trim();
}

function getStoredUser() {
  const data =
    localStorage.getItem("pulso_user");

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}