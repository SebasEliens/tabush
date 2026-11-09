# Urban flood (alagamento) prediction from rainfall in Brazilian cities

*Research note · 22 Oct 2026 · light pass, follows [flood-prediction-from-rainfall.md](flood-prediction-from-rainfall.md); relates to shortlist #4*

## Bottom line

Predicting **street-level urban flooding** from rain is feasible and is a real gap: city alerts today are mostly at the level of the whole city or district ("estado de atenção"), and they are weakest in the peripheries and favelas. The forecast itself has a short horizon (0–2 h nowcast, 6–24 h probability), because alagamento is driven by intense 15–60 min bursts. The same spots flood again and again, though, so ML on historical flood points works well. Selling to cities alone is slow. The business case improves a lot if the core buyers are **auto/property insurers, logistics and mobility apps, and power utilities**, with a public/community tier for peripheries carrying the climate-justice impact.

## Feasibility

- **Works well:** recurrent hotspots (underpasses, valley-bottom avenues, the Tietê/Pinheiros margins, Rio's Praça da Bandeira). Rain intensity over 15/30/60 min plus antecedent rain explains most events. Good labels exist in the big cities.
- **Hard:** sparse labels in peripheries (reporting bias: the flood points recorded by CGE and Waze skew towards formal, car-heavy areas); clogged drainage and trash, which is invisible in the data; convective storms that are hard to forecast more than 1–2 h ahead.
- **Sentinel-1 radar is weak in cities** (buildings scatter the signal), so ground truth has to come from city records, crowdsourcing, and cameras.

## City-specific data

| Source | Gives | Resolution | Access |
|---|---|---|---|
| **Weather radar**: Alerta Rio (Sumaré, Guaratiba), São Paulo FCTH/DAEE (Ponte Nova), CEMADEN S-band network, SIMEPAR (PR), DECEA | Rain intensity, nowcasting | ~0.25–1 km, 5–10 min | Varies; Alerta Rio data partly open, others via partnership |
| **CEMADEN + municipal gauges** (Alerta Rio ~30+ gauges since 1997, CGE SP network) | Rain at points | 5–15 min | Open portals / request |
| **CGE São Paulo flood points**, Rio COR events | Historical alagamento by location and time (labels) | Street / point | Partly public; partnership for full history |
| **Waze for Cities** | Real-time flood/hazard reports from drivers (labels + live validation) | Point, real-time | Free data-sharing partnership with cities |
| **Citizen complaints** (SP 156, Rio 1746) | Flood and drainage complaints | Address | Open data portals |
| **LiDAR / DEM**: São Paulo GeoSampa (MDT/MDS), Rio Data.Rio, Recife ESIG, BH; ANADEM / FABDEM elsewhere | Terrain for flow paths and depressions | 0.5–1 m (LiDAR) vs ~30 m | Open in big capitals; elsewhere coarse |
| **Drainage cadastre** (pipes, manholes, inlets) | Network capacity | Asset | Often incomplete or on paper; ask city or sanitation operator |
| **Buildings**: Google Open Buildings, Microsoft, OSM | Footprints, imperviousness | Building | Open |
| **IBGE Census 2022** favelas e comunidades urbanas + tract data; CEMADEN risk areas | Who is exposed and how vulnerable | Tract / polygon | Open |
| **Traffic cameras** (COR, CET) | Visual flood confirmation (computer vision) | Point | Partnership |

## Approaches

1. **Hotspot ML (fastest to value):** features = radar/gauge rain at 15/30/60/180 min, antecedent rain, terrain (HAND, depressions, slope from LiDAR), imperviousness, drainage proxies. Target = flood yes/no per street segment or H3 cell (res 10–11) from CGE/COR/Waze/1746 labels. Output: flood probability per street for the next 0–2 h, plus a 24 h outlook from forecast rain.
2. **Physics-based plus a fast ML stand-in:** run 2D hydraulic models (SWMM + HEC-RAS 2D / LISFLOOD-FP, or a fast cellular-automata model) for many synthetic storms, then train a quick ML approximation of their results to map depth in real time. This works in cities with no flood history, so it scales to the peripheries.
3. **Graphs and ontology:** the drainage network is a graph (inlets → pipes → channels → river), and so are streets (routing, cut-off neighbourhoods) and dependencies (people ↔ clinics ↔ schools ↔ power substations). An ontology makes each new city's messy, inconsistent datasets plug in without rework; that matters if we scale beyond the 5–10 capitals that have good data.
4. **Community loop:** WhatsApp reports and alerts in favelas (partner with community groups / civil-defense volunteer cores), which also fix the label bias.

## Existing players

- **Public:** Rio COR + Alerta Rio (most mature in Brazil), São Paulo CGE, CEMADEN, the Defesa Civil Alerta cell-broadcast system (national since 2024), state civil defence. They issue alerts for whole regions, not street-level probabilities.
- **Municipal AI pilots:** Santo André (SP) built an AI flood-risk prediction system that won international and national awards in 2025–26, plus "smart manholes" ([DGABC](https://www.dgabc.com.br/Noticia/4261880/santo-andre-e-premiada-internacionalmente-por-uso-de-ia-contra-enchentes), [ABCdoABC](https://www.abcdoabc.com.br/santo-andre-ia-contra-enchentes-ganha-premio/)). This shows cities want it, and that some build it themselves.
- **Private, Brazil:** Climatempo (B2B weather alerts), academic groups (USP, UFRJ COPPE, UFRGS IPH, Mauá); a few disaster-prediction startups ([Startupi](https://startupi.com.br/startup-prever-desastres-naturais/)); not yet checked in depth.
- **Global:** 7Analytics (urban flood, Nordics), Fathom/Swiss Re, Jupiter, Tomorrow.io, FloodMapp, ICEYE (insurance flood footprints). None has a strong street-level product for Brazil.

## Buyers and business model

| Buyer | Why they pay | Product | Speed of sale |
|---|---|---|---|
| **Auto & property insurers** (Porto, Bradesco, Tokio Marine, Allianz, HDI, Youse) | Flooded cars are a large urban claim cost in SP/RJ; underwriting and pre-event SMS to policyholders cut losses | Address-level flood score, live alerts to policyholders, event footprints for claims | Medium |
| **Logistics, delivery & mobility** (iFood, Mercado Livre, Loggi, Uber, 99, bus operators) | Avoid stuck vehicles, reroute, staff safety | Real-time flood-probability API per street | Fast |
| **Power & sanitation utilities** (Enel SP, Light, Sabesp, Aegea) | Substation and asset protection, crew dispatch, regulatory penalties | Asset alerts | Medium |
| **Real estate & mortgage** (Caixa, QuintoAndar, Loft) | Pricing and disclosure | Address flood history and score | Medium |
| **Cities / states** | Early warning, drainage investment priorities; funded by Novo PAC disaster prevention, BNDES/Fundo Clima, IDB/World Bank | Platform licence, drainage master plan analytics | Slow, but large and sticky |
| **Residents of favelas/peripheries** | Warning time, lost goods | Free alerts (WhatsApp); rainfall-triggered micro-insurance via utilities, fintechs or insurers | B2B2C only |

**Suggested model:** one city stack, sold B2B by API to insurers and logistics firms (revenue), with a free public/community alert tier for peripheries (impact, data, legitimacy, grant co-funding). The micro-insurance product, e.g. "R$500 paid automatically if 60-min rainfall over your street exceeds X", links back to our parametric engine.

## Climate-justice angle

Peripheries flood most and are least instrumented and least reported, so a model trained only on official records would reproduce that bias. Building the community reporting loop and physics-based coverage for favelas is both the justice case and a data moat.

## How it fits our other ideas

- Turns shortlist #4 from "hard to monetize" into a B2B play with a public-good tier.
- Shares the parametric index engine, H3 grid and graph stack with the family-farmer product, but buyers, data and sales are different: in practice it's a second product, not a module.

## Suggested next step

A São Paulo spike: CGE flood points + 156 complaints + radar/gauge rain + GeoSampa LiDAR for 2015–2025; train the hotspot model and check skill (hit rate vs false alarms at 1 h lead). In parallel, 3–5 discovery calls with an auto insurer, a delivery company and a civil-defense team.

## Sources

Light pass; figures and data details without a link are from general knowledge and should be checked before external use.

- DGABC, [Santo André premiada internacionalmente por uso de IA contra enchentes](https://www.dgabc.com.br/Noticia/4261880/santo-andre-e-premiada-internacionalmente-por-uso-de-ia-contra-enchentes); [reconhecido em premiação nacional](https://www.dgabc.com.br/Noticia/4284163/projeto-de-ia-de-santo-andre-preve-risco-de-inundacoes-e-e-reconhecido-em-premiacao-nacional)
- ABCdoABC, [IA contra enchentes ganha 2º prêmio internacional](https://www.abcdoabc.com.br/santo-andre-ia-contra-enchentes-ganha-premio/); [bueiros inteligentes](https://www.abcdoabc.com.br/santo-andre-instala-bueiros-inteligentes-e-reforca-combate-as-enchentes/)
- USCS, [Previsão de riscos de alagamentos e inundações com uso de IA](https://seer.uscs.edu.br/index.php/revista_informatica_aplicada/article/view/6985)
- Startupi, [Startup para prever desastres naturais](https://startupi.com.br/startup-prever-desastres-naturais/)
