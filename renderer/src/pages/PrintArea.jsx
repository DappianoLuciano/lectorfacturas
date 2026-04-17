// Formatea número en estilo argentino: 1234.56 → "1.234,56"
function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PrintArea({ facturaInfo, productos }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  const f   = facturaInfo;
  return (
    <div id="printArea" style={{ display: "none" }}>

      {/* ══ ENCABEZADO DE FACTURA ══════════════════════════════════════════ */}
      <div className="invWrap">

        {/* Fila 1: nombre proveedor | tipo + nro + fecha */}
        <div className="invTop">
          <div className="invProvName">{f.proveedorNombre}</div>
          <div className="invTipoBox">
            {f.codigoLetra && <div className="invLetra">{f.codigoLetra}</div>}
            <div>
              <div className="invTipoNombre">{f.tipoComprobante || "Factura"}</div>
              <div className="invTipoRow"><span>Nro:</span> <strong>{f.nroFactura}</strong></div>
              <div className="invTipoRow"><span>Fecha:</span> <strong>{f.fecha}</strong></div>
            </div>
          </div>
        </div>

        {/* Fila 2: datos proveedor | datos cliente IVA/CUIT */}
        <div className="invMid">
          <div className="invProvBox">
            {(f.proveedorDir || []).map((l, i) => <div key={i}>{l}</div>)}
            {f.proveedorCuit   && <div><b>CUIT:</b> {f.proveedorCuit}</div>}
            {f.proveedorIva    && <div><b>IVA:</b> {f.proveedorIva}</div>}
            {f.proveedorIibb   && <div><b>Ingresos Brutos Conv. Mult:</b> {f.proveedorIibb}</div>}
            {f.proveedorInicio && <div><b>Inicio de Actividades:</b> {f.proveedorInicio}</div>}
          </div>
          <div className="invClienteIvaBox">
            {f.clienteCuit && <div><b>CUIT:</b> {f.clienteCuit}</div>}
            {f.clienteIva  && <div><b>IVA:</b> {f.clienteIva}</div>}
          </div>
        </div>

        {/* Fila 3: datos del cliente */}
        <div className="invCliente">
          <div className="invClienteLeft">
            {f.clienteCuenta    && <div><span className="invLbl">Cuenta:</span> {f.clienteCuenta}</div>}
            {f.clienteNombre    && <div><span className="invLbl">Señores:</span> <b>{f.clienteNombre}</b></div>}
            {f.clienteDomicilio && <div><span className="invLbl">Domicilio:</span> {f.clienteDomicilio}</div>}
            {f.clienteLocalidad && <div><span className="invLbl">(CP) Localidad:</span> {f.clienteLocalidad}</div>}
            {f.clienteProvincia && <div><span className="invLbl">Provincia:</span> {f.clienteProvincia}</div>}
          </div>
          {f.condicion && (
            <div className="invClienteRight">
              <div><span className="invLbl">Condición:</span> {f.condicion}</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ SEPARADOR LISTA DE PRECIOS ═════════════════════════════════════ */}
      <div className="invListaBanner">
        <span>Lista de precios</span>
        <span>Impreso: {hoy}</span>
        <span>{productos.length} producto{productos.length !== 1 ? "s" : ""}</span>
      </div>

      <table className="printTable">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Cód. Interno</th>
            <th>Cód. Proveedor</th>
            <th>Descripción</th>
            <th className="tdCenter" style={{ width: 36 }}>Cant.</th>
            <th className="tdRight">Costo</th>
            <th className="tdRight">Precio Venta</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p, i) => (
            <tr key={i}>
              <td className="tdCenter">{i + 1}</td>
              <td className="tdCodInterno">{p.codigoInterno || "—"}</td>
              <td style={{ fontSize: 10 }}>{p.codigoProveedor}</td>
              <td>{p.descripcion}</td>
              <td className="tdCenter">{p.cantidad ?? 1}</td>
              <td className="tdRight tdCosto">{fmt(p.costo)}</td>
              <td className="tdRight tdPrecio">
                {p.precioVenta
                  ? Math.round(p.precioVenta).toLocaleString("es-AR", { maximumFractionDigits: 0 })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="printFooter">
        <span>Carga de Facturas — Óptica</span>
        <span>
          {productos.filter((p) => p.precioVenta).length} de {productos.length} con precio asignado
        </span>
      </div>
    </div>
  );
}
