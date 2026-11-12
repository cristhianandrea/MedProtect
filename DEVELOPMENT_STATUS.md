# Estado de desarrollo — MedConnect

Etapa: completar el flujo clínico del portal médico. Persistencia sigue en JSON. No hay migración a MariaDB ni reconstrucción de autenticación.

## Funcionalidades completadas

- Dashboard: cuarta tarjeta de diagnósticos frecuentes (top 5 del periodo, solo consultas reales).
- Agenda de hoy: filtro pendientes / atendidos / todos, primeros tres horarios con opción de desplegar el resto, y acceso a la agenda completa.
- Acciones de cita: iniciar consulta, cancelar (cambia el estado a Cancelada, no borra al paciente) y reagendar con rechazo de horarios ocupados.
- Consultas recientes, en la tarjeta derecha del inicio, muestran las primeras tres. Ver más despliega el resto de esa columna.
- La agenda del día ocupa la tarjeta izquierda, con filtro y las mismas acciones de cita. Muestra las primeras tres; Ver más despliega esa columna. Las recetas se consultan desde el historial.
- Próximas consultas y la agenda completa quedaron en una sola sección. El resumen muestra tres citas futuras. Ver más abre un calendario de mes o semana: los días con cita llevan marcas y, al elegir un día, se despliegan sus citas con las mismas acciones. El filtro es Futuras o Todas.
- Pacientes: resultados en tarjetas y botón Iniciar nueva consulta, con el mismo formulario del resto del portal.
- Historial: cinco registros recientes y el listado completo. Acciones según estado: Iniciar, Ver receta existente o Ver detalle. No aparece “Emitir receta” si no hay folio.
- Guardar una consulta la deja en estado Completada (atendida), con o sin receta, y marca la cita del día como Atendida.
- Perfil: los campos existentes se guardan y se vuelven a mostrar. Cambiar contraseña valida la contraseña almacenada, la longitud mínima de 6 caracteres y la confirmación.

## Archivos modificados

- `backend/server.js`
- `frontend/api-client.js`
- `frontend/medico-dashboard.html`
- `frontend/ui-icons.js`

## Pruebas realizadas

- Recorrido de API: contraseña inválida y cambio real con restauración, perfil sin pisar la contraseña, cita pendiente, choque de horario, reagendar, consulta en curso, consulta guardada sin receta, actualización del mismo folio de consulta, cita atendida, vista PDF sin duplicar receta, cancelación sin borrar al paciente y filtro de pendientes.
- Navegador en `http://localhost:5000`: tarjetas del inicio, vista de receta existente, búsqueda de paciente en tarjeta, apertura del formulario con el paciente asociado, historial con acciones por estado y mensajes del cambio de contraseña. Escritorio y ancho de teléfono.

## Pendiente

- El inicio de sesión sigue sin comprobar la contraseña. El cambio de contraseña sí compara y actualiza el valor guardado en `users.json`, en texto plano. No es un mecanismo de producción.
- Consultas antiguas guardadas sin receta siguen como Pendiente. Iniciar y guardar las pasa a Atendida; no se reescribieron solas.
- Sigue existiendo respaldo en `localStorage` dentro de `api-client.js`. No se migró en esta etapa.
- Autenticación, autorización y MariaDB quedan para la siguiente etapa. Usar solo datos ficticios.
