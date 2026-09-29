import { NextRequest, NextResponse } from "next/server";
import { activeAlertsStore } from "@/lib/mockData";

export async function POST(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  const alert = activeAlertsStore.find((a) => a.alert_id === params.alertId);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason") || "Forecaster decision: sub-severe echo";

  alert.approval_status = "REJECTED";

  return NextResponse.json({
    status: "REJECTED",
    alert_id: alert.alert_id,
    reason,
  });
}
