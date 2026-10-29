const FLIPTHELOOK_TEMPLATES = {
  open_pack: {
    label: "Open pack",
    fileSuffix: "flipthelook-open-pack",
    columns: [
      "Image URL",
      "Image Ratio",
      "Collection",
      "Product Name",
      "Style Number",
      "Status",
      "Wholesale Type",
      "Unit Price",
      "Minimum Rule",
      "Minimum Qty",
      "Colors",
      "Sizes",
      "Total Stock",
      "Stock By Size",
      "Description",
    ],
    defaults: {
      "Image Ratio": "auto",
      Status: "active",
      "Wholesale Type": "open_pack",
      "Minimum Rule": "order",
    },
  },
  prepack: {
    label: "Prepack",
    fileSuffix: "flipthelook-prepack",
    columns: [
      "Image URL",
      "Image Ratio",
      "Collection",
      "Product Name",
      "Style Number",
      "Status",
      "Wholesale Type",
      "Unit Price",
      "Packs Available",
      "Pack Color Mode",
      "Colors",
      "Pack Sizes",
      "Description",
    ],
    defaults: {
      "Image Ratio": "auto",
      Status: "active",
      "Wholesale Type": "prepack",
      "Pack Color Mode": "single",
    },
  },
};

const BASE_TEMPLATES = {
  faire: { label: "Faire", skipMetadataRows: true },
  generic: { label: "Generic CSV", skipMetadataRows: false },
};

const FIELD_ALIASES = {
  "Image URL": ["Product Images", "Option Image", "Image Src", "Product image URL", "Image URL", "Variant Image"],
  "Image Ratio": ["Image Ratio", "Display Ratio", "Product Image Ratio"],
  Collection: ["Product Type", "Collection", "Collections", "Category", "Categories"],
  "Product Name": ["Product Name (English)", "Product Name", "Title"],
  "Style Number": ["Style Number", "Style #", "Style No", "Style", "SKU", "Variant SKU"],
  Status: ["Product Status", "Status"],
  "Wholesale Type": ["Wholesale Type", "Pack Type"],
  "Unit Price": ["USD Unit Wholesale Price", "Unit Price", "Wholesale Unit Price", "Variant Price", "Price"],
  "Minimum Rule": ["Minimum Rule", "Wholesale Minimum Rule"],
  "Minimum Qty": ["Minimum Order Quantity", "Minimum Qty", "Minimum Quantity", "Wholesale Minimum Qty"],
  "Packs Available": ["On Hand Inventory", "Packs Available", "Pack Stock", "Wholesale Pack Stock", "Total Stock"],
  "Pack Color Mode": ["Pack Color Mode", "Color Mode"],
  Colors: ["Option 1 Value", "Option 2 Value", "Option 3 Value", "Colors", "Color", "Variant Option1 Value"],
  Sizes: ["Option 2 Value", "Option 3 Value", "Option 1 Value", "Sizes", "Size", "Variant Option2 Value", "Variant Option1 Value"],
  "Pack Sizes": ["Pack Sizes", "Pack Sizes JSON", "Wholesale Sizes", "Sizes"],
  "Total Stock": ["On Hand Inventory", "Total Stock", "Variant Inventory Qty", "Inventory Qty", "Stock Quantity"],
  "Stock By Size": ["Stock By Size"],
  Description: ["Description (English)", "Description", "Body HTML", "Body (HTML)", "Body"],
};

const CHOICE_FIELDS = {
  "Image Ratio": ["", "auto", "square", "portrait", "landscape", "tall", "wide"],
  Status: ["", "active", "draft", "archived"],
  "Wholesale Type": ["", "open_pack", "prepack"],
  "Minimum Rule": ["", "none", "style", "order"],
  "Pack Color Mode": ["", "single", "mixed"],
};

const state = {
  base: null,
  baseTemplateKey: "faire",
  templateKey: "open_pack",
  mapping: new Map(),
  defaults: new Map(),
  categoryRenames: new Map(),
};

