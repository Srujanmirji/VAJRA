"use client";

import React, { useRef, useEffect, useState } from "react";
import { FieldLayerData, StormCellData, PlaceCountdownData } from "@/lib/api";
import { MapPin, Navigation, Zap, AlertTriangle, CloudRain, Crosshair } from "lucide-react";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lon: number; val: number } | null>(null);

  // Render radar raster & overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fieldData || !fieldData.bounds) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { lat_min, lat_max, lon_min, lon_max, ny, nx } = fieldData.bounds;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Coordinate projection functions
    const lonToX = (lon: number) => ((lon - lon_min) / (lon_max - lon_min)) * width;
    const latToY = (lat: number) => (1.0 - (lat - lat_min) / (lat_max - lat_min)) * height;

    // 1. Draw raster layer (reflectivity / rain rate / IR)
    if (activeLayers.radar && fieldData.data && fieldData.data.length > 0) {
      const imgData = ctx.createImageData(width, height);
      const gridData = fieldData.data;
      const maskData = fieldData.radar_coverage_mask;

      for (let y = 0; y < height; y++) {
        const gridY = Math.min(ny - 1, Math.floor((y / height) * ny));
        for (let x = 0; x < width; x++) {
          const gridX = Math.min(nx - 1, Math.floor((x / width) * nx));
          const val = gridData[gridY] ? gridData[gridY][gridX] || 0 : 0;
          const isCovered = maskData && maskData[gridY] ? maskData[gridY][gridX] === 1 : true;

          const pixelIdx = (y * width + x) * 4;

          if (fieldData.field_type === "reflectivity") {
            // Reflectivity color ramp
            if (val >= 15 && isCovered) {
              const [r, g, b, a] = getDbzColor(val);
              imgData.data[pixelIdx] = r;
              imgData.data[pixelIdx + 1] = g;
              imgData.data[pixelIdx + 2] = b;
              imgData.data[pixelIdx + 3] = a;
            } else if (!isCovered && activeLayers.hatchedZone) {
              // Subtle background for satellite-only zone
              imgData.data[pixelIdx + 3] = 0;
            }
          } else if (fieldData.field_type === "rain_rate") {
            // Rain rate color ramp (mm/h)
            if (val >= 1.0) {
              const [r, g, b, a] = getRainRateColor(val);
              imgData.data[pixelIdx] = r;
              imgData.data[pixelIdx + 1] = g;
              imgData.data[pixelIdx + 2] = b;
              imgData.data[pixelIdx + 3] = a;
            }
          } else if (fieldData.field_type === "ir_temperature") {
            // Cold cloud top infrared colors (< 245 K)
            if (val < 265.0) {
              const [r, g, b, a] = getIrColor(val);
              imgData.data[pixelIdx] = r;
              imgData.data[pixelIdx + 1] = g;
              imgData.data[pixelIdx + 2] = b;
              imgData.data[pixelIdx + 3] = a;
            }
          } else {
            // Hazard probability ramp (0 to 1)
            if (val > 0.15) {
              imgData.data[pixelIdx] = 242;
              imgData.data[pixelIdx + 1] = 140;
              imgData.data[pixelIdx + 2] = 40;
              imgData.data[pixelIdx + 3] = Math.min(240, Math.floor(val * 255));
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // 2. Draw 250 km Radar Coverage Ring
    if (activeLayers.coverageRing) {
      // Center radar approx
      const centerLat = (lat_min + lat_max) / 2;
      const centerLon = (lon_min + lon_max) / 2;
      const cX = lonToX(centerLon);
      const cY = latToY(centerLat);
      const radiusPx = ((220 / 111) / (lat_max - lat_min)) * height;

      ctx.save();
      ctx.strokeStyle = "rgba(0, 112, 192, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(cX, cY, radiusPx, 0, 2 * Math.PI);
      ctx.stroke();

      // Range labels (100 km, 200 km)
      ctx.fillStyle = "rgba(0, 112, 192, 0.6)";
      ctx.font = "10px JetBrains Mono";
      ctx.fillText("250 km DWR Range Limit", cX - 60, cY - radiusPx + 14);
      ctx.restore();
    }
  }, [fieldData, activeLayers]);

  // Click on map to drop pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !fieldData || !fieldData.bounds) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { lat_min, lat_max, lon_min, lon_max } = fieldData.bounds;
    const clickLon = lon_min + (x / rect.width) * (lon_max - lon_min);
    const clickLat = lat_max - (y / rect.height) * (lat_max - lat_min);

    onMapClickPin(round(clickLat, 4), round(clickLon, 4));
  };

  const lonToPercent = (lon: number) => {
    if (!fieldData?.bounds) return 50;
    const { lon_min, lon_max } = fieldData.bounds;
    return ((lon - lon_min) / (lon_max - lon_min)) * 100;
  };

  const latToPercent = (lat: number) => {
    if (!fieldData?.bounds) return 50;
    const { lat_min, lat_max } = fieldData.bounds;
    return (1.0 - (lat - lat_min) / (lat_max - lat_min)) * 100;
  };

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="relative w-full h-full bg-[#050811] overflow-hidden select-none cursor-crosshair group"
    >
      {/* Background Geo Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Raster Canvas */}
      <canvas
        ref={canvasRef}
        width={720}
        height={560}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hatched Pattern Overlay for Satellite-only zone */}
      {activeLayers.hatchedZone && (
        <div className="absolute top-2 right-2 pointer-events-none px-2.5 py-1 rounded bg-panel/85 border border-white/10 text-[11px] text-slate-400 font-mono flex items-center space-x-1.5 backdrop-blur-sm">
          <div className="w-3 h-3 border border-white/30 hatched-satellite-zone" />
          <span>Hatched: Satellite & Lightning (~4 km lower confidence)</span>
        </div>
      )}

      {/* SVG Vector Overlays: Storm Cell Forecast Tracks & Uncertainty Ellipses */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {activeLayers.tracks &&
          cells.map((cell) => {
            const startX = lonToPercent(cell.lon);
            const startY = latToPercent(cell.lat);
            return (
              <g key={`track-${cell.cell_id}`}>
                {/* Track points & uncertainty ellipses */}
                {cell.forecast_track.map((pt, i) => {
                  const ptX = lonToPercent(pt.lon);
                  const ptY = latToPercent(pt.lat);
                  const isSelected = selectedCellId === cell.cell_id;
                  return (
                    <g key={`pt-${i}`}>
                      <line
                        x1={`${i === 0 ? startX : lonToPercent(cell.forecast_track[i - 1].lon)}%`}
                        y1={`${i === 0 ? startY : latToPercent(cell.forecast_track[i - 1].lat)}%`}
                        x2={`${ptX}%`}
                        y2={`${ptY}%`}
                        stroke={isSelected ? "#F28C28" : "rgba(242, 140, 40, 0.45)"}
                        strokeWidth={isSelected ? 2 : 1.2}
                        strokeDasharray="4 4"
                      />
                      {/* Uncertainty Ellipse (+30 and +60 min) */}
                      {(pt.lead_minutes === 30 || pt.lead_minutes === 60) && (
                        <ellipse
                          cx={`${ptX}%`}
                          cy={`${ptY}%`}
                          rx={pt.semi_major_km * 1.8}
                          ry={pt.semi_minor_km * 1.8}
                          fill="rgba(242, 140, 40, 0.08)"
                          stroke="rgba(242, 140, 40, 0.4)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      )}
                      <circle
                        cx={`${ptX}%`}
                        cy={`${ptY}%`}
                        r={isSelected ? 3.5 : 2.5}
                        fill="#F28C28"
                      />
                      <text
                        x={`${ptX}%`}
                        y={`${ptY}%`}
                        dx="5"
                        dy="-4"
                        fill="#CBD5E1"
                        fontSize="9"
                        fontFamily="JetBrains Mono"
                      >
                        +{pt.lead_minutes}m
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
      </svg>

      {/* Storm Cell Markers */}
      {cells.map((cell) => {
        const x = lonToPercent(cell.lon);
        const y = latToPercent(cell.lat);
        const isSelected = selectedCellId === cell.cell_id;

        return (
          <div
            key={cell.cell_id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCell(cell.cell_id);
            }}
            style={{ left: `${x}%`, top: `${y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 z-20 ${
              isSelected ? "scale-110 z-30" : ""
            }`}
          >
            <div
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-mono font-bold shadow-lg backdrop-blur-md border ${
                cell.severity === "EXTREME"
                  ? "bg-red-950/80 border-red-500 text-red-200 glow-severe"
                  : cell.severity === "SEVERE"
                  ? "bg-orange-950/80 border-orange-500 text-orange-200"
                  : "bg-blue-950/80 border-blue-500 text-blue-200"
              } ${isSelected ? "ring-2 ring-vajra-orange ring-offset-1 ring-offset-black" : ""}`}
            >
              <Navigation
                className="w-3.5 h-3.5 transition-transform"
                style={{ transform: `rotate(${cell.direction_deg}deg)` }}
              />
              <span>{cell.cell_id}</span>
              <span className="text-[10px] opacity-80">{Math.round(cell.max_dbz)}dBZ</span>
            </div>
          </div>
        );
      })}

      {/* Monitored Place Pins (Airports, Towns, River Valleys) */}
      {activeLayers.airports &&
        countdowns.map((place) => {
          const x = lonToPercent(place.lon);
          const y = latToPercent(place.lat);

          return (
            <div
              key={place.place_code}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-10 group/place cursor-pointer"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border ${
                  place.approaching
                    ? "bg-amber-400 border-white animate-ping"
                    : "bg-slate-400 border-slate-700"
                }`}
              />
              <div className="absolute left-3 top-[-8px] whitespace-nowrap bg-panel/90 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300 pointer-events-none group-hover/place:text-white group-hover/place:border-vajra-orange/50 transition-colors">
                <span className="font-semibold text-white">{place.place_code}</span>{" "}
                <span className="text-[9px] text-slate-400">{place.place_name}</span>
                {place.approaching && (
                  <span className="ml-1 text-vajra-orange font-bold font-mono">
                    {place.countdown_display}
                  </span>
                )}
              </div>
            </div>
          );
        })}

      {/* User Pinned Location */}
      {pinnedLocation && (
        <div
          style={{
            left: `${lonToPercent(pinnedLocation.lon)}%`,
            top: `${latToPercent(pinnedLocation.lat)}%`,
          }}
          className="absolute -translate-x-1/2 -translate-y-full z-40 pointer-events-none animate-bounce"
        >
          <div className="flex flex-col items-center">
            <div className="bg-vajra-orange text-slate-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-lg">
              {pinnedLocation.name || `${pinnedLocation.lat.toFixed(2)}°N, ${pinnedLocation.lon.toFixed(2)}°E`}
            </div>
            <MapPin className="w-6 h-6 text-vajra-orange fill-current drop-shadow-md" />
          </div>
        </div>
      )}

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 pointer-events-none bg-panel/90 border border-panel-border px-3 py-2 rounded-lg text-xs font-mono backdrop-blur-md">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
          {fieldData?.field_type.toUpperCase()} ({fieldData?.unit})
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-slate-400">15</span>
          <div className="w-32 h-2.5 rounded bg-gradient-to-r from-blue-500 via-green-400 via-yellow-400 via-orange-500 to-purple-600" />
          <span className="text-[10px] text-slate-400">65+</span>
        </div>
      </div>
    </div>
  );
}

// Color scale helpers
function getDbzColor(dbz: number): [number, number, number, number] {
  if (dbz >= 60) return [168, 85, 247, 240]; // Purple (hail)
  if (dbz >= 55) return [220, 38, 38, 230];  // Deep Red
  if (dbz >= 50) return [239, 68, 68, 220];  // Red
  if (dbz >= 45) return [249, 115, 22, 210]; // Orange
  if (dbz >= 40) return [234, 179, 8, 190];  // Amber/Yellow
  if (dbz >= 30) return [34, 197, 94, 160];  // Green
  if (dbz >= 20) return [56, 189, 248, 130]; // Light Blue
  return [30, 58, 138, 80];                  // Dark Blue
}

function getRainRateColor(r: number): [number, number, number, number] {
  if (r >= 100) return [30, 136, 229, 255]; // Cloudburst Blue
  if (r >= 60) return [220, 38, 38, 230];
  if (r >= 35) return [249, 115, 22, 210];
  if (r >= 15) return [234, 179, 8, 180];
  if (r >= 5) return [34, 197, 94, 150];
  return [56, 189, 248, 100];
}

function getIrColor(k: number): [number, number, number, number] {
  if (k < 205) return [236, 72, 153, 240]; // Deep overshooting top (Magenta)
  if (k < 215) return [168, 85, 247, 220]; // Purple
  if (k < 225) return [239, 68, 68, 200];  // Red
  if (k < 235) return [249, 115, 22, 180]; // Orange
  if (k < 250) return [234, 179, 8, 140];  // Yellow
  return [71, 85, 105, 70];
}

function round(val: number, decimals: number) {
  return Number(val.toFixed(decimals));
}
