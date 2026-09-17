// URL de tu Web App de Google Apps Script
const URL_APKS = "https://script.google.com/macros/s/AKfycbx94fTsDD4lMuNLElpkq2dOSE9FAc-N05PWeUCtgUDSEOpVHbz6QY6Q2a5X88CJmiDBJg/exec";

// Variable global para almacenar temporalmente la actividad seleccionada en el modal
let actividadActualSeleccionada = null;
let modoEdicionId = null; // Si tiene valor, estamos editando en vez de creando

// Función para formatear la fecha y hora de la base de datos de forma limpia
function formatearFechaHora(fechaStr, horaStr) {
    let fechaLimpia = fechaStr;
    let horaLimpia = horaStr;

    // Si la fecha viene en formato ISO (ej. 2026-09-18T03:00:00.000Z), extraemos solo YYYY-MM-DD
    if (fechaStr && fechaStr.includes('T')) {
        fechaLimpia = fechaStr.split('T')[0];
    }
    // Si la hora viene con formato de fecha extraña de Sheets, intentamos extraer la hora real
    if (horaStr && horaStr.includes('T')) {
        let partesHora = horaStr.split('T')[1];
        if (partesHora) {
            horaLimpia = partesHora.substring(0, 5); // HH:mm
        }
    }
    return `${fechaLimpia} - ${horaLimpia}`;
}

// Funciones globales para cambiar entre vistas (Pestañas)
function cambiarVista(vista) {
    const vistaForm = document.getElementById('vista-form');
    const vistaLista = document.getElementById('vista-lista');
    const btnForm = document.getElementById('btn-tab-form');
    const btnLista = document.getElementById('btn-tab-lista');

    if (vista === 'form') {
        vistaForm.classList.remove('seccion-oculta');
        vistaLista.classList.add('seccion-oculta');
        btnForm.classList.add('activo');
        btnLista.classList.remove('activo');
    } else {
        vistaForm.classList.add('seccion-oculta');
        vistaLista.classList.remove('seccion-oculta');
        btnLista.classList.add('activo');
        btnForm.classList.remove('activo');
        
        cargarAgenda();
    }
}

