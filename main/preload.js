const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // PDF
  selectPdf:   ()         => ipcRenderer.invoke("pdf:select"),
  parsePdf:    (filePath) => ipcRenderer.invoke("pdf:parse", filePath),

  // Facturas (historial)
  saveFactura:   (data) => ipcRenderer.invoke("facturas:save", data),
  updateFactura: (data) => ipcRenderer.invoke("facturas:update", data),
  listFacturas:  ()     => ipcRenderer.invoke("facturas:list"),
  getFactura:    (id)   => ipcRenderer.invoke("facturas:get", id),
  deleteFactura: (id)   => ipcRenderer.invoke("facturas:delete", id),

  // Stock y ventas
  listStock:  ()     => ipcRenderer.invoke("stock:list"),
  saveVenta:  (data) => ipcRenderer.invoke("ventas:save", data),
  listVentas: ()     => ipcRenderer.invoke("ventas:list"),

  // Updater
  checkForUpdates: ()   => ipcRenderer.invoke("updater:check"),
  downloadUpdate:  ()   => ipcRenderer.invoke("updater:download"),
  installUpdate:   ()   => ipcRenderer.invoke("updater:install"),
  getAppVersion:   ()   => ipcRenderer.invoke("updater:version"),
  onUpdaterStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("updater:status", handler);
  },
  offUpdaterStatus: () => ipcRenderer.removeAllListeners("updater:status"),
});
