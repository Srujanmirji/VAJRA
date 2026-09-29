import { NextRequest, NextResponse } from "next/server";
import { getVerificationData } from "@/lib/mockData";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "kolkata";
  return NextResponse.json(getVerificationData(region));
}
