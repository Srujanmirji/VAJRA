# Scientific Methodology & Algorithms

VAJRA is built on peer-reviewed meteorological methods adapted specifically to tropical deep convection in the Indian subcontinent.

---

## 1. Quality Control & Attenuation Correction

Raw Doppler Weather Radar (DWR) polar volumes suffer from non-meteorological echoes, speckle noise, ground clutter, and precipitation path attenuation.

### 1.1 Speckle Filtering
Isolated single-pixel reflectivity spikes with no meteorological continuity are removed using morphological 2D opening and minimum neighborhood size constraints ($k \ge 3$ connected pixels).

### 1.2 Ground Clutter & Anomalous Propagation (AP) Filtering
Non-precipitating ground returns (hills, urban buildings, anomalous propagation ducting) are flagged using local texture variance and radial Doppler velocity:
$$\sigma_Z^2 = \frac{1}{N-1}\sum_{i=1}^N (Z_i - \bar{Z})^2$$
Echoes with $\sigma_Z > 8.0\text{ dBZ}$ and near-zero radial velocity ($|v_r| \le 1.0\text{ m/s}$) are masked as non-meteorological clutter.

### 1.3 Hitschfeld-Bordan Attenuation Correction
In heavy tropical rain (especially C-band and X-band), radar beam power attenuates along the radial path $r$:
$$k(r) = \alpha [Z_m(r)]^\beta$$
The unattenuated reflectivity $Z_c(r)$ is recovered recursively:
$$Z_c(r) = \frac{Z_m(r)}{\left[1 - 0.46 \beta \int_0^r \alpha [Z_m(s)]^\beta ds\right]^{1/\beta}}$$
where for Indian monsoon precipitation: $\alpha = 1.12 \times 10^{-4}$, $\beta = 0.62$. Reflectivity values are capped at $65.0\text{ dBZ}$ to prevent numeric runaway instability.

### 1.4 Z-R Convective Conversion
Precipitation rate $R$ (mm/h) is derived from quality-controlled reflectivity $Z$ ($\text{mm}^6/\text{m}^3$) via the convective Marshall-Palmer relationship:
$$Z = 300 \cdot R^{1.4} \iff R = \left(\frac{10^{Z/10}}{300}\right)^{1 / 1.4}$$
At $Z = 56\text{ dBZ}$, $R \approx 170\text{ mm/h}$, characteristic of severe Nor'wester and cloudburst cores.

---

## 2. Satellite Convective Initiation (CI) Detector

Tropical convective cells can intensify from clear sky to severe storms within 30 minutes. Satellite infrared imagery detects the nascent updraft before raindrops grow large enough to produce a radar echo.

Using INSAT-3DR / 3DS Thermal Infrared (TIR-1 10.8 µm) from ISRO MOSDAC:
1. **Cloud-Top Cooling Rate:**
   $$\frac{\Delta T_b}{\Delta t} = \frac{T_b(t) - T_b(t - 15\text{ min})}{15} \le -4.0\text{ K / 15 min}$$
2. **Brightness Temperature Threshold:**
   $$T_b(t) < 265.0\text{ K} \quad (\approx -8^\circ\text{C}, \text{ mixed-phase initiation})$$
3. **Pre-Echo Radar Verification:**
   $$Z(t) < 30.0\text{ dBZ}$$

When all three conditions coincide, VAJRA flags a candidate Convective Initiation zone with an estimated **15–25 minute lead time** over first radar detection.

---

## 3. Physical Hazard Diagnostic Engines

### 3.1 Hail: Waldvogel Technique (POH & MESH)
Calculates the vertical penetration of the severe reflectivity core ($45\text{ dBZ}$) above the environmental freezing level ($0^\circ\text{C}$ isotherm, typically $4.5\text{ km}$ AGL in India):
$$\Delta H = H_{45\text{dBZ}} - H_{0^\circ\text{C}}$$
- **Probability of Hail (POH %):**
  $$\text{POH} = \frac{100}{1 + \exp\left[-1.2 \cdot (\Delta H - 1.5)\right]}$$
- **Maximum Expected Severe Hail (MESH mm):**
  $$\text{MESH} = 2.54 \cdot (\text{SHI})^{0.5}$$
  where $\text{SHI}$ is the Severe Hail Index integrated over reflectivity aloft. A threshold of $\text{MESH} \ge 25\text{ mm}$ triggers severe hail warnings.

