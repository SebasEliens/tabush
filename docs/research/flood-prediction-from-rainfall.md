# Flood prediction from rainfall in Brazil: is it an opportunity?

*Research note · 22 Oct 2026 · light pass, companion to [problem-space-shortlist.md](problem-space-shortlist.md)*

## Bottom line

Rainfall-to-flood **forecasting** as a standalone product is a weak business for us: the public good is already provided free (CEMADEN, SGB's SACE river alerts, Google Flood Hub for riverine floods with ~7 days lead time), and the people most exposed are not the ones who pay. The valuable slice is narrower: **flood hazard and flood-event detection as an insurance and credit input**. That plugs straight into the lead idea (family-farmer credit + parametric cover) as a flood peril alongside drought, and later into an insurer-facing urban product (shortlist #4).

## Feasibility: what's easy and what's hard

| Flood type | Predictable from rain? | Difficulty | Notes |
|---|---|---|---|
| **Large riverine** (Taquari/Guaíba 2024, Amazon basins) | Yes, days ahead | Solved-ish | Hydrological models + ML (Google, SGB, ANA) already do this well on gauged rivers |
| **Flash floods in small hilly catchments** (Serra Gaúcha, Petrópolis, Recife hills) | Hours ahead at best | Hard | Needs radar/nowcasting; satellite rain (GPM IMERG, CHIRPS) too coarse and late |
| **Urban pluvial flooding** (alagamento in peripheries) | Partly | Hard | Depends on drainage, terrain at metre scale, blocked gutters; data is the bottleneck |
| **Landslides** (often confused with floods; deadliest in favelas) | Rain-threshold based | Medium | CEMADEN uses accumulated-rain thresholds; risk-area polygons already mapped |

## Data

- **Rain gauges:** CEMADEN pluviometers (thousands of automatic gauges, many in risk areas, 10-min data), INMET stations, ANA HidroWeb telemetry.
- **River levels/discharge:** ANA HidroWeb / SNIRH; SGB (CPRM) SACE alerts.
- **Satellite rain:** GPM IMERG (half-hourly, ~10 km, Early run ~4 h latency), CHIRPS (daily, 5 km, 1981–, best for historical and parametric backtests), ERA5-Land reanalysis.
- **Radar:** CEMADEN and state radars (DECEA, REDEMET, SIMEPAR in PR); coverage patchy, key for flash floods.
- **Forecasts:** INPE/CPTEC models, ECMWF, GFS; Google's GraphCast/GenCast-style AI weather models.
- **Terrain & exposure:** Copernicus DEM / FABDEM, ANADEM (Brazil-specific DEM from ANA/UFRGS), HAND index, MapBiomas water, IBGE 2022 census tracts and favelas, CEMADEN risk areas.
- **Observed floods (ground truth):** Sentinel-1 SAR flood maps (cloud-proof), S2ID civil-defense disaster declarations, insurer claims (private).

| Source | Gives | Resolution / cadence | Access |
|---|---|---|---|
| CEMADEN gauges | Rainfall in risk areas | Point, 10 min | Map portal / request |
| INMET | Rain, temp, wind | ~600 auto stations, hourly | BDMEP / API |
| GPM IMERG | Satellite rain | ~10 km, 30 min, ~4 h latency (Early) | NASA Earthdata (free login) |
| CHIRPS | Daily rain, 1981– | ~5 km, daily | Open download / GEE |
| ERA5-Land | Rain, soil moisture reanalysis | ~9 km, hourly | Copernicus CDS API |
| Radar (CEMADEN, DECEA/REDEMET, SIMEPAR) | Rain nowcasting | ~1 km, 5–10 min | Patchy; varies by operator |
| ANA HidroWeb / SNIRH | River level, discharge, telemetry rain | Point, decades of history | Open API |
| SGB SACE | River flood alerts/forecasts | Main basins | Public |
| ANADEM, Copernicus DEM, FABDEM | Terrain for inundation (HAND) | ~30 m | Open |
| Sentinel-1 SAR | Observed flood extent | 10 m, 6–12 days | Copernicus / Planetary Computer |
| MapBiomas Water | Surface water history | 30 m, annual/monthly | Open |
| S2ID | Disaster declarations | Municipality, event date | Public |
| CEMADEN risk areas, IBGE Census 2022 | Exposure | Polygons / census tracts | Open |
| Insurer claims, co-op loan books | Payout calibration | Policy / loan | Private, under contract |

## Approaches

1. **Riverine:** rainfall + gauge data into a hydrological model (MGB-IPH, developed for South American basins at UFRGS) or an LSTM rainfall-runoff model (the approach behind Google's Flood Hub), then inundation mapping via HAND/DEM.
2. **Flash/pluvial:** radar nowcasting + catchment-level ML trained on past events, with SAR-derived flood extents and S2ID declarations as labels.
3. **Parametric index (what we'd actually sell):** not a perfect forecast but a robust, auditable trigger, e.g. "72-hour accumulated rainfall over the property's catchment above the 1-in-20-year level" or "Sentinel-1 shows water on X% of the farm". Backtest on CHIRPS/IMERG 1981–present against S2ID and claims.

**Where graphs and ontologies earn their keep:** upstream/downstream river network (a natural graph: which farms and neighbourhoods share a catchment), portfolio concentration (how many loans/policies sit in one basin), and the dependency graph of people ↔ roads ↔ clinics ↔ power for response planning.

## Existing players

- **Public/free:** CEMADEN (national warnings), SGB SACE (river alerts, credited with 9M+ people alerted in a year), state civil defense SMS/cell-broadcast alerts, ANA.
- **Big tech:** Google Flood Hub covers Brazilian rivers since 2023 (with SGB data) and was used in RS 2024.
- **Private:** Climatempo, Meteoblue, Tempo OK; global flood-risk modellers (Fathom/Swiss Re, Jupiter, JBA, ICEYE for SAR flood observations, used by insurers for claims).
- **Parametric insurers** in Brazil are moving: Mapfre planned parametric entry in 2025, Ceres, TRAG, Newe; trade press in 2026 frames parametric as the answer to the climate protection gap.

## Buyers and business model

| Buyer | Pays for | Willingness to pay |
|---|---|---|
| **Insurers / reinsurers** | Flood hazard scores, parametric triggers, post-event loss estimates | High; clearest buyer |
| **Credit co-ops & banks** | Flood exposure of rural and urban loan books, post-event portfolio impact | Medium-high; same buyer as the lead idea |
| **Utilities, logistics, retailers** | Asset-level flood alerts | Medium; crowded with weather vendors |
| **Municipalities / states** | Early warning, adaptation planning | Real need, slow procurement, grants (Novo PAC, BNDES Fundo Clima) |
| **Households in risk areas** | Micro parametric cover distributed via utilities, fintechs, CadÚnico-linked programs | Low per user, but the climate-justice win; viable only bundled B2B2C |

## How it fits our ideas

- **Lead idea (family-farmer credit + parametric):** add flood as a second peril. RS 2024 hit family farms in the Taquari valley hard, so the story is strong. Parametric flood trigger = catchment rainfall index + SAR flood confirmation, priced and backtested in the existing index engine (C3 in the tech spec). Low incremental cost, since CHIRPS/IMERG and Sentinel-1 are already in the stack.
- **Shortlist #4 (urban favelas):** a rainfall-triggered micro-insurance product sold through insurers or utilities is the most credible path to make #4 pay, rather than selling forecasts to cities.

## Recommended next step

Run a backtest spike on the Taquari basin (RS): pull CHIRPS + IMERG + CEMADEN gauges for 2000–2024, build a candidate flood index per municipality, and check how well it separates years with S2ID flood declarations (Sept 2023, Nov 2023, May 2024) from normal years. If basis risk looks acceptable, it becomes the flood module of the parametric engine.

## Sources

Light pass; figures without a link are from general knowledge and should be re-verified before external use.

- Google, [Usando IA para alertar e prever inundações no Brasil](https://blog.google/intl/pt-br/novidades/iniciativas/usando-inteligencia-artificial-para-alertar-e-prever-inundacoes-no-brasil/); [Apoio ao Rio Grande do Sul](https://blog.google/intl/pt-br/novidades/iniciativas/como-estamos-apoiando-a-populacao-do-rio-grande-do-sul/); Hardware.com.br, [IA que prevê enchentes com 7 dias de antecedência](https://www.hardware.com.br/tecnologia/google-traz-para-o-brasil-ia-que-preve-enchentes-com-7-dias-de-antecedencia/)
- Agência Gov, [Alertas de inundação com dados do SGB beneficiaram mais de 9 milhões](https://agenciagov.ebc.com.br/noticias/202312/tecnologia-que-utiliza-dados-do-servico-geologico-do-brasil-ja-beneficiou-em-um-ano-mais-de-9-milhoes-de-pessoas-com-alertas-de-inundacao)
- DGABC, [Santo André premiada pelo uso de IA contra enchentes](https://www.dgabc.com.br/Noticia/4261880/santo-andre-e-premiada-internacionalmente-por-uso-de-ia-contra-enchentes)
- AgFeed, [Mapfre planeja entrada no seguro paramétrico em 2025](https://agfeed.com.br/financas/de-olho-no-clima-mapfre-planeja-entrada-no-seguro-parametrico-em-2025); Revista Apólice, [Seguros paramétricos são blindagem para grandes eventos climáticos (Jun 2026)](https://revistaapolice.com.br/2026/06/seguros-parametricos-sao-blindagem-para-grandes-eventos-climaticos/); Legismap, [A lacuna de proteção climática em 2026](https://legismap.com.br/conteudos/artigos-e-noticias/a-lacuna-de-protecao-climatica-em-2026-do-reativo-ao-preventivo)
