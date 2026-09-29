import { NextResponse } from "next/server";
import { globalSimState } from "@/lib/mockData";

export async function POST() {
  globalSimState.isPlaying = false;
  return NextResponse.json({ status: "paused" });
}
