"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { FieldLayerData, StormCellData, PlaceCountdownData } from "@/lib/api";
import { getLightningFlashes } from "@/lib/mockData";
import { MapPin, Navigation, Zap, AlertTriangle, Radio, Plane, Train, Anchor, Building2 } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface RadarMapProps {
  fieldData: FieldLayerData | null;
  cells: StormCellData[];
  countdowns: PlaceCountdownData[];
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  activeLayers: {
    radar: boolean;
    satellite: boolean;
    lightning: boolean;
    tracks: boolean;
    coverageRing: boolean;
    hatchedZone: boolean;
    airports: boolean;
    cloudburst: boolean;
  };
  onMapClickPin: (lat: number, lon: number) => void;
  pinnedLocation: { lat: number; lon: number; name?: string } | null;
}

const RADAR_CENTER: [number, number] = [88.35, 22.57]; // Kolkata VECC S-Band DWR
const RADAR_RADIUS_KM = 250;

export function RadarMap({
  fieldData,
  cells,
  countdowns,
  selectedCellId,
  onSelectCell,
  activeLayers,
  onMapClickPin,
  pinnedLocation,
}: RadarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Markers storage to update cleanly
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const cellMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dwrMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lightningMarkersRef = useRef<maplibregl.Marker[]>([]);

  // -------------------------------------------------------------------------
  // 1. INITIALIZE MAPLIBRE GL BASEMAP
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: RADAR_CENTER,
      zoom: 7.3,
      minZoom: 5.5,
      maxZoom: 12.0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: "CARTO, © OpenStreetMap contributors" }),
      "bottom-right"
    );

    map.on("load", () => {
      mapRef.current = map;
      setMapLoaded(true);

      // Initialize Geodesic Radar Range Rings & Satellite-only outer zone
      setupRadarRingsAndSatelliteZone(map);
    });

    map.on("click", (e) => {
      onMapClickPin(Number(e.lngLat.lat.toFixed(4)), Number(e.lngLat.lng.toFixed(4)));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. RADAR RASTER LAYER AS GEOREFERENCED SOURCE
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !fieldData || !fieldData.bounds || !fieldData.data) return;

    const { lat_min, lat_max, lon_min, lon_max, ny, nx } = fieldData.bounds;
    const gridData = fieldData.data;
    const maskData = fieldData.radar_coverage_mask;

    // Render offscreen canvas at full 1 km resolution
    const canvas = document.createElement("canvas");
    canvas.width = nx;
    canvas.height = ny;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.createImageData(nx, ny);

    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const val = gridData[y] ? gridData[y][x] : -32;
        const isCovered = maskData && maskData[y] ? maskData[y][x] === 1 : true;
        const pixelIdx = (y * nx + x) * 4;

        if (fieldData.field_type === "reflectivity") {
          if (val >= 15.0 && isCovered) {
            const [r, g, b, a] = getDbzColor(val);
            imgData.data[pixelIdx] = r;
            imgData.data[pixelIdx + 1] = g;
            imgData.data[pixelIdx + 2] = b;
            imgData.data[pixelIdx + 3] = a;
          }
        } else if (fieldData.field_type === "rain_rate") {
          if (val >= 1.0 && isCovered) {
            const [r, g, b, a] = getRainRateColor(val);
            imgData.data[pixelIdx] = r;
            imgData.data[pixelIdx + 1] = g;
            imgData.data[pixelIdx + 2] = b;
            imgData.data[pixelIdx + 3] = a;
          }
        } else if (fieldData.field_type === "ir_temperature") {
          if (val < 265.0) {
            const [r, g, b, a] = getIrColor(val);
            imgData.data[pixelIdx] = r;
            imgData.data[pixelIdx + 1] = g;
            imgData.data[pixelIdx + 2] = b;
            imgData.data[pixelIdx + 3] = a;
          }
        } else if (fieldData.field_type === "lightning_density") {
          if (val > 1.0) {
            imgData.data[pixelIdx] = 250;
            imgData.data[pixelIdx + 1] = 204;
            imgData.data[pixelIdx + 2] = 21;
            imgData.data[pixelIdx + 3] = Math.min(240, Math.floor((val / 35.0) * 220) + 35);
          }
        } else if (fieldData.field_type === "hail_prob") {
          if (val > 15.0) {
            imgData.data[pixelIdx] = 6;
            imgData.data[pixelIdx + 1] = 182;
            imgData.data[pixelIdx + 2] = 212;
            imgData.data[pixelIdx + 3] = Math.min(235, Math.floor((val / 100.0) * 220) + 30);
          }
        } else if (fieldData.field_type === "downburst_prob") {
          if (val > 5.0) {
            imgData.data[pixelIdx] = 168;
            imgData.data[pixelIdx + 1] = 85;
            imgData.data[pixelIdx + 2] = 247;
            imgData.data[pixelIdx + 3] = Math.min(240, Math.floor((val / 30.0) * 210) + 40);
          }
        } else if (fieldData.field_type === "convective_initiation") {
          if (val < -1.0) {
            imgData.data[pixelIdx] = 239;
            imgData.data[pixelIdx + 1] = 68;
            imgData.data[pixelIdx + 2] = 68;
            imgData.data[pixelIdx + 3] = Math.min(230, Math.floor((Math.abs(val) / 8.5) * 200) + 50);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [lon_min, lat_max], // Top-Left
      [lon_max, lat_max], // Top-Right
      [lon_max, lat_min], // Bottom-Right
      [lon_min, lat_min], // Bottom-Left
    ];

    const source = map.getSource("radar-raster") as maplibregl.ImageSource;
    if (source) {
      source.updateImage({
        url: dataUrl,
        coordinates,
      });
    } else {
      map.addSource("radar-raster", {
        type: "image",
        url: dataUrl,
        coordinates,
      });

      // Insert below labels if possible, otherwise normal add
      const labelLayerId = findFirstLabelLayerId(map);
      map.addLayer(
        {
          id: "radar-raster-layer",
          type: "raster",
          source: "radar-raster",
          paint: {
            "raster-opacity": activeLayers.radar ? 0.8 : 0.0,
            "raster-resampling": "linear",
          },
        },
        labelLayerId
      );
    }
  }, [fieldData, mapLoaded]);

  // Handle layer toggle visibility without re-generating raster
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer("radar-raster-layer")) {
      map.setPaintProperty("radar-raster-layer", "raster-opacity", activeLayers.radar ? 0.8 : 0.0);
    }
    if (map.getLayer("satellite-zone-fill")) {
      map.setPaintProperty("satellite-zone-fill", "fill-opacity", activeLayers.hatchedZone ? 0.4 : 0.0);
    }
    if (map.getLayer("radar-rings-line")) {
      map.setLayoutProperty("radar-rings-line", "visibility", activeLayers.coverageRing ? "visible" : "none");
    }
    if (map.getLayer("radar-rings-labels")) {
      map.setLayoutProperty("radar-rings-labels", "visibility", activeLayers.coverageRing ? "visible" : "none");
    }
    if (map.getLayer("storm-tracks-lines")) {
      map.setLayoutProperty("storm-tracks-lines", "visibility", activeLayers.tracks ? "visible" : "none");
    }
    if (map.getLayer("storm-tracks-ellipses")) {
      map.setLayoutProperty("storm-tracks-ellipses", "visibility", activeLayers.tracks ? "visible" : "none");
    }
  }, [activeLayers, mapLoaded]);

  // -------------------------------------------------------------------------
  // 3. STORM TRACKS & FORECAST UNCERTAINTY ELLIPSES
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Build GeoJSON features for cell forecast tracks & uncertainty ellipses
    const linesFeatures: GeoJSON.Feature[] = [];
    const ellipseFeatures: GeoJSON.Feature[] = [];

    cells.forEach((cell) => {
      const isSelected = selectedCellId === cell.cell_id;
      const coords: [number, number][] = [[cell.lon, cell.lat]];

      cell.forecast_track.forEach((pt) => {
        coords.push([pt.lon, pt.lat]);

        // Uncertainty ellipses at +30 min and +60 min
        if (pt.lead_minutes === 30 || pt.lead_minutes === 60) {
          const ellipsePoly = createUncertaintyEllipse(
            pt.lon,
            pt.lat,
            pt.semi_major_km,
            pt.semi_minor_km,
            cell.direction_deg
          );
          ellipseFeatures.push({
            type: "Feature",
            properties: {
              cell_id: cell.cell_id,
              lead: pt.lead_minutes,
              isSelected,
            },
            geometry: {
              type: "Polygon",
              coordinates: [ellipsePoly],
            },
          });
        }
      });

      linesFeatures.push({
        type: "Feature",
        properties: {
          cell_id: cell.cell_id,
          isSelected,
        },
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      });
    });

    const linesCollection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: linesFeatures,
    };

    const ellipsesCollection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: ellipseFeatures,
    };

    const lineSource = map.getSource("storm-tracks-source") as maplibregl.GeoJSONSource;
    if (lineSource) {
      lineSource.setData(linesCollection);
    } else {
      map.addSource("storm-tracks-source", {
        type: "geojson",
        data: linesCollection,
      });

      map.addLayer({
        id: "storm-tracks-lines",
        type: "line",
        source: "storm-tracks-source",
        paint: {
          "line-color": ["case", ["get", "isSelected"], "#F28C28", "rgba(242, 140, 40, 0.5)"],
          "line-width": ["case", ["get", "isSelected"], 2.2, 1.4],
          "line-dasharray": [3, 2],
        },
        layout: {
          visibility: activeLayers.tracks ? "visible" : "none",
        },
      });
    }

    const ellipseSource = map.getSource("storm-ellipses-source") as maplibregl.GeoJSONSource;
    if (ellipseSource) {
      ellipseSource.setData(ellipsesCollection);
    } else {
      map.addSource("storm-ellipses-source", {
        type: "geojson",
        data: ellipsesCollection,
      });

      map.addLayer({
        id: "storm-tracks-ellipses",
        type: "fill",
        source: "storm-ellipses-source",
        paint: {
          "fill-color": "rgba(242, 140, 40, 0.08)",
          "fill-outline-color": "rgba(242, 140, 40, 0.45)",
        },
        layout: {
          visibility: activeLayers.tracks ? "visible" : "none",
        },
      });
    }
  }, [cells, selectedCellId, mapLoaded]);

  // -------------------------------------------------------------------------
  // 4. MONITORED PLACE BADGES & KOLKATA DWR RADAR SITE MARKER
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Clear old place markers
    placeMarkersRef.current.forEach((m) => m.remove());
    placeMarkersRef.current = [];

    // Add Kolkata DWR marker
    if (!dwrMarkerRef.current) {
      const dwrEl = document.createElement("div");
      dwrEl.className = "cursor-pointer group flex flex-col items-center pointer-events-auto z-20";
      dwrEl.innerHTML = `
        <div class="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-950/90 border border-blue-400/60 shadow-lg text-[10px] font-mono text-cyan-300 font-bold backdrop-blur-md">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>VECC DWR (S-Band)</span>
          <span class="text-blue-300 text-[9px]">250 km</span>
        </div>
        <div class="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-0.5 shadow-md"></div>
      `;
      dwrEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onMapClickPin(RADAR_CENTER[1], RADAR_CENTER[0]);
      });
      dwrMarkerRef.current = new maplibregl.Marker({ element: dwrEl })
        .setLngLat(RADAR_CENTER)
        .addTo(map);
    }

    if (!activeLayers.airports) return;

    countdowns.forEach((p) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer group flex flex-col items-center pointer-events-auto z-10 transition-transform hover:scale-105";

      let badgeContent = "";
      if (p.countdown_display === "STORM OVERHEAD") {
        badgeContent = `<span class="bg-red-500/30 text-red-300 border border-red-500 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded animate-pulse">STORM OVERHEAD</span>`;
      } else if (p.approaching) {
        badgeContent = `
          <span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded flex items-center space-x-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>${p.countdown_display}</span>
          </span>
        `;
      } else if (p.countdown_display === "Passed") {
        badgeContent = `<span class="bg-slate-800/80 text-slate-400 border border-slate-700 font-mono text-[9px] px-1.5 py-0.5 rounded">Passed</span>`;
      } else {
        badgeContent = `<span class="bg-slate-800/80 text-slate-500 border border-slate-800 font-mono text-[9px] px-1.5 py-0.5 rounded">No threat</span>`;
      }

      const iconSymbol =
        p.place_code === "CCU"
          ? "✈"
          : p.place_code === "HWH"
          ? "🚆"
          : p.place_code === "HLD"
          ? "⚓"
          : p.place_code === "KGP"
          ? "🏫"
          : "🏛";

      el.innerHTML = `
        <div class="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#090f1d]/90 border border-white/15 text-[11px] font-mono text-slate-200 shadow-xl backdrop-blur-md group-hover:border-vajra-orange/70">
          <span class="text-xs">${iconSymbol}</span>
          <span class="font-bold text-white">${p.place_code}</span>
          <span class="text-slate-400 text-[10px] hidden sm:inline">${p.place_name.split(" ")[0]}</span>
          ${badgeContent}
        </div>
        <div class="w-1.5 h-1.5 bg-white/70 rounded-full mt-0.5 shadow-sm"></div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onMapClickPin(p.lat, p.lon);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .addTo(map);

      placeMarkersRef.current.push(marker);
    });
  }, [countdowns, activeLayers.airports, mapLoaded]);

  // -------------------------------------------------------------------------
  // 5. STORM CELL MARKERS (CELL_KOL_01, CELL_KOL_02, CELL_KOL_03_CI)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    cellMarkersRef.current.forEach((m) => m.remove());
    cellMarkersRef.current = [];

    cells.forEach((cell) => {
      const isSelected = selectedCellId === cell.cell_id;
      const el = document.createElement("div");
      el.className = `cursor-pointer transition-all z-20 hover:scale-110 ${
        isSelected ? "scale-110 z-30" : ""
      }`;

      const severityClass =
        cell.severity === "EXTREME"
          ? "bg-red-950/85 border-red-500 text-red-200 glow-severe"
          : cell.severity === "SEVERE"
          ? "bg-orange-950/85 border-orange-500 text-orange-200"
          : "bg-blue-950/85 border-blue-500 text-blue-200";

      el.innerHTML = `
        <div class="flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-mono font-bold shadow-2xl backdrop-blur-md border ${severityClass} ${
        isSelected ? "ring-2 ring-vajra-orange ring-offset-1 ring-offset-black" : ""
      }">
          <div style="transform: rotate(${cell.direction_deg}deg)" class="transition-transform">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
          <span>${cell.cell_id}</span>
          <span class="text-[10px] opacity-90">${Math.round(cell.max_dbz)}dBZ</span>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectCell(cell.cell_id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cell.lon, cell.lat])
        .addTo(map);

      cellMarkersRef.current.push(marker);
    });
  }, [cells, selectedCellId, mapLoaded]);

  // -------------------------------------------------------------------------
  // 6. LIGHTNING FLASHES (Fading over 15 min where Z > 45 dBZ)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    lightningMarkersRef.current.forEach((m) => m.remove());
    lightningMarkersRef.current = [];

    if (!activeLayers.lightning) return;

    const flashes = getLightningFlashes();

    flashes.forEach((fl) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none transition-opacity";
      el.style.opacity = String(fl.opacity);

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-5 h-5 rounded-full bg-amber-400/20 animate-ping"></div>
          <div class="w-3.5 h-3.5 rounded-full bg-amber-400/30 border border-amber-300 flex items-center justify-center shadow-lg">
            <span class="text-[9px] text-amber-200">⚡</span>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fl.lon, fl.lat])
        .addTo(map);

      lightningMarkersRef.current.push(marker);
    });
  }, [activeLayers.lightning, fieldData?.timestamp, mapLoaded]);

  // -------------------------------------------------------------------------
  // 7. USER PINNED LOCATION MARKER
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }

    if (!pinnedLocation) return;

    const el = document.createElement("div");
    el.className = "pointer-events-none flex flex-col items-center animate-bounce z-40";
    el.innerHTML = `
      <div class="bg-vajra-orange text-slate-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xl">
        ${pinnedLocation.name || `${pinnedLocation.lat.toFixed(3)}°N, ${pinnedLocation.lon.toFixed(3)}°E`}
      </div>
      <div class="w-3 h-3 bg-vajra-orange rotate-45 -mt-1 shadow-md"></div>
    `;

    pinMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([pinnedLocation.lon, pinnedLocation.lat])
      .addTo(map);
  }, [pinnedLocation, mapLoaded]);

  return (
    <div className="relative w-full h-full bg-[#050811] overflow-hidden select-none">
      {/* MapLibre DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" />

      {/* Hatched Pattern Warning Indicator for Satellite-only zone */}
      {activeLayers.hatchedZone && (
        <div className="absolute top-2.5 right-12 pointer-events-none px-2.5 py-1 rounded bg-panel/90 border border-white/10 text-[11px] text-slate-300 font-mono flex items-center space-x-2 backdrop-blur-md shadow-lg">
          <div className="w-3 h-3 border border-white/40 hatched-satellite-zone" />
          <span>Shaded: Satellite & Lightning Zone (Outside 250 km Radar Limit)</span>
        </div>
      )}

      {/* Operational Radar dBZ / Rain / IR Color Ramp Legend */}
      <div className="absolute bottom-3 left-3 pointer-events-none bg-panel/90 border border-panel-border px-3 py-2 rounded-lg text-xs font-mono backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
          <span>{fieldData?.field_type.toUpperCase() || "REFLECTIVITY"} ({fieldData?.unit || "dBZ"})</span>
          <span className="text-emerald-400 font-bold ml-2">1 km GRID</span>
        </div>
        {fieldData?.field_type === "reflectivity" || !fieldData ? (
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-slate-400 font-mono">15</span>
              <div
                className="w-44 h-3 rounded"
                style={{
                  background:
                    "linear-gradient(to right, #00e5ff 0%, #0099ff 18%, #00cc00 36%, #ffee00 54%, #ff9900 72%, #ff0000 85%, #cc0000 92%, #ff00ff 100%)",
                }}
              />
              <span className="text-[10px] text-slate-400 font-mono">65+</span>
            </div>
            <div className="flex justify-between text-[8px] text-slate-500 font-mono px-0.5">
              <span>Light</span>
              <span>Mod</span>
              <span>Heavy</span>
              <span>Hail/Gust</span>
            </div>
          </div>
        ) : fieldData.field_type === "rain_rate" ? (
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-400 font-mono">1</span>
            <div
              className="w-44 h-3 rounded"
              style={{
                background:
                  "linear-gradient(to right, #38bdf8 0%, #22c55e 25%, #eab308 50%, #ef4444 75%, #a855f7 100%)",
              }}
            />
            <span className="text-[10px] text-slate-400 font-mono">100+ mm/h</span>
          </div>
        ) : fieldData.field_type === "ir_temperature" ? (
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-400 font-mono">&lt;200K</span>
            <div
              className="w-44 h-3 rounded"
              style={{
                background:
                  "linear-gradient(to right, #ec4899 0%, #a855f7 25%, #ef4444 50%, #f97316 75%, #eab308 100%)",
              }}
            />
            <span className="text-[10px] text-slate-400 font-mono">265K</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-400 font-mono">Low</span>
            <div className="w-40 h-3 rounded bg-gradient-to-r from-amber-500/20 via-amber-500 to-purple-600" />
            <span className="text-[10px] text-slate-400 font-mono">High Risk</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS: GEODESIC CIRCLES, COLOR PALETTES, ELLIPSES
// ---------------------------------------------------------------------------

function setupRadarRingsAndSatelliteZone(map: maplibregl.Map) {
  // 1. Concentric range rings: 50, 100, 150, 200, 250 km
  const ringRadii = [50, 100, 150, 200, RADAR_RADIUS_KM];
  const ringFeatures: GeoJSON.Feature[] = [];
  const labelFeatures: GeoJSON.Feature[] = [];

  ringRadii.forEach((r) => {
    const coords = createGeodesicCircle(RADAR_CENTER[0], RADAR_CENTER[1], r, 64);
    ringFeatures.push({
      type: "Feature",
      properties: { radius: r },
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    });

    // Northern apex for label
    const labelCoord = coords[Math.floor(coords.length * 0.75)]; // North
    labelFeatures.push({
      type: "Feature",
      properties: { label: `${r} km${r === RADAR_RADIUS_KM ? " DWR Limit" : ""}` },
      geometry: {
        type: "Point",
        coordinates: labelCoord,
      },
    });
  });

  map.addSource("radar-rings-source", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: ringFeatures,
    },
  });

  map.addLayer({
    id: "radar-rings-line",
    type: "line",
    source: "radar-rings-source",
    paint: {
      "line-color": "rgba(0, 160, 255, 0.4)",
      "line-width": 1.2,
      "line-dasharray": [4, 4],
    },
  });

  map.addSource("radar-rings-labels-source", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: labelFeatures,
    },
  });

  map.addLayer({
    id: "radar-rings-labels",
    type: "symbol",
    source: "radar-rings-labels-source",
    layout: {
      "text-field": ["get", "label"],
      "text-size": 10,
      "text-font": ["Open Sans Regular"],
      "text-offset": [0, -0.6],
      "text-anchor": "bottom",
    },
    paint: {
      "text-color": "rgba(0, 180, 255, 0.7)",
      "text-halo-color": "#070B14",
      "text-halo-width": 1.5,
    },
  });

  // 2. Satellite-only zone outside 250 km (Polygon with hole)
  const outerBox: [number, number][] = [
    [82.0, 18.0],
    [94.0, 18.0],
    [94.0, 27.0],
    [82.0, 27.0],
    [82.0, 18.0],
  ];
  // 250 km circle reversed for inner ring
  const innerCircle = createGeodesicCircle(RADAR_CENTER[0], RADAR_CENTER[1], RADAR_RADIUS_KM, 64).reverse();

  map.addSource("satellite-zone-source", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [outerBox, innerCircle],
      },
    },
  });

  map.addLayer({
    id: "satellite-zone-fill",
    type: "fill",
    source: "satellite-zone-source",
    paint: {
      "fill-color": "#020712",
      "fill-opacity": 0.4,
    },
  });
}

