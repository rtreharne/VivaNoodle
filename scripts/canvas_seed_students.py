#!/usr/bin/env python3
"""
Seed a Canvas course with demo student accounts named after Asimov characters.

Examples:
  python scripts/canvas_seed_students.py --course-id 123
  python scripts/canvas_seed_students.py --course-id 123 --count 10 --dry-run
  python scripts/canvas_seed_students.py --course-id 123 --token ABC --base-url https://canvas.example.com
"""

import argparse
import os
import sys
import random
import string
from typing import Dict, List, Optional, Tuple
from pathlib import Path

try:
    import requests
except ImportError:
    print("This script requires the 'requests' library. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


ASIMOV_NAMES = [
    "Susan Calvin",
    "Hari Seldon",
    "Gaal Dornick",
    "Daneel Olivaw",
    "Elijah Baley",
    "Bayta Darell",
    "Arkady Darell",
    "Hober Mallow",
    "Salvor Hardin",
    "R. Giskard Reventlov",
    "Fastolfe",
    "Andrew Harlan",
    "Noÿs Lambent",
    "Joseph Schwartz",
    "Gladia Delmarre",
    "Janov Pelorat",
    "Wanda Seldon",
    "Preem Palver",
    "Cleon II",
    "Dors Venabili",
]


def slugify(name: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in name)
    return "-".join(filter(None, cleaned.split("-")))


def build_roster(count: int) -> List[Tuple[str, str]]:
    roster = []
    names = ASIMOV_NAMES.copy()
    if count > len(names):
        # Extend with numbered variants if more than 20 requested
        for i in range(len(names) + 1, count + 1):
            names.append(f"Asimov Demo {i}")
    for idx, name in enumerate(names[:count], start=1):
        slug = slugify(name)
        email = f"{slug}-{idx}@asimov.demo.edu"
        roster.append((name, email))
    return roster


def canvas_request(session: requests.Session, method: str, url: str, **kwargs):
    resp = session.request(method, url, **kwargs)
    if not resp.ok:
        raise RuntimeError(f"Canvas API error {resp.status_code}: {resp.text}")
    return resp


def find_existing_user(session: requests.Session, base_url: str, account_id: int, email: str) -> Optional[int]:
    params = {"search_term": email, "per_page": 100}
    url = f"{base_url}/api/v1/accounts/{account_id}/users"
    resp = canvas_request(session, "GET", url, params=params)
    for user in resp.json():
        if user.get("login_id") == email or user.get("email") == email:
            return user.get("id")
    return None


def create_user(session: requests.Session, base_url: str, account_id: int, name: str, email: str) -> int:
    url = f"{base_url}/api/v1/accounts/{account_id}/users"
    payload = {
        "user": {"name": name, "short_name": name},
        "pseudonym": {
            "unique_id": email,
            "send_confirmation": False,
            "sis_user_id": email,
        },
        "communication_channel": {
            "type": "email",
            "address": email,
            "skip_confirmation": True,
        },
    }
    resp = canvas_request(session, "POST", url, json=payload)
    return resp.json()["id"]


def enroll_student(session: requests.Session, base_url: str, course_id: int, user_id: int):
    url = f"{base_url}/api/v1/courses/{course_id}/enrollments"
    payload = {
        "enrollment": {
            "user_id": user_id,
            "type": "StudentEnrollment",
            "enrollment_state": "active",
        }
    }
    canvas_request(session, "POST", url, json=payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed a Canvas course with demo students (Asimov characters).")
    parser.add_argument("--course-id", type=int, required=True, help="Canvas course ID to enroll students into.")
    parser.add_argument("--account-id", type=int, default=1, help="Canvas account ID (default: 1).")
    parser.add_argument("--count", "--no", type=int, default=20, dest="count", help="Number of students to create (default: 20).")
    parser.add_argument(
        "--base-url",
        default=os.getenv("CANVAS_URL", "https://canvas.ninepointeightone.com"),
        help="Canvas base URL (or set CANVAS_URL).",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("CANVAS_TOKEN"),
        help="Canvas API token (or set CANVAS_TOKEN env).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions without creating users or enrollments.")
    return parser.parse_args()


def main():
    # Load .env manually if present and env vars missing
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if key and val and key not in os.environ:
                os.environ[key] = val

    args = parse_args()

    if not args.token:
        print("Canvas API token is required. Pass --token or set CANVAS_TOKEN.", file=sys.stderr)
        sys.exit(1)

    roster = build_roster(args.count)

    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {args.token}"})

    created = 0
    skipped = 0

    for name, email in roster:
        existing_id = find_existing_user(session, args.base_url, args.account_id, email)
        if existing_id:
            print(f"Skip existing user {name} ({email}) -> id {existing_id}")
            user_id = existing_id
            skipped += 1
        else:
            print(f"{'[DRY-RUN] ' if args.dry_run else ''}Create user {name} ({email})")
            if args.dry_run:
                user_id = None
            else:
                user_id = create_user(session, args.base_url, args.account_id, name, email)
                created += 1

        if user_id:
            print(f"{'[DRY-RUN] ' if args.dry_run else ''}Enroll {name} into course {args.course_id}")
            if not args.dry_run:
                enroll_student(session, args.base_url, args.course_id, user_id)

    print(f"Done. Created {created}, skipped existing {skipped}.")


if __name__ == "__main__":
    main()
