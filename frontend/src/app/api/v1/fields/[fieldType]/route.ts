import { NextRequest, NextResponse } from "next/server";
import { getFieldData } from "@/lib/mockData";

export async function GET(
  req: NextRequest,
  { params }: { params: { fieldType: string } }
) {
  const { searchParams } = new URL(req.url);
  const lead = parseInt(searchParams.get("lead") || "0");
  const region = searchParams.get("region") || "kolkata";
  const downsample = parseInt(searchParams.get("downsample") || "1");

  return NextResponse.json(getFieldData(params.fieldType, lead, region, downsample));
}
