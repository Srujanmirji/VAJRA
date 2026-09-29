"""Minimal CAP 1.2 alert generation (drafts for IMD approval)."""
from __future__ import annotations
from datetime import datetime, timezone
from xml.sax.saxutils import escape


def certainty_from_probability(p: float) -> str:
    return "Likely" if p >= 0.5 else "Possible" if p >= 0.2 else "Unlikely"


def build_cap(identifier: str, event: str, headline: str, polygon: list[tuple[float, float]],
              probability: float, onset: datetime, severity: str = "Severe",
              urgency: str = "Immediate", sender: str = "vajra@example.org") -> str:
    """Return a CAP 1.2 XML string. Polygon is a list of (lat, lon) and is closed automatically."""
    if polygon[0] != polygon[-1]:
        polygon = polygon + [polygon[0]]
    poly = " ".join(f"{lat},{lon}" for lat, lon in polygon)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    onset_s = onset.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>{escape(identifier)}</identifier>
  <sender>{escape(sender)}</sender>
  <sent>{now}</sent>
  <status>Draft</status>
  <msgType>Alert</msgType>
  <scope>Restricted</scope>
  <info>
    <category>Met</category>
    <event>{escape(event)}</event>
    <urgency>{urgency}</urgency>
    <severity>{severity}</severity>
    <certainty>{certainty_from_probability(probability)}</certainty>
    <onset>{onset_s}</onset>
    <headline>{escape(headline)}</headline>
    <description>Guidance for IMD forecasters. Probability {probability:.0%}. Pending IMD approval.</description>
    <area>
      <areaDesc>{escape(headline)}</areaDesc>
      <polygon>{poly}</polygon>
    </area>
  </info>
</alert>"""
