import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection, doc,
  setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query as fsQuery, orderBy,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let _db = null;
function getDb() {
  if (_db) return _db;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _db = getFirestore(app);
  return _db;
}

// ── Facturas ─────────────────────────────────────────────────────────────────

export async function saveFactura({ header, productos }) {
  const db = getDb();
  const id = Date.now();
  await setDoc(doc(db, "facturas", String(id)), {
    id,
    ...header,
    proveedor:  header.proveedorNombre || "",
    fechaCarga: new Date().toLocaleDateString("es-AR"),
    productos,
  });
  return { id };
}

export async function listFacturas() {
  const db   = getDb();
  const snap = await getDocs(fsQuery(collection(db, "facturas"), orderBy("id", "desc")));
  return snap.docs.map((d) => {
    const f = d.data();
    return {
      id: f.id, nroFactura: f.nroFactura, proveedor: f.proveedor,
      fecha: f.fecha, fechaCarga: f.fechaCarga,
      cantProductos: f.productos?.length ?? 0,
    };
  });
}

export async function getFactura(id) {
  const db   = getDb();
  const snap = await getDoc(doc(db, "facturas", String(id)));
  return snap.exists() ? snap.data() : null;
}

export async function updateFactura({ id, header, productos }) {
  const db  = getDb();
  const ref = doc(db, "facturas", String(id));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    await updateDoc(ref, {
      ...header,
      proveedor: header.proveedorNombre || existing.proveedor || "",
      productos,
    });
  }
  return { ok: true };
}

export async function deleteFactura(id) {
  const db = getDb();
  await deleteDoc(doc(db, "facturas", String(id)));
  return { ok: true };
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export async function listStock() {
  const db   = getDb();
  const snap = await getDocs(collection(db, "facturas"));
  const stock = [];
  for (const d of snap.docs) {
    const f = d.data();
    for (const p of (f.productos || [])) {
      if (!p.codigoInterno) continue;
      const total     = p.cantidad       || 1;
      const vendidas  = p.cantidadVendida || 0;
      const restantes = total - vendidas;
      if (restantes <= 0) continue;
      stock.push({
        facturaId:          f.id,
        proveedor:          f.proveedor,
        codigoInterno:      p.codigoInterno,
        codigoProveedor:    p.codigoProveedor,
        descripcion:        p.descripcion,
        cantidad:           total,
        cantidadDisponible: restantes,
        costo:              p.costo,
        precioVenta:        p.precioVenta,
      });
    }
  }
  return stock;
}

// ── Ventas ────────────────────────────────────────────────────────────────────

export async function saveVenta({ facturaId, codigoInterno, precioVenta, medioPago }) {
  const db      = getDb();
  const factRef = doc(db, "facturas", String(facturaId));
  const factSnap = await getDoc(factRef);

  let prod = null;
  if (factSnap.exists()) {
    const factura   = factSnap.data();
    const productos = [...(factura.productos || [])];
    const idx       = productos.findIndex((p) => p.codigoInterno === codigoInterno);
    if (idx !== -1) {
      prod = productos[idx];
      productos[idx] = { ...prod, cantidadVendida: (prod.cantidadVendida || 0) + 1 };
      await updateDoc(factRef, { productos });
    }
  }

  const id = Date.now();
  await setDoc(doc(db, "ventas", String(id)), {
    id,
    fecha:           new Date().toLocaleDateString("es-AR"),
    facturaId,
    codigoInterno,
    codigoProveedor: prod?.codigoProveedor ?? null,
    descripcion:     prod?.descripcion     ?? null,
    costo:           prod?.costo           ?? null,
    precioOriginal:  prod?.precioVenta     ?? null,
    precioVenta,
    medioPago,
  });

  return { ok: true };
}

export async function listVentas() {
  const db   = getDb();
  const snap = await getDocs(fsQuery(collection(db, "ventas"), orderBy("id", "desc")));
  return snap.docs.map((d) => d.data());
}

// ── Buscador por código interno ───────────────────────────────────────────────

export async function searchByCodigoInterno(searchTerm) {
  const db   = getDb();
  const snap = await getDocs(collection(db, "facturas"));
  const results = [];
  const q = searchTerm.toLowerCase().trim();

  for (const d of snap.docs) {
    const f = d.data();
    for (const p of (f.productos || [])) {
      if (!p.codigoInterno) continue;
      if (q === "" || p.codigoInterno.toLowerCase().includes(q)) {
        results.push({
          facturaId:    f.id,
          proveedor:    f.proveedor,
          fechaFactura: f.fecha,
          nroFactura:   f.nroFactura,
          ...p,
        });
      }
    }
  }

  return results.sort((a, b) =>
    (a.codigoInterno || "").localeCompare(b.codigoInterno || "")
  );
}

// ── Migración: subir datos locales al cloud ───────────────────────────────────

export async function migrarDesdeLocal(localData) {
  const db = getDb();
  const { facturas = [], ventas = [] } = localData;
  for (const f of facturas) {
    await setDoc(doc(db, "facturas", String(f.id)), f);
  }
  for (const v of ventas) {
    await setDoc(doc(db, "ventas", String(v.id)), v);
  }
  return { facturas: facturas.length, ventas: ventas.length };
}
