// Paquete del sector "cafe": textos, botones, tema y palabras. El motor no escribe nada de un sector.
export default {
  "sector": "cafe",
  "nombre": "Café / restaurante",
  "tema": "calido",
  "palabras": {
    "lugar": "mesa",
    "catalogo": "carta",
    "item": "plato",
    "visita": "visita",
    "primera": "tu primera compra"
  },
  "botones": [
    {
      "servicio": "catalogo",
      "id": "carta",
      "texto": "Ver la carta",
      "icono": "lista",
      "ruta": "/n/{slug}/carta",
      "requiere": "tiene_carta",
      "alterna": {
        "ruta": "/c/{slug}/menu",
        "requiere": "menu_url"
      },
      "detalle": "Platos, bebidas y postres"
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
    "modo": "visita",
    "plural": "monedas",
    "singular": "moneda"
  },
  "en_riesgo_dias": 21,
  "estadisticas": [
    "visitas_portal",
    "inscritos",
    "frecuencia",
    "retorno_30",
    "recencia",
    "en_riesgo",
    "conversion_resena",
    "devolucion_real"
  ]
};
