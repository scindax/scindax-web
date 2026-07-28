/* ==========================================================
   SCINDAX RESEARCH — IME (Índice de Maturidade Empresarial)
   Otimizado para mobile: sem reset indesejado, DOM leve,
   timers canceláveis e scroll simplificado.
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       1. SUPABASE
       ========================================================== */
    const SUPABASE_URL = "https://mlepylcwaiiatuonaegz.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_lhx5TUzOCF8jp9vMJOr8uQ_yVP9m4jh";

    let db = null;

    if (
        window.supabase &&
        SUPABASE_URL !== "SUA_SUPABASE_URL" &&
        SUPABASE_ANON_KEY !== "SUA_SUPABASE_ANON_KEY"
    ) {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    /* ==========================================================
       2. ELEMENTOS DO DOM
       ========================================================== */
    const welcomeScreen = document.getElementById("welcome-screen");
    const surveyScreen = document.getElementById("survey-screen");
    const thankScreen = document.getElementById("thank-screen");

    const startButton = document.getElementById("start-btn");
    const form = document.getElementById("survey-form");

    const steps = [...document.querySelectorAll(".step-card, .step")];

    const progressBar = document.getElementById("progress-bar");
    const stepCounter = document.getElementById("step-counter");
    const stepTitle = document.getElementById("step-title");

    const btnBack = document.getElementById("btn-back");
    const btnNext = document.getElementById("btn-next");
    const btnSubmit = document.getElementById("btn-submit");

    const receiveReport = document.getElementById("receive-report");
    const contactBox = document.getElementById("contact-box");
    
    const cepInput = document.getElementById("cep");
    const estadoSelect = document.getElementById("estado");
    const cidadeSelect = document.getElementById("cidade");

    /* ==========================================================
       3. ESTADO DA APLICAÇÃO & TÍTULOS
       ========================================================== */
    // Inicializa na etapa 0 apenas se a pesquisa ainda não foi iniciada.
    // Se a tela de pesquisa já está visível (restauração do cache), mantém.
    let currentStep = surveyScreen && !surveyScreen.classList.contains("hidden") ? 0 : -1;
    let pesquisaIniciada = currentStep >= 0;

    const titles = [
        "Conhecendo o seu Perfil",
        "Desafios e Rotina de Trabalho",
        "Visão de Futuro e Gestão",
        "Perfil Estatístico e Localização"
    ];

    if (window.lucide) {
        window.lucide.createIcons();
    }

    /* ==========================================================
       4. INTEGRAÇÃO API IBGE (ESTADOS E CIDADES) — Otimizada
       ========================================================== */
    async function carregarEstados() {
        if (!estadoSelect) return;
        try {
            const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
            const estados = await res.json();

            // Usando fragmento para construir as opções sem innerHTML repetitivo
            const fragment = document.createDocumentFragment();
            const optionDefault = document.createElement("option");
            optionDefault.value = "";
            optionDefault.disabled = true;
            optionDefault.selected = true;
            optionDefault.textContent = "Selecione o Estado...";
            fragment.appendChild(optionDefault);

            estados.forEach(uf => {
                const option = document.createElement("option");
                option.value = uf.sigla;
                option.textContent = `${uf.nome} (${uf.sigla})`;
                fragment.appendChild(option);
            });

            estadoSelect.innerHTML = ""; // limpa
            estadoSelect.appendChild(fragment);
        } catch (err) {
            console.error("Erro ao carregar estados do IBGE:", err);
            estadoSelect.innerHTML = '<option value="">Erro ao carregar estados</option>';
        }
    }

    async function carregarCidades(uf, cidadeSelecionada = null) {
        if (!cidadeSelect || !uf) return;

        cidadeSelect.disabled = true;
        cidadeSelect.innerHTML = '<option value="">Carregando cidades...</option>';

        try {
            const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
            const cidades = await res.json();

            const fragment = document.createDocumentFragment();
            const optionDefault = document.createElement("option");
            optionDefault.value = "";
            optionDefault.disabled = true;
            optionDefault.selected = true;
            optionDefault.textContent = "Selecione a Cidade...";
            fragment.appendChild(optionDefault);

            cidades.forEach(m => {
                const option = document.createElement("option");
                option.value = m.nome;
                option.textContent = m.nome;
                fragment.appendChild(option);
            });

            cidadeSelect.innerHTML = ""; // limpa
            cidadeSelect.appendChild(fragment);
            cidadeSelect.disabled = false;

            if (cidadeSelecionada) {
                cidadeSelect.value = cidadeSelecionada;
            }
        } catch (err) {
            console.error("Erro ao carregar cidades do IBGE:", err);
            cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        }
    }

    if (estadoSelect) {
        estadoSelect.addEventListener("change", (e) => {
            carregarCidades(e.target.value);
        });
    }

    /* ==========================================================
       5. BUSCA RÁPIDA VIA CEP (ViaCEP -> IBGE Auto Fill)
       ========================================================== */
    if (cepInput) {
        let cepTimer;
        cepInput.addEventListener("keyup", (e) => {
            clearTimeout(cepTimer);
            const cep = e.target.value.replace(/\D/g, "");
            if (cep.length === 8) {
                cepTimer = setTimeout(() => {
                    fetch(`https://viacep.com.br/ws/${cep}/json/`)
                        .then(res => res.json())
                        .then(async data => {
                            if (!data.erro) {
                                if (estadoSelect) estadoSelect.value = data.uf;
                                await carregarCidades(data.uf, data.localidade);
                            }
                        })
                        .catch(err => console.error("Erro ao buscar CEP:", err));
                }, 300);
            }
        });
    }

    /* ==========================================================
       6. NAVEGAÇÃO — Sem reset automático
       ========================================================== */
    function showStep(index) {
        if (index < 0 || index >= steps.length) return;

        steps.forEach((step, i) => {
            step.classList.toggle("hidden-step", i !== index);
            step.classList.toggle("active-step", i === index);
        });

        if (stepTitle) stepTitle.textContent = titles[index] || "Pesquisa Scindax";
        if (stepCounter) stepCounter.textContent = `Etapa ${index + 1} de ${steps.length}`;
        if (progressBar) {
            progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
        }

        if (btnBack) btnBack.classList.toggle("hidden", index === 0);
        const isLast = index === steps.length - 1;
        if (btnNext) btnNext.classList.toggle("hidden", isLast);
        if (btnSubmit) btnSubmit.classList.toggle("hidden", !isLast);

        // Scroll simplificado, sem smooth para evitar conflitos no mobile
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    let errorTimer = null;
    function validateStep() {
        const currentStepEl = steps[currentStep];
        const required = currentStepEl.querySelectorAll("[required]");
        let isValid = true;

        // Cancela qualquer timer de erro pendente
        if (errorTimer) {
            clearTimeout(errorTimer);
            document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
        }

        for (const field of required) {
            if (!field.value.trim()) {
                field.focus();
                field.classList.add("input-error");
                errorTimer = setTimeout(() => {
                    field.classList.remove("input-error");
                    errorTimer = null;
                }, 2000);
                isValid = false;
                break;
            }
        }

        return isValid;
    }

    function getChecks(name) {
        return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
            .map(item => item.value);
    }

    /* ==========================================================
       7. EVENTOS DOS BOTÕES E CHOICE CARDS (delegação otimizada)
       ========================================================== */
    // Delegação única no formulário para todos os clicks
    if (form) {
        form.addEventListener("click", (e) => {
            const choiceBtn = e.target.closest(".choice-card");
            if (!choiceBtn) return;

            const container = choiceBtn.parentElement;
            container.querySelectorAll(".choice-card").forEach(card => card.classList.remove("selected"));
            choiceBtn.classList.add("selected");

            const value = choiceBtn.dataset.value || choiceBtn.innerText.trim();
            const hiddenInput = container.parentElement.querySelector('input[type="hidden"]');
            if (hiddenInput) hiddenInput.value = value;
        });
    }

    if (startButton) {
        startButton.addEventListener("click", () => {
            welcomeScreen.classList.add("hidden");
            surveyScreen.classList.remove("hidden");
            currentStep = 0;
            pesquisaIniciada = true;
            showStep(currentStep);
        });
    }

    if (receiveReport && contactBox) {
        receiveReport.addEventListener("change", () => {
            contactBox.style.display = receiveReport.checked ? "grid" : "none";
        });
    }

    if (btnNext) {
        btnNext.addEventListener("click", () => {
            if (!validateStep()) return;
            if (currentStep < steps.length - 1) {
                currentStep++;
                showStep(currentStep);
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener("click", () => {
            if (currentStep > 0) {
                currentStep--;
                showStep(currentStep);
            }
        });
    }

    /* ==========================================================
       8. SUBMIT E GRAVAÇÃO NO SUPABASE
       ========================================================== */
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!validateStep()) return;

            if (btnSubmit) btnSubmit.disabled = true;

            const formData = new FormData(form);

            const payload = {
                macro_area: formData.get("macro_area"),
                especialidade: formData.get("especialidade"),
                tempo_mercado: formData.get("tempo_mercado"),
                formato_negocio: formData.get("formato_negocio"),
                desafios: getChecks("desafios"),
                organizacao: formData.get("organizacao"),
                conquista: formData.get("conquista"),
                melhoria: formData.get("melhoria"),
                cidade: formData.get("cidade"),
                estado: formData.get("estado"),
                genero: formData.get("genero"),
                raca: formData.get("raca"),
                deseja_relatorio: receiveReport ? receiveReport.checked : false,
                contato_nome: contactBox ? (contactBox.querySelectorAll("input")[0]?.value || "") : "",
                contato: contactBox ? (contactBox.querySelectorAll("input")[1]?.value || "") : "",
                navegador: navigator.userAgent,
                largura_tela: window.innerWidth,
                altura_tela: window.innerHeight,
                data_resposta: new Date().toISOString()
            };

            try {
                if (db) {
                    const { error } = await db
                        .from("ime_respostas")
                        .insert([payload]);

                    if (error) throw error;
                }

                surveyScreen.classList.add("hidden");
                thankScreen.classList.remove("hidden");
                window.scrollTo({ top: 0, behavior: "auto" });

                if (window.confetti) {
                    window.confetti({
                        particleCount: 90,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#E2B857', '#F7D27A', '#3ABAF8']
                    });
                }

            } catch (err) {
                console.error("Erro no envio:", err);
                alert("Ocorreu um erro ao enviar sua resposta. Por favor, tente novamente.");
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    /* ==========================================================
       9. INICIALIZAÇÃO — Segura, sem reset
       ========================================================== */
    // Carrega os estados da API do IBGE apenas se a tela de pesquisa estiver visível
    if (surveyScreen && !surveyScreen.classList.contains("hidden")) {
        carregarEstados();
    } else {
        // Se a pesquisa não começou, os estados serão carregados ao iniciar
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mut => {
                if (mut.target === surveyScreen && !surveyScreen.classList.contains("hidden")) {
                    carregarEstados();
                    observer.disconnect();
                }
            });
        });
        if (surveyScreen) {
            observer.observe(surveyScreen, { attributes: true, attributeFilter: ["class"] });
        }
    }

    // Ajusta a visibilidade do contactBox baseado no checkbox de relatório
    if (receiveReport && contactBox) {
        contactBox.style.display = receiveReport.checked ? "grid" : "none";
    }

    // Exibe a etapa inicial correta sem forçar reset
    if (pesquisaIniciada) {
        showStep(currentStep);
    }
});