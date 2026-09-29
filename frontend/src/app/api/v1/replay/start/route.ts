import { NextResponse } from "next/server";
import { globalSimState } from "@/lib/mockData";

export async function POST() {
  globalSimState.isPlaying = true;
  return NextResponse.json({ status: "playing", speed: globalSimState.speed });
}
