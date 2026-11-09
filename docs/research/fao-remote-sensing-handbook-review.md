# Review: FAO "Handbook on remote sensing for agricultural statistics"

*Research note · 7 Nov 2026 · companion to [problem-space-shortlist.md](problem-space-shortlist.md)*

**Source:** FAO / Global Strategy to improve Agricultural and Rural Statistics (GSARS), *Handbook on remote sensing for agricultural statistics*, 2017 (file `ca6394en.pdf`, 287 pp., overview by Jacques Delincé). [Link](https://openknowledge.fao.org/server/api/core/bitstreams/dcadd248-cccb-43ad-9e3c-7aa0cf2bb577/content)

## Bottom line

It's a methods manual for **national statistics offices**, not a source of new problems or business models. It says nothing about climate justice, knowledge graphs or ontologies, and it dates from 2017 (Sentinel-2 was new, and there's no deep learning or foundation models). It **doesn't change our ranking**. Its value is as a methods reference for the lead idea (#1, family-farm credit and parametric cover). It covers how to estimate crop area and yield from satellites without bias, how to validate against ground data, and what that costs. It also points to one concrete ontology standard we should reuse (LCCS/LCML).

## What's in it

| Ch. | Topic | Takeaway |
|---|---|---|
| 1 | Data access and software | Sensor catalogue, cost of commercial vs free imagery, cloud processing (GEE). Superseded by today's options. |
| 2 | Land cover mapping | **LCCS / LCML** (FAO Land Cover Classification System; LCML is ISO 19144-2), in-situ data collection, change detection. |
| 3 | Sampling frames | Using imagery to stratify and draw area sampling frames (segments, points, transects). Field surveys get 8–38% lower variance from RS stratification (Haiti example). |
| 4 | Crop Data Layers | Operational national crop-type maps; Canada's Annual Crop Inventory case. Agribusiness uses it to **map flooded areas by crop type for insurance claim verification**, validate carbon-offset land use, and prove EU-RED compliance. |
| 5 | Crop area estimation | Pixel counting vs regression, calibration and small-area estimators; accuracy via confusion matrices; national programmes incl. **Brazil's CONAB GeoSafras** (Landsat + MODIS, maize/soy/wheat). |
| 6 | Early warning and yield | Early Warning Early Action (act before the harvest fails), agro-meteorological vs remote-sensing yield models; yield forecasts flagged as useful to **agricultural insurers** (Australia ~2.6% error at shire level). |
| 7 | Forest cover and deforestation | Sampling-based deforestation statistics, MMUs (PRODES 6.25 ha, now 1 ha), and **Brazil's National Forest Inventory landscape units**, built on the RapidEye imagery the Ministry of Environment bought nationwide for **CAR**. Includes riparian (APP) restoration analysis under the Forest Code. |
| 8 | Organisation and competences | How to staff and fund a geospatial unit (Ethiopia, Pakistan, Bangladesh, Rwanda). |
| 9 | Cost-effectiveness | Free imagery + open source + cloud make RS cost-effective; USDA CDL cost ~US$75k per state (1997); public crop maps serve **insurance and financial services**. |
| Annex | Bias of pixel counting | Why naive "count the classified pixels" area estimates are biased, and how to correct with confusion-matrix calibration. |

## Relevance to our shortlist

**#1 Family-farm climate credit and parametric insurance: useful, as methods.**
- *Basis risk is a statistics problem.* The pixel-counting bias annex and the calibration/small-area estimators (ch. 5) are exactly what's needed to make a satellite-based index trigger defensible to an insurer and to SUSEP. A trigger that systematically under-reports losses on small, mixed-crop plots hurts the farmers we claim to protect.
- *Area-yield index at municipality or co-op level.* Ch. 5–6 methods plus IBGE PAM municipal yields as ground truth could produce an **area-yield index** product. That's a simpler first step than per-farm parametric cover. *(My inference, not in the handbook:)* the same estimates could speed loss verification for **Garantia-Safra** (municipal-level loss trigger) and Proagro Mais. That would make the government a possible paying buyer for the semi-arid Northeast, which is worth checking in discovery calls.
- *Know what's planted on each CAR polygon.* Crop Data Layers (ch. 4) are the input that turns a hazard score into an exposure score. MapBiomas covers this at 30 m, but family-farm plots are small and mixed. The handbook (ch. 8) says such plots need higher-resolution imagery, which is a cost risk for the R$3/farmer/year data assumption in [unit-economics-family-farm-risk.xlsx](unit-economics-family-farm-risk.xlsx). Sentinel-2 at 10 m is probably fine for co-op/municipal indices but marginal for per-plot claims.
- *Early Warning Early Action* gives us the climate-justice framing for the product: pay out or offer credit relief *before* a failed harvest, not after. That fits a forecast-based trigger.

**#2 Indirect-supplier deforestation: background only.** Ch. 7 is about national deforestation statistics. PRODES, MapBiomas and DETER already go further than this for Brazil.

**#3 Land tenure for carbon and restoration: small signal.** The NFI landscape study ties RS to CAR and to riparian restoration obligations under the Forest Code, which supports a restoration-compliance module. The Canada example of RS used to validate carbon-offset land use is a precedent.

**Flood notes ([flood-prediction-from-rainfall.md](flood-prediction-from-rainfall.md)): confirms our chosen slice.** The only flood content is crop-type-specific flood maps used by insurers to verify claims. That's the "flood-event detection as an insurance input" slice our note recommends, not forecasting.

**Ontology and graph: one concrete reuse.** Add **LCCS/LCML (ISO 19144-2)** to the ontology reuse list next to GeoSPARQL, SOSA/SSN, AGROVOC and FIBO. It's a formal, composable way to describe land cover classes, so MapBiomas classes, CONAB crop classes and our own labels can map to one vocabulary. Nothing else in the handbook touches graphs.

## What it doesn't cover (gaps to fill elsewhere)

- Modern ML: deep learning crop mapping, SAR time-series models, geospatial foundation models (e.g. Prithvi, Clay, Google AlphaEarth embeddings).
- Brazil-specific current data: MapBiomas, ZARC, SICOR, Plano Safra, the 2024 RS floods.
- Any business model, buyer analysis or justice lens.

## Suggested follow-ups

1. Use the ch. 5 estimators and the annex as the validation spec for the parametric-trigger backtest (CHIRPS/IMERG + Sentinel vs IBGE PAM and S2ID).
2. Add "area-yield index for Garantia-Safra / Proagro Mais loss verification" to the discovery-call list (MDA, a state rural-extension agency).
3. Add LCCS/LCML to the ontology draft.
