import numpy as np
from datetime import datetime, timezone
from app.blend.weights import skill_weights, blend
from app.alerts.cap import build_cap


def test_weights_sum_to_one_and_respect_floor():
    w = skill_weights({"nowcast": 0.9, "nwp": 0.1}, floor=0.2)
    assert abs(sum(w.values()) - 1) < 1e-9 and min(w.values()) >= 0.2 - 1e-9


def test_blend_shapes():
    f = {"a": np.ones((2, 2)), "b": np.zeros((2, 2))}
    assert np.allclose(blend(f, {"a": 0.25, "b": 0.75}), 0.25)


def test_cap_is_valid_xml_and_closed_polygon():
    import xml.etree.ElementTree as ET
    xml = build_cap("vajra-1", "Thunderstorm with hail", "Kolkata area",
                    [(22.5, 88.3), (22.7, 88.3), (22.7, 88.5)], 0.7,
                    datetime(2026, 5, 1, 12, 35, tzinfo=timezone.utc))
    root = ET.fromstring(xml)
    ns = {"c": "urn:oasis:names:tc:emergency:cap:1.2"}
    poly = root.find(".//c:polygon", ns).text.split()
    assert poly[0] == poly[-1]
    assert root.find(".//c:certainty", ns).text == "Likely"
