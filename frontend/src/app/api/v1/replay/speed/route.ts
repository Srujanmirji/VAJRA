import { NextRequest, NextResponse } from "next/server";
import { globalSimState } from "@/lib/mockData";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const speed = parseFloat(searchParams.get("speed") || "10.0");
  globalSimState.speed = speed;
  return NextResponse.json({ status: "ok", speed });
}
