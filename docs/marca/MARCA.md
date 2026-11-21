# Nef — identidad de marca

> **Nombre provisional: Nef** (de NFC). Producto de Mamut Herd. Antes de imprimir en cantidad,
> verificar dominio y registro en la SIC. Si cambia, solo cambian el wordmark y la variable `MARCA`.

Ver `tablero.png` (o `tablero.html` en el navegador). Reglas de páginas web: `GUIA-WEB.md`;
referencia aplicada: `landing-referencia.png`.

## La promesa
**Clientes que vuelven.**
Nef pone un punto en la mesa, la entrada o la máquina. El cliente acerca el celular y el negocio
lo conoce, lo premia y lo recupera.

## Personalidad: cercano con criterio
Ni genérico ni premium: en el medio, un poco hacia lo cercano.
- **El aliado del negocio de barrio.** Sabe de tecnología, pero habla como el dueño del café.
- **Claro antes que impresionante.** Si hay que explicarlo, está mal hecho.
- **Cálido y directo.** Tutea, va al grano, nunca promete lo que no hace.

## Voz
| Así sí | Así no |
|---|---|
| "Acerca el celular." | "Interactúa mediante tecnología NFC." |
| "Estos 12 socios dejaron de venir." | "Optimiza tu tasa de retención con IA." |
| "Tus clientes vuelven." | "Revoluciona tu negocio 🚀" |
| "Lo instalo y te enseño en 10 minutos." | "Solución omnicanal end-to-end." |

Reglas: tuteo; frases cortas; números concretos en vez de adjetivos; nunca "revolucionar",
"potenciar", "solución", "innovador"; nunca prometer resultados que no se han medido.

## Logo
- **Símbolo: el punto.** Anillo + centro = "acerca el celular aquí". Es el mismo punto del kit impreso.
- **Wordmark:** "nef" en minúsculas, Bricolage Grotesque 700, convertido a curvas.
- Archivos: `logo-nef.svg` (sobre claro), `logo-nef-sobre-oscuro.svg`, `logo-nef-una-tinta.svg`
  (firma en portales e impresos de una tinta), `simbolo-nef.svg`, `icono-app-nef.svg`.
- Espacio libre alrededor: el radio del punto. Tamaño mínimo: 80 px de ancho en pantalla, 20 mm impreso.
- No: estirar, rotar, cambiar colores fuera de la paleta, poner sombras, usar el símbolo de pago sin
  contacto (es una marca registrada de otra organización).

## Color
| Nombre | Hex | Uso |
|---|---|---|
| Mandarina | `#FF6B35` | El punto, acentos, una sola cosa importante por pantalla. **Nunca texto sobre blanco** (poco contraste); sobre mandarina va tinta. |
| Tinta | `#1D1B18` | Texto, botones principales, fondos oscuros |
| Papel | `#F5F1EA` | Fondo de página |
| Arena | `#E8E1D4` | Bordes, bloques secundarios |
| Cielo | `#CFE3F0` | Gráficas y datos (segunda serie) |

## Tipografía
- **Bricolage Grotesque** (licencia OFL, archivos en `fuentes/`): títulos y números grandes en las
  superficies de Nef (landing, panel, informes, material de ventas). Pesos 700–800 para títulos.
- **Sans del sistema** para todo el texto y la interfaz.
- En los **portales de los negocios** NO se usa la marca Nef: manda el tema del sector (`docs/DISENO.md`)
  y el logo/color del negocio. Nef aparece solo como firma: "Hecho con [logo-nef-una-tinta]".

## Dónde va qué
| Superficie | Marca que manda |
|---|---|
| Landing (`/`), panel de Jacobo, panel del dueño, informes PDF | **Nef** (esta guía) |
| Portal, catálogo, club, caja del negocio | **El negocio** (tema de sector + su logo y color), firma Nef pequeña |
| Kit impreso | El negocio en sus piezas; Nef en la tarjeta de Mamut y en el sticker genérico |

## Para el código
`docs/diseno/tokens.css` tiene la sección `/* MARCA NEF */` con estas variables (`--nef-*`).
Copiar las fuentes a `public/assets/fuentes/` y declararlas con `font-display: swap`.
