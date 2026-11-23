# =====================================================================
#  NEF · plantilla del estudio trimestral (ver docs/ESTUDIO.md)
#  Uso: Rscript estudio/plantilla.R <carpeta con los CSV> [carpeta de salida] [fecha del cambio AAAA-MM-DD]
#  Paquetes: dplyr, ggplot2, survival.
#  Cada método corre solo si hay datos suficientes (docs/ESTUDIO.md §4); si no, lo dice y sigue.
# =====================================================================
suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(survival)
})

args <- commandArgs(trailingOnly = TRUE)
carpeta <- if (length(args) >= 1) args[1] else "datos"
salida <- if (length(args) >= 2) args[2] else "salida"
fecha_cambio <- if (length(args) >= 3) as.Date(args[3]) else NA
dir.create(salida, showWarnings = FALSE, recursive = TRUE)

resumen <- character()
anota <- function(...) {
  linea <- paste0(...)
  resumen <<- c(resumen, linea)
  cat(linea, "\n")
}

# ---------------------------------------------------------------------
# 1. Leer y limpiar
# ---------------------------------------------------------------------
leer <- function(tipo) {
  f <- list.files(carpeta, pattern = paste0("_", tipo, "\\.csv$"), full.names = TRUE)
  if (length(f) == 0) return(NULL)
  d <- read.csv(f[1], fileEncoding = "UTF-8-BOM", stringsAsFactors = FALSE)
  if (nrow(d) == 0) return(NULL)
  d
}
visitas  <- leer("visitas")
clientes <- leer("clientes")
canjes   <- leer("canjes")
entradas <- leer("entradas")

if (is.null(visitas)) stop("No encontré *_visitas.csv en ", carpeta)
visitas <- visitas %>%
  mutate(fecha = as.Date(fecha), hora = as.integer(hora), dia_semana = as.integer(dia_semana)) %>%
  filter(!is.na(fecha), !is.na(cliente))
if (!is.null(entradas)) entradas <- entradas %>% mutate(fecha = as.Date(fecha), plan = ifelse(plan == "", NA, plan))
if (!is.null(clientes)) clientes <- clientes %>% mutate(inscrito = as.Date(inscrito), ultima_visita = as.Date(ultima_visita))
if (!is.null(canjes)) canjes <- canjes %>% mutate(fecha = as.Date(fecha))

desde <- min(visitas$fecha); hasta <- max(visitas$fecha)
anota("Periodo: ", format(desde), " a ", format(hasta), " (", as.integer(hasta - desde) + 1, " días)")
anota("Personas con visitas: ", n_distinct(visitas$cliente), " · visitas registradas: ", nrow(visitas))

# ---------------------------------------------------------------------
# 2. Descriptivo
# ---------------------------------------------------------------------
por_persona <- visitas %>% group_by(cliente) %>%
  summarise(visitas = n(), primera = min(fecha), ultima = max(fecha), .groups = "drop")
anota("Visitas por persona: mediana ", median(por_persona$visitas), ", promedio ", round(mean(por_persona$visitas), 1))
anota("Recencia (días desde la última visita al final del periodo): mediana ",
      median(as.integer(hasta - por_persona$ultima)))

semanal <- visitas %>% mutate(semana = as.Date(cut(fecha, "week", start.on.monday = TRUE))) %>% count(semana)
g <- ggplot(semanal, aes(semana, n)) + geom_col(fill = "#1D1B18") +
  labs(title = "Visitas por semana", x = NULL, y = "Visitas") + theme_minimal()
ggsave(file.path(salida, "visitas_semana.png"), g, width = 8, height = 4, dpi = 120)

dias <- c("dom", "lun", "mar", "mié", "jue", "vie", "sáb")
pico <- visitas %>% count(dia_semana, hora) %>% mutate(dia = factor(dias[dia_semana + 1], levels = dias))
g <- ggplot(pico, aes(hora, dia, fill = n)) + geom_tile() + scale_fill_gradient(low = "#F5F1EA", high = "#FF6B35") +
  scale_x_continuous(breaks = seq(0, 23, 3)) + labs(title = "Horas pico", x = "Hora", y = NULL, fill = "Visitas") + theme_minimal()
ggsave(file.path(salida, "horas_pico.png"), g, width = 8, height = 3.5, dpi = 120)
top <- pico %>% arrange(desc(n)) %>% slice(1)
anota("Momento con más visitas: ", as.character(top$dia), " a las ", top$hora, " h (", top$n, " visitas)")