// Funciones para ver el detalle flotante (Modal)
function verDetalle(item) {
    actividadActualSeleccionada = item; // Guardamos el objeto completo

    document.getElementById('det-nombre').innerText = item.nombre_actividad;
    document.getElementById('det-categoria').innerText = item.categoria;
    document.getElementById('det-fechahora').innerText = formatearFechaHora(item.fecha, item.hora);
    document.getElementById('det-descripcion').innerText = item.descripcion || "Sin notas adicionales.";

    const bloqueClienteModal = document.getElementById('det-bloque-cliente');
    
    if (item.categoria === 'Trabajo') {
        bloqueClienteModal.classList.remove('seccion-oculta');
        document.getElementById('det-cliente').innerText = item.nombre_cliente || "Sin cliente";
        document.getElementById('det-direccion').innerText = item.direccion || "Sin dirección";
        
        const linkMapaModal = document.getElementById('det-link-mapa');
        if (item.direccion && item.direccion.trim() !== "") {
            linkMapaModal.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}`;
            linkMapaModal.style.display = "inline-flex";
        } else {
            linkMapaModal.style.display = "none";
        }
    } else {
        bloqueClienteModal.classList.add('seccion-oculta');
    }

    document.getElementById('modal-detalle').classList.remove('seccion-oculta');
}

function cerrarDetalle() {
    document.getElementById('modal-detalle').classList.add('seccion-oculta');
}

// Función para preparar la Edición (Pasa los datos al formulario y cambia a esa pestaña)
function prepararEdicion() {
    if (!actividadActualSeleccionada) return;

    if (!confirm("¿Está seguro de que desea modificar esta actividad?")) {
        return;
    }

    // Rellenamos el formulario con los datos actuales
    document.getElementById('categoria').value = actividadActualSeleccionada.categoria;
    document.getElementById('fecha').value = actividadActualSeleccionada.fecha;
    document.getElementById('hora').value = actividadActualSeleccionada.hora;
    document.getElementById('nombre_actividad').value = actividadActualSeleccionada.nombre_actividad;
    document.getElementById('nombre_cliente').value = actividadActualSeleccionada.nombre_cliente || "";
    document.getElementById('direccion').value = actividadActualSeleccionada.direccion || "";
    document.getElementById('descripcion').value = actividadActualSeleccionada.descripcion || "";

    // Activamos modo edición guardando el ID
    modoEdicionId = actividadActualSeleccionada.id;

    // Cambiamos el texto del botón del formulario para indicar que se está actualizando
    const btnSubmit = document.querySelector('#form-agenda button[type="submit"]');
    btnSubmit.innerText = "Actualizar Actividad";

    // Disparamos eventos visuales del form
    document.getElementById('categoria').dispatchEvent(new Event('change'));
    document.getElementById('direccion').dispatchEvent(new Event('input'));

    // Cerramos modal y cambiamos a la pestaña de formulario
    cerrarDetalle();
    cambiarVista('form');
}

// Función para Eliminar con confirmación
function eliminarActividadModal() {
    if (!actividadActualSeleccionada) return;

    if (!confirm("¿Está seguro de que desea ELIMINAR esta actividad de la agenda? Esta acción no se puede deshacer.")) {
        return;
    }

    const datosEliminar = {
        action: "delete",
        id: actividadActualSeleccionada.id
    };

    fetch(URL_APKS, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEliminar)
    })
    .then(() => {
        alert("Actividad eliminada con éxito.");
        cerrarDetalle();
        cargarAgenda(); // Recargamos la lista
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Hubo un error al intentar eliminar la actividad.");
    });
}

// Función para cargar y mostrar las actividades desde Google Sheets
function cargarAgenda() {
    const contenedorLista = document.getElementById('lista-actividades');
    contenedorLista.innerHTML = "<p>Cargando actividades...</p>";

    fetch(URL_APKS)
        .then(response => response.json())
        .then(data => {
            contenedorLista.innerHTML = ""; 

            if (!data || data.length === 0) {
                contenedorLista.innerHTML = "<p>No hay actividades agendadas todavía.</p>";
                return;
            }

            data.forEach(item => {
                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-evento';
                
                let claseBadge = "personal";
                if (item.categoria === 'Trabajo') claseBadge = "trabajo";
                if (item.categoria === 'Turnos') claseBadge = "turnos";

                let clienteTexto = item.nombre_cliente ? `<p><strong>Cliente:</strong> ${item.nombre_cliente}</p>` : "";

                tarjeta.innerHTML = `
                    <div class="tarjeta-header">
                        <span class="badge ${claseBadge}">${item.categoria}</span>
                        <span class="tarjeta-fecha">${formatearFechaHora(item.fecha, item.hora)}</span>
                    </div>
                    <h4>${item.nombre_actividad}</h4>
                    ${clienteTexto}
                `;

                tarjeta.onclick = function() {
                    verDetalle(item); // Le pasamos todo el objeto item completo
                };

                contenedorLista.appendChild(tarjeta);
            });
        })
        .catch(error => {
            console.error('Error al cargar la agenda:', error);
            contenedorLista.innerHTML = "<p>Hubo un error al cargar las actividades desde la base.</p>";
        });
}

// Lógica al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    const selectCategoria = document.getElementById('categoria');
    const bloqueTrabajo = document.getElementById('bloque-trabajo');
    const inputDireccion = document.getElementById('direccion');
    const linkMapa = document.getElementById('link-mapa');
    const formulario = document.getElementById('form-agenda');

    function cambiarVistaFormulario() {
        if (selectCategoria.value === 'Trabajo') {
            bloqueTrabajo.style.display = 'block';
        } else {
            bloqueTrabajo.style.display = 'none';
        }
    }

    function actualizarLinkMapa() {
        const direccionTexto = inputDireccion.value.trim();
        if (direccionTexto !== "") {
            linkMapa.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionTexto)}`;
            linkMapa.style.pointerEvents = "auto";
            linkMapa.style.opacity = "1";
        } else {
            linkMapa.href = "#";
            linkMapa.style.pointerEvents = "none";
            linkMapa.style.opacity = "0.5";
        }
    }

    selectCategoria.addEventListener('change', cambiarVistaFormulario);
    inputDireccion.addEventListener('input', actualizarLinkMapa);
    
    cambiarVistaFormulario();
    actualizarLinkMapa();

    // Envío de datos (Crear o Actualizar)
    formulario.addEventListener('submit', function(e) {
        e.preventDefault();

        const esEdicion = modoEdicionId !== null;
        const mensajeConfirmacion = esEdicion 
            ? "¿Está seguro de guardar los cambios en esta actividad?" 
            : "¿Está seguro de crear esta nueva actividad?";

        if (!confirm(mensajeConfirmacion)) {
            return;
        }

        var datosActividad = {
            action: esEdicion ? "update" : "create",
            id: esEdicion ? modoEdicionId : new Date().getTime().toString(),
            categoria: selectCategoria.value,
            fecha: document.getElementById('fecha').value,
            hora: document.getElementById('hora').value,
            nombre_actividad: document.getElementById('nombre_actividad').value,
            nombre_cliente: document.getElementById('nombre_cliente').value || "",
            direccion: inputDireccion.value || "",
            descripcion: document.getElementById('descripcion').value || ""
        };

        const botonSubmit = formulario.querySelector('button[type="submit"]');
        const textoOriginal = botonSubmit.innerText;
        botonSubmit.innerText = esEdicion ? "Actualizando..." : "Guardando...";
        botonSubmit.disabled = true;

        fetch(URL_APKS, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosActividad)
        })
        .then(() => {
            alert(esEdicion ? "¡Actividad actualizada con éxito!" : "¡Actividad guardada con éxito y programada en Google Calendar!");
            
            formulario.reset();
            modoEdicionId = null;
            botonSubmit.innerText = "Guardar Actividad";
            
            cambiarVistaFormulario();
            actualizarLinkMapa();
            
            cambiarVista('lista');
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Hubo un error al intentar procesar la actividad.");
        })
        .finally(() => {
            botonSubmit.innerText = esEdicion ? "Actualizar Actividad" : "Guardar Actividad";
            botonSubmit.disabled = false;
        });
    });
});