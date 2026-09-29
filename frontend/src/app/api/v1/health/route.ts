import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    system: "VAJRA (वज्र) Real-Time Convective Nowcasting",
    team: "CodeX_2026",
    problem_statement: "26084 (Convective scale nowcasting 0-6 h)",
    label: "Guidance for IMD forecasters — not a public warning",
    active_region: "kolkata",
    available_regions: ["kolkata", "uttarakhand", "delhi", "mumbai", "bengaluru"],
  });
}
