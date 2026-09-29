"""Common Alerting Protocol (CAP 1.2) Generator and Multi-lingual SMS/IVR Dispatcher.
STRICT HONESTY RULE:
All alerts are drafts marked "Pending IMD approval" and are guidance for IMD forecasters,
never public warnings by themselves.
Supports: English, Hindi, Bengali, Kannada.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any, Optional
from xml.sax.saxutils import escape


def certainty_from_probability(p: float) -> str:
    return "Observed" if p >= 0.85 else "Likely" if p >= 0.50 else "Possible" if p >= 0.20 else "Unlikely"


def build_cap(
    identifier: str,
    event: str,
    headline: str,
    polygon: list[tuple[float, float]],
    probability: float,
    onset: datetime,
    severity: str = "Severe",
    urgency: str = "Immediate",
    sender: str = "vajra-forecaster-guidance@ncmrwf.gov.in",
) -> str:
    """Return a CAP 1.2 XML string. Polygon is a list of (lat, lon) and is closed automatically."""
    if len(polygon) > 0 and polygon[0] != polygon[-1]:
        polygon = polygon + [polygon[0]]
    poly = " ".join(f"{lat},{lon}" for lat, lon in polygon)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    onset_s = onset.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    expires_s = (onset + timedelta(hours=2)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

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
    <expires>{expires_s}</expires>
    <headline>{escape(headline)}</headline>
    <description>Guidance for IMD forecasters. Convective scale nowcasting (0-6h). Probability {probability:.0%}. Pending IMD approval.</description>
    <instruction>Take immediate sheltering precautions against lightning, severe gusts and sudden torrential inundation. Awaiting IMD duty forecaster authorization.</instruction>
    <area>
      <areaDesc>{escape(headline)}</areaDesc>
      <polygon>{poly}</polygon>
    </area>
  </info>
</alert>"""


@dataclass
class AlertPayload:
    """In-memory alert record with forecaster review status and multilingual text."""
    alert_id: str
    event: str
    headline: str
    severity: str  # Moderate, Severe, Extreme
    urgency: str
    probability: float
    onset: datetime
    polygon: List[Tuple[float, float]]
    approval_status: str = "PENDING_IMD_APPROVAL"  # PENDING_IMD_APPROVAL, APPROVED, REJECTED
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    cap_xml: str = ""
    sms_text: Dict[str, str] = field(default_factory=dict)
    ivr_text: Dict[str, str] = field(default_factory=dict)


