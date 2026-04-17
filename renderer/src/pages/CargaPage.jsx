import { useState, useRef } from "react";
import PrintArea from "./PrintArea.jsx";

const MULTIPLICADORES = [2.1, 2.2, 2.3, 2.4, 2.5];

// Formatea número en estilo argentino: 1234.56 → "1.234,56"
function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CargaPage() {
  const [estado, setEstado]         = useState("vacio");   // vacio | cargando | listo
  const [facturaInfo, setFacturaInfo] = useState({});
  const [productos, setProductos]   = useState([]);
  const [error, setError]           = useState(null);
  const [guardado, setGuardado]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [toast, setToast]           = useState(null);
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
      setError(
        "No se encontraron productos en el PDF. Verificá que sea una factura con el formato esperado."
      );
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

  function aplicarMult(idx, mult) {
    setProductos((prev) => {
      const next = [...prev];
      const p    = next[idx];
      next[idx]  = { ...p, multiplicador: mult, precioVenta: Math.round(p.costo * mult) };
      return next;
    });
  }

  function aplicarMultTodos(mult) {
    setProductos((prev) =>
      prev.map((p) => ({ ...p, multiplicador: mult, precioVenta: Math.round(p.costo * mult) }))
    );
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await window.api.saveFactura({ header: facturaInfo, productos });
      setGuardado(true);
      showToast("Factura guardada en el historial.");
    } catch (e) {
      showToast("Error al guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleImprimir() {
    window.print();
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
          <div className="uploadHint">
            Hacé clic para seleccionar el archivo PDF del proveedor
          </div>
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
      {/* PrintArea — solo visible al imprimir */}
      <PrintArea facturaInfo={facturaInfo} productos={productos} />

      <div className="noPrint">
        {/* Header factura */}
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

        {/* Aplicar multiplicador a todos */}
        <div className="applyAllRow">
          <span>Aplicar a todos:</span>
          <div className="multRow">
            {MULTIPLICADORES.map((m) => (
              <button key={m} className="multBtn" onClick={() => aplicarMultTodos(m)}>
                ×{m}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="tableWrap">
          <table className="factTable">
            <thead>
              <tr>
                <th className="colNum">#</th>
                <th className="colCodProv">Cód. Proveedor</th>
                <th className="colDesc">Descripción</th>
                <th className="colCant">Cant.</th>
                <th className="colCosto">Costo</th>
                <th className="colCodInt">Cód. Interno</th>
                <th className="colMult">Multiplicador</th>
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
                  <td className="colCosto">{fmt(p.costo)}</td>

                  {/* Código interno — editable */}
                  <td className="colCodInt">
                    <input
                      type="text"
                      placeholder="Ej: RB4165"
                      value={p.codigoInterno}
                      onChange={(e) => updateProducto(i, "codigoInterno", e.target.value)}
                    />
                  </td>

                  {/* Multiplicadores rápidos */}
                  <td className="colMult">
                    <div className="multRow">
                      {MULTIPLICADORES.map((m) => (
                        <button
                          key={m}
                          className={`multBtn ${p.multiplicador === m ? "selected" : ""}`}
                          onClick={() => aplicarMult(i, m)}
                        >
                          ×{m}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Precio de venta — editable a mano */}
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

        {/* Barra de acciones */}
        <div className="actionBar">
          <button className="btn" onClick={handleCargarPdf}>
            Cargar otro PDF
          </button>
          <button className="btn" onClick={handleNueva}>
            Limpiar
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button
              className="btn"
              onClick={handleGuardar}
              disabled={guardando || guardado}
            >
              {guardado ? "✓ Guardada" : guardando ? "Guardando…" : "Guardar en Historial"}
            </button>
            <button className="btnPrimary" onClick={handleImprimir}>
              🖨 Imprimir Lista
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
