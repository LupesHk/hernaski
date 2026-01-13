const STORAGE_KEY = "hernaski-contratos";
const ADMIN_KEY = "hernaski-admin-access";
const ADMIN_USER = "hernaski";
const ADMIN_PASSWORD = "35890822";

const publicForm = document.getElementById("public-form");
const adminToggle = document.getElementById("admin-toggle");
const adminArea = document.getElementById("admin-area");
const pendingItems = document.getElementById("pending-items");
const sensitiveForm = document.getElementById("sensitive-form");
const selectedInfo = document.getElementById("selected-info");
const generateButton = document.getElementById("generate-contract");
const adminLogin = document.getElementById("admin-login");
const adminPanel = document.getElementById("admin-panel");
const adminLoginForm = document.getElementById("admin-login-form");

let selectedId = null;

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

const renderPending = () => {
  const submissions = loadSubmissions();
  pendingItems.innerHTML = "";

  if (submissions.length === 0) {
    pendingItems.innerHTML =
      "<p class=\"helper-text\">Nenhum formulário enviado ainda.</p>";
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

    const action = document.createElement("button");
    action.type = "button";
    action.className = "secondary";
    action.textContent = "Complementar dados";
    action.addEventListener("click", () => selectSubmission(item.id));

    card.append(title, meta, status, action);
    pendingItems.appendChild(card);
  });
};

const setAdminAccess = (value) => {
  localStorage.setItem(ADMIN_KEY, value ? "true" : "false");
};

const hasAdminAccess = () => localStorage.getItem(ADMIN_KEY) === "true";

const updateAdminView = () => {
  const isActive = adminArea.classList.contains("active");
  document.body.classList.toggle("admin-view", isActive && hasAdminAccess());
};

const renderAdminAccess = () => {
  const allowed = hasAdminAccess();
  adminLogin.classList.toggle("hidden", allowed);
  adminPanel.classList.toggle("hidden", !allowed);
  if (allowed) {
    renderPending();
  }
  updateAdminView();
};

const selectSubmission = (id) => {
  const submissions = loadSubmissions();
  const selected = submissions.find((item) => item.id === id);
  if (!selected) return;
  selectedId = id;
  sensitiveForm.reset();
  generateButton.disabled = true;

  const valorBonificado = sensitiveForm.elements.namedItem("valorBonificado");
  const caucao = sensitiveForm.elements.namedItem("caucao");

  if (selected.sensitive) {
    Object.entries(selected.sensitive).forEach(([key, value]) => {
      const field = sensitiveForm.elements.namedItem(key);
      if (field) field.value = value;
    });
    generateButton.disabled = false;
  }

  const diaVencimento = sensitiveForm.elements.namedItem("diaVencimento");
  if (diaVencimento && !diaVencimento.value) {
    diaVencimento.value = "10";
  }

  const encargos = sensitiveForm.elements.namedItem("encargos");
  if (encargos && !encargos.value) {
    encargos.value = "água, luz, IPTU";
  }

  if (valorBonificado && caucao) {
    caucao.value = valorBonificado.value || caucao.value;
  }

  selectedInfo.textContent = `Complementando: ${selected.personal.nome} • CPF ${
    selected.personal.cpf
  }.`;
};

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

publicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(publicForm);
  const data = Object.fromEntries(formData.entries());
  const submissions = loadSubmissions();
  submissions.unshift(createSubmission(data));
  saveSubmissions(submissions);
  publicForm.reset();
  renderAdminAccess();
});

sensitiveForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedId) return;
  const formData = new FormData(sensitiveForm);
  const data = Object.fromEntries(formData.entries());
  const submissions = loadSubmissions();
  const updated = submissions.map((item) =>
    item.id === selectedId
      ? { ...item, sensitive: data, status: "dados_complementados" }
      : item
  );
  saveSubmissions(updated);
  generateButton.disabled = false;
  renderPending();
});

generateButton.addEventListener("click", () => {
  if (!selectedId) return;
  const submissions = loadSubmissions();
  let chosen = null;
  const updated = submissions.map((item) => {
    if (item.id !== selectedId) return item;
    chosen = { ...item, status: "contrato_gerado" };
    return chosen;
  });
  saveSubmissions(updated);
  selectedInfo.textContent =
    "Contrato marcado como gerado. Utilize o modelo oficial para finalizar.";
  downloadContractSummary(chosen);
  renderPending();
});

adminLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(adminLoginForm);
  const usuario = formData.get("usuario");
  const senha = formData.get("senha");
  if (usuario === ADMIN_USER && senha === ADMIN_PASSWORD) {
    setAdminAccess(true);
    adminLoginForm.reset();
    renderAdminAccess();
    return;
  }
  adminLoginForm.reset();
  alert("Credenciais inválidas. Verifique com a administradora.");
});

adminToggle.addEventListener("click", () => {
  adminArea.classList.toggle("active");
  if (adminArea.classList.contains("active")) {
    adminArea.scrollIntoView({ behavior: "smooth" });
  }
  updateAdminView();
});

renderAdminAccess();

const syncCaucaoFromBonificado = () => {
  const valorBonificado = sensitiveForm.elements.namedItem("valorBonificado");
  const caucao = sensitiveForm.elements.namedItem("caucao");
  if (!valorBonificado || !caucao) return;
  if (valorBonificado.value) {
    caucao.value = valorBonificado.value;
  }
};

sensitiveForm.addEventListener("input", (event) => {
  if (event.target?.name === "valorBonificado") {
    syncCaucaoFromBonificado();
  }
});
