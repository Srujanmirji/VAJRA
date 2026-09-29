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

  alert.approval_status = "APPROVED";
  alert.approved_by = "IMD_DUTY_FORECASTER";
  alert.approved_at = new Date().toISOString();

  return NextResponse.json({
    status: "APPROVED",
    alert_id: alert.alert_id,
    approved_by: alert.approved_by,
    approved_at: alert.approved_at,
  });
}
