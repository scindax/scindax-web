const LOGIN_STORAGE_KEY = "pulso_participant_id";
const USER_STORAGE_KEY = "pulso_user";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  if (!loginForm) return;

  loginForm.addEventListener("submit", handleLogin);

  checkSession();
});

async function handleLogin(event) {
  event.preventDefault();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const errorElement = document.getElementById("login-error");
  const button = event.submitter;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorElement.textContent = "";

  if (!email || !password) {
    errorElement.textContent =
      "Informe seu e-mail e sua senha.";
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Entrando...";
    }

    const response = await apiLogin(email, password);

    if (!response.success || !response.participant) {
      throw new Error("Email ou senha inválidos");
    }

    const participant = response.participant;

    localStorage.setItem(
      LOGIN_STORAGE_KEY,
      String(participant.id)
    );

    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify(participant)
    );

    showDashboard();

    if (typeof loadDashboard === "function") {
      await loadDashboard();
    }

  } catch (error) {
    console.error(error);

    errorElement.textContent =
      error.message || "Não foi possível entrar.";

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Entrar";
    }
  }
}

function checkSession() {
  const participantId =
    localStorage.getItem(LOGIN_STORAGE_KEY);

  if (!participantId) {
    showLogin();
    return;
  }

  showDashboard();

  if (typeof loadDashboard === "function") {
    loadDashboard().catch(() => {
      logout();
    });
  }
}

function showLogin() {
  const loginScreen =
    document.getElementById("login-screen");

  const dashboardScreen =
    document.getElementById("dashboard-screen");

  if (loginScreen) {
    loginScreen.classList.add("active");
  }

  if (dashboardScreen) {
    dashboardScreen.classList.remove("active");
  }
}

function showDashboard() {
  const loginScreen =
    document.getElementById("login-screen");

  const dashboardScreen =
    document.getElementById("dashboard-screen");

  if (loginScreen) {
    loginScreen.classList.remove("active");
  }

  if (dashboardScreen) {
    dashboardScreen.classList.add("active");
  }
}

function logout() {
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);

  showLogin();

  const loginForm =
    document.getElementById("login-form");

  if (loginForm) {
    loginForm.reset();
  }
}

document.addEventListener("click", (event) => {
  if (event.target.id === "logout-btn") {
    logout();
  }
});