const els = {
  baseCsv: document.getElementById("baseCsv"),
  baseTemplate: document.getElementById("baseTemplate"),
  baseFileName: document.getElementById("baseFileName"),
  baseRowCount: document.getElementById("baseRowCount"),
  copyColumnCount: document.getElementById("copyColumnCount"),
  openPackBtn: document.getElementById("openPackBtn"),
  prepackBtn: document.getElementById("prepackBtn"),
  autoMapBtn: document.getElementById("autoMapBtn"),
  clearMapBtn: document.getElementById("clearMapBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  mappingStatus: document.getElementById("mappingStatus"),
  mappingTable: document.getElementById("mappingTable"),
  previewMeta: document.getElementById("previewMeta"),
  previewTable: document.getElementById("previewTable"),
  categoryTable: document.getElementById("categoryTable"),
  resetCategoriesBtn: document.getElementById("resetCategoriesBtn"),
};

els.baseCsv.addEventListener("change", () => handleBaseFile(els.baseCsv.files[0]));
els.baseTemplate.addEventListener("change", () => setBaseTemplate(els.baseTemplate.value));
els.openPackBtn.addEventListener("click", () => setTemplate("open_pack"));
els.prepackBtn.addEventListener("click", () => setTemplate("prepack"));
els.autoMapBtn.addEventListener("click", autoMapColumns);
els.clearMapBtn.addEventListener("click", clearMapping);
els.downloadBtn.addEventListener("click", downloadConvertedCsv);
els.resetCategoriesBtn.addEventListener("click", () => {
  state.categoryRenames.clear();
  renderPreview();
});

applyTemplateDefaults();
render();

async function handleBaseFile(file) {
  if (!file) return;

  const text = await file.text();
  const parsed = parseCsv(text);

  if (!parsed.headers.length) {
    alert("That CSV does not appear to have a header row.");
    return;
  }

  state.categoryRenames.clear();
  state.base = {
    name: file.name,
    headers: parsed.headers,
    rawRows: parsed.rows,
    rows: normalizeSourceRows(parsed.rows),
  };
  els.baseFileName.textContent = file.name;
  autoMapColumns();
}

function setBaseTemplate(templateKey) {
  if (!BASE_TEMPLATES[templateKey] || state.baseTemplateKey === templateKey) return;
  state.baseTemplateKey = templateKey;
  state.mapping.clear();
  if (state.base) {
    state.base.rows = normalizeSourceRows(state.base.rawRows);
    autoMapColumns();
  }
  render();
}

function setTemplate(templateKey) {
  if (!FLIPTHELOOK_TEMPLATES[templateKey] || state.templateKey === templateKey) return;
  state.templateKey = templateKey;
  state.mapping.clear();
  applyTemplateDefaults();
  if (state.base) autoMapColumns();
  render();
}

function applyTemplateDefaults() {
  state.defaults.clear();
  currentTemplate().columns.forEach((column) => {
    state.defaults.set(column, currentTemplate().defaults[column] ?? "");
  });
}

function currentTemplate() {
  return FLIPTHELOOK_TEMPLATES[state.templateKey];
}

function currentBaseTemplate() {
  return BASE_TEMPLATES[state.baseTemplateKey];
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      pushRow(rows, row);
      field = "";
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  pushRow(rows, row);

  const headers = rows.shift() || [];
  return { headers, rows };
}

function pushRow(rows, row) {
  if (row.length === 1 && row[0] === "" && rows.length === 0) return;
  const hasValue = row.some((cell) => cell.trim() !== "");
  if (hasValue) rows.push(row);
}

function normalizeSourceRows(rows) {
  const out = rows.map((row) => [...row]);
  if (!currentBaseTemplate().skipMetadataRows) return out;

  while (out.length && isFaireMetadataRow(out[0])) {
    out.shift();
  }
  return out;
}

function isFaireMetadataRow(row) {
  const first = normalizeHeader(row[0] || "");
  if (first === "mandatory" || first === "productnameenglish") return true;
  return row.some((cell) => normalizeHeader(cell).startsWith("optionaldefaults"));
}

function render() {
  const template = currentTemplate();
  const hasBase = Boolean(state.base);

  els.baseRowCount.textContent = hasBase ? state.base.rows.length : "0";
  els.copyColumnCount.textContent = template.columns.length;
  els.autoMapBtn.disabled = !hasBase;
  els.clearMapBtn.disabled = !hasBase;
  els.openPackBtn.classList.toggle("is-active", state.templateKey === "open_pack");
  els.prepackBtn.classList.toggle("is-active", state.templateKey === "prepack");

  renderMapping();
  renderPreview();
}

function renderMapping() {
  const template = currentTemplate();

  if (!state.base) {
    els.mappingStatus.textContent = `${template.label} template selected`;
    els.mappingTable.className = "mapping-table empty-state";
    els.mappingTable.innerHTML = "<p>Upload a base CSV to map it into FlipTheLook columns.</p>";
    return;
  }

  els.mappingStatus.textContent = `${mappedCount()} of ${template.columns.length} columns mapped`;
  els.mappingTable.className = "mapping-table";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>FlipTheLook column</th>
        <th>Base column</th>
        <th>Default or sample</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  template.columns.forEach((targetHeader, index) => {
    const sourceIndex = state.mapping.get(targetHeader);
    const tr = document.createElement("tr");
    tr.append(createCell(index + 1));
    tr.append(createCell(targetHeader, "target-name"));

    const selectCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "mapping-select";
    select.dataset.target = targetHeader;
    select.append(new Option("Use default / leave blank", ""));
    state.base.headers.forEach((header, sourceIndex) => {
      select.append(new Option(`${sourceIndex + 1}. ${header}`, String(sourceIndex)));
    });
    select.value = Number.isInteger(sourceIndex) ? String(sourceIndex) : "";
    select.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value !== "") {
        state.mapping.set(targetHeader, Number(value));
      } else {
        state.mapping.delete(targetHeader);
      }
      render();
    });
    selectCell.append(select);
    tr.append(selectCell);

    const defaultCell = document.createElement("td");
    defaultCell.append(createDefaultControl(targetHeader, sourceIndex));
    tr.append(defaultCell);
    tbody.append(tr);
  });

  els.mappingTable.replaceChildren(table);
}