# Cohortes: de los que llegaron cada mes, cuántos vinieron en cada mes siguiente
cohortes <- visitas %>%
  group_by(cliente) %>% mutate(cohorte = format(min(fecha), "%Y-%m")) %>% ungroup() %>%
  mutate(mes = format(fecha, "%Y-%m")) %>% distinct(cliente, cohorte, mes) %>% count(cohorte, mes) %>%
  group_by(cohorte) %>% mutate(retencion = round(n / max(n), 2)) %>% ungroup()
write.csv(cohortes, file.path(salida, "cohortes.csv"), row.names = FALSE)

if (!is.null(canjes)) {
  anota("Canjes: ", nrow(canjes), " · valor en premios: $", format(sum(canjes$valor_pesos), big.mark = "."))
}

# ---------------------------------------------------------------------
# 3. Variables por persona (para los modelos)
# ---------------------------------------------------------------------
# Abandono = no vino en los últimos 30 días del periodo (habiendo venido antes)
personas <- por_persona %>%
  mutate(abandono = as.integer(ultima < hasta - 29),
         primer_mes = NA_integer_)
primer_mes <- visitas %>% inner_join(por_persona %>% select(cliente, primera), by = "cliente") %>%
  filter(fecha <= primera + 29) %>% count(cliente, name = "visitas_primer_mes")
personas <- personas %>% left_join(primer_mes, by = "cliente") %>%
  mutate(visitas_primer_mes = coalesce(visitas_primer_mes, 0L))
if (!is.null(entradas)) {
  # En la exportación, el id del socio en entradas.csv es el mismo que el de visitas.csv cuando el origen es "entrada"
  planes <- entradas %>% filter(!is.na(plan)) %>% distinct(socio, plan)
  personas <- personas %>% left_join(planes, by = c("cliente" = "socio"))
} else personas$plan <- NA

# ---------------------------------------------------------------------
# 4. ¿Funcionó el cambio? (antes / después)
# ---------------------------------------------------------------------
if (!is.na(fecha_cambio)) {
  diarias <- visitas %>% count(fecha) %>%
    right_join(data.frame(fecha = seq(desde, hasta, by = "day")), by = "fecha") %>% mutate(n = coalesce(n, 0L))
  antes <- diarias %>% filter(fecha < fecha_cambio)
  despues <- diarias %>% filter(fecha >= fecha_cambio)
  if (nrow(antes) >= 28 && nrow(despues) >= 28) {
    w <- wilcox.test(despues$n, antes$n, conf.int = TRUE)
    anota("Antes/después (Wilcoxon): mediana diaria ", median(antes$n), " → ", median(despues$n),
          "; diferencia estimada ", round(w$estimate, 1), " (IC 95 % ", round(w$conf.int[1], 1), " a ", round(w$conf.int[2], 1),
          "), p = ", signif(w$p.value, 3))
    if (nrow(antes) >= 56 && nrow(despues) >= 56) {
      diarias <- diarias %>% mutate(t = as.integer(fecha - desde), despues = as.integer(fecha >= fecha_cambio),
                                    t_despues = pmax(0, as.integer(fecha - fecha_cambio)), dia = format(fecha, "%u"))
      its <- glm(n ~ t + despues + t_despues + dia, family = quasipoisson, data = diarias)
      anota("ITS (cuasi-Poisson): cambio de nivel ×", round(exp(coef(its)["despues"]), 2),
            ", cambio de pendiente ×", round(exp(coef(its)["t_despues"]), 3), " por día")
    }
  } else anota("Antes/después: faltan datos (se necesitan ≥ 4 semanas antes y después). Solo se describe.")
}

