import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "kolkata";
  return NextResponse.json({
    region,
    provenance: "VERIFICATION_DERIVED",
    label: "Guidance for IMD forecasters — not a public warning",
    rows: [
      {
        lead_time_range: "0–1 hour (0–60 min)",
        radar_confidence: "HIGH",
        satellite_confidence: "MEDIUM",
        lightning_confidence: "HIGH",
        recommended_action: "Tactical local warning; airport runway alert; precise countdowns valid",
      },
      {
        lead_time_range: "1–2 hours (60–120 min)",
        radar_confidence: "MEDIUM",
        satellite_confidence: "MEDIUM",
        lightning_confidence: "MEDIUM",
        recommended_action: "District-scale advisory; probabilistic arrival window; ensemble envelope",
      },
      {
        lead_time_range: "2–6 hours (120–360 min)",
        radar_confidence: "LOW / INFORMATIVE",
        satellite_confidence: "LOW",
        lightning_confidence: "LOW",
        recommended_action: "Regional synoptic watch; blended NWP model guidance; no point countdowns",
      },
    ],
  });
}