function createGeodesicCircle(
  centerLon: number,
  centerLat: number,
  radiusKm: number,
  numPoints = 64
): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6371.0;
  const latRad = (centerLat * Math.PI) / 180;
  const lonRad = (centerLon * Math.PI) / 180;
  const dByR = radiusKm / earthRadius;

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i * 2 * Math.PI) / numPoints;
    const ptLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) + Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearing)
    );
    const ptLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(dByR) * Math.cos(latRad),
        Math.cos(dByR) - Math.sin(latRad) * Math.sin(ptLatRad)
      );
    coords.push([Number(((ptLonRad * 180) / Math.PI).toFixed(4)), Number(((ptLatRad * 180) / Math.PI).toFixed(4))]);
  }
  return coords;
}

function createUncertaintyEllipse(
  centerLon: number,
  centerLat: number,
  majorKm: number,
  minorKm: number,
  dirDeg: number,
  numPoints = 36
): [number, number][] {
  const coords: [number, number][] = [];
  const rad = Math.PI / 180;
  const theta = (dirDeg - 90) * rad;

  for (let i = 0; i <= numPoints; i++) {
    const phi = (i * 2 * Math.PI) / numPoints;
    const x0 = majorKm * Math.cos(phi);
    const y0 = minorKm * Math.sin(phi);

    // Rotate by angle
    const xRot = x0 * Math.cos(theta) - y0 * Math.sin(theta);
    const yRot = x0 * Math.sin(theta) + y0 * Math.cos(theta);

    const dLon = xRot / (102.5 * Math.cos(centerLat * rad));
    const dLat = yRot / 111.0;

    coords.push([Number((centerLon + dLon).toFixed(4)), Number((centerLat + dLat).toFixed(4))]);
  }
  return coords;
}

function findFirstLabelLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === "symbol" && layer.layout && (layer.layout as any)["text-field"]) {
      return layer.id;
    }
  }
  return undefined;
}

// Operational Radar Color Ramp (<15 transparent, 15-20 light blue, 20-30 blue->green, 30-40 green->yellow, 40-50 orange, 50-55 red, 55-60 dark red, 60+ magenta)
function getDbzColor(val: number): [number, number, number, number] {
  if (val < 15.0) return [0, 0, 0, 0];
  if (val < 20.0) {
    const t = (val - 15.0) / 5.0;
    return [0, Math.round(200 + t * 55), 255, Math.round(140 + t * 40)];
  }
  if (val < 30.0) {
    const t = (val - 20.0) / 10.0;
    return [0, Math.round(150 + t * 70), Math.round(255 * (1 - t)), Math.round(180 + t * 20)];
  }
  if (val < 40.0) {
    const t = (val - 30.0) / 10.0;
    return [Math.round(t * 255), Math.round(220 + t * 25), 0, 210];
  }
  if (val < 50.0) {
    const t = (val - 40.0) / 10.0;
    return [255, Math.round(190 - t * 80), 0, 225];
  }
  if (val < 55.0) {
    const t = (val - 50.0) / 5.0;
    return [Math.round(250 - t * 15), Math.round(70 - t * 50), 0, 235];
  }
  if (val < 60.0) {
    return [Math.round(200), 0, 0, 245];
  }
  return [255, 0, 255, 255]; // 60+ dBZ Magenta (Severe hail)
}

function getRainRateColor(r: number): [number, number, number, number] {
  if (r >= 100.0) return [168, 85, 247, 255]; // Cloudburst violet
  if (r >= 65.0) return [239, 68, 68, 235];
  if (r >= 35.0) return [249, 115, 22, 220];
  if (r >= 15.0) return [234, 179, 8, 195];
  if (r >= 5.0) return [34, 197, 94, 170];
  return [56, 189, 248, 130];
}

function getIrColor(k: number): [number, number, number, number] {
  if (k < 205.0) return [236, 72, 153, 240]; // Deep overshooting top (Magenta)
  if (k < 215.0) return [168, 85, 247, 220];
  if (k < 225.0) return [239, 68, 68, 200];
  if (k < 235.0) return [249, 115, 22, 180];
  if (k < 250.0) return [234, 179, 8, 140];
  return [71, 85, 105, 70];
}
