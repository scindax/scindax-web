const API_BASE_URL =
  "https://scindax-pulso-worker.contato-330.workers.dev/api/pulso";

async function apiRequest(endpoint, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Erro na requisição"
        );
    }

    return data;
}

async function apiLogin(
  email,
  password
) {
  return apiRequest(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    }
  );
}

async function apiDashboard() {
  return apiRequest(
    "/participant/dashboard"
  );
}

async function apiTodayAction() {
  return apiRequest(
    "/participant/today-action"
  );
}

async function apiExecuteAction(
  executionId,
  comment
) {
  return apiRequest(
    "/participant/execute-action",
    {
      method: "POST",
      body: JSON.stringify({
        executionId,
        comment
      })
    }
  );
}

async function apiSubmitEvidence(
  executionId,
  description,
  evidenceTypes,
  file
) {
  const formData = new FormData();

  formData.append("executionId", executionId);
  formData.append("description", description);

  evidenceTypes.forEach(type => {
    formData.append("evidenceTypes", type);
  });

  if (file) {
    formData.append("file", file);
  }

  return apiRequest(
    "/participant/submit-evidence",
    {
      method: "POST",
      body: formData
    }
  );
}

async function apiProgress() {
  return apiRequest(
    "/participant/progress"
  );
}

async function apiTimeline() {
  return apiRequest(
    "/participant/timeline"
  );
}

async function apiCompany() {
  return apiRequest(
    "/participant/company"
  );
}