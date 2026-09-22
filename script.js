// URL de tu Web App de Google Apps Script
const URL_APKS = "https://script.google.com/macros/s/AKfycbx94fTsDD4lMuNLElpkq2dOSE9FAc-N05PWeUCtgUDSEOpVHbz6QY6Q2a5X88CJmiDBJg/exec";

// Variable global para almacenar temporalmente la actividad seleccionada en el modal
let actividadActualSeleccionada = null;
let modoEdicionId = null; 

// Función para formatear la fecha y hora de forma limpia
function formatearFechaHora(fechaStr, horaStr) {
    let fechaLimpia = fechaStr ? fechaStr.toString().split('T')[0] : "";
    let horaLimpia = horaStr ? horaStr.toString() : "00:00";
    
    if (horaLimpia.includes('T')) {
        let partes = horaLimpia.split('T');
        if (partes[1]) horaLimpia = partes[1].substring(0, 5);
    } else if (horaLimpia.length > 5) {
        horaLimpia = horaLimpia.substring(0, 5);
    }
    
    return `${fechaLimpia} - ${horaLimpia}`;
}

// Funciones globales para cambiar entre vistas
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
    actividadActualSeleccionada = item;

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

// Función para preparar la Edición
function prepararEdicion() {
    if (!actividadActualSeleccionada) return;

    if (!confirm("¿Está seguro de que desea modificar esta actividad?")) {
        return;
    }

    document.getElementById('categoria').value = actividadActualSeleccionada.categoria;
    
    let fechaFormato = actividadActualSeleccionada.fecha;
    if (fechaFormato && fechaFormato.includes('T')) {
        fechaFormato = fechaFormato.split('T')[0];
    }
    document.getElementById('fecha').value = fechaFormato;

    let horaFormato = actividadActualSeleccionada.hora;
    if (horaFormato && horaFormato.includes('T')) {
        let partes = horaFormato.split('T');
        if (partes[1]) horaFormato = partes[1].substring(0, 5);
    } else if (horaFormato && horaFormato.length > 5) {
        horaFormato = horaFormato.substring(0, 5);
    }
    document.getElementById('hora').value = horaFormato;

    document.getElementById('nombre_actividad').value = actividadActualSeleccionada.nombre_actividad;
    document.getElementById('nombre_cliente').value = actividadActualSeleccionada.nombre_cliente || "";
    document.getElementById('direccion').value = actividadActualSeleccionada.direccion || "";
    document.getElementById('descripcion').value = actividadActualSeleccionada.descripcion || "";

    modoEdicionId = actividadActualSeleccionada.id;

    const btnSubmit = document.querySelector('#form-agenda button[type="submit"]');
    if (btnSubmit) btnSubmit.innerText = "Actualizar Actividad";

    document.getElementById('categoria').dispatchEvent(new Event('change'));
    document.getElementById('direccion').dispatchEvent(new Event('input'));

    cerrarDetalle();
    cambiarVista('form');
}

// Función para Eliminar con confirmación y retraso de refresco
function eliminarActividadModal() {
    if (!actividadActualSeleccionada) return;

    if (!confirm("¿Está seguro de que desea ELIMINAR esta actividad de la agenda?")) {
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
        // Damos un respiro de 1 segundo para que Google Sheets procese antes de recargar
        setTimeout(() => {
            cargarAgenda();
        }, 1000);
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Hubo un error al intentar eliminar la actividad.");
    });
}

// Función para cargar, ordenar, filtrar y mostrar las actividades
function cargarAgenda() {
    const contenedorLista = document.getElementById('lista-actividades');
    if (!contenedorLista) return;
    
    contenedorLista.innerHTML = "<p>Cargando actividades...</p>";

    fetch(URL_APKS, { redirect: 'follow' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la red al conectar con Google Sheets');
            }
            return response.json();
        })
        .then(data => {
            contenedorLista.innerHTML = ""; 

            if (!data || !Array.isArray(data) || data.length === 0) {
                contenedorLista.innerHTML = "<p>No hay actividades agendadas todavía.</p>";
                return;
            }

            const hoy = new Date();
            const limiteAyer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);

            let actividadesFiltradas = data.filter(item => {
                if (!item.fecha) return false;
                let fechaStr = item.fecha.toString().split('T')[0];
                let horaStr = item.hora ? item.hora.toString() : "00:00";
                if (horaStr.includes('T')) {
                    let partes = horaStr.split('T');
                    if (partes[1]) horaStr = partes[1].substring(0, 5);
                } else if (horaStr.length > 5) {
                    horaStr = horaStr.substring(0, 5);
                }

                let fechaHoraItem = new Date(`${fechaStr}T${horaStr}:00`);
                return fechaHoraItem >= limiteAyer;
            });

            if (actividadesFiltradas.length === 0) {
                contenedorLista.innerHTML = "<p>No hay actividades pendientes o recientes.</p>";
                return;
            }

            actividadesFiltradas.sort((a, b) => {
                let fechaA = a.fecha.toString().split('T')[0];
                let horaA = a.hora ? a.hora.toString().substring(0, 5) : "00:00";
                if (a.hora && a.hora.toString().includes('T')) {
                    let p = a.hora.toString().split('T');
                    if (p[1]) horaA = p[1].substring(0, 5);
                }

                let fechaB = b.fecha.toString().split('T')[0];
                let horaB = b.hora ? b.hora.toString().substring(0, 5) : "00:00";
                if (b.hora && b.hora.toString().includes('T')) {
                    let p = b.hora.toString().split('T');
                    if (p[1]) horaB = p[1].substring(0, 5);
                }

                let tA = new Date(`${fechaA}T${horaA}:00`).getTime();
                let tB = new Date(`${fechaB}T${horaB}:00`).getTime();

                return tA - tB;
            });

            actividadesFiltradas.forEach(item => {
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
                    verDetalle(item); 
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
        if (selectCategoria && bloqueTrabajo) {
            if (selectCategoria.value === 'Trabajo') {
                bloqueTrabajo.style.display = 'block';
            } else {
                bloqueTrabajo.style.display = 'none';
            }
        }
    }

    function actualizarLinkMapa() {
        if (inputDireccion && linkMapa) {
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
    }

    if (selectCategoria) selectCategoria.addEventListener('change', cambiarVistaFormulario);
    if (inputDireccion) inputDireccion.addEventListener('input', actualizarLinkMapa);
    
    cambiarVistaFormulario();
    actualizarLinkMapa();

    if (formulario) {
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
            if (botonSubmit) {
                botonSubmit.innerText = esEdicion ? "Actualizando..." : "Guardando...";
                botonSubmit.disabled = true;
            }

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
                if (botonSubmit) botonSubmit.innerText = "Guardar Actividad";
                
                cambiarVistaFormulario();
                actualizarLinkMapa();
                
                // Damos 1 segundo de respiro antes de cambiar a la lista para asegurar que Sheets registre el cambio
                setTimeout(() => {
                    cambiarVista('lista');
                }, 1000);
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Hubo un error al intentar procesar la actividad.");
            })
            .finally(() => {
                if (botonSubmit) {
                    botonSubmit.innerText = esEdicion ? "Actualizar Actividad" : "Guardar Actividad";
                    botonSubmit.disabled = false;
                }
            });
        });
    }
});