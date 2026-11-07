from datetime import date, timedelta

from streak_logic import compute_streaks

TODAY = date(2026, 10, 15)


def test_no_activity_is_zero():
    assert compute_streaks(set(), TODAY) == (0, 0)


def test_streak_includes_today():
    days = {TODAY - timedelta(days=i) for i in range(3)}
    assert compute_streaks(days, TODAY) == (3, 3)


def test_streak_survives_until_today_is_studied():
    days = {TODAY - timedelta(days=i) for i in range(1, 4)}
    assert compute_streaks(days, TODAY) == (3, 3)


def test_streak_breaks_after_a_missed_day():
    days = {TODAY - timedelta(days=2), TODAY - timedelta(days=3)}
    assert compute_streaks(days, TODAY) == (0, 2)


def test_longest_streak_can_exceed_current():
    old = {date(2026, 1, d) for d in range(1, 11)}
    recent = {TODAY, TODAY - timedelta(days=1)}
    assert compute_streaks(old | recent, TODAY) == (2, 10)