def generate_multilingual_messages(
    event: str,
    place_name: str,
    eta_min: int,
    probability_pct: int,
    hazard_type: str,
) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Generates localized SMS and IVR voice scripts in EN, HI, BN, KN."""
    # English
    sms_en = (
        f"VAJRA ALERT [IMD Guidance]: Severe {hazard_type} approaching {place_name}. "
        f"Expected in ~{eta_min} min ({probability_pct}% prob). Seek safe shelter immediately. Dial 1077 for emergency."
    )
    ivr_en = (
        f"Attention. This is a severe weather guidance alert from VAJRA and IMD. "
        f"A severe {hazard_type} is detected approaching {place_name}, expected within {eta_min} minutes. "
        f"Please stay indoors and avoid trees or open metal structures."
    )

    # Hindi (हिन्दी)
    sms_hi = (
        f"वज्र चेतावनी [मौसम विभाग मार्गदर्शन]: {place_name} में {eta_min} मिनट में भारी {hazard_type} की संभावना ({probability_pct}%)। "
        f"तुरंत सुरक्षित पक्के आश्रय में जाएं। आपातकाल के लिए 1077 डायल करें।"
    )
    ivr_hi = (
        f"सावधान। यह मौसम विभाग और वज्र प्रणाली से गंभीर मौसम की चेतावनी है। "
        f"{place_name} की ओर तीव्र {hazard_type} बढ़ रहा है, जिसके अगले {eta_min} मिनट में पहुंचने की संभावना है। "
        f"कृपया तुरंत पक्के घर में शरण लें और खुले मैदान या पेड़ों से दूर रहें।"
    )

    # Bengali (বাংলা)
    sms_bn = (
        f"বজ্র সতর্কতা [আইএমডি নির্দেশিকা]: {place_name}-এ প্রায় {eta_min} মিনিটের মধ্যে তীব্র {hazard_type} আসার সম্ভাবনা ({probability_pct}%)। "
        f"অবিলম্বে নিরাপদ পাকা আশ্রয়ে যান। জরুরি প্রয়োজনে 1077 ডায়াল করুন।"
    )
    ivr_bn = (
        f"মনোযোগ দিন। এটি বজ্র এবং আবহাওয়া দপ্তরের জরুরি পূর্বাভাসের নির্দেশিকা। "
        f"{place_name}-এর দিকে তীব্র {hazard_type} অগ্রসর হচ্ছে, যা আগামী {eta_min} মিনিটের মধ্যে আঘাত হানতে পারে। "
        f"অনুগ্রহ করে নিরাপদ স্থানে থাকুন এবং গাছের নিচে আশ্রয় নেবেন না।"
    )

    # Kannada (ಕನ್ನಡ)
    sms_kn = (
        f"ವಜ್ರ ಮುನ್ಸೂಚನೆ [ಐಎಂಡಿ ಮಾರ್ಗದರ್ಶನ]: {place_name} ಪ್ರದೇಶಕ್ಕೆ ಸುಮಾರು {eta_min} ನಿಮಿಷಗಳಲ್ಲಿ ತೀವ್ರ {hazard_type} ಆಗಮಿಸುವ ಸಂಭವನೀಯತೆ ({probability_pct}%) ಇದೆ. "
        f"ಕೂಡಲೇ ಸುರಕ್ಷಿತ ಆಶ್ರಯ ಪಡೆಯಿರಿ. ತುರ್ತು ಸಹಾಯಕ್ಕೆ 1077 ಕರೆ ಮಾಡಿ."
    )
    ivr_kn = (
        f"ಗಮನಿಸಿ. ಇದು ವಜ್ರ ಮತ್ತು ಭಾರತೀಯ ಹವಾಮಾನ ಇಲಾಖೆಯ ಮುನ್ನೆಚ್ಚರಿಕೆ ಸಂದೇಶ. "
        f"{place_name} ಭಾಗದಲ್ಲಿ ಮುಂದಿನ {eta_min} ನಿಮಿಷಗಳಲ್ಲಿ ತೀವ್ರ {hazard_type} ಬೀಳುವ ಸಾಧ್ಯತೆಯಿದೆ. "
        f"ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಕಟ್ಟಡದ ಒಳಗೆ ಇರಿ ಮತ್ತು ಮರಗಳ ಕೆಳಗೆ ನಿಲ್ಲಬೇಡಿ."
    )

    sms_dict = {"en": sms_en, "hi": sms_hi, "bn": sms_bn, "kn": sms_kn}
    ivr_dict = {"en": ivr_en, "hi": ivr_hi, "bn": ivr_bn, "kn": ivr_kn}
    return sms_dict, ivr_dict


def create_cap_alert(
    alert_id: str,
    event: str,
    place_name: str,
    polygon: List[Tuple[float, float]],
    probability: float,
    onset: datetime,
    eta_min: int = 25,
    severity: str = "Severe",
    hazard_type: str = "Thunderstorm & Hail",
) -> AlertPayload:
    """Constructs a full AlertPayload with valid CAP 1.2 XML and 4-language templates."""
    headline = f"Severe {hazard_type} warning for {place_name}"
    cap_xml = build_cap(
        identifier=alert_id,
        event=event,
        headline=headline,
        polygon=polygon,
        probability=probability,
        onset=onset,
        severity=severity,
    )
    prob_pct = int(round(probability * 100))
    sms, ivr = generate_multilingual_messages(event, place_name, eta_min, prob_pct, hazard_type)

    return AlertPayload(
        alert_id=alert_id,
        event=event,
        headline=headline,
        severity=severity,
        urgency="Immediate",
        probability=probability,
        onset=onset,
        polygon=polygon,
        approval_status="PENDING_IMD_APPROVAL",
        cap_xml=cap_xml,
        sms_text=sms,
        ivr_text=ivr,
    )
