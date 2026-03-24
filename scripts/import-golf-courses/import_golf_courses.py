#!/usr/bin/env python3
"""
Golf Course Import Pipeline for Spotter
========================================
Sources:
  1. GitHub CSV (andystrub00/excel-golf-course-ratings) - MIT licensed, top ~360/state
  2. OpenStreetMap PBF (Geofabrik) - ODbL licensed, 70-85% coverage

Security:
  - All string fields sanitized (no SQL injection possible)
  - Lat/lon range validation
  - State code validation against US state list
  - Required field validation (name + city + state)
  - Parameterized queries only

OSM Attribution: Data © OpenStreetMap contributors, ODbL license.
  Must display attribution in Spotter UI when OSM data is used.
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import httpx
from supabase import create_client
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env.local")

# =============================================================================
# CONFIGURATION
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jicmcotwcpldbaheerbc.supabase.co")
_RAW_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if _RAW_KEY == "VAULTED":
    # Load from vault helper
    import subprocess as _sub
    _result = _sub.run(
        ["python3", str(Path(__file__).parent / "vault_helpers.py"), "get-service-key"],
        capture_output=True, text=True, timeout=10
    )
    if _result.returncode != 0:
        raise RuntimeError(f"Failed to load vaulted key: {_result.stderr}")
    SUPABASE_SERVICE_KEY = _result.stdout.strip()
else:
    SUPABASE_SERVICE_KEY = _RAW_KEY
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

GITHUB_BASE = "https://raw.githubusercontent.com/andystrub00/excel-golf-course-ratings/main/CSV%20Files/Individual%20States"
GEOFABRIK_BASE = "https://download.geofabrik.de/north-america/us"

# All 50 US states
US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

STATE_ABBREVS = set(US_STATES.keys())

# State name to abbreviation mapping
STATE_NAME_TO_ABBREV = {v: k for k, v in US_STATES.items()}

# =============================================================================
# SECURITY: SANITIZATION & VALIDATION
# =============================================================================

# SQL injection patterns to reject outright
SQL_INJECTION_PATTERNS = [
    r"(--|;|\\|\/\*|\*\/|xp_|exec\s*\(|execute\s*\(|eval\s*\(|openrowset|oledb)",
    r"\x00|\x08|\x0b|\x0c|\x0e|\x1f",  # Control characters
]

# XSS/script injection patterns
XSS_PATTERNS = [
    r"<script|javascript:|onerror=|onclick=|onload=",
    r"data:text/html|expression\s*\(",
]

COMBINED_MALICIOUS = SQL_INJECTION_PATTERNS + XSS_PATTERNS


def sanitize_string(value: str | None) -> str | None:
    """
    Sanitize a string field to prevent injection attacks.
    Strips control chars, rejects dangerous patterns.
    Returns None if input is None or entirely invalid.
    """
    if value is None:
        return None

    val = str(value).strip()
    if not val or val == "-":
        return None

    # Reject control characters and SQL/XSS patterns
    for pat in COMBINED_MALICIOUS:
        if re.search(pat, val, re.IGNORECASE):
            return None  # Treat as invalid rather than sanitizing away

    # Remove any remaining control characters
    val = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", val)

    # Truncate to reasonable length
    return val[:500] if len(val) > 500 else val


def validate_lat(lat: Any) -> float | None:
    """Validate latitude is in range [-90, 90]."""
    try:
        lat_f = float(lat)
        if -90 <= lat_f <= 90:
            return lat_f
    except (TypeError, ValueError):
        pass
    return None


def validate_lon(lon: Any) -> float | None:
    """Validate longitude is in range [-180, 180]."""
    try:
        lon_f = float(lon)
        if -180 <= lon_f <= 180:
            return lon_f
    except (TypeError, ValueError):
        pass
    return None


def validate_state(state: str | None) -> str | None:
    """
    Validate state is a known US state code (uppercase).
    Also handles full state names and normalizes them.
    """
    if state is None:
        return None

    s = str(state).strip().upper()
    if s in STATE_ABBREVS:
        return s
    # Try to normalize full state name -> abbreviation
    abbrev = STATE_NAME_TO_ABBREV.get(state.strip().title())
    if abbrev:
        return abbrev
    return None


def validate_required_fields(name: str | None, city: str | None, state: str | None) -> bool:
    """Reject records missing name + city + state (required fields)."""
    return bool(name and city and state)


def dedup_key(name: str, city: str, state: str) -> str:
    """Generate a deduplication key (case-insensitive)."""
    return f"{name.strip().lower()}|{city.strip().lower()}|{state.strip().upper()}"


# =============================================================================
# REPORTING
# =============================================================================

class ImportReport:
    """Tracks import statistics."""

    def __init__(self):
        self.github_total = 0
        self.github_valid = 0
        self.github_rejected_latlon = 0
        self.github_rejected_state = 0
        self.github_rejected_missing = 0
        self.github_rejected_malicious = 0
        self.github_duplicates = 0
        self.github_inserted = 0
        self.github_osm_deduped = 0

        self.osm_total = 0
        self.osm_valid = 0
        self.osm_rejected_latlon = 0
        self.osm_rejected_missing = 0
        self.osm_rejected_malicious = 0
        self.osm_deduped = 0
        self.osm_inserted = 0

        self.final_total_inserted = 0
        self.final_duplicates_removed = 0
        self.final_rejected = 0

    def to_dict(self) -> dict:
        return {
            "github": {
                "total": self.github_total,
                "valid": self.github_valid,
                "rejected_latlon": self.github_rejected_latlon,
                "rejected_state": self.github_rejected_state,
                "rejected_missing": self.github_rejected_missing,
                "rejected_malicious": self.github_rejected_malicious,
                "duplicates": self.github_duplicates,
                "osm_deduped": self.github_osm_deduped,
                "inserted": self.github_inserted,
            },
            "osm": {
                "total": self.osm_total,
                "valid": self.osm_valid,
                "rejected_latlon": self.osm_rejected_latlon,
                "rejected_missing": self.osm_rejected_missing,
                "rejected_malicious": self.osm_rejected_malicious,
                "deduped": self.osm_deduped,
                "inserted": self.osm_inserted,
            },
            "final": {
                "total_inserted": self.final_total_inserted,
                "duplicates_removed": self.final_duplicates_removed,
                "rejected": self.final_rejected,
            }
        }


# =============================================================================
# SOURCE 1: GITHUB CSV PARSER
# =============================================================================

class GitHubCSVParser:
    """
    Parses state CSV files from andystrub00/excel-golf-course-ratings.
    MIT License.

    Columns: CourseName, Played, Date, Notes, CurrentRanking, PastRanking,
             PanelistRating, City, State, Country, Architect, Latitude, Longitude
    """

    SOURCE_NAME = "github"
    SOURCE_ATTRIBUTION = "Golf Digest Rankings via andystrub00/excel-golf-course-ratings (MIT)"

    def __init__(self, http_client: httpx.Client):
        self.http = http_client

    def fetch_state_csv(self, state_abbrev: str) -> str:
        state_name = US_STATES[state_abbrev]
        filename = f"{state_name} - Golf Digest Top Courses in each State.csv"
        url = f"{GITHUB_BASE}/{filename}"
        resp = self.http.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text

    def parse_csv(self, csv_text: str, state_abbrev: str, report: ImportReport) -> list[dict]:
        """
        Parse CSV and return list of validated course dicts.
        Does NOT insert — just validates and transforms.
        """
        courses = []
        reader = csv.DictReader(io.StringIO(csv_text))

        for row in reader:
            report.github_total += 1
            raw_name = row.get("CourseName", "")
            raw_city = row.get("City", "")
            raw_state = row.get("State", "")
            raw_lat = row.get("Latitude", "")
            raw_lon = row.get("Longitude", "")
            raw_country = row.get("Country", "")
            raw_architect = row.get("Architect", "")
            raw_rating = row.get("PanelistRating", "")

            # Sanitize
            name = sanitize_string(raw_name)
            city = sanitize_string(raw_city)
            state = validate_state(raw_state)
            lat = validate_lat(raw_lat)
            lon = validate_lon(raw_lon)
            country = sanitize_string(raw_country)
            architect = sanitize_string(raw_architect)
            panelist_rating = raw_rating.strip() if raw_rating else None

            # Check for malicious content
            for field_val in [raw_name, raw_city, raw_state, raw_architect]:
                for pat in COMBINED_MALICIOUS:
                    if re.search(pat, str(field_val), re.IGNORECASE):
                        report.github_rejected_malicious += 1
                        break
                else:
                    continue
                break  # Already counted
            else:
                # Validate required fields
                if not validate_required_fields(name, city, state):
                    report.github_rejected_missing += 1
                    continue

                # Validate lat/lon
                if lat is None or lon is None:
                    report.github_rejected_latlon += 1
                    continue

                # Validate state code matches expected
                if state != state_abbrev:
                    report.github_rejected_state += 1
                    continue

                course = {
                    "name": name,
                    "city": city,
                    "state": state,
                    "country": country or "US",
                    "latitude": lat,
                    "longitude": lon,
                    "address": None,
                    "postal_code": None,
                    "phone": None,
                    "website": None,
                    "email": None,
                    "par_total": None,
                    "course_rating": None,
                    "slope_rating": None,
                    "difficulty": None,
                    "is_public": True,
                    "is_verified": False,
                    "is_active": True,
                    "amenities": {},
                    "images": [],
                    "osm_data": False,
                    "_source": self.SOURCE_NAME,
                    "_attribution": self.SOURCE_ATTRIBUTION,
                    "_panelist_rating": panelist_rating,
                    "_architect": architect,
                }
                courses.append(course)
                report.github_valid += 1

        return courses


# =============================================================================
# SOURCE 2: OSM PBF PARSER
# =============================================================================

class OSMPBFParser:
    """
    Parses golf courses from Geofabrik OSM PBF files using osmium-tool.
    ODbL License — attribution required in Spotter UI.

    Filters for: leisure=golf_course (ways/polygons)
    Extracts: name, address, city, state, phone, website, lat/lon (centroid)
    """

    SOURCE_NAME = "osm"
    SOURCE_ATTRIBUTION = "© OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright"

    # Geofabrik state file mapping
    GEOFABRIK_STATES = {
        "AL": "alabama", "AK": "alaska", "AZ": "arizona", "AR": "arkansas",
        "CA": "california", "CO": "colorado", "CT": "connecticut", "DE": "delaware",
        "FL": "florida", "GA": "georgia", "HI": "hawaii", "ID": "idaho",
        "IL": "illinois", "IN": "indiana", "IA": "iowa", "KS": "kansas",
        "KY": "kentucky", "LA": "louisiana", "ME": "maine", "MD": "maryland",
        "MA": "massachusetts", "MI": "michigan", "MN": "minnesota", "MS": "mississippi",
        "MO": "missouri", "MT": "montana", "NE": "nebraska", "NV": "nevada",
        "NH": "new-hampshire", "NJ": "new-jersey", "NM": "new-mexico", "NY": "new-york",
        "NC": "north-carolina", "ND": "north-dakota", "OH": "ohio", "OK": "oklahoma",
        "OR": "oregon", "PA": "pennsylvania", "RI": "rhode-island", "SC": "south-carolina",
        "SD": "south-dakota", "TN": "tennessee", "TX": "texas", "UT": "utah",
        "VT": "vermont", "VA": "virginia", "WA": "washington", "WV": "west-virginia",
        "WI": "wisconsin", "WY": "wyoming",
    }

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir

    def download_and_parse(self, state_abbrev: str, report: ImportReport) -> list[dict]:
        """
        Download PBF, extract golf courses via osmium, parse to course dicts.
        Returns list of validated courses (does NOT insert).
        """
        geofabrik_name = self.GEOFABRIK_STATES.get(state_abbrev)
        if not geofabrik_name:
            return []

        pbf_url = f"{GEOFABRIK_BASE}/{geofabrik_name}-latest.osm.pbf"
        pbf_path = self.work_dir / f"{state_abbrev}.osm.pbf"
        filtered_path = self.work_dir / f"{state_abbrev}_golf.osm"

        # Download PBF (if not cached)
        if not pbf_path.exists():
            print(f"  Downloading {state_abbrev} PBF from Geofabrik...")
            resp = httpx.get(pbf_url, timeout=300, follow_redirects=True)
            resp.raise_for_status()
            pbf_path.write_bytes(resp.content)

        # Extract golf course ways
        import subprocess
        result = subprocess.run(
            ["osmium", "tags-filter", str(pbf_path), "w/leisure=golf_course",
             "--output-format=osm"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"  osmium error: {result.stderr}")
            return []

        filtered_path.write_text(result.stdout)

        # Parse the filtered OSM file
        return self._parse_osm_xml(filtered_path, state_abbrev, report)

    def _parse_osm_xml(self, osm_path: Path, state_abbrev: str, report: ImportReport) -> list[dict]:
        """
        Parse OSM XML file, extract golf course ways and compute centroids.
        """
        tree = ET.parse(osm_path)
        root = tree.getroot()

        # Build node lookup for centroid calculation
        nodes: dict[int, tuple[float, float]] = {}
        for node_el in root.iter("node"):
            nid = int(node_el.attrib["id"])
            lat = float(node_el.attrib["lat"])
            lon = float(node_el.attrib["lon"])
            nodes[nid] = (lat, lon)

        courses = []
        seen_keys = set()  # track dedup keys already processed in this file

        for way_el in root.iter("way"):
            tags = {t.attrib["k"]: t.attrib["v"] for t in way_el.iter("tag")}
            leisure = tags.get("leisure", "")
            if leisure != "golf_course":
                continue

            report.osm_total += 1

            # Extract fields
            raw_name = tags.get("name", "")
            raw_city = tags.get("addr:city", "")
            raw_state = tags.get("addr:state", "")
            raw_postcode = tags.get("addr:postcode", "")
            raw_street = tags.get("addr:street", "")
            raw_housenumber = tags.get("addr:housenumber", "")
            raw_phone = tags.get("phone", "")
            raw_website = tags.get("website", "")
            raw_email = tags.get("email", "")
            raw_golf_par = tags.get("golf:par", "")
            raw_access = tags.get("access", "yes")
            raw_osm_id = way_el.attrib.get("id", "")

            # Sanitize
            name = sanitize_string(raw_name)
            city = sanitize_string(raw_city)
            state = validate_state(raw_state) if raw_state else None
            postcode = sanitize_string(raw_postcode)
            phone = sanitize_string(raw_phone)
            website = sanitize_string(raw_website)
            email = sanitize_string(raw_email)

            # Build address
            addr_parts = []
            if raw_housenumber:
                addr_parts.append(raw_housenumber)
            if raw_street:
                addr_parts.append(raw_street)
            address = " ".join(addr_parts) if addr_parts else None
            address = sanitize_string(address)

            # Check for malicious patterns
            for field_val in [raw_name, raw_city, raw_phone, raw_website, raw_email]:
                for pat in COMBINED_MALICIOUS:
                    if re.search(pat, str(field_val), re.IGNORECASE):
                        report.osm_rejected_malicious += 1
                        break
                else:
                    continue
                break
            else:
                # Validate required fields
                if not validate_required_fields(name, city, state):
                    report.osm_rejected_missing += 1
                    continue

                # Validate state
                if state != state_abbrev:
                    state = state_abbrev  # Force state from parameter

                # Compute centroid from way nodes
                node_refs = [int(nd.attrib["ref"]) for nd in way_el.iter("nd")]
                lats = [nodes[nid][0] for nid in node_refs if nid in nodes]
                lons = [nodes[nid][1] for nid in node_refs if nid in nodes]

                if not lats or not lons:
                    report.osm_rejected_latlon += 1
                    continue

                lat = sum(lats) / len(lats)
                lon = sum(lons) / len(lons)

                if not validate_lat(lat) or not validate_lon(lon):
                    report.osm_rejected_latlon += 1
                    continue

                # Derive difficulty from par if available
                difficulty = None
                par_total = None
                if raw_golf_par:
                    try:
                        par_total = int(raw_golf_par)
                        if par_total <= 68:
                            difficulty = "easy"
                        elif par_total <= 72:
                            difficulty = "moderate"
                        elif par_total <= 75:
                            difficulty = "challenging"
                        else:
                            difficulty = "expert"
                    except ValueError:
                        pass

                is_public = raw_access in ("yes", "permissive", "customers", "public")

                # Deduplication key
                dk = dedup_key(name or "", city, state or state_abbrev)
                if dk in seen_keys:
                    report.osm_deduped += 1
                    continue
                seen_keys.add(dk)

                course = {
                    "name": name,
                    "city": city,
                    "state": state or state_abbrev,
                    "country": "US",
                    "address": address,
                    "postal_code": postcode,
                    "latitude": lat,
                    "longitude": lon,
                    "phone": phone,
                    "website": website,
                    "email": email,
                    "par_total": par_total,
                    "course_rating": None,
                    "slope_rating": None,
                    "difficulty": difficulty,
                    "is_public": is_public,
                    "is_verified": False,
                    "is_active": True,
                    "amenities": {},
                    "images": [],
                    "osm_data": True,
                    "_source": self.SOURCE_NAME,
                    "_attribution": self.SOURCE_ATTRIBUTION,
                    "_osm_id": raw_osm_id,
                }
                courses.append(course)
                report.osm_valid += 1

        return courses


# =============================================================================
# SUPABASE DATABASE OPERATIONS
# =============================================================================

class Database:
    """
    Manages Supabase connection and database operations.
    Uses parameterized queries exclusively — no string interpolation.
    """

    def __init__(self, url: str, service_key: str):
        self.client = create_client(url, service_key)
        self.service_key = service_key

    def get_existing_keys(self) -> set[str]:
        """Get all (name, city, state) keys currently in golf_courses."""
        keys = set()
        offset = 0
        batch_size = 1000
        while True:
            resp = self.client.table("golf_courses").select("name,city,state").range(offset, offset + batch_size - 1).execute()
            if not resp.data:
                break
            for row in resp.data:
                n = (row.get("name") or "").strip().lower()
                c = (row.get("city") or "").strip().lower()
                s = (row.get("state") or "").strip().upper()
                if n and c and s:
                    keys.add(f"{n}|{c}|{s}")
            offset += batch_size
            if len(resp.data) < batch_size:
                break
        return keys

    def course_exists(self, name: str, city: str, state: str) -> bool:
        """Check if a course already exists (name + city + state)."""
        resp = self.client.table("golf_courses").select("id").eq("name", name).eq("city", city).eq("state", state).limit(1).execute()
        return len(resp.data) > 0

    def insert_courses_batch(self, courses: list[dict], batch_size: int = 100) -> int:
        """
        Insert courses in batches using parameterized upsert.
        Returns number of courses actually inserted.
        """
        inserted = 0
        for i in range(0, len(courses), batch_size):
            batch = courses[i:i + batch_size]
            rows = []
            for c in batch:
                # Build amenity JSON
                amenities = {
                    "driving_range": False, "pro_shop": False, "restaurant": False,
                    "bar": False, "snack_bar": False, "locker_rooms": False,
                    "cart_rental": False, "club_rental": False, "caddie_service": False,
                    "lessons": False, "putting_green": False, "chipping_area": False,
                    "practice_bunker": False, "cart_gps": False, "electronic_scorecards": False,
                }
                rows.append({
                    "name": c["name"],
                    "address": c.get("address"),
                    "city": c["city"],
                    "state": c["state"],
                    "country": c.get("country", "US"),
                    "postal_code": c.get("postal_code"),
                    "latitude": c["latitude"],
                    "longitude": c["longitude"],
                    "phone": c.get("phone"),
                    "website": c.get("website"),
                    "email": c.get("email"),
                    "par_total": c.get("par_total"),
                    "course_rating": c.get("course_rating"),
                    "slope_rating": c.get("slope_rating"),
                    "difficulty": c.get("difficulty"),
                    "is_verified": c.get("is_verified", False),
                    "is_active": c.get("is_active", True),
                    "amenities": amenities,
                    "images": [],
                })

            try:
                resp = self.client.table("golf_courses").insert(rows).execute()
                inserted += len(resp.data) if resp.data else 0
            except Exception as e:
                # If batch fails, try one-by-one and count only successes
                for row in rows:
                    try:
                        single_resp = self.client.table("golf_courses").insert(row).execute()
                        if single_resp.data:
                            inserted += 1
                    except Exception:
                        pass  # Already exists or constraint violation

        return inserted

    def upsert_courses(self, courses: list[dict], existing_keys: set[str]) -> tuple[int, int]:
        """
        Insert courses that don't already exist.
        Returns (inserted_count, skipped_count).
        """
        to_insert = []
        skipped = 0

        for c in courses:
            dk = dedup_key(c["name"], c["city"], c["state"])
            if dk in existing_keys:
                skipped += 1
                continue
            to_insert.append(c)
            existing_keys.add(dk)  # Prevent duplicates within this import run

        if not to_insert:
            return 0, skipped

        inserted = self.insert_courses_batch(to_insert)
        return inserted, skipped


# =============================================================================
# MAIN IMPORT PIPELINE
# =============================================================================

def run_import(
    states: list[str] | None = None,
    supabase_url: str = SUPABASE_URL,
    supabase_key: str = SUPABASE_SERVICE_KEY,
    skip_github: bool = False,
    skip_osm: bool = False,
    osm_work_dir: str = "/tmp/golf_import",
    github_states_only: list[str] | None = None,
    osm_states_only: list[str] | None = None,
) -> ImportReport:
    """
    Run the full golf course import pipeline.

    Args:
        states: List of state abbreviations to import (default: all 50)
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key
        skip_github: Skip GitHub CSV source
        skip_osm: Skip OSM PBF source
        osm_work_dir: Directory for PBF downloads
        github_states_only: Import only these GitHub states (for testing)
        osm_states_only: Import only these OSM states (for testing)
    """
    report = ImportReport()
    work_dir = Path(osm_work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    if states is None:
        states = list(US_STATES.keys())

    print(f"\n{'='*60}")
    print("GOLF COURSE IMPORT PIPELINE")
    print(f"{'='*60}")
    print(f"States: {len(states)}")
    print(f"GitHub CSV: {'enabled' if not skip_github else 'SKIPPED'}")
    print(f"OSM PBF: {'enabled' if not skip_osm else 'SKIPPED'}")
    print(f"Supabase: {supabase_url}")
    print()

    # Initialize database
    db = Database(supabase_url, supabase_key)

    # Get existing courses for deduplication
    print("Fetching existing courses from database...")
    existing_keys = db.get_existing_keys()
    print(f"Existing courses in DB: {len(existing_keys)}")

    # Collect all courses from all sources
    all_courses: list[dict] = []
    seen_keys: set[str] = set(existing_keys)

    # ---- SOURCE 1: GitHub CSV ----
    if not skip_github:
        http = httpx.Client(timeout=30)
        parser = GitHubCSVParser(http)

        github_states = github_states_only if github_states_only else states
        print(f"\n[GitHub CSV] Processing {len(github_states)} states...")

        for i, state_abbrev in enumerate(github_states):
            print(f"  [{i+1}/{len(github_states)}] {state_abbrev}...", end=" ", flush=True)
            try:
                csv_text = parser.fetch_state_csv(state_abbrev)
                courses = parser.parse_csv(csv_text, state_abbrev, report)

                # Deduplicate within source
                unique = []
                for c in courses:
                    dk = dedup_key(c["name"], c["city"], c["state"])
                    if dk in seen_keys:
                        report.github_duplicates += 1
                        continue
                    seen_keys.add(dk)
                    unique.append(c)

                all_courses.extend(unique)
                print(f"OK ({len(courses)} valid, {len(unique)} unique)")
            except Exception as e:
                print(f"ERROR: {e}")
        http.close()

    # ---- SOURCE 2: OSM PBF ----
    if not skip_osm:
        parser = OSMPBFParser(work_dir)

        osm_states = osm_states_only if osm_states_only else states
        print(f"\n[OSM PBF] Processing {len(osm_states)} states...")

        for i, state_abbrev in enumerate(osm_states):
            print(f"  [{i+1}/{len(osm_states)}] {state_abbrev}...", end=" ", flush=True)
            try:
                courses = parser.download_and_parse(state_abbrev, report)

                # Deduplicate within source and against GitHub
                unique = []
                for c in courses:
                    dk = dedup_key(c["name"], c["city"], c["state"])
                    if dk in seen_keys:
                        report.github_osm_deduped += 1
                        continue
                    seen_keys.add(dk)
                    unique.append(c)

                all_courses.extend(unique)
                print(f"OK ({len(courses)} valid, {len(unique)} unique)")
            except Exception as e:
                print(f"ERROR: {e}")

    # ---- FINAL DEDUPLICATION ----
    print(f"\n[Dedup] Total candidates: {len(all_courses)}")

    # ---- INSERTION ----
    print(f"[Insert] Inserting into Supabase...")
    inserted, skipped = db.upsert_courses(all_courses, existing_keys)
    report.final_total_inserted = inserted
    report.final_duplicates_removed = skipped
    report.final_rejected = (
        report.github_rejected_latlon +
        report.github_rejected_state +
        report.github_rejected_missing +
        report.github_rejected_malicious +
        report.osm_rejected_latlon +
        report.osm_rejected_missing +
        report.osm_rejected_malicious
    )
    report.github_inserted = inserted  # approximate
    report.osm_inserted = 0  # will be set if OSM was the only source

    # Print summary
    print(f"\n{'='*60}")
    print("IMPORT SUMMARY")
    print(f"{'='*60}")
    print(f"  GitHub CSV:")
    print(f"    Total rows:       {report.github_total}")
    print(f"    Valid rows:       {report.github_valid}")
    print(f"    Rejected (lat/lon): {report.github_rejected_latlon}")
    print(f"    Rejected (state):   {report.github_rejected_state}")
    print(f"    Rejected (missing): {report.github_rejected_missing}")
    print(f"    Rejected (malicious): {report.github_rejected_malicious}")
    print(f"    Duplicate within source: {report.github_duplicates}")
    print(f"    Deduped against OSM: {report.github_osm_deduped}")
    print(f"  OSM PBF:")
    print(f"    Total ways:      {report.osm_total}")
    print(f"    Valid ways:      {report.osm_valid}")
    print(f"    Rejected (lat/lon): {report.osm_rejected_latlon}")
    print(f"    Rejected (missing): {report.osm_rejected_missing}")
    print(f"    Rejected (malicious): {report.osm_rejected_malicious}")
    print(f"    Deduped:         {report.osm_deduped}")
    print(f"  Final:")
    print(f"    Inserted:        {report.final_total_inserted}")
    print(f"    Skipped (exists): {report.final_duplicates_removed}")
    print(f"    Total Rejected:  {report.final_rejected}")

    return report


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Import golf courses into Spotter")
    parser.add_argument("--states", nargs="+", default=None,
                        help="State abbreviations (default: all 50)")
    parser.add_argument("--skip-github", action="store_true",
                        help="Skip GitHub CSV source")
    parser.add_argument("--skip-osm", action="store_true",
                        help="Skip OSM PBF source")
    parser.add_argument("--github-states", nargs="+", dest="github_states",
                        help="Test: only these GitHub states")
    parser.add_argument("--osm-states", nargs="+", dest="osm_states",
                        help="Test: only these OSM states")
    parser.add_argument("--osm-work-dir", default="/tmp/golf_import",
                        help="OSM PBF cache directory")
    parser.add_argument("--report-path", default=None,
                        help="Write JSON report to this path")
    parser.add_argument("--supabase-url", default=None)
    parser.add_argument("--supabase-key", default=None)

    args = parser.parse_args()

    report = run_import(
        states=args.states,
        supabase_url=args.supabase_url or SUPABASE_URL,
        supabase_key=args.supabase_key or SUPABASE_SERVICE_KEY,
        skip_github=args.skip_github,
        skip_osm=args.skip_osm,
        osm_work_dir=args.osm_work_dir,
        github_states_only=args.github_states,
        osm_states_only=args.osm_states,
    )

    if args.report_path:
        with open(args.report_path, "w") as f:
            json.dump(report.to_dict(), f, indent=2)
        print(f"\nReport written to {args.report_path}")

    return report


if __name__ == "__main__":
    main()
