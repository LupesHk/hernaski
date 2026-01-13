const STORAGE_KEY = "hernaski-contratos";
const ADMIN_KEY = "hernaski-admin-access";
const ADMIN_USER = "hernaski";
const ADMIN_PASSWORD = "35890822";

const page = document.body.dataset.page;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR");
};

const loadSubmissions = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveSubmissions = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const createSubmission = (data) => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  status: "pendente",
  personal: data,
  sensitive: null,
});

const setAdminAccess = (value) => {
  localStorage.setItem(ADMIN_KEY, value ? "true" : "false");
};

const hasAdminAccess = () => localStorage.getItem(ADMIN_KEY) === "true";

const requireAdmin = () => {
  if (!hasAdminAccess()) {
    window.location.href = "login.html";
  }
};

const getSubmission = (id) => loadSubmissions().find((item) => item.id === id);

const downloadContractSummary = (submission) => {
  if (!submission?.sensitive) return;
  const { personal, sensitive } = submission;
  const lines = [
    "Resumo do contrato (prévia)",
    "============================",
    `Nome: ${personal.nome}`,
    `CPF: ${personal.cpf}`,
    `RG: ${personal.rg}`,
    `Data de nascimento: ${formatDate(personal.dataNascimento)}`,
    `Estado civil: ${personal.estadoCivil}`,
    `Profissão: ${personal.profissao}`,
    `E-mail: ${personal.email}`,
    "",
    `Endereço: ${sensitive.endereco}`,
    `Cidade: ${sensitive.cidade}`,
    `Período: ${sensitive.periodo}`,
    `Data inicial: ${formatDate(sensitive.dataInicial)}`,
    `Valor bruto: R$ ${sensitive.valorBruto}`,
    `Valor bruto (extenso): ${sensitive.valorBrutoExtenso}`,
    `Valor bonificado: R$ ${sensitive.valorBonificado}`,
    `Valor bonificado (extenso): ${sensitive.valorBonificadoExtenso}`,
    `Dia de vencimento: ${sensitive.diaVencimento}`,
    `Caução: R$ ${sensitive.caucao}`,
    `Caução (extenso): ${sensitive.caucaoExtenso}`,
    `Encargos: ${sensitive.encargos}`,
    "",
    "Finalize o contrato usando o modelo oficial informado.",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contrato-${personal.cpf}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const renderPendingList = (container) => {
  const submissions = loadSubmissions();
  container.innerHTML = "";

  if (submissions.length === 0) {
    container.innerHTML =
      '<p class="helper-text">Nenhum formulário enviado ainda.</p>';
    return;
  }

  submissions.forEach((item) => {
    const card = document.createElement("div");
    card.className = "pending-card";

    const title = document.createElement("h4");
    title.textContent = item.personal.nome;

    const meta = document.createElement("p");
    meta.textContent = `CPF: ${item.personal.cpf} • Envio: ${formatDate(
      item.createdAt
    )}`;

    const status = document.createElement("p");
    status.textContent = `Status: ${item.status.replace("_", " ")}`;

    const action = document.createElement("a");
    action.className = "secondary";
    action.href = `details.html?id=${item.id}`;
    action.textContent = "Complementar dados";

    card.append(title, meta, status, action);
    container.appendChild(card);
  });
};

const setupPublicForm = () => {
  const publicForm = document.getElementById("public-form");
  if (!publicForm) return;
  publicForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(publicForm);
    const data = Object.fromEntries(formData.entries());
    const submissions = loadSubmissions();
    submissions.unshift(createSubmission(data));
    saveSubmissions(submissions);
    publicForm.reset();
    window.location.href = "success.html";
  });
};

const setupAdminLogin = () => {
  const adminLoginForm = document.getElementById("admin-login-form");
  if (!adminLoginForm) return;
  adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(adminLoginForm);
    const usuario = formData.get("usuario");
    const senha = formData.get("senha");
    if (usuario === ADMIN_USER && senha === ADMIN_PASSWORD) {
      setAdminAccess(true);
      adminLoginForm.reset();
      window.location.href = "pending.html";
      return;
    }
    adminLoginForm.reset();
    alert("Credenciais inválidas. Verifique com a administradora.");
  });
};

const setupPendingPage = () => {
  const pendingItems = document.getElementById("pending-items");
  if (!pendingItems) return;
  requireAdmin();
  renderPendingList(pendingItems);

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      setAdminAccess(false);
    });
  }
};

const setupDetailsPage = () => {
  const sensitiveForm = document.getElementById("sensitive-form");
  if (!sensitiveForm) return;
  requireAdmin();

  const selectedInfo = document.getElementById("selected-info");
  const statusInfo = document.getElementById("status-info");
  const generateButton = document.getElementById("generate-contract");
  const id = new URLSearchParams(window.location.search).get("id");
  const submission = id ? getSubmission(id) : null;

  if (!submission) {
    selectedInfo.textContent = "Nenhum formulário encontrado para complementar.";
    generateButton.disabled = true;
    sensitiveForm.querySelectorAll("input").forEach((input) => {
      input.disabled = true;
    });
    return;
  }

  selectedInfo.textContent = `Complementando: ${submission.personal.nome} • CPF ${
    submission.personal.cpf
  }.`;

  const valorBonificado = sensitiveForm.elements.namedItem("valorBonificado");
  const caucao = sensitiveForm.elements.namedItem("caucao");
  const diaVencimento = sensitiveForm.elements.namedItem("diaVencimento");
  const encargos = sensitiveForm.elements.namedItem("encargos");

  if (submission.sensitive) {
    Object.entries(submission.sensitive).forEach(([key, value]) => {
      const field = sensitiveForm.elements.namedItem(key);
      if (field) field.value = value;
    });
    generateButton.disabled = false;
  }

  if (diaVencimento && !diaVencimento.value) {
    diaVencimento.value = "10";
  }

  if (encargos && !encargos.value) {
    encargos.value = "água, luz, IPTU";
  }

  if (valorBonificado && caucao) {
    caucao.value = valorBonificado.value || caucao.value;
  }

  const syncCaucaoFromBonificado = () => {
    if (valorBonificado?.value) {
      caucao.value = valorBonificado.value;
    }
  };

  sensitiveForm.addEventListener("input", (event) => {
    if (event.target?.name === "valorBonificado") {
      syncCaucaoFromBonificado();
    }
  });

  sensitiveForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(sensitiveForm);
    const data = Object.fromEntries(formData.entries());
    const submissions = loadSubmissions();
    const updated = submissions.map((item) =>
      item.id === submission.id
        ? { ...item, sensitive: data, status: "dados_complementados" }
        : item
    );
    saveSubmissions(updated);
    statusInfo.textContent = "Dados salvos com sucesso.";
    generateButton.disabled = false;
  });

  generateButton.addEventListener("click", () => {
    const submissions = loadSubmissions();
    let chosen = null;
    const updated = submissions.map((item) => {
      if (item.id !== submission.id) return item;
      chosen = { ...item, status: "contrato_gerado" };
      return chosen;
    });
    saveSubmissions(updated);
    statusInfo.textContent =
      "Contrato marcado como gerado. Utilize o modelo oficial para finalizar.";
    downloadContractSummary(chosen);
  });
};

if (page === "public") {
  setupPublicForm();
}

if (page === "admin-login") {
  setupAdminLogin();
}

if (page === "admin-pending") {
  setupPendingPage();
}

if (page === "admin-details") {
  setupDetailsPage();
}
