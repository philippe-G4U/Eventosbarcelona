# Setup GoHighLevel — Eventos Barcelona

## Guia paso a paso para Ramiro

---

## 1. CREAR CUENTA GHL

- Plan: **Starter** ($97/mes)
- Email de la cuenta: `dev@eventosbarcelona.com`
- Nombre del negocio: Eventos Barcelona
- Timezone: Europe/Madrid
- Moneda: EUR

---

## 2. PIPELINES

### Pipeline 1: Clientes (ventas)

| Etapa | Descripcion | Color sugerido |
|-------|-------------|----------------|
| **New Lead** | Lead entra por formulario o email. Aun no se ha generado propuesta. | Azul |
| **Propuesta Enviada** | Propuesta generada, revisada por Xavi y enviada al cliente. | Amarillo |
| **Negociacion** | Cliente respondio. Ajustes de precio, shows o condiciones en curso. | Naranja |
| **Won** | Evento confirmado. Presupuesto aceptado. | Verde |
| **Lost** | Oportunidad no convertida. | Rojo |

### Pipeline 2: Artistas

| Etapa | Descripcion | Color sugerido |
|-------|-------------|----------------|
| **Solicitud Recibida** | Artista envio formulario o contacto. | Azul |
| **Portfolio Revisado** | Xavi reviso fotos/videos del artista. | Amarillo |
| **Artista Aprobado** | Artista validado, listo para incluir en propuestas. | Verde |
| **En Catalogo Activo** | Artista activo, aparece en propuestas comerciales. | Verde oscuro |
| **No Apto** | Artista descartado o no encaja. | Gris |

---

## 3. CUSTOM FIELDS — Contactos (Clientes/Leads)

Crear estos campos personalizados en la seccion de contactos:

### Datos del evento

| Campo | Tipo | Opciones / Notas |
|-------|------|------------------|
| Tipo de evento | Dropdown | Cena de gala, Cocktail / Welcome drink, Lanzamiento de producto, Convencion / Congreso, Entrega de premios, Family Day corporativo, Fiesta tematica, Otro |
| Formato de show | Dropdown | Show de escenario, Ambient / entre mesas, Ambos |
| Categorias artisticas | Multi-select | Danza, Musica, Circo, Shows especiales |
| Fecha del evento | Date | — |
| Numero de asistentes | Number | — |
| Ubicacion / Hotel | Text | — |
| Ciudad | Text | — |
| Presupuesto aproximado | Dropdown | < 3.000€, 3.000 - 6.000€, 6.000 - 12.000€, > 12.000€ |
| Idioma del cliente | Dropdown | Espanol, Ingles |
| Como nos conocio | Dropdown | Busqueda en Google, Recomendacion, Redes sociales, Evento anterior, Otro |

### Datos de la propuesta

| Campo | Tipo | Notas |
|-------|------|-------|
| URL de la propuesta | Text (URL) | Link a propuestas.eventosbarcelona.com/... |
| Estado de la propuesta | Dropdown | Pendiente de revision, Aprobada, Enviada, Modificada |
| Fecha de envio de propuesta | Date | — |
| Margen aplicado (%) | Number | Ej: 15, 20, 30 |
| Notas internas | Text (long) | Notas de Xavi sobre el lead |
| Comentarios del cliente | Text (long) | Lo que escribio en el formulario |

---

## 4. CUSTOM FIELDS — Contactos (Artistas)

Usar el mismo modulo de contactos pero con estos campos adicionales + tag "Artista" para diferenciarlos:

| Campo | Tipo | Opciones / Notas |
|-------|------|------------------|
| Tipo de contacto | Dropdown | Cliente, Artista |
| Disciplina artistica | Multi-select | Danza, Musica, Circo, Shows especiales, Animacion, Otro |
| Nombre artistico | Text | — |
| Nombre de compania | Text | — |
| Bio del show | Text (long) | Max 100 palabras |
| Link video 1 | Text (URL) | YouTube / Vimeo |
| Link video 2 | Text (URL) | Opcional |
| Link web / RRSS | Text (URL) | Instagram, web, etc. |
| Rider tecnico | Text (long) | Necesidades tecnicas del show |
| Rango de cache | Dropdown | < 500€, 500 - 1.500€, 1.500 - 3.000€, > 3.000€ |
| Numero de artistas en show | Number | — |
| Duracion del show | Dropdown | 15-20 min, 30 min, 45 min, 1 hora, Mas de 1 hora, Flexible |
| Fotos (URLs) | Text (long) | Links a Cloudinary / Drive |
| Acepto politica de imagen | Checkbox | Autorizacion de uso sin marca de agua |
| Estado del artista | Dropdown | Pendiente revision, Aprobado, En catalogo, No apto |