# ---------------------------------------------------------------------
# 5. ¿Quién se va a ir? (regresión logística)
# ---------------------------------------------------------------------
eventos <- sum(personas$abandono)
usa_plan <- !all(is.na(personas$plan)) && n_distinct(na.omit(personas$plan)) > 1
k <- 1 + usa_plan * (n_distinct(na.omit(personas$plan)) - 1)
if (eventos >= 10 * k && sum(1 - personas$abandono) >= 10 * k) {
  formula <- if (usa_plan) abandono ~ visitas_primer_mes + plan else abandono ~ visitas_primer_mes
  m <- glm(formula, family = binomial, data = personas)
  or <- exp(cbind(OR = coef(m), suppressMessages(confint.default(m))))
  p <- fitted(m)
  if (!m$converged || any(!is.finite(or)) || max(or[, 3], na.rm = TRUE) > 1e4 || mean(p < 1e-6 | p > 1 - 1e-6) > 0.5) {
    anota("Logística: los grupos se separan casi perfectamente con estas variables; el odds ratio no es confiable. ",
          "Reportar la tabla de abandono por visitas del primer mes en vez del modelo.")
    print(table(primer_mes = cut(personas$visitas_primer_mes, c(-1, 2, 5, 10, Inf)), abandono = personas$abandono))
  } else {
    anota("Logística (abandono): por cada visita más en el primer mes, odds ×", round(or["visitas_primer_mes", "OR"], 2),
          " (IC 95 % ", round(or["visitas_primer_mes", 2], 2), "–", round(or["visitas_primer_mes", 3], 2), ")")
  }
  write.csv(round(or, 3), file.path(salida, "logistica_odds_ratios.csv"))
} else anota("Logística: pocos eventos (", eventos, " personas se fueron). Se necesitan ≥ 10 por variable. Solo se describe.")

# ---------------------------------------------------------------------
# 6. ¿Cuánto dura un socio? (Kaplan-Meier + log-rank)
# ---------------------------------------------------------------------
if (nrow(personas) >= 30 && eventos >= 10) {
  personas <- personas %>% mutate(duracion = as.integer(ultima - primera) + 1)
  km <- survfit(Surv(duracion, abandono) ~ 1, data = personas)
  med <- summary(km)$table["median"]
  anota("Kaplan-Meier: duración mediana ", ifelse(is.na(med), "no alcanzada (más de la mitad sigue viniendo)", paste(med, "días")))
  png(file.path(salida, "kaplan_meier.png"), width = 900, height = 500)
  if (usa_plan) {
    km_plan <- survfit(Surv(duracion, abandono) ~ plan, data = personas)
    plot(km_plan, col = 1:n_distinct(na.omit(personas$plan)), xlab = "Días desde la primera visita", ylab = "Siguen viniendo",
         main = "¿Cuánto dura un socio? (por plan)")
    legend("bottomleft", legend = names(km_plan$strata), col = 1:length(km_plan$strata), lty = 1)
    lr <- survdiff(Surv(duracion, abandono) ~ plan, data = personas)
    anota("Log-rank entre planes: p = ", signif(1 - pchisq(lr$chisq, length(lr$n) - 1), 3))
  } else plot(km, xlab = "Días desde la primera visita", ylab = "Siguen viniendo", main = "¿Cuánto dura un socio?")
  invisible(dev.off())
} else anota("Kaplan-Meier: se necesitan ≥ 30 personas y ≥ 10 que se hayan ido. Solo se describe.")

# ---------------------------------------------------------------------
# 7. ¿Cuándo viene la gente? (Poisson por hora)
# ---------------------------------------------------------------------
if (as.integer(hasta - desde) >= 27) {
  rejilla <- expand.grid(fecha = seq(desde, hasta, by = "day"), hora = 0:23)
  conteo <- visitas %>% count(fecha, hora) %>% right_join(rejilla, by = c("fecha", "hora")) %>%
    mutate(n = coalesce(n, 0L), hora = factor(hora), dia = factor(format(fecha, "%u")))
  pm <- glm(n ~ hora + dia, family = poisson, data = conteo)
  dispersion <- sum(residuals(pm, type = "pearson")^2) / pm$df.residual
  if (dispersion > 1.5) pm <- update(pm, family = quasipoisson)
  pred <- conteo %>% mutate(esperado = fitted(pm)) %>% group_by(dia, hora) %>% summarise(esperado = mean(esperado), .groups = "drop")
  write.csv(pred, file.path(salida, "afluencia_esperada.csv"), row.names = FALSE)
  anota("Afluencia: modelo ", ifelse(dispersion > 1.5, "cuasi-Poisson", "Poisson"), " (dispersión ", round(dispersion, 2), ")")
} else anota("Afluencia: se necesitan ≥ 4 semanas de datos.")

anota("ADVERTENCIA: n = ", n_distinct(visitas$cliente), " personas; periodo ", format(desde), " a ", format(hasta),
      ". Una asociación no prueba causa.")
writeLines(resumen, file.path(salida, "resumen.txt"), useBytes = TRUE)
