// ================================
// HERNASKI - app.js (SEM localStorage)
// Fluxo novo:
// 1) Cliente envia dados pessoais  -> Apps Script action="lead"  -> cria Solicitação (pendente) + gera HK em Clientes
// 2) ADM lista pendentes           -> Apps Script GET action="list"
// 3) ADM complementa e SALVA       -> Apps Script action="update" -> status dados_complementados
// 4) ADM gera contrato             -> Apps Script action="finalize" -> grava em Contratos + status contrato_gerado -> volta pros pendentes
// ================================

const ADMIN_KEY = "hernaski-admin-access";
const ADMIN_USER = "hernaski";
const ADMIN_PASSWORD = "35890822";

const SHEET_ID = "1N0Try5gqh9Z-MUL3d6YVRSVsMQrBUxVejttn1B3zmPs";
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxPMP0AsYBqIQ9yrdVCnQySwFLhSyxMlLXnHgzF7wOSQpEoZ1qTCZnivLRjmSFPmg/exec";

const page = document.body.dataset.page;

// =====================
// Utils
// =====================


const formatDate = (value) => {
  if (!value) return "";
  const s = String(value).trim();

  // já está BR
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // input type="date"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  // fallback (se vier outro formato)
  const d = new Date(value);
  if (isNaN(d.getTime())) return s;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const brToISO = (br) => {
  const s = String(br || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const isoToBR = (iso) => formatDate(iso); // reaproveita a função corrigida

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseBRNumber = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};

const numeroParaExtensoBRL = (valor) => {
  if (typeof valor !== "number" || isNaN(valor)) return "";

  const totalCentavos = Math.round(valor * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const extensoReais = reais === 0 ? "" : inteiroPorExtenso(reais);
  const extensoCentavos = centavos === 0 ? "" : inteiroPorExtenso(centavos);

  const parteReais =
    reais === 0 ? "zero real" : `${extensoReais} ${reais === 1 ? "real" : "reais"}`;

  const parteCentavos =
    centavos === 0 ? "" : `${extensoCentavos} ${centavos === 1 ? "centavo" : "centavos"}`;

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

const isValidScriptUrl = (url) =>
  Boolean(url) && url.includes("script.google.com/macros/s/") && url.endsWith("/exec");

const setAdminAccess = (value) => localStorage.setItem(ADMIN_KEY, value ? "true" : "false");
const hasAdminAccess = () => localStorage.getItem(ADMIN_KEY) === "true";
const requireAdmin = () => {
  if (!hasAdminAccess()) window.location.href = "login.html";
};

// =====================
// API helpers (Apps Script)
// =====================

const apiGet = async (params) => {
  if (!isValidScriptUrl(SCRIPT_URL)) throw new Error("SCRIPT_URL inválida.");

  const url = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`Falha na requisição GET (HTTP ${res.status}).`);

  // pode falhar se o GAS devolver texto
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do Apps Script (GET): ${text}`);
  }
};

// ✅ CORRIGIDO: envia como text/plain (mais compatível com GAS) e mostra erro real
const apiPost = async (payload) => {
  if (!isValidScriptUrl(SCRIPT_URL)) throw new Error("SCRIPT_URL inválida.");

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  // Se CORS bloquear a resposta, isso pode virar TypeError antes daqui.
  // Mas quando chega aqui, vamos tentar ler o texto e parsear.
  const text = await res.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    // Se não for JSON, ainda mostramos o texto
    throw new Error(`Resposta inválida do Apps Script (POST): ${text}`);
  }

  if (!json?.ok) {
    throw new Error(json?.message || "Erro desconhecido no Apps Script.");
  }

  return json;
};

// ✅ Para o formulário do cliente (evitar NetworkError por CORS)
const apiPostNoCors = async (payload) => {
  if (!isValidScriptUrl(SCRIPT_URL)) throw new Error("SCRIPT_URL inválida.");

  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return { ok: true };
};

// =====================
// Public: envia lead (cliente)
// =====================

// 🔒 trava global pra impedir double submit
let __sendingLead = false;

// mobile-proof: tenta sendBeacon (mais confiável quando a página navega logo depois)
const sendLeadBeacon = (payload) => {
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" });
    return navigator.sendBeacon(SCRIPT_URL, blob);
  } catch {
    return false;
  }
};

// fallback: fetch keepalive (ajuda em navegação imediata)
const sendLeadFetchKeepalive = async (payload) => {
  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    keepalive: true, // <- importante no mobile
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return true;
};

const setupPublicForm = () => {
  const publicForm = document.getElementById("public-form");
  if (!publicForm) return;

  const submitBtn =
    publicForm.querySelector('button[type="submit"], input[type="submit"]') || null;

  const lockUI = (locked, text) => {
    if (!submitBtn) return;
    submitBtn.disabled = locked;
    if (text) submitBtn.dataset.originalText = submitBtn.textContent;
    if (locked && text) submitBtn.textContent = text;
    if (!locked && submitBtn.dataset.originalText) submitBtn.textContent = submitBtn.dataset.originalText;
  };

  publicForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // anti-double-click
    if (__sendingLead) return;
    __sendingLead = true;

    lockUI(true, "Enviando...");

    const formData = new FormData(publicForm);
    const data = Object.fromEntries(formData.entries());

    // ✅ payload com requestId fixo (ajuda dedupe no servidor se quiser)
    const payload = {
      action: "lead",
      sheetId: SHEET_ID,
      requestId: crypto.randomUUID(),
      nome: data.nome || "",
      cpf: data.cpf || "",
      rg: data.rg || "",
      nascimento: formatDate(data.dataNascimento),
      estadoCivil: data.estadoCivil || "",
      profissao: data.profissao || "",
      email: data.email || "",
    };

    try {
      // 1) tenta beacon (melhor pra mobile/navegação)
      const okBeacon = sendLeadBeacon(payload);

      // 2) se beacon não existir/falhar, usa fetch keepalive
      if (!okBeacon) {
        await sendLeadFetchKeepalive(payload);
      }

      // ✅ só redireciona depois de disparar a requisição
      publicForm.reset();
      window.location.href = "success.html";
    } catch (err) {
      __sendingLead = false;
      lockUI(false);
      alert(
        "Não foi possível enviar. Verifique sua conexão e tente novamente.\n\n" +
          String(err?.message || err)
      );
    }
  });
};


// =====================
// Admin: Login
// =====================

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

// =====================
// Admin: Lista + filtros
// =====================

const normalizeStatusLabel = (s) => String(s || "").replaceAll("_", " ");

const renderListFromApi = async (container, filter = "pending") => {
  container.innerHTML = '<p class="helper-text">Carregando...</p>';

  try {
    const json = await apiGet({
      action: "list",
      sheetId: SHEET_ID,
      status: filter,
    });

    const items = Array.isArray(json.items) ? json.items : [];
    container.innerHTML = "";

    if (items.length === 0) {
      container.innerHTML = '<p class="helper-text">Nenhuma solicitação encontrada.</p>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "pending-card";

      const title = document.createElement("h4");
      title.textContent = item.nome || "(Sem nome)";

      const meta = document.createElement("p");
      meta.textContent = `CPF: ${item.cpf || "-"} • Envio: ${formatDate(item.createdAt)}`;

      const status = document.createElement("p");
      status.textContent = `Status: ${normalizeStatusLabel(item.status)}`;

      const actionRow = document.createElement("div");
      actionRow.className = "pending-actions";

      const action = document.createElement("a");
      action.className = "secondary";
      action.href = `details.html?requestId=${encodeURIComponent(item.requestId)}`;
      action.textContent = item.status === "contrato_gerado" ? "Ver detalhes" : "Complementar dados";

      actionRow.append(action);
      card.append(title, meta, status, actionRow);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<p class="helper-text">Falha ao carregar. ${String(err?.message || err)}</p>`;
    console.error(err);
  }
};

const setupPendingPage = () => {
  const pendingItems = document.getElementById("pending-items");
  if (!pendingItems) return;

  requireAdmin();

  const filterButtons = document.querySelectorAll("[data-filter]");
  let currentFilter = "pending";

  const load = (filter) => {
    currentFilter = filter;
    renderListFromApi(pendingItems, currentFilter);
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => load(btn.dataset.filter));
  });

  load(currentFilter);

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) logoutButton.addEventListener("click", () => setAdminAccess(false));
};

