# =============================================================================
# metrics.py  -  OBSERVABILITY
#
# WHY THIS FILE EXISTS
# --------------------
# The course slides list five technical requirements for GlobeTrotter, and
# one of them is: "Must be observable (metrics, logging, tracing)".
#
# "Observable" just means: can you tell what your system is doing while it
# is running, without guessing? If a page feels slow, can you prove which
# endpoint is slow and by how much? Without measurements you are debugging
# by feel.
#
# So this file does two small things:
#
#   1. MIDDLEWARE - a piece of code that FastAPI runs around EVERY request.
#      Think of it as a stopwatch: start it when a request comes in, stop
#      it when the response goes out, and write down how long it took.
#
#   2. A SUMMARY - it keeps those timings in memory so /metrics can report
#      totals, averages, error counts and the slowest endpoints.
#
# WHY IT MATTERS FOR THE PROJECT
# ------------------------------
# Phase 1 is deliberately a monolith storing data in one JSON file. The
# whole point of the phase is to FEEL its limits. With this file you can
# actually see them: run scripts/load_test.py, watch the p95 response time
# climb as concurrent users increase, and you have hard evidence for why
# Phase 2 (microservices) and Phase 4 (caching, queues) are needed.
#
# WHAT IS "p95"?
# --------------
# If you sort every response time from fastest to slowest, the p95 is the
# value 95% of requests were faster than. It is a better measure than the
# average, because one very slow request can hide behind a nice average.
# Real engineering teams watch p95 and p99, not the mean.
#
# NOTE ON STORAGE: everything here lives in memory (a plain Python list).
# Restart the server and the numbers reset. That is fine for Phase 1 - in
# a real system these would be shipped to Prometheus, Grafana or
# CloudWatch, which is exactly the sort of thing Phase 4 introduces.
# =============================================================================

import time
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock

# How many individual request records we keep. We cap it so a long-running
# server can't slowly eat all the machine's memory.
MAX_SAMPLES = 5000

# The moment the server started, used to report uptime.
_STARTED_AT = time.time()

# Our in-memory store of recent requests. Each entry looks like:
#   {"route": "GET /destinations", "ms": 12.4, "status": 200, "at": "..."}
_samples: list[dict] = []

# Same lock idea as storage.py: several requests can finish at the exact
# same moment, and two threads appending to the same list at once can
# corrupt it. The lock makes sure only one thread writes at a time.
_lock = Lock()


def record(route: str, status_code: int, duration_ms: float) -> None:
    """Save one request's result. Called by the middleware below."""
    with _lock:
        _samples.append(
            {
                "route": route,
                "ms": round(duration_ms, 2),
                "status": status_code,
                "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        )
        # Keep only the most recent MAX_SAMPLES entries.
        if len(_samples) > MAX_SAMPLES:
            del _samples[: len(_samples) - MAX_SAMPLES]


def _percentile(sorted_values: list[float], percent: float) -> float:
    """Return the value at a given percentile of an already-sorted list.

    Example: _percentile([10, 20, 30, 40], 95) -> 40
    We use the simple 'nearest rank' method, which is plenty for a class
    project and easy to explain in a presentation.
    """
    if not sorted_values:
        return 0.0
    index = min(int(round(percent / 100 * len(sorted_values) + 0.5)) - 1, len(sorted_values) - 1)
    return sorted_values[max(index, 0)]


def snapshot() -> dict:
    """Build the summary that GET /metrics returns.

    Everything is computed on demand from the samples list, so there is no
    background job to run and nothing to keep in sync.
    """
    with _lock:
        samples = list(_samples)  # copy, so we can release the lock quickly

    total = len(samples)
    errors = [s for s in samples if s["status"] >= 400]
    durations = sorted(s["ms"] for s in samples)

    # Group timings per route so we can show which endpoints are slowest.
    per_route_times: dict[str, list[float]] = defaultdict(list)
    per_route_errors: dict[str, int] = defaultdict(int)
    for s in samples:
        per_route_times[s["route"]].append(s["ms"])
        if s["status"] >= 400:
            per_route_errors[s["route"]] += 1

    routes = []
    for route, times in per_route_times.items():
        ordered = sorted(times)
        routes.append(
            {
                "route": route,
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "p95_ms": round(_percentile(ordered, 95), 2),
                "max_ms": round(ordered[-1], 2),
                "errors": per_route_errors[route],
            }
        )
    # Slowest endpoints first - that's what you actually want to look at.
    routes.sort(key=lambda r: r["p95_ms"], reverse=True)

    uptime_seconds = int(time.time() - _STARTED_AT)

    return {
        "uptime_seconds": uptime_seconds,
        "uptime_human": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s",
        "total_requests": total,
        "error_count": len(errors),
        # Guard against dividing by zero when no request has been served yet.
        "error_rate_percent": round(len(errors) / total * 100, 2) if total else 0.0,
        "avg_ms": round(sum(durations) / total, 2) if total else 0.0,
        "p50_ms": round(_percentile(durations, 50), 2),
        "p95_ms": round(_percentile(durations, 95), 2),
        "p99_ms": round(_percentile(durations, 99), 2),
        "max_ms": round(durations[-1], 2) if durations else 0.0,
        "routes": routes,
        # The last 40 requests, newest first - handy for a live view.
        "recent": list(reversed(samples[-40:])),
        "sample_window": MAX_SAMPLES,
        "note": (
            "Metrics are held in memory and reset when the server restarts. "
            "Phase 1 has no metrics database - that is one of the monolith's limits."
        ),
    }


def reset() -> None:
    """Wipe all collected samples. Used by the dashboard's reset button and
    by the tests, so one test's requests don't pollute another's numbers."""
    with _lock:
        _samples.clear()


async def metrics_middleware(request, call_next):
    """Runs around every single request.

    FastAPI hands us the incoming `request` and a function `call_next`
    that actually runs the rest of the app. So the shape is always:

        start stopwatch
        response = await call_next(request)   <- the real work happens here
        stop stopwatch and record it
        return response

    If the endpoint raises an exception we still record it (as a 500) and
    then re-raise, so a crash never disappears silently from the metrics.
    """
    started = time.perf_counter()

    # request.scope["route"] only exists after routing, so we build the
    # label from the method and path. We use the path template where we
    # can (e.g. "/destinations/{destination_id}") so that a thousand
    # different ids don't create a thousand different metric rows.
    method = request.method

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started) * 1000
        record(f"{method} {request.url.path}", 500, duration_ms)
        raise

    duration_ms = (time.perf_counter() - started) * 1000

    route = request.scope.get("route")
    path_template = getattr(route, "path", request.url.path)
    record(f"{method} {path_template}", response.status_code, duration_ms)

    # A nice extra: send the timing back in a response header, so you can
    # see it in your browser's Network tab without opening the dashboard.
    response.headers["X-Response-Time-ms"] = f"{duration_ms:.2f}"
    return response
