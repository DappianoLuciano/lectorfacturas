const { ipcMain, dialog, BrowserWindow } = require("electron");
const { parsePdf }  = require("./pdf-parser");
const { load, save } = require("./storage");

function registerIpcHandlers() {
  // ── Seleccionar PDF ─────────────────────────────────────────────────────────
  ipcMain.handle("pdf:select", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: "Seleccionar factura PDF",
      properties: ["openFile"],
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  // ── Parsear PDF ─────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:parse", async (_e, filePath) => {
    try {
      return await parsePdf(filePath);
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Guardar factura ─────────────────────────────────────────────────────────
  ipcMain.handle("facturas:save", (_e, { header, productos }) => {
    const data = load();
    const id   = Date.now();
    data.facturas.unshift({
      id,
      ...header,
      // campo legacy usado en historial y ventas; se deriva de proveedorNombre
      proveedor:  header.proveedorNombre || "",
      fechaCarga: new Date().toLocaleDateString("es-AR"),
      productos,
    });
    save(data);
    return { id };
  });

  // ── Listar facturas ─────────────────────────────────────────────────────────
  ipcMain.handle("facturas:list", () => {
    const { facturas } = load();
    return facturas.map(({ id, nroFactura, proveedor, fecha, fechaCarga, productos }) => ({
      id, nroFactura, proveedor, fecha, fechaCarga,
      cantProductos: productos?.length ?? 0,
    }));
  });

  // ── Obtener factura completa ────────────────────────────────────────────────
  ipcMain.handle("facturas:get", (_e, id) => {
    const { facturas } = load();
    return facturas.find((f) => f.id === id) ?? null;
  });

  // ── Actualizar factura existente ────────────────────────────────────────────
  ipcMain.handle("facturas:update", (_e, { id, header, productos }) => {
    const data = load();
    const idx  = data.facturas.findIndex((f) => f.id === id);
    if (idx !== -1) {
      data.facturas[idx] = {
        ...data.facturas[idx],
        ...header,
        proveedor: header.proveedorNombre || data.facturas[idx].proveedor || "",
        productos,
      };
    }
    save(data);
    return { ok: true };
  });

  // ── Eliminar factura ────────────────────────────────────────────────────────
  ipcMain.handle("facturas:delete", (_e, id) => {
    const data = load();
    data.facturas = data.facturas.filter((f) => f.id !== id);
    save(data);
    return { ok: true };
  });

  // ── Listar stock disponible (productos con cód. interno con unidades restantes) ─
  ipcMain.handle("stock:list", () => {
    const { facturas } = load();
    const stock = [];
    for (const f of facturas) {
      for (const p of (f.productos || [])) {
        if (!p.codigoInterno) continue;
        const total     = p.cantidad      || 1;
        const vendidas  = p.cantidadVendida || 0;
        const restantes = total - vendidas;
        if (restantes <= 0) continue;
        stock.push({
          facturaId:       f.id,
          proveedor:       f.proveedor,
          codigoInterno:   p.codigoInterno,
          codigoProveedor: p.codigoProveedor,
          descripcion:     p.descripcion,
          cantidad:        total,
          cantidadDisponible: restantes,
          costo:           p.costo,
          precioVenta:     p.precioVenta,
        });
      }
    }
    return stock;
  });

  // ── Registrar venta y descontar una unidad del stock ────────────────────────
  ipcMain.handle("ventas:save", (_e, { facturaId, codigoInterno, precioVenta, medioPago }) => {
    const data = load();

    const factura = data.facturas.find((f) => f.id === facturaId);
    let prod = null;
    if (factura) {
      prod = factura.productos.find((p) => p.codigoInterno === codigoInterno);
      if (prod) {
        prod.cantidadVendida = (prod.cantidadVendida || 0) + 1;
      }
    }

    if (!data.ventas) data.ventas = [];
    data.ventas.unshift({
      id:              Date.now(),
      fecha:           new Date().toLocaleDateString("es-AR"),
      facturaId,
      codigoInterno,
      codigoProveedor: prod?.codigoProveedor ?? null,
      descripcion:     prod?.descripcion ?? null,
      costo:           prod?.costo ?? null,
      precioOriginal:  prod?.precioVenta ?? null,
      precioVenta,
      medioPago,
    });

    save(data);
    return { ok: true };
  });

  // ── Listar ventas ────────────────────────────────────────────────────────────
  ipcMain.handle("ventas:list", () => {
    const { ventas } = load();
    return ventas || [];
  });

  // ── Exportar todos los datos locales (para migración a cloud) ───────────────
  ipcMain.handle("data:exportAll", () => {
    return load();
  });
}

module.exports = { registerIpcHandlers };
