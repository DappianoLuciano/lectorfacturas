import { useState, useEffect, useRef } from "react";
import { listStock, saveVenta, listVentas, isFirebaseConfigured } from "../db.js";


const MEDIOS_PAGO = ["Efectivo", "Débito", "Crédito", "Transferencia"];

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function medioPagoBg(m) {
  const map = {
    "Efectivo":      "rgba(34,197,94,0.15)",
    "Débito":        "rgba(59,130,246,0.15)",
    "Crédito":       "rgba(168,85,247,0.15)",
    "Transferencia": "rgba(234,179,8,0.15)",
  };
  return map[m] || "rgba(122,216,176,0.15)";
}

function medioPagoColor(m) {
  const map = {
    "Efectivo":      "#15803d",
    "Débito":        "#1d4ed8",
    "Crédito":       "#7e22ce",
    "Transferencia": "#854d0e",
  };
  return map[m] || "#0b5a3a";
}

// ── Modal de confirmación de venta ───────────────────────────────────────────
function ModalVenta({ armazon, onConfirmar, onCancelar }) {
  const [precio, setPrecio] = useState(
    armazon.precioVenta != null
      ? Math.round(armazon.precioVenta).toLocaleString("es-AR", { maximumFractionDigits: 0 })
      : ""
  );
  const [medioPago, setMedioPago] = useState("Efectivo");

  function handleConfirmar() {
    const raw = precio.replace(/\./g, "").replace(/\D/g, "");
    if (!raw) return;
    onConfirmar({ precioVenta: Number(raw), medioPago });
  }

  function handlePrecioChange(e) {
    const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
    setPrecio(
      raw !== ""
        ? Number(raw).toLocaleString("es-AR", { maximumFractionDigits: 0 })
        : ""
    );
  }

  return (
    <div className="modalOverlay" onClick={onCancelar}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="modalTitle">Registrar venta</div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>
            {armazon.descripcion}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Cód. Interno: <strong>{armazon.codigoInterno}</strong>
            {armazon.proveedor && <> · {armazon.proveedor}</>}
          </div>
          {armazon.precioVenta && (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              Precio lista: ${Math.round(armazon.precioVenta).toLocaleString("es-AR")}
            </div>
          )}
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <span>Precio de venta ($)</span>
          <input
            type="text"
            value={precio}
            onChange={handlePrecioChange}
            placeholder="0"
            autoFocus
          />
        </div>

        <div className="field" style={{ marginBottom: 24 }}>
          <span>Medio de pago</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {MEDIOS_PAGO.map((m) => (
              <button
                key={m}
                className={`multBtn ${medioPago === m ? "selected" : ""}`}
                onClick={() => setMedioPago(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="modalActions">
          <button className="btn" onClick={onCancelar}>Cancelar</button>
          <button className="btnPrimary" onClick={handleConfirmar}>
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista: stock disponible ───────────────────────────────────────────────────
function StockView({ onVender }) {
  const [stock, setStock]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    const s = await listStock();
    setStock(s);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  const filtrado = stock.filter((p) => {
    const q = busqueda.toLowerCase();
    return (
      p.codigoInterno?.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q) ||
      p.codigoProveedor?.toLowerCase().includes(q) ||
      p.proveedor?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="spinnerWrap">
        <div className="spinner" />
        <p>Cargando stock…</p>
      </div>
    );
  }

  if (stock.length === 0) {
    return (
      <div className="card">
        <div className="emptyState">
          No hay armazones en stock.<br />
          <span className="muted">
            Cargá facturas y asigná códigos internos para ver el stock aquí.
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Buscar por código, descripción o proveedor…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="histTable">
          <thead>
            <tr>
              <th>Cód. Interno</th>
              <th>Descripción</th>
              <th>Proveedor</th>
              <th style={{ textAlign: "center" }}>Disp.</th>
              <th style={{ textAlign: "right" }}>Costo</th>
              <th style={{ textAlign: "right" }}>Precio lista</th>
              <th style={{ textAlign: "center" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtrado.map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 900 }}>{p.codigoInterno}</td>
                <td>{p.descripcion}</td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>{p.proveedor || "—"}</td>
                <td style={{ textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 8px",
                    borderRadius: 999, fontWeight: 900, fontSize: 12,
                    background: "rgba(122,216,176,0.18)",
                    border: "1px solid rgba(85,201,154,0.35)",
                    color: "#0b5a3a",
                  }}>
                    {p.cantidadDisponible}/{p.cantidad}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>{fmt(p.costo)}</td>
                <td style={{ textAlign: "right", fontWeight: 900, color: "#0b7a55" }}>
                  {p.precioVenta
                    ? "$" + Math.round(p.precioVenta).toLocaleString("es-AR")
                    : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    className="btnPrimary"
                    style={{ padding: "6px 14px", fontSize: 13 }}
                    onClick={() => onVender(p)}
                  >
                    Vender
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
        {filtrado.length} de {stock.length} armazón{stock.length !== 1 ? "es" : ""} disponible{stock.length !== 1 ? "s" : ""}
      </div>
    </>
  );
}

// ── Vista: historial de ventas ────────────────────────────────────────────────
function HistorialView() {
  const [ventas, setVentas]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    listVentas().then((v) => {
      setVentas(v);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="spinnerWrap">
        <div className="spinner" />
        <p>Cargando ventas…</p>
      </div>
    );
  }

  if (ventas.length === 0) {
    return (
      <div className="card">
        <div className="emptyState">No hay ventas registradas todavía.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="histTable">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cód. Interno</th>
            <th>Descripción</th>
            <th>Medio de pago</th>
            <th style={{ textAlign: "right" }}>Precio lista</th>
            <th style={{ textAlign: "right" }}>Precio vendido</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td style={{ color: "var(--muted)", fontSize: 13 }}>{v.fecha}</td>
              <td style={{ fontWeight: 900 }}>{v.codigoInterno}</td>
              <td>{v.descripcion || "—"}</td>
              <td>
                <span style={{
                  display: "inline-block", padding: "2px 9px",
                  borderRadius: 999, fontWeight: 800, fontSize: 12,
                  background: medioPagoBg(v.medioPago),
                  color: medioPagoColor(v.medioPago),
                }}>
                  {v.medioPago}
                </span>
              </td>
              <td style={{ textAlign: "right", color: "var(--muted)" }}>
                {v.precioOriginal != null
                  ? "$" + Math.round(v.precioOriginal).toLocaleString("es-AR")
                  : "—"}
              </td>
              <td style={{ textAlign: "right", fontWeight: 900, color: "#0b7a55" }}>
                ${Math.round(v.precioVenta).toLocaleString("es-AR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function VentasPage() {
  const [vista, setVista]               = useState("stock");
  const [seleccionado, setSeleccionado] = useState(null);
  const [toast, setToast]               = useState(null);
  const [ventasKey, setVentasKey]       = useState(0);
  const toastTimer                      = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  async function handleVender({ precioVenta, medioPago }) {
    await saveVenta({
      facturaId:     seleccionado.facturaId,
      codigoInterno: seleccionado.codigoInterno,
      precioVenta,
      medioPago,
    });
    setSeleccionado(null);
    showToast("Venta registrada correctamente.");
    // Incrementar la key fuerza remount de ambas vistas para que recarguen datos
    setVentasKey((k) => k + 1);
  }

  return (
    <div className="page">
      {seleccionado && (
        <ModalVenta
          armazon={seleccionado}
          onConfirmar={handleVender}
          onCancelar={() => setSeleccionado(null)}
        />
      )}

      <div className="pageHeaderRow">
        <h2 className="pageTitle">Ventas</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={vista === "stock" ? "btnPrimary" : "btn"}
            onClick={() => setVista("stock")}
          >
            Stock disponible
          </button>
          <button
            className={vista === "historial" ? "btnPrimary" : "btn"}
            onClick={() => setVista("historial")}
          >
            Historial de ventas
          </button>
        </div>
      </div>

      {vista === "stock" && (
        <StockView key={ventasKey} onVender={setSeleccionado} />
      )}
      {vista === "historial" && (
        <HistorialView key={ventasKey} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
