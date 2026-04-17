const fs   = require("fs");
const path = require("path");
const { app } = require("electron");

function getDataFilePath() {
  const dir = app.isPackaged
    ? app.getPath("userData")
    : path.join(__dirname, "..");
  return path.join(dir, "facturas.json");
}

function load() {
  const p = getDataFilePath();
  if (!fs.existsSync(p)) return { facturas: [] };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return { facturas: [] };
  }
}

function save(data) {
  const target = getDataFilePath();
  const tmp    = target + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, target);
}

module.exports = { load, save };
