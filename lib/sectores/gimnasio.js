// Paquete del sector "gimnasio": textos, botones, tema y palabras. El motor no escribe nada de un sector.
export default {
  "sector": "gimnasio",
  "nombre": "Gimnasio",
  "tema": "energia",
  "palabras": {
    "lugar": "máquina",
    "catalogo": "clases",
    "item": "clase",
    "visita": "entrada"
  },
  "botones": [
    {
      "servicio": "catalogo",
      "id": "clases",
      "texto": "Clases de hoy",
      "icono": "calendario",
      "ruta": "/n/{slug}/clases",
      "detalle": "El horario de hoy"
    },
    {
      "servicio": "club",
      "id": "monedas",
      "texto": "Mis monedas",
      "icono": "monedas",
      "ruta": "/n/{slug}/club",
      "detalle": "Tu saldo y tus premios"
    },
    {
      "servicio": "base",
      "id": "resena",
      "texto": "Déjanos tu reseña",
      "icono": "estrella",
      "ruta": "/c/{slug}/resena",
      "requiere": "resena_url",
      "detalle": "Cuéntale a otros cómo te fue"
    }
  ],
  "monedas": {
    "modo": "asistencia",
    "plural": "monedas",
    "singular": "moneda"
  },
  "en_riesgo_dias": 10,
  "estadisticas": [
    "visitas_portal",
    "activos",
    "abandono",
    "en_riesgo",
    "inscritos",
    "frecuencia",
    "conversion_resena",
    "uso_maquinas"
  ]
};
