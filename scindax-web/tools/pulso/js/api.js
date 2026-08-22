const PULSO_API = "https://scindax.com.br/api/pulso";

async function apiRequest(endpoint, options = {}) {
  const participantId = localStorage.getItem("pulso_participant_id");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (participantId) {
    headers["X-Participant-Id"] = participantId;
  }

  const response = await fetch(
    `${PULSO_API}${endpoint}`,
    {
      ...options,
      headers
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Erro ao comunicar com o servidor"
    );
  }

  return data;
}

async function apiLogin(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });
}

async function apiDashboard() {
  return apiRequest("/participant/dashboard");
}

async function apiTodayAction() {
  return apiRequest("/participant/today-action");
}

async function apiExecuteAction(executionId, comment) {
  return apiRequest("/participant/execute-action", {
    method: "POST",
    body: JSON.stringify({
      executionId,
      comment
    })
  });
}

async function apiSubmitEvidence(
  executionId,
  description
) {
  return apiRequest("/participant/submit-evidence", {
    method: "POST",
    body: JSON.stringify({
      executionId,
      description
    })
  });
}

async function apiProgress() {
  return apiRequest("/participant/progress");
}

async function apiTimeline() {
  return apiRequest("/participant/timeline");
}

async function apiCompany() {
  return apiRequest("/participant/company");
}