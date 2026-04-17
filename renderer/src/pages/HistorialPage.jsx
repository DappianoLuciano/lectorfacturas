import { useState, useEffect, useRef } from "react";
import PrintArea from "./PrintArea.jsx";

const MULTIPLICADORES = [2.1, 2.2, 2.3, 2.4, 2.5];

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Vista de detalle / edición de una factura guardada ───────────────────────
function FacturaDetalle({ factura, onVolver }) {
  const [productos, setProductos] = useState(factura.productos || []);
  const [guardado, setGuardado]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState(null);
  const toastTimer                = useRef(null);

  // Separar id y fechaCarga; el resto es el header
  const { id, fechaCarga, productos: _p, ...header } = factura;

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
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
    setGuardado(false);
  }

  function aplicarMultTodos(mult) {
    setProductos((prev) =>
      prev.map((p) => ({ ...p, multiplicador: mult, precioVenta: Math.round(p.costo * mult) }))
    );
    setGuardado(false);
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await window.api.updateFactura({ id, header, productos });
      setGuardado(true);
      showToast("Factura actualizada.");
    } catch (e) {
      showToast("Error al guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="page">
      <PrintArea facturaInfo={header} productos={productos} />

      <div className="noPrint">
        <div className="pageHeaderRow">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btnSmall" onClick={onVolver}>← Volver</button>
            <h2 className="pageTitle" style={{ margin: 0 }}>{header.proveedor || "Factura"}</h2>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              onClick={handleGuardar}
              disabled={guardando || guardado}
            >
              {guardado ? "✓ Guardada" : guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button className="btnPrimary" onClick={() => window.print()}>
              🖨 Imprimir Lista
            </button>
          </div>
        </div>

        <div className="facturaHeader">
          {header.proveedor && (
            <div className="facturaHeaderItem">
              <span className="label">Proveedor</span>
              <span className="value">{header.proveedor}</span>
            </div>
          )}
          {header.nroFactura && (
            <div className="facturaHeaderItem">
              <span className="label">Nro. Factura</span>
              <span className="value">{header.nroFactura}</span>
            </div>
          )}
          {header.fecha && (
            <div className="facturaHeaderItem">
              <span className="label">Fecha</span>
              <span className="value">{header.fecha}</span>
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
            {MULTIPLICADORES.map((m) => (
              <button key={m} className="multBtn" onClick={() => aplicarMultTodos(m)}>
                ×{m}
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

                  <td className="colCodInt">
                    <input
                      type="text"
                      placeholder="Ej: RB4165"
                      value={p.codigoInterno}
                      onChange={(e) => updateProducto(i, "codigoInterno", e.target.value)}
                    />
                  </td>

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
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ── Modal de confirmación ────────────────────────────────────────────────────
function ConfirmModal({ proveedor, onConfirmar, onCancelar }) {
  return (
    <div className="modalOverlay" onClick={onCancelar}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle">Eliminar factura</div>
        <div className="modalMsg">
          ¿Confirmás la eliminación de la factura de{" "}
          <strong>{proveedor || "este proveedor"}</strong>?
          <br />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Esta acción no se puede deshacer.</span>
        </div>
        <div className="modalActions">
          <button className="btn" onClick={onCancelar}>Cancelar</button>
          <button className="btnDanger" onClick={onConfirmar}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function HistorialPage() {
  const [facturas, setFacturas]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [vista, setVista]             = useState("lista"); // "lista" | "detalle"
  const [facturaActiva, setFacturaActiva] = useState(null);
  const [confirm, setConfirm]         = useState(null); // { id, proveedor }

  async function cargar() {
    setLoading(true);
    const lista = await window.api.listFacturas();
    setFacturas(lista);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function handleVer(id) {
    const f = await window.api.getFactura(id);
    if (!f) return;
    setFacturaActiva(f);
    setVista("detalle");
  }

  async function handleEliminar(id) {
    await window.api.deleteFactura(id);
    setConfirm(null);
    cargar();
  }

  if (vista === "detalle" && facturaActiva) {
    return (
      <FacturaDetalle
        factura={facturaActiva}
        onVolver={() => { setVista("lista"); setFacturaActiva(null); }}
      />
    );
  }

  return (
    <div className="page">
      {confirm && (
        <ConfirmModal
          proveedor={confirm.proveedor}
          onConfirmar={() => handleEliminar(confirm.id)}
          onCancelar={() => setConfirm(null)}
        />
      )}

      <div className="pageHeaderRow">
        <h2 className="pageTitle">Historial de Facturas</h2>
        <button className="btn" onClick={cargar}>Actualizar</button>
      </div>

      {loading ? (
        <div className="spinnerWrap">
          <div className="spinner" />
          <p>Cargando…</p>
        </div>
      ) : facturas.length === 0 ? (
        <div className="card">
          <div className="emptyState">
            No hay facturas guardadas todavía.<br />
            <span className="muted">Cargá una factura y guardala para verla acá.</span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="histTable">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Nro. Factura</th>
                <th>Fecha</th>
                <th>Fecha Carga</th>
                <th style={{ textAlign: "center" }}>Productos</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 800 }}>{f.proveedor || "—"}</td>
                  <td>{f.nroFactura || "—"}</td>
                  <td>{f.fecha || "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{f.fechaCarga}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 10px",
                      borderRadius: 999, fontWeight: 900, fontSize: 13,
                      background: "rgba(122,216,176,0.18)",
                      border: "1px solid rgba(85,201,154,0.35)",
                      color: "#0b5a3a",
                    }}>
                      {f.cantProductos}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button className="btnSmall" onClick={() => handleVer(f.id)}>
                        Ver
                      </button>
                      <button
                        className="btnDangerSmall"
                        onClick={() => setConfirm({ id: f.id, proveedor: f.proveedor })}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