### 3.2 Downburst & Microburst Divergence Dipole
Dense precipitation downdrafts impacting the ground spread out radially, producing adjacent inbound (negative $v_r$) and outbound (positive $v_r$) Doppler velocity signatures:
$$|\Delta v| = |v_{\text{outbound}} - v_{\text{inbound}}| \ge 20.0\text{ m/s} \quad (\approx 72\text{ km/h})$$
within a maximum horizontal separation of $\le 10\text{ km}$. This provides critical 5–15 minute warnings for airport runway wind shear.

### 3.3 IMD Cloudburst Detection
Implementing the official standard of the India Meteorological Department:
$$\text{Rainfall Rate } R \ge 100.0\text{ mm/h} \quad \text{over contiguous area } A \ge 20.0\text{ km}^2$$
Connected-component spatial clustering on the 1 km rain rate grid identifies qualifying clusters and tracks their watershed risk envelope.

### 3.4 Lightning Jump (Schultz 2σ Algorithm)
Total lightning flash rate surges indicate vigorous updraft acceleration and mixed-phase charging prior to ground severe weather:
$$\Delta f = f(t) - f(t - 5\text{ min}) \ge 10\text{ flashes/min} \quad \text{and} \quad \Delta f \ge 2 \cdot \sigma_{\text{historical}}$$
Triggers severe storm alerts with 15–20 minutes lead time ahead of destructive surface winds or large hail.

---

## 4. Probabilistic Ensemble Nowcasting (0–2 h)

### 4.1 Lucas-Kanade Optical Flow Advection
Computes horizontal motion field $\vec{v} = (u, v)$ minimizing brightness constancy error between consecutive quality-controlled radar grids:
$$\nabla Z \cdot \vec{v} + \frac{\partial Z}{\partial t} = 0$$

### 4.2 STEPS Stochastic Scale Cascade (16 Members)
Decomposes radar reflectivity into 5 discrete spatial frequency cascades via 2D Fast Fourier Transform (FFT):
$$Z(x, y) = \sum_{k=1}^5 Z_k(x, y)$$
Each scale is advected with scale-dependent autoregressive AR(2) noise perturbations:
- Synoptic scales maintain high temporal correlation.
- Fine convective scales decorrelate rapidly, mimicking turbulence and unpredictable cell dissipation.

### 4.3 Physics-Informed ML (`VajraNowcastUNet`)
A 9-channel deep convolutional U-Net trained on paired radar, satellite IR, lightning strokes, and topography. Provides non-linear convective growth tendencies that pure optical flow cannot capture.

---

## 5. Smooth NWP Blending (2–6 h)

Operational NWP models (IMD-HRRR, NCUM-R) are strictly read-only.
VAJRA blends nowcast ensemble fields with NWP rain fields via a smooth sigmoid weight function:
$$w_{\text{radar}}(t) = \frac{1}{1 + \exp\left(\frac{t - 120.0}{30.0}\right)}, \quad w_{\text{nwp}}(t) = 1.0 - w_{\text{radar}}(t)$$

Properties:
- At $t \le 30\text{ min}$: $w_{\text{radar}} \approx 1.0$, $w_{\text{nwp}} \approx 0.0$ (Observation dominant).
- At $t = 120\text{ min}$ (2 h): $w_{\text{radar}} = 0.5$, $w_{\text{nwp}} = 0.5$ (Equal balance).
- At $t \ge 300\text{ min}$ (5–6 h): $w_{\text{radar}} \approx 0.0$, $w_{\text{nwp}} \approx 1.0$ (NWP dominant).
- $\forall t: w_{\text{radar}}(t) + w_{\text{nwp}}(t) \equiv 1.0$.

---

## 6. Arrival Countdowns & Decision Windows

Rather than publishing deterministic point arrival times, VAJRA projects cell forecast tracks against configured location polygons:
- **Arrival Window:** 10th to 90th percentile arrival time across all 16 ensemble members.
- **Probability:** Percentage of ensemble members penetrating the location buffer within 60 minutes.
- **Countdown Display:** Live countdown in `MM:SS` format to the start of the arrival window.
