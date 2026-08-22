document.addEventListener("DOMContentLoaded", () => {
  initializePulso();
});

function initializePulso() {
  setupNavigation();
  setupModals();
  setupPageVisibility();
}

function setupNavigation() {
  const navItems =
    document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      const tab =
        item.dataset.tab;

      handleTabChange(tab);
    });
  });
}

function handleTabChange(tab) {
  switch (tab) {
    case "home":
      loadDashboard();
      break;

    case "journey":
      loadJourney();
      break;

    case "progress":
      loadProgress();
      break;

    case "company":
      loadCompany();
      break;
  }
}

async function loadJourney() {
  try {
    const data =
      await apiTimeline();

    renderJourney(data);

  } catch (error) {
    console.error(
      "Erro ao carregar jornada:",
      error
    );
  }
}

function renderJourney(data) {
  /*
   * A tela de Jornada será implementada
   * quando o HTML correspondente estiver pronto.
   */
}

async function loadProgress() {
  try {
    const data =
      await apiProgress();

    renderProgressPage(data);

  } catch (error) {
    console.error(
      "Erro ao carregar progresso:",
      error
    );
  }
}

function renderProgressPage(data) {
  /*
   * A tela de Progresso será implementada
   * quando o HTML correspondente estiver pronto.
   */
}

async function loadCompany() {
  try {
    const data =
      await apiCompany();

    renderCompany(data);

  } catch (error) {
    console.error(
      "Erro ao carregar empresa:",
      error
    );
  }
}

function renderCompany(data) {
  /*
   * A tela de Empresa será implementada
   * quando o HTML correspondente estiver pronta.
   */
}

function setupModals() {
  const modals =
    document.querySelectorAll(".modal");

  modals.forEach((modal) => {

    modal.addEventListener(
      "click",
      (event) => {

        if (event.target !== modal) {
          return;
        }

        modal.classList.remove(
          "active"
        );
      }
    );
  });
}

function setupPageVisibility() {
  const participantId =
    localStorage.getItem(
      "pulso_participant_id"
    );

  const loginScreen =
    document.getElementById(
      "login-screen"
    );

  const dashboardScreen =
    document.getElementById(
      "dashboard-screen"
    );

  if (!participantId) {

    if (loginScreen) {
      loginScreen.classList.add(
        "active"
      );
    }

    if (dashboardScreen) {
      dashboardScreen.classList.remove(
        "active"
      );
    }

    return;
  }

  if (loginScreen) {
    loginScreen.classList.remove(
      "active"
    );
  }

  if (dashboardScreen) {
    dashboardScreen.classList.add(
      "active"
    );
  }
}