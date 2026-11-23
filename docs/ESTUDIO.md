# Estudio trimestral (servicio "Estudio") — plantilla para Jacobo

> Qué es: un informe en PDF, en lenguaje simple, con **3 acciones concretas** para el dueño, hecho en R con los
> datos que Nef exporta. Se publica en el link del dueño (admin → Estadísticas → Informes).
> Datos: admin → Estadísticas → "Exportar para el estudio" → 4 CSV + `LEEME.txt` (sin nombres ni teléfonos).
> Script base: `estudio/plantilla.R`.

## 1. Cómo correrlo
```
Rscript estudio/plantilla.R <carpeta con los CSV> [carpeta de salida] [fecha del cambio AAAA-MM-DD]
```
- Lee `*_visitas.csv`, `*_clientes.csv`, `*_canjes.csv`, `*_entradas.csv` de la carpeta (los nombres que pone Nef).
- Escribe gráficas PNG y `resumen.txt` en la carpeta de salida (por defecto `salida/`).
- La fecha del cambio (opcional) activa la comparación antes/después (ej. el día en que empezó la hora dorada).

## 2. Secciones del informe (en este orden, máximo 4 páginas)
1. **Resumen en 5 líneas.** Qué pasó en el trimestre, en frases que el dueño entienda sin gráficas.
2. **Descriptivo.** Clientes/socios activos, visitas por semana, frecuencia (mediana), horas pico, cohortes por mes de inscripción
   (¿cuántos de los que llegaron en septiembre siguen viniendo?), canjes y devolución real.
3. **La pregunta del dueño.** Una sola por trimestre, escrita con sus palabras (ej. "¿Sirvió la hora dorada?").
4. **Método.** Una línea: qué prueba se usó y por qué (ver §3).
5. **Resultado.** El número que responde la pregunta, con su intervalo de confianza o su valor p y qué significa en pesos o en clientes.
6. **3 acciones.** Concretas, con fecha y responsable (ej. "Escribirle el lunes a los 12 socios en riesgo del plan mensual").
7. **Advertencias.** Tamaño de muestra, periodo, qué no se puede concluir (ver §4).

## 3. Qué prueba usar según la pregunta
| Pregunta del dueño | Método | En `plantilla.R` |
|---|---|---|
| ¿Funcionó el cambio? (hora dorada, nuevo premio, nuevo horario) | Visitas diarias antes vs. después: **Wilcoxon** (o t pareada si hay pares naturales, ej. el mismo día de la semana). Con ≥ 8 semanas antes y después: **serie de tiempo interrumpida (ITS)** con regresión segmentada (nivel y pendiente) | Sección 4 |
| ¿Quién se va a ir? | **Regresión logística**: abandono (sin venir en los últimos 30 días) ~ frecuencia del primer mes + plan + horario habitual. Reportar odds ratios con IC 95 % | Sección 5 |
| ¿Cuánto dura un socio? ¿Qué plan retiene más? | **Kaplan-Meier** (tiempo desde la primera entrada hasta dejar de venir, censurando a los que siguen) + **log-rank** entre planes | Sección 6 |
| ¿Cuándo viene la gente? ¿Cuánto personal poner? | **Modelo de conteo**: Poisson (o cuasi-Poisson si hay sobredispersión) de visitas por hora ~ hora + día de la semana | Sección 7 |

## 4. Mínimo de datos para hacer inferencia
- Si no se cumple, el informe **solo describe** y lo dice: "Con estos datos aún no se puede concluir…".
- Antes/después: ≥ 4 semanas antes y ≥ 4 después; ITS: ≥ 8 y ≥ 8.
- Regresión logística: ≥ 10 eventos (personas que se fueron) por variable del modelo.
- Kaplan-Meier: ≥ 30 personas en total y ≥ 10 eventos por grupo para comparar con log-rank.
- Poisson por hora: ≥ 4 semanas de datos.
- Siempre en el informe: n (personas y visitas), periodo exacto, y que una asociación no prueba causa.

## 5. Privacidad
- Los CSV no tienen nombres ni teléfonos; los ids cambian en cada exportación. No intentes cruzarlos con otras fuentes.
- No guardes los CSV en carpetas compartidas. Al terminar el informe, bórralos.
- Ley 1581: el negocio es el responsable de los datos; Mamut Herd es el encargado y solo los usa para este informe.