---

## 5. TAGS

### Tags de tipo de evento
- `evento:gala`
- `evento:cocktail`
- `evento:lanzamiento`
- `evento:convencion`
- `evento:premios`
- `evento:familyday`
- `evento:fiesta`
- `evento:otro`

### Tags de categoria artistica
- `cat:danza`
- `cat:musica`
- `cat:circo`
- `cat:shows-especiales`

### Tags de formato
- `formato:escenario`
- `formato:ambient`

### Tags de estado
- `estado:lead-nuevo`
- `estado:propuesta-pendiente`
- `estado:propuesta-enviada`
- `estado:negociacion`
- `estado:won`
- `estado:lost`

### Tags de presupuesto
- `budget:bajo` (< 3.000€)
- `budget:medio` (3.000 - 6.000€)
- `budget:alto` (6.000 - 12.000€)
- `budget:premium` (> 12.000€)

### Tags de origen
- `origen:web-formulario`
- `origen:email-directo`
- `origen:telefono`
- `origen:whatsapp`
- `origen:recomendacion`

### Tags de contacto
- `tipo:cliente`
- `tipo:artista`

### Tags de idioma
- `idioma:es`
- `idioma:en`

### Tags de prioridad
- `prioridad:alta` (evento a corto plazo + budget alto)
- `prioridad:media`
- `prioridad:baja` (evento a largo plazo o budget bajo)

---

## 6. CUSTOM VALUES (Catalogo de Shows)

Estos son los valores globales que se usan para generar propuestas automaticamente. Xavi los puede editar sin tocar codigo.

### Estructura por show:

Crear un Custom Value por cada show con la siguiente convencion de nombres:

```
show_[categoria]_[nombre]_precio_base
show_[categoria]_[nombre]_descripcion
show_[categoria]_[nombre]_duracion
show_[categoria]_[nombre]_num_artistas
```

### Ejemplo (rellenar cuando Xavi pase la lista de precios):

| Custom Value | Valor |
|-------------|-------|
| `show_danza_flamenco_precio_base` | 1500 |
| `show_danza_flamenco_descripcion` | Show de flamenco con 3 bailaoras y guitarra en directo |
| `show_danza_flamenco_duracion` | 30 min |
| `show_danza_flamenco_num_artistas` | 4 |
| `show_musica_violin_electrico_precio_base` | 1800 |
| `show_circo_malabares_led_precio_base` | 1200 |
| `margen_default` | 20 |
| `margen_gala` | 25 |
| `margen_cocktail` | 20 |
| `margen_convencion` | 15 |

**PENDIENTE: Xavi nos tiene que pasar la lista completa de shows con precios base.**

---

## 7. CONFIGURACION DE EMAIL (Mailgun + SMTP)

### En Mailgun:
1. Crear cuenta Mailgun (Foundation plan, $35/mes)
2. Agregar dominio: `eventosbarcelona.com`
3. Configurar registros DNS en CDmon:
   - SPF: `v=spf1 include:mailgun.org ~all`
   - DKIM: (Mailgun te da el registro)
   - DMARC: `v=DMARC1; p=none; rua=mailto:dev@eventosbarcelona.com`
4. Verificar dominio en Mailgun

### En GHL:
1. Ir a Settings > Email Services
2. Agregar Mailgun como proveedor SMTP
3. Pegar API key y dominio de Mailgun
4. Enviar email de prueba para verificar

---

## 8. WORKFLOWS (configurar despues del setup basico)

### Workflow 1: Nuevo lead desde formulario de clientes
```
Trigger: Form submitted (formulario clientes)
→ Crear/actualizar contacto
→ Asignar tags automaticos (tipo evento, categoria, budget, origen:web-formulario)
→ Mover a pipeline Clientes > "New Lead"
→ Enviar notificacion a Xavi (email + app GHL)
     Asunto: "Nuevo lead: {nombre} — {tipo_evento} — {num_asistentes} personas"
     Cuerpo: resumen del formulario + link a la propuesta (cuando este implementado)
```

### Workflow 2: Nuevo lead desde email
```
Trigger: Email recibido en info@eventosbarcelona.com
→ Crear contacto
→ Tag: origen:email-directo
→ Mover a pipeline Clientes > "New Lead"
→ Enviar respuesta automatica al lead:
     "Gracias por contactarnos. Para prepararte una propuesta personalizada,
      rellena este breve formulario: [link formulario]"
→ Notificar a Xavi
```

