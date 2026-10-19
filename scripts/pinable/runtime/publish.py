#!/usr/bin/env python3
"""Publish a validated, immutable stable runtime without changing upstream latest."""
import argparse
import json
import os
from pathlib import Path
import subprocess

import runtime

REPOSITORY = "PinableAgents/codegraph"


def api(path, payload=None, method=None):
    args = ["gh", "api", path]
    if payload is not None:
        args += ["--method", method or "POST", "--input", "-"]
    result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                            check=True, text=True, stdout=subprocess.PIPE)
    return json.loads(result.stdout)


def validate(directory, expected_commit):
    manifest = runtime.runtime_set(directory, released=True)
    runtime.require(manifest == runtime.read_json(directory / "codegraph-runtime-manifest.json"), "manifest mismatch")
    runtime.require(manifest["source"]["revision"] == expected_commit, "source mismatch")
    files = {p.name for p in directory.iterdir()}
    seen = set()
    for line in (directory / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        checksum, name = line.split("  ", 1)
        runtime.require(name in files - {"SHA256SUMS"} and name not in seen, "unsafe/duplicate checksum entry")
        path = directory / name
        runtime.require(path.is_file() and not path.is_symlink() and runtime.sha256(path) == checksum,
                        "release checksum mismatch")
        seen.add(name)
    runtime.require(seen == files - {"SHA256SUMS"}, "incomplete checksums")
    return manifest, sorted(files)


def publish(directory, expected_commit):
    runtime.require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY and
                    os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and
                    os.environ.get("GITHUB_REF") == "refs/heads/main", "publication is manual and main-only")
    manifest, files = validate(directory, expected_commit)
    base = f"repos/{REPOSITORY}"
    runtime.require(api(base + "/git/ref/heads/main")["object"]["sha"] == expected_commit,
                    "main moved after validation; build the new revision before publishing")
    tag = manifest["source"]["releaseTag"]
    refs = api(base + f"/git/matching-refs/tags/{tag}")
    runtime.require(not any(ref["ref"] == "refs/tags/" + tag for ref in refs), "runtime tag already exists")
    created = api(base + "/git/refs", {"ref": "refs/tags/" + tag, "sha": expected_commit})
    runtime.require(created["object"]["sha"] == expected_commit, "reserved tag source mismatch")
    notes = (f"Pinable Desktop CodeGraph runtime, source `{expected_commit}`.\n\n"
             "All six native runtimes passed bundled Node, kernel, indexing and MCP smoke checks, "
             "including the Desktop managed installation layout. Full application quality gates passed.\n\n"
             "Use codegraph-runtime-manifest.json and SHA256SUMS to pin downloads for first use. "
             "The ZIP and launcher preserve the existing Desktop directory layout. "
             "Desktop locks are updated separately. No Pinable Developer ID, notarization or "
             "Authenticode signature is applied; native smoke does not certify OS distribution signing.")
    release = api(base + "/releases", {"tag_name": tag, "target_commitish": expected_commit,
                  "name": "Pinable CodeGraph " + manifest["source"]["version"] + " (" + expected_commit[:12] + ")",
                  "body": notes, "draft": True, "prerelease": False, "make_latest": "false"})
    subprocess.run(["gh", "release", "upload", tag, "--repo", REPOSITORY,
                    *[str(directory / name) for name in files]], check=True)
    runtime.require(api(base + f"/git/ref/tags/{tag}")["object"]["sha"] == expected_commit, "release tag moved")
    runtime.require(api(base + "/git/ref/heads/main")["object"]["sha"] == expected_commit,
                    "main moved during publication; leave draft for inspection")
    assets = api(base + f"/releases/{release['id']}/assets?per_page=100")
    runtime.require(len(assets) == len(files) and {a["name"] for a in assets} == set(files), "uploaded asset set mismatch")
    for asset in assets:
        path = directory / asset["name"]
        runtime.require(asset["state"] == "uploaded" and asset["size"] == path.stat().st_size and
                        asset["digest"] == "sha256:" + runtime.sha256(path), "uploaded asset hash/size mismatch")
    published = api(base + f"/releases/{release['id']}",
                    {"draft": False, "prerelease": False, "make_latest": "false"}, method="PATCH")
    runtime.require(published["draft"] is False and published["prerelease"] is False and published["tag_name"] == tag,
                    "stable release publication not confirmed")
    print(published["html_url"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--expected-commit", required=True)
    args = parser.parse_args()
    publish(args.directory.resolve(), args.expected_commit)
