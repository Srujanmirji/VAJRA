# VAJRA — Research Notes (PS 26084)

Evaluator-safe summary of the research behind VAJRA. Full method: [Detailed Technical Report](../report/VAJRA_Detailed_Report.pdf).

## 1. Existing Indian capability
| System | Capability | Limitation |
|---|---|---|
| WDSS-II (IMD, 2006) | Radar severe-weather algorithms | Radar-only |
| SWIRLS-2 (IMD, 2018) | Radar-led nowcasts: reflectivity, rainfall, tracks, lightning, squall, hail | Extrapolation; ~1–2 h skill |
| PySTEPS module (IMD) | Probabilistic extrapolation | No hazard products |
| IMD-HRRR | Rapid-refresh NWP | Not blended with observation nowcasts |
| DAMINI (IITM) | Lightning warnings up to ~40 min | Single hazard |
| INSAT-3D/3DR/3DS | IR imagery via MOSDAC | 4 km IR; 30-min routine cadence |

IMD has stated plans for village-level nowcasts every 10 minutes.

## 2. Physical constraints
- Radar extrapolation skill decreases with lead time; Indian studies extended useful lead to about 2 h.
- INSAT IR bands are 4 km; routine cadence 30 min, rapid scan ~4.5 min when activated → 1–3 km outputs only under radar.
- IMD defines a cloudburst as ≥100 mm in 1 h over ~20–30 km².
- Downbursts give only minutes of lead.

## 3. Literature
| Approach | Lesson |
|---|---|
| Optical-flow extrapolation (PySTEPS) | Robust baseline |
| STEPS blending with NWP | Route to seamless 0–6 h |
| DGMR, NowcastNet | Generative models keep storms sharp |
| Satellite diffusion nowcasting | Satellite extends coverage |
| 3D radar nowcasting | Volume data improve heavy-rain location |
| SEVIR | Co-located radar/IR/lightning for training |

## 4. Design decisions and evidence
| Decision | Evidence |
|---|---|
| Build on SWIRLS/PySTEPS; use PySTEPS as baseline | IMD already operates them |
| Observation-driven 0–2 h, NWP-blended 2–6 h | Skill decay; STEPS blending |
| 1 km only under radar | INSAT IR 4 km |
| Cloudburst via radar rain threshold | IMD definition |
| Live countdowns with windows | Storm motion uncertainty |
| Pre-train on SEVIR | No open fused Indian dataset |

## 5. Sources
1. Operational assessment of radar nowcasting tools (IMD), *Atmosphere* 15(2):154, 2024 — https://doi.org/10.3390/atmos15020154
2. SWIRLS with Indian DWR, *MAUSAM* — https://mausamjournal.imd.gov.in/index.php/MAUSAM/article/view/1442
3. Radar nowcasting over NE India, *J. Earth Syst. Sci.* 2025 — https://link.springer.com/article/10.1007/s12040-025-02649-4
4. IMD press release, Jan 2025 — https://internal.imd.gov.in/press_release/20250114_pr_3552.pdf
5. Satellite diffusion nowcasting, arXiv 2404.10512 — https://arxiv.org/pdf/2404.10512
6. MOSDAC INSAT-3D payloads — https://mosdac.gov.in/insat-3d-payloads?language=en
7. INSAT-3DR rapid scan, *Current Science* — https://www.currentscience.ac.in/Volumes/120/06/1026.pdf
8. IIT Madras Shaastra — lightning networks — https://shaastramag.iitm.ac.in/special-feature/bolt-blue
9. Cloudbursts explainer — https://www.climate.rocksea.org/cloudbursts/
10. DGMR, *Nature* 2021 — https://www.nature.com/articles/s41586-021-03854-z
11. NowcastNet, *Nature* 2023 — https://www.nature.com/articles/s41586-023-06184-4
12. SEVIR — https://sevir.mit.edu/
13. pySTEPS — https://pysteps.github.io/
14. Nowcast3D, arXiv 2511.04659 — https://arxiv.org/pdf/2511.04659
