# Brazil: climate-justice problems where geospatial AI + graphs can win

*Research/brainstorm note · 17 Oct 2026 · first pass, meant to pick 1–2 candidates for deeper validation*

## TL;DR — ranked shortlist

| # | Problem | Climate justice | Who pays (and why now) | Graph/ontology fit | Crowding |
|---|---------|-----------------|------------------------|--------------------|----------|
| **1** | **Climate-risk credit & parametric insurance for family farmers** | High | Banks, credit co-ops, insurers, BNDES; Plano Safra, Proagro, climate-adaptation credit lines | High (farm ↔ CAR ↔ SIGEF ↔ co-op ↔ buyer ↔ loan) | Medium |
| **2** | **Indirect-supplier deforestation & social-risk intelligence (cattle first)** | High (indigenous lands, land grabbing, slave labour) | Meatpackers, traders, banks, EU importers; EUDR + Central Bank rural-credit rules | Very high (cattle-movement network is literally a graph) | High in direct suppliers, low in indirect + social |
| **3** | **Land-tenure integrity for carbon & restoration projects** | High (traditional communities' rights, benefit-sharing) | Carbon developers, buyers, registries, funds; SBCE law, jurisdictional REDD+, restoration finance | Very high (overlapping cadastres = entity resolution) | Medium |
| 4 | Urban flood/heat exposure for favelas and peripheries | Highest | Municipalities, utilities, insurers, development banks — slow, grant-heavy | Medium-high | Low (because hard to monetize) |
| 5 | Semi-arid water security | High | State water companies, cisterns programs — mostly public | Medium | Low |
| 6 | Disaster response / post-disaster recovery | High | Civil defense, insurers, NGOs — episodic | Medium | Medium |

**Recommendation:** go deeper on **#1 and #2**, and treat #3 as a product extension of either (all three share the same core asset: a *rural property knowledge graph* that fuses CAR, SIGEF, embargoes, land-use change, climate hazards and ownership/credit links). #4 is the strongest justice story but the weakest business; best pursued as an insurer/utility play later, reusing the same stack.

---

## Ranking criteria

1. **Climate justice:** do benefits land on people who emit least and are most exposed (family farmers, indigenous and *quilombola* communities, favela residents)?
2. **Profitability:** a paying customer with a regulatory or financial reason to buy now, not grants.
3. **Data readiness:** open Brazilian data exists at usable resolution.
4. **Why graphs/ontologies:** the problem is about *relationships* (ownership, supply flows, overlaps, dependencies), not just pixels. If raster ML alone solves it, the moat is thin.
5. **Competitive whitespace.**

## The shared core asset (why one stack serves several problems)

Brazil publishes an unusual amount of rural geodata, but it lives in silos with conflicting IDs and overlapping polygons:

- **CAR / SICAR** (self-declared rural environmental registry, millions of properties, frequent overlaps)
- **SIGEF / SNCI** (INCRA georeferenced titles), **Terra Legal**, state land agencies
- **FUNAI** indigenous lands, **INCRA** quilombola territories and settlements, **ICMBio** protected areas, **CNFP** undesignated public forests
- **INPE PRODES / DETER**, **MapBiomas** (annual land use 1985–present, Alerta, fire, water), **IBAMA embargoes**, state embargo lists
- **Ministry of Labour "lista suja"** (slave-like labour), CNPJ/CPF company registry (Receita Federal), **SICOR** (Central Bank rural credit operations)
- Animal transit permits (**GTA**) — the cattle-movement network; access is restricted/partial by state, which is a key risk and a key moat
- Climate: **CEMADEN** (risk areas, rain gauges), **INMET**, **ANA** (hydrology), **ZARC** (Embrapa/MAPA agro-climatic risk zoning), **CHIRPS/ERA5**, Sentinel/Landsat/Planet (NICFI)
- People: **IBGE Census 2022** (incl. *favelas e comunidades urbanas*), **CadÚnico** (aggregated), **Censo Agropecuário 2017**

An **ontology** (property, parcel, owner, legal person, territory, permit, embargo, hazard, loan, commodity flow) plus a **graph database** lets you answer questions no single dataset can: *"Which loans finance properties that overlap an indigenous land or sell calves to a farm embargoed last year?"* or *"Which co-op members are exposed to a 1-in-10-year drought under ZARC and have no insurance?"* AI sits on top for entity resolution (fuzzy-matching owners and polygons), land-use change detection, hazard modelling and LLM-based question answering over the graph.

---

## 1. Climate-risk credit & parametric insurance for family farmers

**Problem.** Family farming is ~77% of Brazil's farm establishments (Censo Agro 2017) and a large share of food staples, yet access to PRONAF credit and rural insurance is concentrated in the South and among better-off farmers; the semi-arid Northeast and North are under-served. Lenders lack cheap, trustworthy risk data, so they either exclude farmers or overprice. Climate shocks (2023–24 Amazon drought, 2024 Rio Grande do Sul floods, recurring Northeast droughts) hit this group hardest. Climate Policy Initiative's 2026 work on *closing the rural credit divide* documents the access gap.

**Product.** A risk & eligibility engine for lenders/insurers:
- property-level hazard scores (drought, flood, heat) from satellite + ZARC + climate projections;
- automatic socio-environmental compliance checks (CAR status, embargoes, overlaps with protected/indigenous lands) required by Central Bank rural-credit rules;
- parametric triggers (rainfall/soil-moisture/NDVI indices) for low-cost insurance pay-outs;
- adaptation-linked pricing: better terms for farmers adopting agroforestry, irrigation, soil practices verified from imagery.

**Why graph.** Farmer ↔ co-op ↔ property ↔ title ↔ buyer ↔ loan history; co-ops and contract buyers become proxy collateral, and portfolio concentration risk (many loans exposed to the same basin/drought) is a graph query.

**Business model.** SaaS / per-analysis fee to credit co-ops (Sicredi, Sicoob, Cresol), digital banks and agri-fintechs, insurers and reinsurers; revenue share on parametric products; blended-finance funds (BNDES, IDB, Green Climate Fund) pay for MRV of adaptation outcomes.

**Players.** Agrotools, Serasa Experian Agro, Traive, TerraMagna, Agrosmart, Solinftec (mostly large/medium growers); few target family farmers in the North/Northeast at scale.

**Existing players checked (17 Oct 2026, light pass).** Parametric insurance: [Newe Seguros](https://revistaapolice.com.br/2024/03/newe-seguros-protege-agricultor-familiar-no-municipio-de-uaua-ba/) paid a parametric claim to 5 umbu producers at COOPERCUC, Uauá-BA, subsidized by PSR (pilot scale); [Picsel](https://www.revistaapolice.com.br/2022/10/com-foco-na-agricultura-familiar-insurtech-desenvolve-seguro-parametrico/) piloted drought/frost parametric cover with women coffee growers in Paraná, EU EuroClima+/GIZ funded; [TRAG](https://startups.com.br/negocios/rodada-de-investimento/trag-de-seguros-climaticos-capta-r-2m-com-domo-vc-e-anjos/) raised R$2M (2024), farm size unspecified; [Ceres](https://agfeed.com.br/financas/ceres-arrisca-com-nova-modalidade-de-seguro-rural-e-projeta-r-1-bilhao-em-apolices) is parametric but sells to agribusiness and co-ops. Public: Garantia-Safra is a de facto index payout for semi-arid family farmers. Credit: [TerraMagna](https://www.accion.org/how-one-company-uses-tech-to-support-brazilian-farmers) scores small/medium farmers via satellite through input retailers. Nobody yet combines credit, adaptation-linked pricing and parametric cover for family farmers at scale.

**Risks.** Thin margins per small loan; policy-driven credit (subsidized rates) can crowd out pricing innovation; must avoid "risk scoring" that further excludes the most exposed — design for *inclusion* (adaptation pathways, not just denial).

## 2. Indirect-supplier deforestation & social-risk intelligence

**Problem.** Cattle ranching drives most Amazon and Cerrado deforestation. Meatpackers monitor *direct* suppliers fairly well, but calves are raised on *indirect* farms (often several hops back) where deforestation, land grabbing on public/indigenous land and slave-like labour concentrate. The EU Deforestation Regulation (EUDR, applying to large operators after repeated delays; track the current date) and Central Bank rules restricting credit to embargoed/irregular properties create hard demand for traceability.

**Product.** A cattle- and soy-supply graph: reconstruct likely animal flows (GTA where available, plus inference from herd sizes, pasture, distance and slaughterhouse catchments), score each node for deforestation (PRODES/MapBiomas), embargoes, territorial overlaps and labour violations, and deliver due-diligence statements and risk alerts. Extend to a *farmer reintegration* service (helping blocked producers regularize), which is where the climate-justice angle is strongest.

**Why graph.** The problem *is* multi-hop network reasoning plus entity resolution of owners hiding behind relatives/companies ("farm laundering").

**Business model.** Enterprise SaaS for meatpackers, traders, retailers, EU importers, banks; per-shipment EUDR due-diligence fees; certification bodies.

**Players.** Direct-supplier monitoring is crowded (Agrotools, Niceplanet, Safe Trace, Serasa, Satelligence, Trase/SEI, Visipec for indirect suppliers, free government-data platforms tracking EUDR compliance). Whitespace: robust indirect-supplier inference, social risk, and reintegration.

**Risks.** GTA access is political; EUDR timing keeps moving; buyers may prefer "minimum compliance" over depth.

## 3. Land-tenure integrity for carbon & restoration projects

**Problem.** Brazil's regulated carbon market (Law 15.042/2024, SBCE) and the restoration/REDD+ wave (jurisdictional REDD+ in Pará, Tocantins etc., restoration finance, COP30 momentum) depend on knowing *who holds rights to the land*. Several voluntary REDD+ projects have been linked to land grabbing on public land, damaging trust. Traditional communities are often not consulted or paid.

**Product.** A tenure-and-rights due-diligence graph: resolve CAR/SIGEF/state titles/indigenous/quilombola/undesignated-public-land overlaps; flag grabbing patterns (recent CAR on public forest, fragmentation); check free, prior and informed consent obligations; track benefit-sharing to communities; combine with MRV of forest/restoration carbon.

**Business model.** Pre-investment due-diligence fees from developers, buyers and funds; ratings for registries/standards; government contracts for land regularization (states are actively doing this).

**Players.** Carbon raters (BeZero, Sylvera, Calyx) cover project integrity globally but are thin on Brazilian tenure; local legal/consulting firms do it manually.

**Risks.** Carbon-market sentiment is volatile; regulated market rules (SBCE) are still being phased in.

## 4. Urban flood & heat exposure in favelas and peripheries

**Problem.** 16.4 million people (≈8% of Brazil) live in *favelas e comunidades urbanas* (IBGE Census 2022). IBGE/CEMADEN previously estimated ~8 million people living in mapped disaster-risk areas across hundreds of monitored municipalities. Rio Grande do Sul 2024 affected millions and displaced hundreds of thousands; poorer neighbourhoods are hit first and recover last. Heat islands are hottest in dense, tree-poor peripheries.

**Product.** Building-level exposure model (flood, landslide, heat) from LiDAR/DSM, satellite, rainfall and census data; a city "dependency graph" (people ↔ buildings ↔ drainage ↔ roads ↔ clinics/schools ↔ power) to prioritize adaptation investment and early warning; community-sourced data loops.

**Business model (the weak point).** Municipalities/states (slow procurement), development banks and Novo PAC/adaptation funds (project-based), utilities, insurers (micro-insurance distribution), real-estate/infra investors. Likely viable as B2B for insurers/utilities with a public-good tier.

**Players.** Climatempo, CEMADEN (public), MapBiomas urban, academic groups, global players (Jupiter, One Concern, Fathom/Swiss Re).

## 5. Semi-arid water security & 6. Disaster response

Both are high-impact but mostly public-funded and episodic. Best treated as modules: drought indices from #1 feed water planning; exposure graphs from #4 feed civil-defense response and post-disaster claims assessment for insurers (the profitable slice).

---

## Suggested next steps

1. Pick #1 or #2 as the wedge (or both, with the shared rural knowledge graph as the platform).
2. Validate demand: 5–10 discovery calls (credit co-ops, an insurer, a meatpacker sustainability team, a carbon developer).
3. Data feasibility spike: load one municipality (e.g. São Félix do Xingu, PA, or a semi-arid Bahia municipality) — CAR + SIGEF + MapBiomas + embargoes + FUNAI — into a graph DB and test 3 killer queries.
4. Draft the ontology (reuse GeoSPARQL, SOSA/SSN, FIBO for finance, AGROVOC) and a climate-justice impact metric to report alongside revenue.

## Sources and caveats

Figures without a link below are from general knowledge and should be re-verified before external use; search for this pass was a light sweep, not a full literature review.

- IBGE, [2022 Census: 16.4 million persons lived in favelas and urban communities](https://agenciadenoticias.ibge.gov.br/en/agencia-news/2184-news-agency/news/41813-2022-census-16-4-million-persons-in-brazil-lived-in-favelas-and-urban-communities)
- UN OCHA / ReliefWeb, [Brazil floods Rio Grande do Sul situation report (June 2024)](https://reliefweb.int/report/brazil/brazil-floods-rio-grande-do-sul-united-nations-situation-report-25-june-2024); ILO, [Floods Rio Grande do Sul](https://www.ilo.org/resource/article/ilos-emergency-response-rio-grande-do-sul-floods)
- Climate Policy Initiative, [Closing the rural credit divide: pathways to increase PRONAF access for smallholders](https://www.climatepolicyinitiative.org/publication/closing-the-rural-credit-divide-pathways-to-increase-pronaf-access-for-smallholders/); [Family Farming in Brazil](https://www.climatepolicyinitiative.org/wp-content/uploads/2023/11/Family-Farming-in-Brazil.pdf)
- WRI, [Compliance with the EU Deforestation Regulation is feasible, underway](https://www.wri.org/technical-perspectives/eu-deforestation-regulation-compliance-underway); Fern, [Zero deforestation in the cattle sector](https://www.fern.org/pt/publications-insight/how-to-achieve-zero-deforestation-in-the-cattle-sector/); Mongabay (via UFMG CSR), [Free platform uses government data to track EUDR compliance](https://csr.ufmg.br/csr/wp-content/uploads/2026/03/news.mongabay_brazil_free-platform-uses-government-data-to-track-EUDR-compliance.pdf); Agrolink, [EUDR 2026 traceability for soy, coffee, beef](https://www.agrolink.com.br/noticias/eudr-2026--regra-da-ue-aumenta-exigencia-de-rastreabilidade-para-soja--cafe-e-carne_517838.html)
- IETA, [Business Brief Brazil (Aug 2025)](https://www.ieta.org/uploads/wp-content/Resources/Busines-briefs/2025/IETA_Business_Brief-Brazil-final-August25.pdf); BMA, [Brazil's carbon market regulation](https://www.bmalaw.com.br/en/content/environmental-climate-and-mining/bma-review-en/brazils-carbon-market-regulation-what-your-company-needs-to-know)
- Correio Braziliense, [Brasil tem mais de 27 mil áreas de risco de desastres](https://www.correiobraziliense.com.br/brasil/2022/05/5011789-brasil-tem-mais-de-27-mil-areas-de-risco-de-desastres.html)
