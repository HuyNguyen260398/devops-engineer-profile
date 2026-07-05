#!/usr/bin/env python3
"""Regenerate src/aws-s3-web/assets/data/pinned-repos.json from GitHub pinned repos.

Uses the GitHub GraphQL API (pinned repos are only exposed there). On any error
it exits non-zero WITHOUT touching the existing JSON, so the committed fallback
survives. Requires env GITHUB_TOKEN; optional GITHUB_USERNAME (default below).
Standard library only (urllib) — no pip dependency.
"""
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_USER = "HuyNguyen260398"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "src", "aws-s3-web", "assets", "data", "pinned-repos.json")

QUERY = """
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          description
          url
          stargazerCount
          forkCount
          primaryLanguage { name }
          languages(first: 8, orderBy: {field: SIZE, direction: DESC}) { nodes { name } }
        }
      }
    }
  }
}
"""


def fail(msg):
    print(f"[fetch_pinned_repos] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        fail("GITHUB_TOKEN is not set")
    user = os.environ.get("GITHUB_USERNAME", DEFAULT_USER)

    payload = json.dumps({"query": QUERY, "variables": {"login": user}}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "huy-portfolio-pinned-fetch",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as exc:
        fail(f"request failed: {exc}")

    if body.get("errors"):
        fail(f"graphql errors: {body['errors']}")

    try:
        nodes = body["data"]["user"]["pinnedItems"]["nodes"]
    except (KeyError, TypeError):
        fail(f"unexpected response shape: {body}")

    repos = []
    for n in nodes:
        if not n:
            continue
        repos.append({
            "name": n.get("name", ""),
            "description": n.get("description") or "",
            "url": n.get("url", ""),
            "stars": n.get("stargazerCount", 0),
            "forks": n.get("forkCount", 0),
            "primaryLanguage": (n.get("primaryLanguage") or {}).get("name") or "",
            "languages": [x["name"] for x in (n.get("languages") or {}).get("nodes", [])],
        })

    if not repos:
        fail("no pinned repos returned; leaving existing file untouched")

    out = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "username": user,
        "repos": repos,
    }

    # Atomic write: temp then replace, so a crash mid-write can't corrupt the file.
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    tmp = OUT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, OUT_PATH)
    print(f"[fetch_pinned_repos] wrote {len(repos)} repos to {OUT_PATH}")


if __name__ == "__main__":
    main()
