# Guia: Conectar Gmail a GoHighLevel

Hola Xavi, sigue estos pasos para conectar tus cuentas de email a GHL. Hay que hacerlo para las dos cuentas:

- **info@eventosbarcelona.com**
- **xavi@eventosbarcelona.com**

---

## 1. Conectar las cuentas de Gmail

Repite estos pasos para cada cuenta:

1. Entra a GHL → **Settings** (esquina inferior izquierda)
2. Ve a **Email Services**
3. Haz clic en **"Add Email"** o **"Connect New Account"**
4. Selecciona **Gmail / Google Workspace**
5. Inicia sesion con la cuenta de Gmail correspondiente
6. **Acepta todos los permisos** que pida Google (lectura, envio, gestion de contactos)
7. Activa **"2-Way Sync"** para que se sincronicen tanto emails entrantes como salientes
8. Repite para la segunda cuenta

> **Importante:** Asegurate de aceptar TODOS los permisos. Si rechazas alguno, la sincronizacion no funcionara completa.

---

## 2. Sincronizar historial de emails

Una vez conectada cada cuenta:

1. En **Email Services**, haz clic en la cuenta recien conectada
2. Busca la opcion **"Sync Previous Emails"** o **"Import Email History"**
3. Selecciona el periodo que quieras importar (recomendado: **todos** o al menos **ultimos 12 meses**)
4. Confirma y espera a que termine la sincronizacion (puede tardar unas horas dependiendo del volumen)

Esto permite ver dentro de GHL todas las conversaciones que ya tuviste por email con clientes.

---

## 3. Importar contactos de Gmail a GHL

Para cada cuenta:

1. Abre **Google Contacts** (contacts.google.com) con la cuenta correspondiente
2. Haz clic en **"Exportar"** (menu lateral izquierdo)
3. Selecciona **"Todos los contactos"**
4. Formato: **Google CSV**
5. Descarga el archivo

Luego en GHL:

1. Ve a **Contacts** → **Import**
2. Sube el CSV que descargaste
3. Mapea los campos (nombre, email, telefono, empresa)
4. Marca **"Do not create duplicates"** para evitar contactos repetidos
5. Confirma la importacion
6. Repite para la segunda cuenta

---

## 4. Verificar que todo funciona

Despues de conectar ambas cuentas:

- [ ] Enviate un email de prueba a info@ y verifica que aparece en GHL como conversacion
- [ ] Enviate un email de prueba a xavi@ y verifica lo mismo
- [ ] Revisa que los contactos importados aparecen en la seccion Contacts de GHL
- [ ] Comprueba que puedes responder emails desde GHL y que llegan correctamente

---

## Notas

- Si alguna cuenta usa verificacion en 2 pasos (2FA), Google te pedira que confirmes desde el movil. Es normal.
- Los emails nuevos que lleguen a partir de ahora se sincronizaran automaticamente.
- Si tienes dudas, avisanos y lo hacemos juntos en una llamada.