function createDefaultControl(targetHeader, sourceIndex) {
  const choices = CHOICE_FIELDS[targetHeader];
  const control = choices ? document.createElement("select") : document.createElement("input");
  control.className = "default-input";

  if (choices) {
    choices.forEach((choice) => control.append(new Option(choice || "Blank", choice)));
  }

  control.value = state.defaults.get(targetHeader) ?? "";
  control.placeholder = Number.isInteger(sourceIndex) ? firstSampleValue(sourceIndex) : "Blank";
  control.addEventListener("input", (event) => {
    state.defaults.set(targetHeader, event.target.value);
    renderPreview();
  });
  control.addEventListener("change", (event) => {
    state.defaults.set(targetHeader, event.target.value);
    renderPreview();
  });
  return control;
}

function collectionForRow(sourceRow) {
  const index = state.mapping.get("Collection");
  return transformValue("Collection", Number.isInteger(index)
    ? sourceRow[index] ?? ""
    : state.defaults.get("Collection") ?? "");
}

function renderCategories() {
  els.resetCategoriesBtn.disabled = state.categoryRenames.size === 0;
  const counts = new Map();
  (state.base?.rows || []).forEach((row) => {
    const category = collectionForRow(row);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  if (!counts.size) {
    els.categoryTable.className = "category-table empty-state";
    els.categoryTable.innerHTML = "<p>Upload a CSV to see its categories.</p>";
    return;
  }

  els.categoryTable.className = "category-table";
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>Original category</th><th>Source rows</th><th>New category name</th></tr></thead><tbody></tbody>";
  const tbody = table.querySelector("tbody");
  counts.forEach((count, category) => {
    const tr = document.createElement("tr");
    tr.append(createCell(category || "(No category)"), createCell(count));
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "default-input";
    input.placeholder = category || "Add category";
    input.value = state.categoryRenames.get(category) || "";
    input.setAttribute("aria-label", `New category name for ${category || "uncategorized products"}`);
    input.addEventListener("input", () => {
      if (input.value.trim()) state.categoryRenames.set(category, input.value);
      else state.categoryRenames.delete(category);
      els.resetCategoriesBtn.disabled = state.categoryRenames.size === 0;
      renderPreview(false);
    });
    cell.append(input);
    tr.append(cell);
    tbody.append(tr);
  });
  els.categoryTable.replaceChildren(table);
}

function renderPreview(refreshCategories = true) {
  if (refreshCategories) renderCategories();
  const output = buildOutputRows();
  const template = currentTemplate();
  const hasPreview = state.base && output.length;
  els.downloadBtn.disabled = !hasPreview;

  if (!state.base) {
    els.previewMeta.textContent = "No output yet";
    els.previewTable.className = "preview-table empty-state";
    els.previewTable.innerHTML = "<p>Upload a base CSV to preview the FlipTheLook output.</p>";
    return;
  }

  els.previewMeta.textContent = `Showing ${Math.min(10, output.length)} of ${output.length} rows`;
  els.previewTable.className = "preview-table";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  template.columns.forEach((header) => headerRow.append(createCell(header, "", "th")));
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  output.slice(0, 10).forEach((row) => {
    const tr = document.createElement("tr");
    template.columns.forEach((header) => tr.append(createCell(row[header] ?? "")));
    tbody.append(tr);
  });

  table.append(thead, tbody);
  els.previewTable.replaceChildren(table);
}

function createCell(value, className = "", tag = "td") {
  const cell = document.createElement(tag);
  cell.textContent = value;
  if (className) cell.className = className;
  return cell;
}

function firstSampleValue(index) {
  const row = state.base.rows.find((item) => String(item[index] ?? "").trim() !== "");
  return row ? row[index] : "";
}

function mappedCount() {
  return currentTemplate().columns.filter((header) => state.mapping.has(header)).length;
}

function autoMapColumns() {
  if (!state.base) return;

  const normalizedBase = new Map();
  state.base.headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!normalizedBase.has(key)) normalizedBase.set(key, index);
  });

  currentTemplate().columns.forEach((targetHeader) => {
    const aliases = [targetHeader, ...(FIELD_ALIASES[targetHeader] || [])];
    const sourceIndex = aliases
      .map((alias) => normalizedBase.get(normalizeHeader(alias)))
      .find((index) => Number.isInteger(index));
    if (Number.isInteger(sourceIndex)) state.mapping.set(targetHeader, sourceIndex);
  });

  render();
}

