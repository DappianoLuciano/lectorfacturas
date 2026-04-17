import { useState, useEffect } from "react";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/print.css";

import CargaPage    from "./pages/CargaPage.jsx";
import HistorialPage from "./pages/HistorialPage.jsx";
import VentasPage    from "./pages/VentasPage.jsx";
import BuscadorPage  from "./pages/BuscadorPage.jsx";

const NAV = [
  { section: "FACTURAS", key: "carga",     label: "Nueva Carga" },
  { section: null,       key: "historial", label: "Historial" },
  { section: "VENTAS",  key: "ventas",    label: "Ventas" },
  { section: null,       key: "buscador",  label: "Buscador" },
];

// ── Banner de actualización ────────────────────────────────────────────────
function UpdateBanner() {
  const [status, setStatus] = useState(null); // null | "available" | "downloading" | "downloaded" | "error"
  const [info,   setInfo]   = useState({});

  useEffect(() => {
    window.api?.onUpdaterStatus?.((data) => {
      switch (data.event) {
        case "available":
          setStatus("available");
          setInfo({ version: data.version });
          break;
        case "progress":
          setStatus("downloading");
          setInfo((p) => ({ ...p, percent: data.percent }));
          break;
        case "downloaded":
          setStatus("downloaded");
          setInfo((p) => ({ ...p, version: data.version }));
          break;
        case "error": {
          const msg = data.message ?? "";
          const noVersions = msg.includes("No published versions") || msg.includes("404");
          if (!noVersions) {
            setStatus("error");
            setInfo({ message: "No se pudo verificar actualizaciones." });
          }
          break;
        }
        default: break;
      }
    });
    return () => window.api?.offUpdaterStatus?.();
  }, []);

  if (!status) return null;

  const s = {
    position: "fixed", bottom: 16, right: 16, zIndex: 9999,
    background: "#0c5a55", color: "#fff",
    borderRadius: 10, padding: "12px 16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    maxWidth: 320, fontSize: 13,
    display: "flex", flexDirection: "column", gap: 8,
  };

  if (status === "available") return (
    <div style={s}>
      <strong>Nueva versión disponible: v{info.version}</strong>
      <button
        onClick={() => { setStatus("downloading"); window.api.downloadUpdate(); }}
        style={{ background: "#7ad8b0", color: "#0c5a55", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}
      >
        Descargar actualización
      </button>
    </div>
  );

  if (status === "downloading") return (
    <div style={s}>
      <strong>Descargando actualización... {info.percent ?? 0}%</strong>
      <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 4, height: 6 }}>
        <div style={{ width: `${info.percent ?? 0}%`, background: "#7ad8b0", borderRadius: 4, height: 6, transition: "width 0.3s" }} />
      </div>
    </div>
  );

  if (status === "downloaded") return (
    <div style={s}>
      <strong>Actualización lista: v{info.version}</strong>
      <button
        onClick={() => window.api.installUpdate()}
        style={{ background: "#7ad8b0", color: "#0c5a55", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}
      >
        Instalar y reiniciar
      </button>
    </div>
  );

  if (status === "error") return (
    <div style={{ ...s, background: "#c0392b" }}>
      <span>{info.message}</span>
      <button onClick={() => setStatus(null)} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
        Cerrar
      </button>
    </div>
  );

  return null;
}

export default function App() {
  const [tab, setTab] = useState("carga");

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">Facturas</div>
          <div className="sidebarSub">Óptica</div>
        </div>
        <nav className="sideNav">
          {NAV.map(({ section, key, label }) => (
            <div key={key}>
              {section && (
                <div style={{
                  fontSize: 10, fontWeight: 900, opacity: 0.5,
                  letterSpacing: "0.08em", padding: "6px 4px 2px",
                  textTransform: "uppercase",
                }}>
                  {section}
                </div>
              )}
              <button
                className={`sideItem ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
              >
                <span className="dot" />
                {label}
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="mainContent">
          <div className="container">
            {tab === "carga"     && <CargaPage />}
            {tab === "historial" && <HistorialPage />}
            {tab === "ventas"    && <VentasPage />}
            {tab === "buscador"  && <BuscadorPage />}
          </div>
        </div>
      </main>

      <UpdateBanner />
    </div>
  );
}