// =====================
// Admin: Details (buscar + salvar + gerar)
// =====================

const fetchOneRequest = async (requestId) => {
  const json = await apiGet({ action: "list", sheetId: SHEET_ID, status: "all" });
  const items = Array.isArray(json.items) ? json.items : [];
  return items.find((x) => String(x.requestId) === String(requestId)) || null;
};

const setupDetailsPage = () => {
  const sensitiveForm = document.getElementById("sensitive-form");
  if (!sensitiveForm) return;

  requireAdmin();

  const selectedInfo = document.getElementById("selected-info");
  const statusInfo = document.getElementById("status-info");
  const generateButton = document.getElementById("generate-contract");

  const requestId = new URLSearchParams(window.location.search).get("requestId");

  if (!requestId) {
    selectedInfo.textContent = "requestId ausente na URL.";
    generateButton.disabled = true;
    return;
  }

  // por padrão: só libera depois de salvar
  generateButton.disabled = true;

  const valorBonificado = sensitiveForm.elements.namedItem("valorBonificado");
  const caucao = sensitiveForm.elements.namedItem("caucao");
  const caucaoExtenso = sensitiveForm.elements.namedItem("caucaoExtenso");

  const valorBruto = sensitiveForm.elements.namedItem("valorBruto");
  const valorBrutoExtenso = sensitiveForm.elements.namedItem("valorBrutoExtenso");

  const diaVencimento = sensitiveForm.elements.namedItem("diaVencimento");
  const encargos = sensitiveForm.elements.namedItem("encargos");
  const periodo = sensitiveForm.elements.namedItem("periodo");
  const dataInicial = sensitiveForm.elements.namedItem("dataInicial");

  bindExtenso(sensitiveForm, "valorBruto", "valorBrutoExtenso");
  bindExtenso(sensitiveForm, "valorBonificado", "valorBonificadoExtenso");
  bindExtenso(sensitiveForm, "caucao", "caucaoExtenso");

  if (diaVencimento && !diaVencimento.value) diaVencimento.value = "10";
  if (encargos && !encargos.value) encargos.value = "energia elétrica, água, IPTU";
  if (periodo && !periodo.value) periodo.value = "12";
  if (dataInicial && !dataInicial.value) dataInicial.value = todayISO();

  const setCaucaoAndExtenso = (valueNumberOrString) => {
    if (!caucao) return;

    caucao.value = String(valueNumberOrString ?? "");
    if (caucaoExtenso) {
      const n = parseBRNumber(caucao.value);
      caucaoExtenso.value = isNaN(n) ? "" : numeroParaExtensoBRL(n);
    }
  };

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

  const syncCaucaoFromBonificado = () => {
    if (!valorBonificado?.value) return;
    setCaucaoAndExtenso(valorBonificado.value);
  };

  sensitiveForm.addEventListener("input", (event) => {
    if (event.target?.name === "valorBonificado") {
      calcularValorBruto();
      syncCaucaoFromBonificado();
    }
  });

  (async () => {
    try {
      const item = await fetchOneRequest(requestId);

      if (!item) {
        selectedInfo.textContent = "Solicitação não encontrada.";
        generateButton.disabled = true;

        sensitiveForm
          .querySelectorAll("input, select, textarea, button")
          .forEach((el) => (el.disabled = true));
        return;
      }

      selectedInfo.textContent = `Complementando: ${item.nome} • CPF ${item.cpf}.`;

      const map = {
        endereco: item.endereco,
        cidade: item.cidade,
        periodo: item.periodo,
        dataInicial: brToISO(item.dataInicial || ""),
        diaVencimento: item.vencimento,
        encargos: item.encargos,
        valorBonificado: item.valorBonificado,
        valorBonificadoExtenso: item.valorBonificadoExtenso,
        valorBruto: item.valorBruto,
        valorBrutoExtenso: item.valorBrutoExtenso,
        caucao: item.caucao,
        caucaoExtenso: item.caucaoExtenso,
      };

      Object.entries(map).forEach(([k, v]) => {
        const el = sensitiveForm.elements.namedItem(k);
        if (el && v) el.value = v;
      });

      // defaults extras, se vier vazio do GAS
      if (periodo && !periodo.value) periodo.value = "12";
      if (dataInicial && !dataInicial.value) dataInicial.value = todayISO();

      if (valorBonificado && caucao && !caucao.value) setCaucaoAndExtenso(valorBonificado.value);

      if (item.status === "contrato_gerado") {
        generateButton.disabled = false;
        statusInfo.textContent = "Este contrato já foi gerado.";
      } else if (item.status === "dados_complementados") {
        generateButton.disabled = false;
        statusInfo.textContent = "Dados já complementados. Você já pode gerar o contrato.";
      } else {
        generateButton.disabled = true;
        statusInfo.textContent = "Salve o complemento para liberar o botão de gerar contrato.";
      }
    } catch (err) {
      console.error(err);
      selectedInfo.textContent = "Falha ao buscar solicitação.";
      generateButton.disabled = true;
    }
  })();

  // SALVAR COMPLEMENTO
  sensitiveForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    calcularValorBruto();
    syncCaucaoFromBonificado();

    const d2 = Object.fromEntries(new FormData(sensitiveForm).entries());

    try {
      statusInfo.textContent = "Salvando...";

      await apiPost({
        action: "update",
        sheetId: SHEET_ID,
        requestId,

        endereco: d2.endereco || "",
        cidade: d2.cidade || "",
        periodo: d2.periodo || "",
        dataInicial: d2.dataInicial || "",
        vencimento: d2.diaVencimento || "",
        encargos: d2.encargos || "",
        valorBruto: d2.valorBruto || "",
        valorBrutoExtenso: d2.valorBrutoExtenso || "",
        valorBonificado: d2.valorBonificado || "",
        valorBonificadoExtenso: d2.valorBonificadoExtenso || "",
        caucao: d2.caucao || "",
        caucaoExtenso: d2.caucaoExtenso || "",
      });

      statusInfo.textContent = "Dados salvos com sucesso.";
      generateButton.disabled = false;
    } catch (err) {
      console.error(err);
      statusInfo.textContent = `Erro ao salvar: ${String(err?.message || err)}`;
    }
  });

  // GERAR CONTRATO
  generateButton.addEventListener("click", async () => {
    generateButton.disabled = true;

    let item = null;
    try {
      item = await fetchOneRequest(requestId);
    } catch (_) {}

    const d2 = Object.fromEntries(new FormData(sensitiveForm).entries());

    try {
      statusInfo.textContent = "Gerando contrato...";

      await apiPost({
        action: "finalize",
        sheetId: SHEET_ID,
        requestId,

        id: crypto.randomUUID(),
        nome: item?.nome || "",
        email: item?.email || "",
        estadoCivil: item?.estadoCivil || "",
        nascimento: item?.nascimento || "",
        profissao: item?.profissao || "",
        rg: item?.rg || "",
        cpf: item?.cpf || "",

        endereco: d2.endereco || "",
        cidade: d2.cidade || "",
        periodo: d2.periodo || "",
        dataInicial: d2.dataInicial || "",
        vencimento: d2.diaVencimento || "",
        encargos: d2.encargos || "",
        valorBruto: d2.valorBruto || "",
        valorBrutoExtenso: d2.valorBrutoExtenso || "",
        valorBonificado: d2.valorBonificado || "",
        valorBonificadoExtenso: d2.valorBonificadoExtenso || "",
        caucao: d2.caucao || "",
        caucaoExtenso: d2.caucaoExtenso || "",
      });

      statusInfo.textContent = "Contrato gerado e dados enviados para a planilha.";

      setTimeout(() => {
        window.location.href = "pending.html";
      }, 500);
    } catch (err) {
      console.error(err);
      statusInfo.textContent = `Erro ao gerar: ${String(err?.message || err)}`;
      generateButton.disabled = false;
    }
  });
};

// =====================
// Router
// =====================

if (page === "public") setupPublicForm();
if (page === "admin-login") setupAdminLogin();
if (page === "admin-pending") setupPendingPage();
if (page === "admin-details") setupDetailsPage();