function clearMapping() {
  state.mapping.clear();
  render();
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildOutputRows() {
  if (!state.base) return [];
  const template = currentTemplate();
  const outputRows = [];

  state.base.rows.forEach((sourceRow) => {
    const outputRow = {};
    template.columns.forEach((targetHeader) => {
      const sourceIndex = state.mapping.get(targetHeader);
      const value = Number.isInteger(sourceIndex)
        ? sourceRow[sourceIndex] ?? ""
        : state.defaults.get(targetHeader) ?? "";
      outputRow[targetHeader] = transformValue(targetHeader, value);
    });

    applyBaseTemplateTransforms(outputRow, sourceRow);
    outputRow.Collection = state.categoryRenames.get(outputRow.Collection)?.trim() || outputRow.Collection;

    const imageLinks = splitImageLinks(outputRow["Image URL"]);
    if (imageLinks.length <= 1) {
      outputRow["Image URL"] = imageLinks[0] || outputRow["Image URL"];
      outputRows.push(outputRow);
      return;
    }

    imageLinks.forEach((imageUrl) => {
      outputRows.push({ ...outputRow, "Image URL": imageUrl });
    });
  });

  return outputRows;
}

function applyBaseTemplateTransforms(outputRow, sourceRow) {
  if (state.baseTemplateKey !== "faire") return;

  if (state.templateKey === "prepack") {
    if (/^\d+$/.test(outputRow["Pack Sizes"])) outputRow["Pack Sizes"] = "";
    return;
  }

  if (/^\d+$/.test(outputRow.Sizes)) outputRow.Sizes = "";

  if (!outputRow["Stock By Size"] && outputRow.Sizes && outputRow["Total Stock"]) {
    outputRow["Stock By Size"] = `${outputRow.Sizes}:${outputRow["Total Stock"]}`;
  }
}

function transformValue(targetHeader, value) {
  const text = String(value ?? "").trim();
  if (text === "") return text;

  if (targetHeader === "Status") {
    const normalized = normalizeHeader(text);
    if (normalized === "published" || normalized === "active") return "active";
    if (normalized === "unpublished" || normalized === "draft") return "draft";
    if (normalized === "archived") return "archived";
  }

  if (targetHeader === "Image Ratio") {
    const normalized = normalizeHeader(text);
    const allowed = ["auto", "square", "portrait", "landscape", "tall", "wide"];
    return allowed.includes(normalized) ? normalized : state.defaults.get("Image Ratio") || "auto";
  }

  if (targetHeader === "Wholesale Type") {
    const normalized = normalizeHeader(text);
    if (normalized.includes("prepack")) return "prepack";
    if (normalized.includes("openpack")) return "open_pack";
  }

  if (targetHeader === "Minimum Rule") {
    const normalized = normalizeHeader(text);
    if (["none", "style", "order"].includes(normalized)) return normalized;
    if (normalized.includes("style")) return "style";
    if (normalized.includes("order") || normalized.includes("cart")) return "order";
  }

  if (targetHeader === "Pack Color Mode") {
    const normalized = normalizeHeader(text);
    if (normalized === "mixed") return "mixed";
    if (normalized === "single") return "single";
  }

  return text;
}

function splitImageLinks(value) {
  const text = String(value ?? "").trim();
  if (text === "") return [];
  const urls = text.match(/https?:\/\/[^\s,;|]+/gi);
  if (urls && urls.length) return [...new Set(urls.map((url) => url.trim()))];
  return text.split(/[\n\r|;,]+/).map((item) => item.trim()).filter(Boolean);
}

function downloadConvertedCsv() {
  const rows = buildOutputRows();
  if (!state.base || !rows.length) return;

  const template = currentTemplate();
  const csv = stringifyCsv(template.columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = state.base?.name?.replace(/\.csv$/i, "") || "converted";

  link.href = url;
  link.download = `${baseName}-${template.fileSuffix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function stringifyCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(",")];

  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvValue(row[header] ?? "")).join(","));
  });

  return `${lines.join("\r\n")}\r\n`;
}

function escapeCsvValue(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
