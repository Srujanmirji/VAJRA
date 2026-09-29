import { NextRequest, NextResponse } from "next/server";
import { getCycleLatestData } from "@/lib/mockData";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "kolkata";
  return NextResponse.json(getCycleLatestData(region));
}
