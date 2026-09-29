# Methods

## 1. Fusion grid
Radar reflectivity and radial velocity are quality-controlled (clutter, anomalous propagation, speckle, non-meteorological echoes; attenuation correction where applicable) and regridded to a common 1 km Cartesian grid. INSAT IR brightness temperatures (native ~4 km) and lightning flash density (5/15-min windows) are aligned on the same grid and clock. A coverage mask records which sources each cell has.

## 2. Convective initiation
Consecutive IR frames give cloud-top cooling rates, brightness-temperature thresholds and cold-area growth. Thresholds follow satellite convective-initiation literature and are tuned on Indian cases. Candidates are cross-checked with lightning and early radar echoes. Rapid-scan imagery (~4.5 min) improves timing when available.

## 3. Nowcasting (0–2 h)
- **Baseline:** PySTEPS Lucas–Kanade optical flow + semi-Lagrangian extrapolation; STEPS stochastic ensemble.
- **ML:** multi-source model (reflectivity, IR, lightning channels), generative formulation to avoid blur, pre-trained on SEVIR, fine-tuned on Indian cases.

## 4. Blending (2–6 h)
The nowcast ensemble is blended with the latest available IMD-HRRR / NCUM-R output (read, not run). Weights per lead time come from measured skill of each component; weights are non-negative and sum to 1.

## 5. Hazard diagnostics
| Hazard | Basis | Output |
|---|---|---|
| Lightning | Flash rate/trend, reflectivity aloft, IR cooling | Probability, flash density |
| Hail | High reflectivity above freezing level, VIL density, MESH-style estimates | Probability |
| Downburst | Low-level radial-velocity divergence, descending core | Outflow speed (m/s), short-lead warning |
| Cloudburst | 1-h rain ≥100 mm over contiguous ≥20 km² (IMD definition) | Probability, cluster area |
| Initiation | Section 2 | Probability |

## 6. Tracking and live countdowns
Cells are identified by thresholding and connected components and tracked across frames. For each configured place, arrival times across ensemble members give a distribution; the **window** is the 10th–90th percentile, the **probability** is the fraction of members arriving within 60 minutes, and the dashboard shows a **live countdown to the window start** together with the window and probability.

## 7. Honest lead times
Confidence for each hazard at 0–1 h, 1–2 h and 2–6 h is taken from verification. Beyond demonstrated point-scale skill, outputs become area probabilities or are withheld.

## Limitations
See the [Detailed Technical Report](report/VAJRA_Detailed_Report.pdf), Section 18.
