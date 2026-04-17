import { useState, useEffect, useRef } from "react";
import PrintArea from "./PrintArea.jsx";
import {
  listFacturas, getFactura, updateFactura, deleteFactura,
  isFirebaseConfigured, migrarDesdeLocal,
} from "../db.js";

// Factores base; fórmula: costoUnit * 1.21 * factor
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

// ── Modal multi-código (cantidad > 1) ────────────────────────────────────────
function ModalMultiCodigo({ producto, onGuardar, onCancelar }) {
  const cant    = producto.cantidad || 1;
  const partes  = (producto.codigoInterno || "").split("/").filter(Boolean);
  const inicial = Array.from({ length: cant }, (_, i) => partes[i] || "");
  const [codigos, setCodigos] = useState(inicial);

  function setVal(i, v) {
    setCodigos((prev) => { const next = [...prev]; next[i] = v; return next; });
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
          <button
            className="btnPrimary"
            onClick={() => onGuardar(codigos.map((c) => c.trim()).join("/"))}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista de detalle / edición de una factura guardada ───────────────────────
function FacturaDetalle({ factura, onVolver }) {
  const [productos, setProductos]   = useState(factura.productos || []);
  const [guardado, setGuardado]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [modalMulti, setModalMulti] = useState(null); // { idx }
  // intereses[i]: null | 5 | 10 | número personalizado
  const [interesAplicado, setInteresAplicado] = useState(() => (factura.productos || []).map(() => null));
  const [precioBase, setPrecioBase]           = useState(() => (factura.productos || []).map((p) => p.precioVenta ?? null));
  const [interesCustom, setInteresCustom]     = useState(() => (factura.productos || []).map(() => ""));
  const toastTimer = useRef(null);

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

  function aplicarMult(idx, factor) {
    setProductos((prev) => {
      const next = [...prev];
      const p    = next[idx];
      const nuevo = calcPrecio(p, factor);
      next[idx]  = { ...p, multiplicador: factor, precioVenta: nuevo };
      // Actualizar precioBase e interés al cambiar el multiplicador
      setPrecioBase((pb) => { const n = [...pb]; n[idx] = nuevo; return n; });
      setInteresAplicado((ia) => { const n = [...ia]; n[idx] = null; return n; });
      setInteresCustom((ic) => { const n = [...ic]; n[idx] = ""; return n; });
      return next;
    });
    setGuardado(false);
  }

  function aplicarMultTodos(factor) {
    setProductos((prev) => {
      const next = prev.map((p) => ({ ...p, multiplicador: factor, precioVenta: calcPrecio(p, factor) }));
      setPrecioBase(next.map((p) => p.precioVenta));
      setInteresAplicado(next.map(() => null));
      setInteresCustom(next.map(() => ""));
      return next;
    });
    setGuardado(false);
  }

  function aplicarInteres(idx, pct) {
    const base = precioBase[idx];
    if (base == null) return;
    const mismoInteres = interesAplicado[idx] === pct;
    const nuevoPrecio  = mismoInteres ? base : Math.round(base * (1 + pct / 100));
    setProductos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], precioVenta: nuevoPrecio };
      return next;
    });
    setInteresAplicado((prev) => { const next = [...prev]; next[idx] = mismoInteres ? null : pct; return next; });
    // Si se aplica un preset (5/10), limpiar el input personalizado
    if (!mismoInteres) {
      setInteresCustom((prev) => { const next = [...prev]; next[idx] = ""; return next; });
    }
    setGuardado(false);
  }

  function setCustomInteres(idx, val) {
    setInteresCustom((prev) => { const next = [...prev]; next[idx] = val; return next; });
  }

  function aplicarInteresCustom(idx) {
    const v    = parseFloat(interesCustom[idx]);
    if (isNaN(v)) return;
    const base = precioBase[idx];
    if (base == null) return;
    const mismoInteres = interesAplicado[idx] === v;
    const nuevoPrecio  = mismoInteres ? base : Math.round(base * (1 + v / 100));
    setProductos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], precioVenta: nuevoPrecio };
      return next;
    });
    setInteresAplicado((prev) => { const next = [...prev]; next[idx] = mismoInteres ? null : v; return next; });
    if (mismoInteres) setCustomInteres(idx, "");
    else setCustomInteres(idx, String(v));
    setGuardado(false);
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await updateFactura({ id, header, productos });
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
        <div className="pageHeaderRow">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btnSmall" onClick={onVolver}>← Volver</button>
            <h2 className="pageTitle" style={{ margin: 0 }}>{header.proveedor || "Factura"}</h2>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={handleGuardar} disabled={guardando || guardado}>
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
                <th className="colInteres noPrint">Interés %</th>
                <th className="colPrecio">Precio Venta</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => {
                return (
                  <tr key={i}>
                    <td className="colNum">{i + 1}</td>
                    <td className="colCodProv">{p.codigoProveedor}</td>
                    <td className="colDesc">{p.descripcion}</td>
                    <td className="colCant">{p.cantidad ?? 1}</td>
                    <td className="colCosto">{fmt(costoUnit(p))}</td>

                    {/* Código interno */}
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

                    {/* Multiplicadores */}
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

                    {/* Columna Interés — solo en pantalla, no imprime */}
                    <td className="colInteres noPrint">
                      <div className="multRow" style={{ flexWrap: "nowrap", alignItems: "center" }}>
                        {[5, 10].map((f) => (
                          <button
                            key={f}
                            className={`multBtn ${interesAplicado[i] === f ? "selected" : ""}`}
                            style={{ height: 26, padding: "0 7px" }}
                            onClick={() => aplicarInteres(i, f)}
                          >
                            {f}%
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="%"
                          className={`interesInput ${interesAplicado[i] != null && interesAplicado[i] !== 5 && interesAplicado[i] !== 10 ? "interesInputSelected" : ""}`}
                          value={interesCustom[i]}
                          onChange={(e) => setCustomInteres(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") aplicarInteresCustom(i);
                          }}
                        />
                      </div>
                    </td>

                    {/* Precio venta */}
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
                          const val = raw !== "" ? Number(raw) : null;
                          updateProducto(i, "precioVenta", val);
                          setPrecioBase((prev) => { const next = [...prev]; next[i] = val; return next; });
                          setInteresAplicado((prev) => { const next = [...prev]; next[i] = null; return next; });
                        }}
                      />
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ── Modal de confirmación de eliminación ─────────────────────────────────────
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
  const [facturas, setFacturas]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [vista, setVista]               = useState("lista");
  const [facturaActiva, setFacturaActiva] = useState(null);
  const [confirm, setConfirm]           = useState(null);
  const [migrando, setMigrando]         = useState(false);
  const [hayDatosLocales, setHayDatosLocales] = useState(false);
  const [toast, setToast]               = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function cargar() {
    setLoading(true);
    try {
      const lista = await listFacturas();
      setFacturas(lista);
    } catch (e) {
      showToast("Error al cargar: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFirebaseConfigured()) cargar();
    else setLoading(false);
    // Verificar si hay datos locales para mostrar el botón de migración
    window.api?.exportAllData?.().then((d) => {
      setHayDatosLocales((d?.facturas?.length ?? 0) > 0);
    });
  }, []);

  async function handleVer(id) {
    const f = await getFactura(id);
    if (!f) return;
    setFacturaActiva(f);
    setVista("detalle");
  }

  async function handleEliminar(id) {
    await deleteFactura(id);
    setConfirm(null);
    cargar();
  }

  async function handleMigrar() {
    if (!window.api?.exportAllData) {
      showToast("Función de exportación no disponible.");
      return;
    }
    setMigrando(true);
    try {
      const localData = await window.api.exportAllData();
      const result    = await migrarDesdeLocal(localData);
      showToast(`Migración completada: ${result.facturas} facturas y ${result.ventas} ventas subidas al cloud.`);
      setHayDatosLocales(false);
      cargar();
    } catch (e) {
      showToast("Error en la migración: " + e.message);
    } finally {
      setMigrando(false);
    }
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
        <div style={{ display: "flex", gap: 8 }}>
          {isFirebaseConfigured() && hayDatosLocales && (
            <button className="btn" onClick={handleMigrar} disabled={migrando}>
              {migrando ? "Migrando…" : "Migrar datos locales"}
            </button>
          )}
          <button className="btn" onClick={cargar}>Actualizar</button>
        </div>
      </div>

      {!isFirebaseConfigured() && (
        <div className="firebaseWarning">
          Firebase no configurado — completá los valores en <code>renderer/src/firebase-config.js</code> para ver el historial.
        </div>
      )}

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
                      <button className="btnSmall" onClick={() => handleVer(f.id)}>Ver</button>
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
