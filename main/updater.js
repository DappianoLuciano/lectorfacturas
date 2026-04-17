// main/updater.js — Auto-actualización via GitHub Releases (electron-updater)
//
// Flujo:
//   1. Al iniciar → checkForUpdates() silencioso
//   2. Si hay actualización → el renderer recibe "updater:status" { event: "available", info }
//   3. Usuario hace clic en "Descargar" → downloadUpdate()
//   4. Descarga completada → renderer recibe "updater:status" { event: "downloaded" }
//   5. Usuario hace clic en "Instalar y reiniciar" → installUpdate()

const { autoUpdater } = require("electron-updater");
const { ipcMain }     = require("electron");

let mainWindow = null;

function send(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status", { event, ...data });
  }
}

function setupUpdater(win) {
  mainWindow = win;

  autoUpdater.logger = {
    info:  (msg) => console.log("[updater]", msg),
    warn:  (msg) => console.warn("[updater]", msg),
    error: (msg) => console.error("[updater]", msg),
    debug: () => {},
  };

  // No descargar automáticamente: el usuario decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // ── Eventos ────────────────────────────────────────────────────────────────
  autoUpdater.on("checking-for-update", () => {
    send("checking");
  });

  autoUpdater.on("update-available", (info) => {
    send("available", { version: info.version, releaseNotes: info.releaseNotes ?? null });
  });

  autoUpdater.on("update-not-available", () => {
    send("not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    send("progress", { percent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("downloaded", { version: info.version });
  });

  autoUpdater.on("error", (err) => {
    send("error", { message: err?.message ?? String(err) });
  });

  // ── IPC desde el renderer ──────────────────────────────────────────────────
  ipcMain.handle("updater:check", async () => {
    if (!autoUpdater.isUpdaterActive()) return { active: false };
    try {
      await autoUpdater.checkForUpdates();
      return { active: true };
    } catch (e) {
      return { active: true, error: e?.message };
    }
  });

  ipcMain.handle("updater:download", async () => {
    autoUpdater.downloadUpdate();
    return { ok: true };
  });

  ipcMain.handle("updater:install", async () => {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  ipcMain.handle("updater:version", async () => {
    const { app } = require("electron");
    return { version: app.getVersion() };
  });

  // Verificación silenciosa al iniciar (solo en producción)
  const { app } = require("electron");
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 3000);
  }
}

module.exports = { setupUpdater };
