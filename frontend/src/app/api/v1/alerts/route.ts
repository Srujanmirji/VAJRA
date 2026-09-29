import { NextRequest, NextResponse } from "next/server";
import { activeAlertsStore } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json({ alerts: activeAlertsStore });
}
