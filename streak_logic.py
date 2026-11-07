"""Streak calculation from recorded activity dates. Mirrors the frontend rules in streak.js."""
from datetime import date, timedelta


def compute_streaks(activity_dates: set[date], today: date) -> tuple[int, int]:
    """Return (current_streak, longest_streak).

    The current streak counts back from today, or from yesterday if today has no activity yet,
    so a streak is not lost before the user's day has finished.
    """
    if not activity_dates:
        return 0, 0

    cursor = None
    if today in activity_dates:
        cursor = today
    elif today - timedelta(days=1) in activity_dates:
        cursor = today - timedelta(days=1)

    current = 0
    while cursor is not None and cursor in activity_dates:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    previous = None
    for day in sorted(activity_dates):
        run = run + 1 if previous is not None and day == previous + timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return current, longest
