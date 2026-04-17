import { useState, useEffect } from "react";
import { searchByCodigoInterno, isFirebaseConfigured } from "../db.js";

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BuscadorPage() {
  const [query, setQuery]       = useState("");
  const [todos, setTodos]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [cargado, setCargado]   = useState(false);

  async function cargarTodos() {
    if (!isFirebaseConfigured()) return;
    setLoading(true);
    try {
      const res = await searchByCodigoInterno("");
      setTodos(res);
      setCargado(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarTodos(); }, []);

  const filtrado = query.trim()
    ? todos.filter((p) => {
        const q = query.toLowerCase();
        const codigos = (p.codigoInterno || "").split("/").map(c => c.trim().toLowerCase());
        return codigos.some(c => c.startsWith(q));
      })
    : [];

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <h2 className="pageTitle">Buscador por Código Interno</h2>
        <button className="btn" onClick={cargarTodos} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {!isFirebaseConfigured() && (
        <div className="firebaseWarning">
          Firebase no configurado — completá los valores en <code>renderer/src/firebase-config.js</code>.
        </div>
      )}

      {isFirebaseConfigured() && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Buscar por código interno, descripción o cód. proveedor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{ width: "100%", fontSize: 14 }}
            />
          </div>

          {loading ? (
            <div className="spinnerWrap">
              <div className="spinner" />
              <p>Cargando productos…</p>
            </div>
          ) : !query.trim() ? (
            <div className="card">
              <div className="emptyState">Escribí un código interno para buscar.</div>
            </div>
          ) : filtrado.length === 0 ? (
            <div className="card">
              <div className="emptyState">Sin resultados para "{query}".</div>
            </div>
          ) : (
            <>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="histTable">
                  <thead>
                    <tr>
                      <th>Cód. Interno</th>
                      <th>Descripción</th>
                      <th>Cód. Proveedor</th>
                      <th style={{ textAlign: "center" }}>Cant.</th>
                      <th style={{ textAlign: "right" }}>Costo Unit.</th>
                      <th style={{ textAlign: "right" }}>Precio Venta</th>
                      <th>Proveedor</th>
                      <th>Fecha Factura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrado.map((p, i) => {
                      const cu = (p.costo ?? 0) / (p.cantidad || 1);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 900 }}>{p.codigoInterno}</td>
                          <td>{p.descripcion || "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{p.codigoProveedor || "—"}</td>
                          <td style={{ textAlign: "center" }}>{p.cantidad ?? 1}</td>
                          <td style={{ textAlign: "right" }}>{fmt(cu)}</td>
                          <td style={{ textAlign: "right", fontWeight: 900, color: "#0b7a55" }}>
                            {p.precioVenta
                              ? "$" + Math.round(p.precioVenta).toLocaleString("es-AR")
                              : "—"}
                          </td>
                          <td style={{ color: "var(--muted)", fontSize: 13 }}>{p.proveedor || "—"}</td>
                          <td style={{ color: "var(--muted)", fontSize: 13 }}>{p.fechaFactura || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                {filtrado.length} resultado{filtrado.length !== 1 ? "s" : ""}
                {query && ` para "${query}"`}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
