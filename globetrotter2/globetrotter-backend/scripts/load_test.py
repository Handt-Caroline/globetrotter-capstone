#!/usr/bin/env python3
# =============================================================================
# scripts/load_test.py  -  PROVE THE MONOLITH'S LIMITS
#
# WHAT THIS SCRIPT IS FOR
# -----------------------
# The lecture slides say Phase 1 exists so you EXPERIENCE the limits of a
# monolith rather than memorise them. This script produces the evidence.
#
# It pretends to be many users at once and measures how the server copes.
# Then it does the same thing again with more users, and again with more,
# so you can watch the response times climb.
#
# WHAT YOU SHOULD SEE
# -------------------
# 1. READS (GET /destinations) stay fairly quick, because reading a file
#    is cheap and many requests can read at the same time.
# 2. WRITES (creating itineraries) get much slower as users increase. Why?
#    Look at backend/app/storage.py: every write takes a LOCK, loads the
#    WHOLE db.json into memory, edits it, and writes the WHOLE file back.
#    Only one write can happen at a time, so writers queue up behind each
#    other. That is the "JSON files are not designed for concurrent access"
#    line from the slides, turned into a number you can put on a slide.
#
# WHY THIS MATTERS LATER
# ----------------------
# Phase 2 splits the app into services, Phase 3 runs several copies behind
# a load balancer, Phase 4 adds caching and queues. Each of those is an
# answer to a problem this script measures. Run it again after each phase
# and you have a before/after story - which is exactly what makes a good
# final presentation.
#
# HOW TO RUN IT
# -------------
#   1. Start the server in one terminal:   uvicorn app.main:app --port 8000
#   2. In another terminal:                python scripts/load_test.py
#
# Options:
#   python scripts/load_test.py --url http://localhost:8000 --requests 60
#
# It only uses Python's standard library, so there is nothing to install.
# =============================================================================

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor


def call(url: str, method: str = "GET", body: dict | None = None, token: str | None = None):
    """Make one HTTP request and return (status_code, seconds_taken, parsed_json).

    We use urllib from the standard library rather than the `requests`
    package so this script runs anywhere with no pip install.
    """
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")

    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
            elapsed = time.perf_counter() - started
            parsed = json.loads(payload) if payload else None
            return response.status, elapsed, parsed
    except urllib.error.HTTPError as error:
        return error.code, time.perf_counter() - started, None
    except Exception:
        # Connection refused, timeout, etc. Reported as 0 so it stands out.
        return 0, time.perf_counter() - started, None


def percentile(values: list[float], percent: float) -> float:
    """The value that `percent`% of measurements were faster than.

    p95 is the number engineers actually watch: an average can look healthy
    while one user in twenty is having a terrible time.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(int(round(percent / 100 * len(ordered) + 0.5)) - 1, len(ordered) - 1)
    return ordered[max(index, 0)]


def summarise(label: str, timings: list[float], failures: int) -> None:
    """Print one tidy result line for a batch of requests."""
    if not timings:
        print(f"  {label:<26} no successful requests ({failures} failed)")
        return
    print(
        f"  {label:<26} "
        f"avg {statistics.mean(timings) * 1000:7.1f} ms | "
        f"p95 {percentile(timings, 95) * 1000:7.1f} ms | "
        f"max {max(timings) * 1000:7.1f} ms | "
        f"failed {failures}"
    )


def run_concurrently(task, times: int, workers: int):
    """Run `task` `times` times, with `workers` of them happening at once.

    A ThreadPoolExecutor is Python's simple way of doing several things in
    parallel. Each thread here is standing in for one user of the app.
    """
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(lambda _: task(), range(times)))


def main() -> None:
    parser = argparse.ArgumentParser(description="Load-test the GlobeTrotter monolith")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the API")
    parser.add_argument("--requests", type=int, default=60, help="Requests per round")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    print("=" * 74)
    print(" GlobeTrotter Phase 1 - monolith load test")
    print(f" Target: {base}   |   {args.requests} requests per round")
    print("=" * 74)

    # --- Is the server even up? ------------------------------------------
    status, _, _ = call(f"{base}/health")
    if status != 200:
        print("\n Server is not responding. Start it first:")
        print("   cd backend && uvicorn app.main:app --port 8000\n")
        return

    # Clear previous numbers so the dashboard shows only this test.
    call(f"{base}/metrics/reset", method="POST")

    # --- We need one logged-in user to test writes -----------------------
    email = f"loadtest_{uuid.uuid4().hex[:8]}@example.cm"
    _, _, registration = call(
        f"{base}/auth/register",
        method="POST",
        body={"name": "Load Tester", "email": email, "password": "SuperSecret123"},
    )
    token = registration["access_token"]
    _, _, destinations = call(f"{base}/destinations")
    destination_id = destinations[0]["id"]

    # --- Round after round, with more simulated users each time ----------
    for concurrent_users in (1, 5, 10, 25, 50):
        print(f"\n {concurrent_users} simultaneous users")

        # READ test: everybody browses the destination list.
        read_results = run_concurrently(
            lambda: call(f"{base}/destinations"), args.requests, concurrent_users
        )
        read_times = [t for s, t, _ in read_results if s == 200]
        summarise("GET /destinations (read)", read_times, len(read_results) - len(read_times))

        # WRITE test: everybody saves an itinerary at the same moment.
        # This is where the single JSON file becomes the bottleneck.
        def write_once():
            return call(
                f"{base}/itineraries",
                method="POST",
                token=token,
                body={
                    "title": f"Load test {uuid.uuid4().hex[:6]}",
                    "date": "2026-09-20",
                    "stops": [{"destination_id": destination_id, "order": 0}],
                },
            )

        write_results = run_concurrently(write_once, args.requests, concurrent_users)
        write_times = [t for s, t, _ in write_results if s in (200, 201)]
        summarise("POST /itineraries (write)", write_times, len(write_results) - len(write_times))

    # --- What the server itself recorded ---------------------------------
    _, _, metrics = call(f"{base}/metrics")
    if metrics:
        print("\n" + "=" * 74)
        print(" Server-side view (same numbers, measured inside the app)")
        print("=" * 74)
        print(f"  Total requests : {metrics['total_requests']}")
        print(f"  Error rate     : {metrics['error_rate_percent']}%")
        print(f"  p50 / p95 / p99: {metrics['p50_ms']} / {metrics['p95_ms']} / {metrics['p99_ms']} ms")
        print("\n  Slowest endpoints:")
        for route in metrics["routes"][:5]:
            print(f"    {route['route']:<42} p95 {route['p95_ms']:>8.1f} ms  ({route['count']} calls)")

    print(
        "\n WHAT TO TAKE FROM THIS\n"
        " ----------------------\n"
        " Reads scale reasonably. Writes do not: every write locks the whole\n"
        " database file and rewrites it, so writers queue behind each other and\n"
        " p95 climbs sharply as users increase. There is also only ONE server -\n"
        " if it dies, everything dies.\n\n"
        " Those two sentences are the argument for Phase 2 (split the services),\n"
        " Phase 3 (run several copies behind a load balancer) and Phase 4\n"
        " (cache reads, queue writes). Re-run this script after each phase and\n"
        " compare the numbers.\n"
    )


if __name__ == "__main__":
    main()
