# 🔒 Configuración de Seguridad Firebase

Esta guía te ayudará a configurar Firebase de forma segura para la aplicación de la óptica.

## 📋 Pasos para configuración segura

### 1. Configurar reglas de Firestore

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: **carga-facturas-ea3d1**
3. En el menú lateral: **Firestore Database** → **Reglas**
4. Reemplaza las reglas con este código:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Facturas: solo lectura/escritura con estructura válida
    match /facturas/{facturaId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasAll(['id', 'productos', 'fechaCarga'])
                   && request.resource.data.productos is list
                   && request.resource.data.id is int;
    }
    
    // Ventas: solo lectura/escritura con estructura válida
    match /ventas/{ventaId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasAll(['id', 'fecha', 'facturaId'])
                   && request.resource.data.id is int
                   && request.resource.data.facturaId is int;
    }
  }
}
```

5. Haz clic en **Publicar**

### 2. Restringir dominios autorizados

1. En Firebase Console, ve a **Configuración del proyecto** (⚙️ arriba a la izquierda)
2. Pestaña **Configuración general**
3. Bajá hasta **Dominios autorizados**
4. **Eliminá** cualquier dominio que no uses
5. Solo dejá `localhost` (necesario para desarrollo)

### 3. Proteger credenciales

✅ **YA CONFIGURADO**: El archivo `firebase-config.js` está en `.gitignore`

⚠️ **NUNCA compartas** el archivo `firebase-config.js` por email, WhatsApp, o subirlo a GitHub público

### 4. Limitar acceso por red (opcional - avanzado)

Si siempre usás la app desde las mismas PCs/red:

1. En Firebase Console → **Firestore Database** → **Reglas**
2. Podés agregar restricciones por hora del día o días de la semana:

```javascript
// Ejemplo: solo permitir acceso en horario laboral
allow read, write: if request.time.hours() >= 9 
                   && request.time.hours() <= 20;
```

## 🛡️ Nivel de seguridad implementado

### ✅ Lo que está protegido:

- **Validación de estructura**: Solo se pueden guardar datos con el formato correcto
- **Credenciales privadas**: `firebase-config.js` no se sube a GitHub
- **Dominios restringidos**: Solo localhost y dominios autorizados pueden acceder

### ⚠️ Limitaciones (aceptables para uso interno):

- No hay login de usuarios (no es necesario para una óptica chica)
- Cualquiera con acceso a `firebase-config.js` puede leer/escribir
  - **Solución**: NO compartir ese archivo con nadie externo

## 🔄 Si necesitás más seguridad en el futuro

Si la óptica crece o querés acceso desde múltiples locales con control de permisos, podemos agregar:

1. **Firebase Authentication** (login con email/contraseña)
2. **Roles de usuario** (admin, empleado, solo lectura)
3. **Auditoría de cambios** (quién modificó qué y cuándo)

## 📞 Soporte

Si tenés problemas con la configuración, revisá:
- Las reglas están publicadas en Firebase Console
- El archivo `firebase-config.js` existe y tiene los datos correctos
- Firestore Database está habilitado en el proyecto
