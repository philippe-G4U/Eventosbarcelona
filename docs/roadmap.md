# Roadmap Eventos Barcelona

*Última actualización: 30 marzo 2026 (actualizado)*

## FASE 1: CRM + Pipeline + Formularios (Sem 1) — ~85% completada

| Tarea | Estado |
|-------|--------|
| Pipeline en GHL (Lead → Propuesta → Negociación → Won → Lost) | ✅ |
| Guía setup GHL (campos, tags, pipelines) | ✅ |
| Formulario inteligente (leads clientes) | ✅ |
| Formulario registro artistas + Cloudinary | ✅ |
| APIs Vercel (lead-cliente, lead-artista, get-artista) | ✅ |
| OAuth Gmail para GHL | ✅ |
| Migración contactos (Mailchimp + Holded + Gmail + Google) | ✅ Extraídos y limpiados |
| Importar contactos clasificados a GHL | ⏳ Pendiente revisión Xavi del CSV |
| Lead Connector / DNS (verificar dominio para envío email) | ❓ Pendiente confirmar |
| Captura emails entrantes (info@ + casilla Xavi) → crear lead en GHL | ❌ Pendiente |
| Conectar formulario con web EB (coordinar agencia SEO) | ❌ Pendiente |

## FASE 2: Propuestas web automatizadas (Sem 2-3) — ~85%

| Tarea | Estado |
|-------|--------|
| Ejemplo propuesta visual (prototipo) | ✅ |
| Templates por categoría (danza, música, circo, shows, wow) | ✅ propuesta.html con temas por categoría |
| Sistema modular (cada show = bloque con datos de GHL) | ✅ Catálogo JSON + render dinámico |
| Admin bar (Aprobar / Modificar) | ✅ Con flujo aprobar + chat modificar |
| Edición de precios individual + global | ✅ Click-to-edit + slider margen global |
| Exportable a PDF | ✅ html2pdf.js integrado |
| Xavi limpiar contenido PPTs en paralelo | ❓ Depende de Xavi |
| Conectar con API GHL (datos reales en lugar de demo) | ❌ Pendiente |
| Deploy propuesta.html en Vercel/Railway | ❌ Pendiente |

## FASE 3: Workflows + Integraciones (Sem 3-4) — No iniciada

| Tarea | Estado |
|-------|--------|
| Workflows GHL (seguimiento automático leads) | ❌ |
| Human in the loop (revisión antes de enviar propuestas) | ❌ |
| Integración Holded (facturación) | ❌ |
| Seguimiento automático (leads fríos, reminders) | ❌ |

## FASE 4: IA + Base artistas + Formación (Sem 5-6) — No iniciada

| Tarea | Estado |
|-------|--------|
| Servidor propuestas Node.js (Railway) | ❌ |
| Chat IA (GPT-4o mini) modifica propuestas en tiempo real | ❌ |
| Base de artistas completa en GHL | ❌ |
| Newsletters (vía Lead Connector) | ❌ |
| Formación a Xavi | ❌ |

## Próximo paso

1. **Xavi**: Revisar CSV de contactos clasificados → importar a GHL
2. **Xavi**: Limpiar contenido de los PPTs actuales (descripciones, fotos, videos de shows)
3. **Nosotros**: Conectar propuesta.html con datos reales de GHL (API endpoint)
4. **Nosotros**: Deploy del sistema de propuestas en Vercel/Railway
5. **En paralelo**: Verificar Lead Connector + DNS y coordinar con agencia SEO para CTA en web
