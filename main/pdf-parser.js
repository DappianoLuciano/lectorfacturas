// pdf-parse se carga desde la ruta directa para evitar issues con Electron
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const fs = require("fs");

const COUNTRIES = [
  "IT", "US", "BR", "CN", "JP", "DE", "FR", "ES",
  "TW", "KR", "MX", "AR", "UY", "PY", "BO", "PE",
  "CL", "CH", "AT", "IN", "VN", "TH",
];
// Sin word boundaries: en esta factura los campos van concatenados sin espacio
const COUNTRIES_RE = new RegExp(`(${COUNTRIES.join("|")})`);

// Número argentino: 1.234,56 → 1234.56
function parseArgFloat(str) {
  return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Intenta parsear una línea como producto de factura.
 * Formato: {código} {PO} {descripción} {despacho} {cant} NR {pLista} {pct}% ({monto}) {importe}
 */
function tryParseProductLine(line) {
  // Número argentino: 1.234,56
  const ARG = "[\\d.]*\\d+,\\d+";
  // Los campos del PDF van concatenados sin espacio, por eso \s* en lugar de \s+
  // junto a NR y entre el descuento y el importe final.
  const tailRe = new RegExp(
    `(\\d[\\d,]*)\\s+NR\\s*(${ARG})\\s+(\\d+(?:,\\d+)?)%\\s+\\((${ARG})\\)\\s*(${ARG})\\s*$`
  );

  const tailMatch = line.match(tailRe);
  if (!tailMatch) return null;

  const tailStart = line.indexOf(tailMatch[0]);
  if (tailStart <= 0) return null;
  const prefix = line.substring(0, tailStart).trim();
  if (!prefix) return null;

  // Separar por código de país. Los campos van pegados (ej: "53BRINYECTADO")
  // por eso no usamos \b en COUNTRIES_RE.
  const parts = prefix.split(COUNTRIES_RE);
  // split con grupo de captura devuelve: [antes, país, después, ...]
  if (parts.length < 3) return null;

  const codigoProveedor = parts[0].trim();
  const paisOrigen      = parts[1];
  const afterPo         = parts.slice(2).join("").trim();

  if (!codigoProveedor || !afterPo) return null;

  // descripcion y despacho van concatenados sin espacio (ej: "INYECTADO MUJER OPTICA25073IC04140521Z")
  // El despacho comienza en la transición de letra mayúscula → dígito.
  let descripcion, despachoAduana;
  const splitIdx = afterPo.search(/(?<=[A-Z])(?=\d)/);
  if (splitIdx > 0) {
    descripcion    = afterPo.substring(0, splitIdx).trim();
    despachoAduana = afterPo.substring(splitIdx).trim();
  } else {
    // Fallback: el despacho es la última palabra separada por espacio
    const sp = afterPo.lastIndexOf(" ");
    if (sp === -1) return null;
    descripcion    = afterPo.substring(0, sp).trim();
    despachoAduana = afterPo.substring(sp + 1).trim();
  }

  if (!descripcion || !despachoAduana) return null;

  return {
    codigoProveedor,
    descripcion,
    cantidad:      parseInt(tailMatch[1]) || 1,
    costo:         parseArgFloat(tailMatch[5]),
    // campos que completa el usuario
    codigoInterno: "",
    multiplicador: null,
    precioVenta:   null,
  };
}

/**
 * Extrae el encabezado completo de la factura
 */
function parseHeader(text) {
  const get = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };
  const fmt = (s)  => s.replace(/\./g, "/");

  // ── Tipo y letra del comprobante ─────────────────────────────────────────
  const tipoMatch       = text.match(/(Factura|Remito|Nota de Cr[eé]dito|Nota de D[eé]bito)/i);
  const tipoComprobante = tipoMatch ? tipoMatch[1] : "Factura";
  // Letra: el badge "A\nCODIGO\n01" aparece antes del nombre del proveedor
  const letraMatch  = text.match(/([ABC])\s*\nCODIGO/);
  const codigoLetra = letraMatch ? letraMatch[1] : "";

  // ── Proveedor ────────────────────────────────────────────────────────────
  // El nombre aparece inmediatamente después del badge "CODIGO\n01\n"
  const codMatch       = text.match(/CODIGO\s*\n\s*\d+\s*\n([^\n]+)/);
  // Fallback: cualquier línea con S.R.L./S.A./SRL/LTDA
  const srlMatch       = text.match(/^([^\n]*(?:S\.R\.L\.|S\.A\.|SRL|LTDA)[^\n]*)/m);
  const proveedorNombre = (codMatch ? codMatch[1] : (srlMatch ? srlMatch[1] : "")).trim();

  // Dirección: líneas entre el nombre y el primer CUIT:
  let proveedorDir = [];
  if (proveedorNombre) {
    const idx   = text.indexOf(proveedorNombre);
    const after = text.substring(idx + proveedorNombre.length);
    const m     = after.match(/^([\s\S]*?)CUIT:/);
    if (m) proveedorDir = m[1].split("\n").map(l => l.trim()).filter(Boolean);
  }

  const proveedorCuit   = get(/CUIT:\s*([\d\-]+)/);
  const proveedorIva    = get(/IVA:\s*([^\n]+)/);
  const proveedorIibb   = get(/Ingresos Brutos Conv[^:]*:\s*([^\n]+)/);
  const proveedorInicio = get(/Inicio de Actividades:\s*([^\n]+)/);

  // ── Número y fecha ───────────────────────────────────────────────────────
  const nroMatch   = text.match(/Nro:\s*([\w\s\-]+?)(?:\n|Fecha)/);
  const nroFactura = nroMatch ? nroMatch[1].trim() : "";
  const fechaMatch = text.match(/Fecha:\s*(\d{2}[.\/]\d{2}[.\/]\d{4})/);
  const fecha      = fechaMatch ? fmt(fechaMatch[1]) : "";

  // ── Cliente ──────────────────────────────────────────────────────────────
  const clienteCuenta    = get(/Cuenta:\s*(\S+)/);
  const clienteNombre    = get(/Se[ñn]ores:\s*([^\n]+)/);
  const clienteDomicilio = get(/Domicilio:\s*([^\n]+)/);
  const clienteLocalidad = get(/(?:\(CP\)\s*)?Localidad:\s*([^\n]+)/);
  const clienteProvincia = get(/Provincia:\s*([^\n]+)/);
  const allCuits         = [...text.matchAll(/CUIT:[\s]*([\d-]+)/g)];
  const clienteCuit      = allCuits.length > 1 ? allCuits[1][1].trim() : "";
  const clienteIva       = "RESPONSABLE INSCRIPTO"; // siempre igual en estas facturas
  const condicion        = get(/Condici[oó]n:\s*([^\n]+)/);

  // ── CAE ──────────────────────────────────────────────────────────────────
  const cae        = get(/CAE:\s*(\d+)/);
  const fechaVtoCae = fmt(get(/Fecha Vto\.CAE:\s*(\d{2}[.\/]\d{2}[.\/]\d{4})/));

  return {
    // proveedor
    proveedorNombre, proveedorDir, proveedorCuit, proveedorIva,
    proveedorIibb, proveedorInicio,
    // comprobante
    tipoComprobante, codigoLetra, nroFactura, fecha,
    // cliente
    clienteCuenta, clienteNombre, clienteDomicilio,
    clienteLocalidad, clienteProvincia, clienteCuit, clienteIva,
    condicion,
    // cae
    cae, fechaVtoCae,
  };
}

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data   = await pdfParse(buffer);
  // Fix global: algunos PDFs codifican I/l como pipe (|). Se reemplaza | seguido
  // o precedido por letra (cubre inicio/mitad/fin de palabra).
  const text   = data.text.replace(/\|(?=[A-Za-z])|(?<=[A-Za-z])\|/g, "I");

  // Buscar la sección de detalle (entre "Detalle" y "Subtotal")
  const detalleIdx  = text.indexOf("Detalle");
  const subtotalIdx = text.indexOf("Subtotal");

  const sectionText =
    detalleIdx !== -1 && subtotalIdx > detalleIdx
      ? text.substring(detalleIdx, subtotalIdx)
      : text;

  const lines    = sectionText.split("\n").map((l) => l.trim()).filter((l) => l.length > 15);
  const productos = [];

  for (const line of lines) {
    const p = tryParseProductLine(line);
    if (p) productos.push(p);
  }

  const header = parseHeader(text);
  return { ...header, productos };
}

module.exports = { parsePdf };
