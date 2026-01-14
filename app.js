const STORAGE_KEY = "hernaski-contratos";
const ADMIN_KEY = "hernaski-admin-access";
const ADMIN_USER = "hernaski";
const ADMIN_PASSWORD = "35890822";
const SHEET_ID = "1N0Try5gqh9Z-MUL3d6YVRSVsMQrBUxVejttn1B3zmPs";
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxPMP0AsYBqIQ9yrdVCnQySwFLhSyxMlLXnHgzF7wOSQpEoZ1qTCZnivLRjmSFPmg/exec";

const page = document.body.dataset.page;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR");
};

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // formato certo pro <input type="date">
};

// ====== UTIL: ler número BR (aceita "1.234,56" ou "1234.56") ======
const parseBRNumber = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};

// ====== UTIL: número -> extenso (pt-BR) para dinheiro ======
const numeroParaExtensoBRL = (valor) => {
  if (typeof valor !== "number" || isNaN(valor)) return "";

  const totalCentavos = Math.round(valor * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const extensoReais = reais === 0 ? "" : inteiroPorExtenso(reais);
  const extensoCentavos = centavos === 0 ? "" : inteiroPorExtenso(centavos);

  const parteReais =
    reais === 0
      ? "zero real"
      : `${extensoReais} ${reais === 1 ? "real" : "reais"}`;

  const parteCentavos =
    centavos === 0
      ? ""
      : `${extensoCentavos} ${centavos === 1 ? "centavo" : "centavos"}`;

  if (!parteCentavos) return parteReais;
  return `${parteReais} e ${parteCentavos}`;

  function inteiroPorExtenso(n) {
    if (n === 0) return "zero";

    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dezADezenove = [
      "dez",
      "onze",
      "doze",
      "treze",
      "quatorze",
      "quinze",
      "dezesseis",
      "dezessete",
      "dezoito",
      "dezenove",
    ];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    const grupos = [
      { value: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
      { value: 1_000_000, singular: "milhão", plural: "milhões" },
      { value: 1_000, singular: "mil", plural: "mil" },
      { value: 1, singular: "", plural: "" },
    ];

    const partes = [];
    let resto = n;

    for (const g of grupos) {
      const q = Math.floor(resto / g.value);
      if (q === 0) continue;
      resto = resto % g.value;

      if (g.value === 1) {
        partes.push(ate999(q));
      } else if (g.value === 1000) {
        partes.push(q === 1 ? "mil" : `${ate999(q)} mil`);
      } else {
        const nome = q === 1 ? g.singular : g.plural;
        partes.push(`${ate999(q)} ${nome}`);
      }
    }

    return juntarPartes(partes);

    function ate999(x) {
      if (x === 0) return "";
      if (x === 100) return "cem";

      const c = Math.floor(x / 100);
      const d = Math.floor((x % 100) / 10);
      const u = x % 10;

      const chunk = [];
      if (c > 0) chunk.push(centenas[c]);

      if (d === 1) {
        chunk.push(dezADezenove[u]);
      } else {
        if (d > 1) chunk.push(dezenas[d]);
        if (u > 0) chunk.push(unidades[u]);
      }
      return chunk.join(" e ");
    }

    function juntarPartes(arr) {
      if (arr.length === 1) return arr[0];
      const last = arr[arr.length - 1];
      const firsts = arr.slice(0, -1);
      return `${firsts.join(", ")} e ${last}`;
    }
  }
};

// ====== PLUG: vincula campo numérico -> campo extenso ======
const bindExtenso = (form, numberName, extensoName) => {
  const numEl = form.elements.namedItem(numberName);
  const extEl = form.elements.namedItem(extensoName);
  if (!numEl || !extEl) return;

  const update = () => {
    const n = parseBRNumber(numEl.value);
    extEl.value = isNaN(n) ? "" : numeroParaExtensoBRL(n);
  };

  numEl.addEventListener("input", update);
  numEl.addEventListener("blur", update);
  update();
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

const isValidScriptUrl = (url) =>
  Boolean(url) && url.includes("script.google.com/macros/s/") && url.endsWith("/exec");

const submitToSheet = async (submission) => {
  if (!submission?.sensitive) return { ok: false, message: "Dados incompletos." };

  if (!isValidScriptUrl(SCRIPT_URL)) {
    return {
      ok: false,
      message:
        "URL do Apps Script inválida. Publique como Web App e use a URL /exec em SCRIPT_URL.",
    };
  }

  const { personal, sensitive } = submission;

  const payload = {
    sheetId: SHEET_ID,
    id: crypto.randomUUID(),
    nome: personal.nome,
    email: personal.email,
    estadoCivil: personal.estadoCivil,
    nascimento: formatDate(personal.dataNascimento),
    profissao: personal.profissao,
    rg: personal.rg,
    cpf: personal.cpf,
    endereco: sensitive.endereco,
    cidade: sensitive.cidade,
    periodo: sensitive.periodo,
    dataInicial: formatDate(sensitive.dataInicial),
    vencimento: sensitive.diaVencimento,
    encargos: sensitive.encargos,
    valorBruto: sensitive.valorBruto,
    valorBrutoExtenso: sensitive.valorBrutoExtenso,
    valorBonificado: sensitive.valorBonificado,
    valorBonificadoExtenso: sensitive.valorBonificadoExtenso,
    caucao: sensitive.caucao,
    caucaoExtenso: sensitive.caucaoExtenso,
  };

  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    mode: "no-cors",
    body: JSON.stringify(payload),
  });

  if (response.type === "opaque") {
    return {
      ok: true,
      message:
        "Envio solicitado. Se necessário, verifique o Apps Script para confirmar o registro.",
    };
  }

  if (!response.ok) {
    return { ok: false, message: "Falha ao enviar dados para a planilha." };
  }

  return { ok: true };
};

const deleteSubmission = (id) => {
  const submissions = loadSubmissions();
  const updated = submissions.filter((item) => item.id !== id);
  saveSubmissions(updated);
};

const renderPendingList = (container) => {
  const submissions = loadSubmissions();
  container.innerHTML = "";

  if (submissions.length === 0) {
    container.innerHTML = '<p class="helper-text">Nenhum formulário enviado ainda.</p>';
    return;
  }

  submissions.forEach((item) => {
    const card = document.createElement("div");
    card.className = "pending-card";

    const title = document.createElement("h4");
    title.textContent = item.personal.nome;

    const meta = document.createElement("p");
    meta.textContent = `CPF: ${item.personal.cpf} • Envio: ${formatDate(item.createdAt)}`;

    const status = document.createElement("p");
    status.textContent = `Status: ${item.status.replace("_", " ")}`;

    const actionRow = document.createElement("div");
    actionRow.className = "pending-actions";

    const action = document.createElement("a");
    action.className = "secondary";
    action.href = `details.html?id=${item.id}`;
    action.textContent = "Complementar dados";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.setAttribute("aria-label", "Excluir solicitação");
    deleteButton.innerHTML = "🗑️";
    deleteButton.addEventListener("click", () => {
      const confirmed = confirm("Tem certeza que deseja excluir esta solicitação?");
      if (!confirmed) return;
      deleteSubmission(item.id);
      renderPendingList(container);
    });

    actionRow.append(action, deleteButton);
    card.append(title, meta, status, actionRow);
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
    sensitiveForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  selectedInfo.textContent = `Complementando: ${submission.personal.nome} • CPF ${submission.personal.cpf}.`;

  const valorBonificado = sensitiveForm.elements.namedItem("valorBonificado");
const caucao = sensitiveForm.elements.namedItem("caucao");
const caucaoExtenso = sensitiveForm.elements.namedItem("caucaoExtenso");

const valorBruto = sensitiveForm.elements.namedItem("valorBruto");
const valorBrutoExtenso = sensitiveForm.elements.namedItem("valorBrutoExtenso");

const valorBonificadoExtenso = sensitiveForm.elements.namedItem("valorBonificadoExtenso");

const diaVencimento = sensitiveForm.elements.namedItem("diaVencimento");
const encargos = sensitiveForm.elements.namedItem("encargos");
const periodo = sensitiveForm.elements.namedItem("periodo");
const dataInicial = sensitiveForm.elements.namedItem("dataInicial");

// Vincula automação "por extenso"
bindExtenso(sensitiveForm, "valorBruto", "valorBrutoExtenso");
bindExtenso(sensitiveForm, "valorBonificado", "valorBonificadoExtenso");
bindExtenso(sensitiveForm, "caucao", "caucaoExtenso");

// Defaults
if (diaVencimento && !diaVencimento.value) diaVencimento.value = "10";
if (encargos && !encargos.value) encargos.value = "energia elétrica, água, IPTU";
if (periodo && !periodo.value) periodo.value = "12";
if (dataInicial && !dataInicial.value) dataInicial.value = todayISO();

// Atualiza caução (número) e caução extenso juntos
const setCaucaoAndExtenso = (valueNumberOrString) => {
  if (!caucao) return;

  caucao.value = String(valueNumberOrString ?? "");

  if (caucaoExtenso) {
    const n = parseBRNumber(caucao.value);
    caucaoExtenso.value = isNaN(n) ? "" : numeroParaExtensoBRL(n);
  }
};

// Caução padrão = valor bonificado (se caução estiver vazia)
if (valorBonificado && caucao && !caucao.value) {
  setCaucaoAndExtenso(valorBonificado.value);
}

// Valor bruto = bonificado / 0.9 (e atualiza extenso do bruto também)
const calcularValorBruto = () => {
  if (!valorBonificado || !valorBruto) return;

  const vb = parseBRNumber(valorBonificado.value);
  if (isNaN(vb) || vb <= 0) return;

  const bruto = vb / 0.9;
  valorBruto.value = bruto.toFixed(2);

  if (valorBrutoExtenso) {
    valorBrutoExtenso.value = numeroParaExtensoBRL(bruto);
  }
};

// Sync: quando bonificado muda -> recalcula bruto e atualiza caução + extenso
const syncCaucaoFromBonificado = () => {
  if (!valorBonificado?.value) return;
  setCaucaoAndExtenso(valorBonificado.value);
};

// Um único listener
sensitiveForm.addEventListener("input", (event) => {
  if (event.target?.name === "valorBonificado") {
    calcularValorBruto();
    syncCaucaoFromBonificado(); // <-- agora atualiza caução + cauçãoExtenso
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

    // REMOVIDO: download de arquivo .txt

    submitToSheet(chosen).then((result) => {
      statusInfo.textContent = result.ok
        ? "Contrato gerado e dados enviados para a planilha."
        : result.message;
    });
  });
};

// Router simples
if (page === "public") setupPublicForm();
if (page === "admin-login") setupAdminLogin();
if (page === "admin-pending") setupPendingPage();
if (page === "admin-details") setupDetailsPage();
