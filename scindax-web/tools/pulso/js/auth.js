document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupLogout();
  checkSession();
});

function setupLogin() {
  const form =
    document.getElementById("login-form");

  if (!form) return;

  form.addEventListener(
    "submit",
    handleLoginSubmit
  );
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email =
    document
      .getElementById("login-email")
      ?.value.trim();

  const password =
    document
      .getElementById("login-password")
      ?.value || "";

  const error =
    document.getElementById(
      "login-error"
    );

  const button =
    document.querySelector(
      "#login-form button[type='submit']"
    );

  clearLoginError();

  if (!email || !password) {
    showLoginError(
      "Informe e-mail e senha."
    );
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Entrando...";
    }

    const data =
      await apiLogin(
        email,
        password
      );

    if (
      !data.success ||
      !data.participant
    ) {
      throw new Error(
        "Não foi possível entrar."
      );
    }

    localStorage.setItem(
      "pulso_participant_id",
      String(data.participant.id)
    );

    localStorage.setItem(
      "pulso_participant",
      JSON.stringify(
        data.participant
      )
    );

    showDashboard();

    await loadDashboard();

  } catch (err) {
    console.error(err);

    showLoginError(
      err.message ||
      "E-mail ou senha inválidos."
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Entrar";
    }
  }
}

function setupLogout() {
  const button =
    document.getElementById(
      "logout-btn"
    );

  if (!button) return;

  button.addEventListener(
    "click",
    logout
  );
}

function logout() {
  localStorage.removeItem(
    "pulso_participant_id"
  );

  localStorage.removeItem(
    "pulso_participant"
  );

  showLogin();
}

function checkSession() {
  const participantId =
    localStorage.getItem(
      "pulso_participant_id"
    );

  if (!participantId) {
    showLogin();
    return;
  }

  showDashboard();

  if (
    typeof loadDashboard ===
    "function"
  ) {
    loadDashboard();
  }
}

function showLogin() {
  const login =
    document.getElementById(
      "login-screen"
    );

  const dashboard =
    document.getElementById(
      "dashboard-screen"
    );

  if (login) {
    login.classList.add("active");
  }

  if (dashboard) {
    dashboard.classList.remove(
      "active"
    );
  }
}

function showDashboard() {
  const login =
    document.getElementById(
      "login-screen"
    );

  const dashboard =
    document.getElementById(
      "dashboard-screen"
    );

  if (login) {
    login.classList.remove(
      "active"
    );
  }

  if (dashboard) {
    dashboard.classList.add(
      "active"
    );
  }
}

function showLoginError(message) {
  const error =
    document.getElementById(
      "login-error"
    );

  if (!error) return;

  error.textContent = message;
  error.classList.add("visible");
}

function clearLoginError() {
  const error =
    document.getElementById(
      "login-error"
    );

  if (!error) return;

  error.textContent = "";
  error.classList.remove(
    "visible"
  );
}