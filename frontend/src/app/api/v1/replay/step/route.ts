import { NextRequest, NextResponse } from "next/server";
import { globalSimState, getCycleLatestData } from "@/lib/mockData";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "kolkata";
  globalSimState.stepIndex = (globalSimState.stepIndex + 1) % 12;
  return NextResponse.json({
    status: "ok",
    action: "step",
    step_index: globalSimState.stepIndex,
    cycle: getCycleLatestData(region),
  });
}
