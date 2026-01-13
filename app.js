const STORAGE_KEY = "hernaski-contratos";

const publicForm = document.getElementById("public-form");
const adminToggle = document.getElementById("admin-toggle");
const adminArea = document.getElementById("admin-area");
const pendingItems = document.getElementById("pending-items");
const sensitiveForm = document.getElementById("sensitive-form");
const selectedInfo = document.getElementById("selected-info");
const generateButton = document.getElementById("generate-contract");

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

const selectSubmission = (id) => {
  const submissions = loadSubmissions();
  const selected = submissions.find((item) => item.id === id);
  if (!selected) return;
  selectedId = id;
  sensitiveForm.reset();
  generateButton.disabled = true;

  if (selected.sensitive) {
    Object.entries(selected.sensitive).forEach(([key, value]) => {
      const field = sensitiveForm.elements.namedItem(key);
      if (field) field.value = value;
    });
    generateButton.disabled = false;
  }

  selectedInfo.textContent = `Complementando: ${selected.personal.nome} • CPF ${
    selected.personal.cpf
  }.`;
};

publicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(publicForm);
  const data = Object.fromEntries(formData.entries());
  const submissions = loadSubmissions();
  submissions.unshift(createSubmission(data));
  saveSubmissions(submissions);
  publicForm.reset();
  renderPending();
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
  const updated = submissions.map((item) =>
    item.id === selectedId
      ? { ...item, status: "contrato_gerado" }
      : item
  );
  saveSubmissions(updated);
  selectedInfo.textContent =
    "Contrato marcado como gerado. Utilize o modelo oficial para finalizar.";
  renderPending();
});

adminToggle.addEventListener("click", () => {
  adminArea.classList.toggle("active");
  if (adminArea.classList.contains("active")) {
    adminArea.scrollIntoView({ behavior: "smooth" });
  }
});

renderPending();
