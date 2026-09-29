import { NextRequest, NextResponse } from "next/server";
import { getCountdownsData } from "@/lib/mockData";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "kolkata";
  const place = searchParams.get("place") || undefined;
  return NextResponse.json(getCountdownsData(region, place));
}
