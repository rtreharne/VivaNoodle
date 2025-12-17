#!/usr/bin/env python3
"""
Seed the local database with dummy viva data for a given assignment slug.

Usage:
  python scripts/seed_dummy_data.py --slug <resource_link_id> [--count 10] [--force]

This does NOT call Canvas APIs. It only creates local Assignment, Submission,
VivaSession, VivaMessage, InteractionLog, and VivaFeedback records for demo/testing.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
import requests
import textwrap
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lti.settings")

import django  # noqa: E402
django.setup()

from django.core.files.base import ContentFile  # noqa: E402
from django.utils.timezone import now  # noqa: E402

from tool.models import (  # noqa: E402
    Assignment,
    Submission,
    VivaSession,
    VivaMessage,
    InteractionLog,
    VivaFeedback,
)

def slugify_name(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in name)


def fetch_canvas_roster(canvas_course: int, canvas_url: str, token: str, limit: int) -> list[dict]:
    roster: list[dict] = []
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{canvas_url.rstrip('/')}/api/v1/courses/{canvas_course}/enrollments"
    params = {"type[]": "StudentEnrollment", "per_page": 100}

    while url and len(roster) < limit:
        resp = requests.get(url, headers=headers, params=params if "?" not in url else None)
        resp.raise_for_status()
        data = resp.json()
        for enr in data:
            user = enr.get("user", {}) or {}
            name = user.get("sortable_name") or user.get("name") or user.get("short_name")
            if name:
                roster.append(
                    {
                        "name": name,
                        "user_id": user.get("id"),
                        "sortable_name": user.get("sortable_name") or user.get("name"),
                    }
                )
                if len(roster) >= limit:
                    break

        # pagination
        links = resp.headers.get("Link", "")
        next_link = None
        for part in links.split(","):
            if 'rel="next"' in part:
                next_link = part[part.find("<") + 1 : part.find(">")]
        url = next_link
        params = None  # only for first request

    return roster[:limit]


def load_names(
    count: int,
    names_file: str = None,
    prefix: str = "Demo Student",
    canvas_course: int | None = None,
    canvas_url: str | None = None,
    canvas_token: str | None = None,
) -> list[dict]:
    roster: list[dict] = []
    if canvas_course and canvas_url and canvas_token:
        try:
            roster = fetch_canvas_roster(canvas_course, canvas_url, canvas_token, count)
        except Exception as e:
            print(f"Canvas roster fetch failed: {e}. Falling back to file/prefix.")

    # names_file and prefix fallback
    if names_file:
        try:
            with open(names_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        roster.append({"name": line, "user_id": None, "sortable_name": line})
        except FileNotFoundError:
            print(f"Names file not found: {names_file}. Falling back to generated names.")

    while len(roster) < count:
        name = f"{prefix} {len(roster)+1:02d}"
        roster.append({"name": name, "user_id": None, "sortable_name": name})

    return roster[:count]


def build_assignment(slug: str) -> Assignment:
    assignment, _ = Assignment.objects.get_or_create(
        slug=slug,
        defaults={
            "title": f"Dummy Viva for {slug}",
            "description": "Demo data seeded for testing the teacher dashboard.",
            "viva_duration_seconds": 600,
            "viva_instructions": "Be concise; probe reasoning; one question at a time.",
            "viva_tone": "Supportive",
        },
    )
    return assignment


def build_submission_text(name: str) -> str:
    return textwrap.dedent(
        f"""
        Title: AI in Education — An Essay by {name}

        AI is reshaping assessment, feedback, and learner support. This dummy submission
        explores risks (plagiarism, over-reliance), benefits (personalisation, faster
        feedback), and institutional guardrails (transparent use, integrity signals,
        viva follow-ups). It is generated locally for demo purposes only.
        """
    ).strip()


def seed_student(assignment: Assignment, name: str, idx: int, force: bool = False, canvas_user_id=None):
    user_id = str(canvas_user_id) if canvas_user_id else f"demo-{slugify_name(name)}-{idx}"
    existing = Submission.objects.filter(assignment=assignment, user_id=user_id).first()
    if existing and not force:
        return existing

    comment = build_submission_text(name)
    file_content = ContentFile(comment)
    sub = existing or Submission(assignment=assignment, user_id=user_id, comment=comment)
    sub.file.save(f"demo_{user_id}.txt", file_content, save=True)
    if not existing:
        sub.save()
    else:
        sub.comment = comment
        sub.save()

    session, _ = VivaSession.objects.get_or_create(submission=sub)

    # Seed messages
    VivaMessage.objects.filter(session=session).delete()
    messages = [
        ("ai", "Q1: Summarise your main claim in one sentence."),
        ("student", "Rewilding stabilises ecosystems by restoring trophic cascades."),
        ("ai", "Q2: What evidence would challenge your claim?"),
        ("student", "If predator reintroduction led to herbivore collapse or invasives spread."),
        ("ai", "Q3: What policy lever would you use to mitigate that risk?"),
        ("student", "Tiered subsidies plus monitoring to align incentives with biodiversity metrics."),
    ]
    start_ts = now() - timedelta(minutes=10)
    for i, (sender, text) in enumerate(messages):
        VivaMessage.objects.create(
            session=session,
            sender="student" if sender == "student" else "ai",
            text=text,
            timestamp=start_ts + timedelta(seconds=60 * i),
        )

    # Seed interaction logs (flags)
    InteractionLog.objects.filter(submission=sub).delete()
    InteractionLog.objects.create(
        submission=sub, event_type="paste", event_data={"text": "sample"}, timestamp=start_ts
    )
    InteractionLog.objects.create(
        submission=sub, event_type="blur", event_data={}, timestamp=start_ts + timedelta(seconds=120)
    )
    InteractionLog.objects.create(
        submission=sub, event_type="arrhythmic_typing", event_data={}, timestamp=start_ts + timedelta(seconds=240)
    )

    # Mark session end/duration
    session.ended_at = start_ts + timedelta(minutes=8)
    session.duration_seconds = 8 * 60
    session.save()

    # Feedback
    VivaFeedback.objects.update_or_create(
        session=session,
        defaults={
            "strengths": "Clear on mechanisms and policy levers.",
            "improvements": "Add quantitative evidence and mitigation detail.",
            "misconceptions": "None observed.",
            "impression": "Solid grasp; minor depth improvements needed.",
        },
    )

    return sub


def main():
    parser = argparse.ArgumentParser(description="Seed dummy viva data for an assignment slug.")
    parser.add_argument("--slug", required=True, help="Assignment slug (resource_link_id).")
    parser.add_argument("--name", help="Single student name to seed.")
    parser.add_argument("--count", type=int, default=10, help="Number of dummy students to seed (ignored if --name provided).")
    parser.add_argument("--force", action="store_true", help="Overwrite existing demo submissions.")
    parser.add_argument("--names-file", help="Optional path to a file with one student name per line.")
    parser.add_argument("--prefix", default="Demo Student", help="Prefix for generated student names.")
    parser.add_argument("--canvas-course", type=int, help="Canvas course ID to pull student names from.")
    parser.add_argument("--canvas-url", default=os.getenv("CANVAS_URL"), help="Canvas base URL for roster fetch.")
    parser.add_argument("--canvas-token", default=os.getenv("CANVAS_TOKEN"), help="Canvas token for roster fetch.")
    args = parser.parse_args()

    assignment = build_assignment(args.slug)

    # Determine target names
    if args.name:
        names = [{"name": args.name, "user_id": None, "sortable_name": args.name}]
        if args.canvas_course and args.canvas_url and args.canvas_token:
            roster = fetch_canvas_roster(args.canvas_course, args.canvas_url, args.canvas_token, limit=200)
            match = next(
                (r for r in roster if r.get("sortable_name") == args.name or r.get("name") == args.name),
                None
            )
            if match:
                names = [match]
            else:
                print(f"Warning: could not find Canvas user for '{args.name}'. Using local demo user_id.")
    else:
        names = load_names(
            args.count,
            names_file=args.names_file,
            prefix=args.prefix,
            canvas_course=args.canvas_course,
            canvas_url=args.canvas_url,
            canvas_token=args.canvas_token,
        )

    total = 0
    for idx, record in enumerate(names, start=1):
        seed_student(
            assignment,
            record["name"],
            idx,
            force=args.force,
            canvas_user_id=record.get("user_id"),
        )
        total += 1

    print(f"Seeded {total} demo submissions for assignment '{assignment.slug}'.")


if __name__ == "__main__":
    main()
