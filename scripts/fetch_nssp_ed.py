"""
Fetch NSSP Emergency Department data and produce per-week JSON files
for COVID and influenza percent_visits by HSA and by state.

Usage:
  uv run scripts/fetch_nssp_ed.py            # uses cached download if available
  uv run scripts/fetch_nssp_ed.py --refresh   # force re-download

Output goes to models/public/data/
"""

import argparse
import csv
import io
import json
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

# SODA endpoint supports server-side filtering via $where, unlike the
# /api/views/.../rows.csv export which always returns the full dataset (~110MB).
DATA_HOST = "https://data.cdc.gov/resource/rdmq-nq56.csv"
WEEKS_TO_KEEP = 13  # ~3 months — demo only
CACHE_PATH = Path(__file__).resolve().parent.parent / ".cache" / "nssp_ed_raw.csv"
OUT_DIR = Path(__file__).resolve().parent.parent / "models" / "public" / "data"

METRICS = ["percent_visits_covid", "percent_visits_influenza"]


def data_url() -> str:
    cutoff = (date.today() - timedelta(weeks=WEEKS_TO_KEEP)).isoformat()
    query = urllib.parse.urlencode({
        "$where": f"week_end >= '{cutoff}'",
        "$limit": "500000",
    })
    return f"{DATA_HOST}?{query}"


def fetch_csv(refresh: bool) -> list[dict]:
    if not refresh and CACHE_PATH.exists():
        print(f"Using cached data from {CACHE_PATH}")
        text = CACHE_PATH.read_text()
    else:
        url = data_url()
        print(f"Downloading {url} ...")
        with urllib.request.urlopen(url) as resp:
            text = resp.read().decode("utf-8")
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(text)
        print(f"Cached raw CSV to {CACHE_PATH} ({len(text) / 1024:.0f} KB)")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    # SODA returns timestamps as "YYYY-MM-DDTHH:MM:SS.sss"; legacy export
    # used bare "YYYY-MM-DD". Normalize so downstream filenames and the
    # demo's week URLs stay in the short form.
    for r in rows:
        if "week_end" in r and "T" in r["week_end"]:
            r["week_end"] = r["week_end"].split("T", 1)[0]
    return rows


def main():
    parser = argparse.ArgumentParser(description="Fetch and process NSSP ED data")
    parser.add_argument("--refresh", action="store_true", help="Force re-download (ignore cache)")
    args = parser.parse_args()

    rows = fetch_csv(args.refresh)

    # State-level: county == "All" and hsa_nci_id == "All"
    state_rows = [r for r in rows if r["county"] == "All" and r["hsa_nci_id"] == "All"]
    print(f"State-level rows: {len(state_rows)}")

    # HSA-level: deduplicate by (hsa_nci_id, week_end), skip "All"
    seen_hsa: set[tuple[str, str]] = set()
    hsa_rows: list[dict] = []
    for r in rows:
        if r["county"] == "All" or r["hsa_nci_id"] == "All":
            continue
        key = (r["hsa_nci_id"], r["week_end"])
        if key not in seen_hsa:
            seen_hsa.add(key)
            hsa_rows.append(r)
    print(f"HSA-level rows (deduplicated): {len(hsa_rows)}")

    weeks = sorted(set(r["week_end"] for r in state_rows))
    print(f"Weeks: {weeks[0]} to {weeks[-1]} ({len(weeks)} total)")

    # Group rows by week
    state_by_week: dict[str, list[dict]] = {w: [] for w in weeks}
    for r in state_rows:
        state_by_week[r["week_end"]].append(r)

    hsa_by_week: dict[str, list[dict]] = {w: [] for w in weeks}
    for r in hsa_rows:
        w = r["week_end"]
        if w in hsa_by_week:
            hsa_by_week[w].append(r)

    # Write per-week JSON files: { state: { covid, influenza }, hsa: { covid, influenza } }
    weeks_dir = OUT_DIR / "weeks"
    weeks_dir.mkdir(parents=True, exist_ok=True)

    def extract_metrics(r: dict) -> dict[str, float | None]:
        return {
            m.replace("percent_visits_", ""): round(float(r[m]), 1) if r[m] else None
            for m in METRICS
        }

    for week in weeks:
        week_data: dict = {"state": {}, "hsa": {}}
        for r in state_by_week[week]:
            week_data["state"][r["geography"]] = extract_metrics(r)
        for r in hsa_by_week[week]:
            week_data["hsa"][r["hsa_nci_id"]] = extract_metrics(r)

        week_path = weeks_dir / f"{week}.json"
        week_path.write_text(json.dumps(week_data, separators=(",", ":")))

    print(f"Wrote {len(weeks)} week files to {weeks_dir}")

    # Write manifest
    manifest = {"weeks": weeks}
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"Wrote {manifest_path}")

    # Write county FIPS -> HSA NCI ID mapping
    # Must iterate all rows (not hsa_rows) since hsa_rows is deduplicated per HSA,
    # dropping sibling counties that share the same HSA.
    fips_to_nci: dict[str, str] = {}
    for r in rows:
        fips = r["fips"]
        if not fips or r["county"] == "All" or r["hsa_nci_id"] == "All":
            continue
        fips_to_nci.setdefault(fips.zfill(5), r["hsa_nci_id"])
    fips_path = OUT_DIR / "fips_to_hsa_nci.json"
    fips_path.write_text(json.dumps(fips_to_nci, separators=(",", ":")))
    print(f"Wrote {fips_path} ({len(fips_to_nci)} counties)")

    # Write HSA metadata
    seen_meta: set[str] = set()
    meta_rows: list[dict] = []
    for r in hsa_rows:
        hsa_id = r["hsa_nci_id"]
        if hsa_id not in seen_meta:
            seen_meta.add(hsa_id)
            meta_rows.append({
                "hsa_nci_id": hsa_id,
                "hsa": r["hsa"],
                "geography": r["geography"],
                "hsa_counties": r["hsa_counties"],
            })
    meta_rows.sort(key=lambda x: int(x["hsa_nci_id"]))
    meta_path = OUT_DIR / "hsa_metadata.csv"
    with open(meta_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["hsa_nci_id", "hsa", "geography", "hsa_counties"])
        writer.writeheader()
        writer.writerows(meta_rows)
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