### Workflow 3: Seguimiento automatico
```
Trigger: Contacto en etapa "Propuesta Enviada" durante 48h sin respuesta
→ Enviar email de seguimiento 1:
     "Hola {nombre}, queria saber si has tenido oportunidad de revisar
      nuestra propuesta para {tipo_evento}..."

Trigger: Sin respuesta 5 dias
→ Enviar email de seguimiento 2

Trigger: Sin respuesta 10 dias
→ Enviar email de seguimiento 3 (ultimo + oferta opcional)
→ Notificar a Xavi: "Lead {nombre} sin respuesta tras 10 dias"
```

### Workflow 4: Evento confirmado (Won)
```
Trigger: Contacto movido a etapa "Won"
→ Custom code: crear contacto + factura en Holded via API
→ Enviar email de confirmacion al cliente
→ Tag: estado:won
```

### Workflow 5: Nuevo artista desde formulario
```
Trigger: Form submitted (formulario artistas)
→ Crear contacto
→ Tag: tipo:artista + tags de disciplina
→ Mover a pipeline Artistas > "Solicitud Recibida"
→ Notificar a Xavi: "Nuevo artista: {nombre} — {disciplina}"
```

### Workflow 6: Post-evento
```
Trigger: 3 dias despues de fecha del evento (contacto en "Won")
→ Enviar email de agradecimiento al cliente
→ Solicitar resena / feedback
```

---

## 9. FORMULARIOS EN GHL

Replicar los prototipos que ya tenemos en HTML:

### Formulario de clientes
Campos: nombre, empresa, email, telefono, tipo de evento, formato de show (escenario/ambient), categorias artisticas, fecha, num asistentes, ubicacion, presupuesto, comentarios, como nos conocio.

**Prototipo**: propuestas.eventosbarcelona.com/formulario-inteligente.html

### Formulario de artistas
Campos: nombre/nombre artistico, compania, email, telefono, ciudad, disciplina, bio del show, fotos (upload), link video, web/RRSS, rider tecnico, rango de cache, num artistas, duracion, aceptacion politica de imagen.

**Prototipo**: propuestas.eventosbarcelona.com/formulario-artistas.html

---

## 10. ORDEN DE EJECUCION

### Semana 1:
1. ☐ Crear cuenta GHL
2. ☐ Crear Pipeline de Clientes (5 etapas)
3. ☐ Crear Pipeline de Artistas (5 etapas)
4. ☐ Crear todos los Custom Fields (clientes + artistas)
5. ☐ Crear todos los Tags
6. ☐ Configurar Mailgun + SMTP en GHL
7. ☐ Crear formulario de clientes en GHL (replicar prototipo)
8. ☐ Crear formulario de artistas en GHL (replicar prototipo)

### Semana 2:
9. ☐ Configurar Workflow 1 (nuevo lead formulario)
10. ☐ Configurar Workflow 2 (nuevo lead email)
11. ☐ Configurar Workflow 5 (nuevo artista)
12. ☐ Migrar contactos de Mailchimp a GHL
13. ☐ Coordinar con agencia SEO para CTAs en la web → link al formulario

### Semana 3:
14. ☐ Configurar Workflow 3 (seguimiento automatico)
15. ☐ Cargar catalogo de shows en Custom Values (cuando Xavi pase precios)
16. ☐ Configurar Workflow 4 (Won → Holded)
17. ☐ Testing end-to-end: formulario → lead → pipeline → notificacion

---

## 11. ACCESOS NECESARIOS

| Que | Estado |
|-----|--------|
| Email dev@eventosbarcelona.com | ✅ Listo |
| WordPress | ✅ Listo |
| Mailchimp (para migrar contactos) | ✅ Listo |
| Holded (CRM access) | ✅ Listo (invitacion enviada a dev@) |
| DNS / CDmon | ✅ Listo (agencia SEO configuro subdominio) |
| Vercel (deploy propuestas) | ✅ Listo |
| GHL | ☐ Pendiente — Ramiro crea la cuenta |
| Mailgun | ☐ Pendiente |
| OpenAI API key | ☐ Pendiente (para fase de chat IA en propuestas) |
| Lista de shows con precios | ☐ Pendiente — Xavi |

---

*Documento creado: 24 marzo 2026*
*Para: Ramiro Perez Rodero — Growth4U*
