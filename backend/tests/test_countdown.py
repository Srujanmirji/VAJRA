from datetime import datetime, timedelta, timezone
from app.tracking.countdown import arrival_countdown


def test_window_probability_and_countdown():
    t0 = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    c = arrival_countdown([30, 35, 40, 45, 50, 70, None, None], now=t0, issued=t0)
    assert c.window_min[0] < c.window_min[1]
    assert c.p_arrival_60min == 5 / 8
    assert c.countdown_seconds == int(c.window_min[0] * 60)


def test_countdown_never_negative_and_none_when_no_arrival():
    t0 = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    c = arrival_countdown([5, 6, 7], now=t0 + timedelta(minutes=30), issued=t0)
    assert c.countdown_seconds == 0
    assert arrival_countdown([None, None], now=t0, issued=t0) is None
