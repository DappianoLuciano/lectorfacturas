import { useState, useRef } from "react";
import PrintArea from "./PrintArea.jsx";
import { saveFactura, isFirebaseConfigured } from "../db.js";

// Factores base; la fórmula final es: costoUnit * 1.21 * factor
const MULT_FACTORES = [2, 2.5, 3, 3.5];

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function costoUnit(p) {
  return (p.costo ?? 0) / (p.cantidad || 1);
}

function calcPrecio(p, factor) {
  return Math.round(costoUnit(p) * 1.21 * factor);
}

// ── Modal para ingresar múltiples códigos internos (cuando cantidad > 1) ──────
function ModalMultiCodigo({ producto, onGuardar, onCancelar }) {
  const cant = producto.cantidad || 1;
  const partes = (producto.codigoInterno || "").split("/").filter(Boolean);
  const inicial = Array.from({ length: cant }, (_, i) => partes[i] || "");
  const [codigos, setCodigos] = useState(inicial);

  function setVal(i, v) {
    setCodigos((prev) => { const next = [...prev]; next[i] = v; return next; });
  }

  function handleGuardar() {
    onGuardar(codigos.map((c) => c.trim()).join("/"));
  }

  return (
    <div className="modalOverlay" onClick={onCancelar}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle">Códigos internos</div>
        <div className="modalMsg" style={{ marginBottom: 16 }}>
          {producto.descripcion} — {cant} {cant === 1 ? "unidad" : "unidades"}
        </div>
        {codigos.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", width: 72, flexShrink: 0 }}>
              Unidad {i + 1}
            </span>
            <input
              type="text"
              placeholder={`Ej: RB${4165 + i}`}
              value={c}
              onChange={(e) => setVal(i, e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        ))}
        <div className="modalActions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onCancelar}>Cancelar</button>
          <button className="btnPrimary" onClick={handleGuardar}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CargaPage() {
  const [estado, setEstado]           = useState("vacio");
  const [facturaInfo, setFacturaInfo] = useState({});
  const [productos, setProductos]     = useState([]);
  const [error, setError]             = useState(null);
  const [guardado, setGuardado]       = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [toast, setToast]             = useState(null);
  const [modalMulti, setModalMulti]   = useState(null); // { idx }
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  async function handleCargarPdf() {
    setError(null);
    const filePath = await window.api.selectPdf();
    if (!filePath) return;

    setEstado("cargando");
    const result = await window.api.parsePdf(filePath);

    if (result?.error) {
      setError(`Error al parsear el PDF: ${result.error}`);
      setEstado("vacio");
      return;
    }

    if (!result?.productos?.length) {
      setError("No se encontraron productos en el PDF. Verificá que sea una factura con el formato esperado.");
      setEstado("vacio");
      return;
    }

    const { productos: _p, ...header } = result;
    setFacturaInfo(header);
    setProductos(result.productos);
    setGuardado(false);
    setEstado("listo");
  }

  function updateProducto(idx, field, value) {
    setProductos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setGuardado(false);
  }

  function aplicarMult(idx, factor) {
    setProductos((prev) => {
      const next = [...prev];
      const p    = next[idx];
      next[idx]  = { ...p, multiplicador: factor, precioVenta: calcPrecio(p, factor) };
      return next;
    });
  }

  function aplicarMultTodos(factor) {
    setProductos((prev) =>
      prev.map((p) => ({ ...p, multiplicador: factor, precioVenta: calcPrecio(p, factor) }))
    );
  }

  async function handleGuardar() {
    if (!isFirebaseConfigured()) {
      showToast("Configurá Firebase en firebase-config.js antes de guardar.");
      return;
    }
    setGuardando(true);
    try {
      await saveFactura({ header: facturaInfo, productos });
      setGuardado(true);
      showToast("Factura guardada en el historial.");
    } catch (e) {
      showToast("Error al guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleNueva() {
    setEstado("vacio");
    setProductos([]);
    setFacturaInfo({});
    setError(null);
    setGuardado(false);
  }

  // ── RENDER: vacío ──────────────────────────────────────────────────────────
  if (estado === "vacio") {
    return (
      <div className="page">
        <div className="pageHeaderRow">
          <h2 className="pageTitle">Nueva Carga</h2>
        </div>

        {!isFirebaseConfigured() && (
          <div className="firebaseWarning">
            Firebase no configurado — completá los valores en <code>renderer/src/firebase-config.js</code> para guardar y sincronizar datos.
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,77,77,0.10)", border: "1px solid rgba(255,77,77,0.35)",
            color: "#b91c1c", fontWeight: 800, fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <div className="uploadArea" onClick={handleCargarPdf}>
          <div className="uploadIcon">📄</div>
          <div className="uploadTitle">Cargar factura PDF</div>
          <div className="uploadHint">Hacé clic para seleccionar el archivo PDF del proveedor</div>
        </div>
      </div>
    );
  }

  // ── RENDER: cargando ───────────────────────────────────────────────────────
  if (estado === "cargando") {
    return (
      <div className="page">
        <div className="spinnerWrap">
          <div className="spinner" />
          <p>Leyendo factura…</p>
        </div>
      </div>
    );
  }

  // ── RENDER: listo ──────────────────────────────────────────────────────────
  return (
    <div className="page">
      <PrintArea facturaInfo={facturaInfo} productos={productos} />

      {modalMulti !== null && (
        <ModalMultiCodigo
          producto={productos[modalMulti]}
          onGuardar={(val) => {
            updateProducto(modalMulti, "codigoInterno", val);
            setModalMulti(null);
          }}
          onCancelar={() => setModalMulti(null)}
        />
      )}

      <div className="noPrint">
        <div className="facturaHeader">
          {facturaInfo.proveedor && (
            <div className="facturaHeaderItem">
              <span className="label">Proveedor</span>
              <span className="value">{facturaInfo.proveedor}</span>
            </div>
          )}
          {facturaInfo.nroFactura && (
            <div className="facturaHeaderItem">
              <span className="label">Nro. Factura</span>
              <span className="value">{facturaInfo.nroFactura}</span>
            </div>
          )}
          {facturaInfo.fecha && (
            <div className="facturaHeaderItem">
              <span className="label">Fecha</span>
              <span className="value">{facturaInfo.fecha}</span>
            </div>
          )}
          <div className="facturaHeaderItem" style={{ marginLeft: "auto" }}>
            <span className="label">Productos</span>
            <span className="value">{productos.length}</span>
          </div>
        </div>

        <div className="applyAllRow">
          <span>Aplicar a todos:</span>
          <div className="multRow">
            {MULT_FACTORES.map((f) => (
              <button key={f} className="multBtn" onClick={() => aplicarMultTodos(f)}>
                ×{f} +IVA
              </button>
            ))}
          </div>
        </div>

        <div className="tableWrap">
          <table className="factTable">
            <thead>
              <tr>
                <th className="colNum">#</th>
                <th className="colCodProv">Cód. Proveedor</th>
                <th className="colDesc">Descripción</th>
                <th className="colCant">Cant.</th>
                <th className="colCosto">Costo Unit.</th>
                <th className="colCodInt">Cód. Interno</th>
                <th className="colMult">Multiplicador + IVA</th>
                <th className="colPrecio">Precio Venta</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={i}>
                  <td className="colNum">{i + 1}</td>
                  <td className="colCodProv">{p.codigoProveedor}</td>
                  <td className="colDesc">{p.descripcion}</td>
                  <td className="colCant">{p.cantidad ?? 1}</td>
                  <td className="colCosto">{fmt(costoUnit(p))}</td>

                  {/* Código interno — simple si cant=1, botón de modal si cant>1 */}
                  <td className="colCodInt">
                    {(p.cantidad || 1) > 1 ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.codigoInterno || <span style={{ color: "var(--muted)" }}>—</span>}
                        </span>
                        <button
                          className="btnSmall"
                          style={{ padding: "3px 7px", fontSize: 11, flexShrink: 0 }}
                          onClick={() => setModalMulti(i)}
                          title="Ingresar códigos por unidad"
                        >
                          ✎
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ej: RB4165"
                        value={p.codigoInterno}
                        onChange={(e) => updateProducto(i, "codigoInterno", e.target.value)}
                      />
                    )}
                  </td>

                  {/* Multiplicadores rápidos con IVA */}
                  <td className="colMult">
                    <div className="multRow">
                      {MULT_FACTORES.map((f) => (
                        <button
                          key={f}
                          className={`multBtn ${p.multiplicador === f ? "selected" : ""}`}
                          onClick={() => aplicarMult(i, f)}
                        >
                          ×{f}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Precio de venta */}
                  <td className="colPrecio">
                    <input
                      type="text"
                      placeholder="—"
                      value={
                        p.precioVenta != null
                          ? Math.round(p.precioVenta).toLocaleString("es-AR", { maximumFractionDigits: 0 })
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
                        updateProducto(i, "precioVenta", raw !== "" ? Number(raw) : null);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actionBar">
          <button className="btn" onClick={handleCargarPdf}>Cargar otro PDF</button>
          <button className="btn" onClick={handleNueva}>Limpiar</button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button
              className="btn"
              onClick={handleGuardar}
              disabled={guardando || guardado}
            >
              {guardado ? "✓ Guardada" : guardando ? "Guardando…" : "Guardar en Historial"}
            </button>
            <button className="btnPrimary" onClick={() => window.print()}>
              🖨 Imprimir Lista
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
