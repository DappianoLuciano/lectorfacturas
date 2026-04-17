const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerIpcHandlers } = require("./ipc");
const { setupUpdater }        = require("./updater");

let win;

async function createWindow() {
  registerIpcHandlers();

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }

  // Auto-update (solo en producción)
  setupUpdater(win);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
