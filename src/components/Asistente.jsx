import { useState } from 'react'

const RESPUESTAS = [
  { pregunta: '¿Cómo creo una cuenta?', respuesta: 'Selecciona “Crear cuenta”, completa el formulario y verifica tu correo con el código que te envíe el sistema. Si no llega, revisa spam y espera antes de pedir otro para evitar el límite de correos.' },
  { pregunta: '¿Cómo solicito una cita?', respuesta: 'Inicia sesión y elige “Solicitar una cita”. Selecciona el servicio, la fecha y uno de los horarios disponibles. La solicitud queda sujeta a la disponibilidad y revisión del equipo.' },
  { pregunta: '¿Dónde veo mis citas?', respuesta: 'Inicia sesión y abre “Mis citas” desde el menú superior o desde tu espacio personal. Allí puedes revisar estados, pagos y las opciones permitidas para cancelar o reprogramar.' },
  { pregunta: '¿Cómo pago?', respuesta: 'En “Mis citas”, abre la opción de pago y sigue las instrucciones Nequi que aparecen allí. Adjunta el comprobante; el equipo debe revisarlo antes de aprobar el pago. El asistente no puede confirmar transferencias.' },
  { pregunta: 'No veo horarios disponibles', respuesta: 'Los horarios aparecen cuando hay un profesional asignado y su agenda está configurada. Si no ves opciones, contacta al administrador del servicio para que revise la asignación y disponibilidad.' },
  { pregunta: '¿Cómo cambio o cancelo una cita?', respuesta: 'Abre “Mis citas”. Las opciones aparecen según el estado de la cita y el tiempo que falta para la atención. Si no ves la opción, solicita ayuda al administrador.' },
]

export default function Asistente() {
  const [abierto, setAbierto] = useState(false)
  const [preguntaActiva, setPreguntaActiva] = useState(null)

  return <>
    {abierto && <section className="asistente-panel" id="asistente-panel" aria-label="Asistente de ayuda">
      <header className="asistente-cabecera">
        <div><strong>Ayuda del sitio</strong><small>Respuestas automáticas sobre el uso de la página</small></div>
        <button type="button" className="asistente-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar ayuda">×</button>
      </header>
      <div className="asistente-mensajes" aria-live="polite">
        <p className="asistente-burbuja">Hola. Puedo orientarte con el registro, las citas y el proceso de pago. No escribas aquí información personal o clínica.</p>
        {preguntaActiva && <>
          <p className="asistente-pregunta">{preguntaActiva.pregunta}</p>
          <p className="asistente-burbuja">{preguntaActiva.respuesta}</p>
        </>}
      </div>
      <div className="asistente-opciones" aria-label="Temas de ayuda">
        {RESPUESTAS.map((item) => <button type="button" key={item.pregunta} onClick={() => setPreguntaActiva(item)}>{item.pregunta}</button>)}
      </div>
      <p className="asistente-aviso">Este asistente es informativo; no presta atención psicológica ni atiende emergencias.</p>
    </section>}
    <button type="button" className="asistente-boton" onClick={() => setAbierto((estado) => !estado)} aria-expanded={abierto} aria-controls="asistente-panel" aria-label={abierto ? 'Cerrar ayuda' : 'Abrir ayuda'}>
      <span aria-hidden="true">{abierto ? '×' : '？'}</span>{abierto ? 'Cerrar' : 'Ayuda'}
    </button>
  </>
}
