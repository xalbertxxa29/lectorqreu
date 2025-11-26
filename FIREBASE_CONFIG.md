# 🔧 Guía de Configuración Firebase

## Problema: Errores de CORS en Firebase

Si ves errores como estos en la consola:
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
has been blocked by CORS policy
```

## ✅ Soluciones Necesarias

### 1. Verificar Reglas de Firestore

En Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura/escritura a IncidenciasEU para usuarios autenticados
    match /IncidenciasEU/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Alternativa si quieres permitir sin autenticación (menos seguro)
    match /IncidenciasEU/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2. Verificar Reglas de Storage

En Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permitir acceso a la carpeta evidencias
    match /evidencias/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Alternativa sin autenticación
    match /evidencias/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. Habilitar APIs Requeridas

En Google Cloud Console → APIs & Services, habilita:
- ✓ Cloud Firestore API
- ✓ Cloud Storage API
- ✓ Firebase Realtime Database API

### 4. Verificar CORS (si usas servidor propio)

Si tienes un servidor web personalizado, crea un archivo `cors.json`:

```json
[
  {
    "origin": ["http://localhost:*", "https://localhost:*"],
    "method": ["GET", "HEAD", "DELETE", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Luego aplica con gsutil:
```bash
gsutil cors set cors.json gs://lidermaneu.appspot.com
```

### 5. Configuración Alternativa (Sin Firebase)

Si prefieres usar solo IndexedDB local sin depender de Firebase:

El código ya soporta esto - simplemente no necesitarás Firebase credenciales.

---

## 📱 Pruebas Recomendadas

1. Abre la consola del navegador (F12)
2. Verifica en la pestaña Network si hay errores 403/CORS
3. Si ves errores, revisa las reglas de Firestore/Storage
4. La app debería funcionar offline sin Firebase

## ⚙️ Estado Actual

- ✓ Escaneo QR funciona SIN Firebase
- ✓ Guardado local en IndexedDB
- ✓ Sincronización automática cuando hay conexión
- ✓ Indicador de estado de conexión

## 🆘 Si Aún No Funciona

1. **Verifica firebaseConfig** en `firebase-config.js`
2. **Revisa la consola** (F12) para mensajes de error
3. **Desactiva adblockers** - pueden bloquear Firebase
4. **Prueba en modo incógnito** - evita cache de navegador

---

Más info: https://firebase.google.com/docs/firestore/quickstart
