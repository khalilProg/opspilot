"""Run the backend, gateway, frontend, and browser acceptance checks on the development stack."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CRITERIA = (
    "Monitor CRUD",
    "Outage detected after exactly three failures",
    "Exactly one active incident during the outage",
    "Incident-opened notification delivered",
    "Recovery after exactly two successes and incident resolution",
    "Duplicate delivery caused no duplicate side effect",
    "RabbitMQ outage and replay",
    "Application restart preserved state",
    "Java, Go, and backend integration suites",
    "Gateway routes, security headers, asset caching, and upstream recovery",
    "Frontend production build and unit tests",
    "Playwright dashboard workflows",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    parser.add_argument("--skip-stack-build", action="store_true",
                        help="Use an already-running stack with both development fixtures")
    args = parser.parse_args()
    docker = ["sudo", "docker"] if args.sudo_docker else ["docker"]
    compose = docker + ["compose", "-f", "compose.yml", "-f", "compose.monitor-dev.yml",
                        "-f", "compose.notification-dev.yml"]
    if shutil.which("npm"):
        npm = ["npm"]
    elif shutil.which("mise"):
        npm = ["mise", "exec", "--", "npm"]
    else:
        raise SystemExit("Playwright requires npm. Run this script from your usual Node environment; "
                         "use --sudo-docker to elevate only Docker commands.")

    def run(label, command, env=None, hint=""):
        print(f"\n=== {label} ===", flush=True)
        try:
            subprocess.run(command, cwd=ROOT, env=env, check=True)
        except subprocess.CalledProcessError as error:
            raise SystemExit(f"Acceptance stopped at {label} (exit {error.returncode}).{hint}") from None
        except FileNotFoundError as error:
            raise SystemExit(f"Required command unavailable: {error.filename}") from None

    def script(name, *, docker_access=False, extra=(), env=None):
        options = ["--sudo-docker"] if args.sudo_docker and docker_access else []
        run(name, [sys.executable, f"scripts/{name}", *options, *extra], env)

    browser_suite = [*npm, "--prefix", "tests/e2e", "test", "--"]
    run("Playwright prerequisites", [*browser_suite, "--list"],
        hint=" Use your regular Node environment and run npm ci --prefix tests/e2e. "
             "Use --sudo-docker to elevate Docker commands only.")
    run("Docker access", docker + ["info", "--format", "{{.ServerVersion}}"],
        hint=" Rerun with --sudo-docker if Docker requires sudo." if not args.sudo_docker else "")
    run("Compose configuration", compose + ["config", "--quiet"])
    if not args.skip_stack_build:
        run("Refresh development fixtures", compose + [
            "up", "-d", "--force-recreate", "--no-deps", "monitor-fixture", "notification-webhook",
        ])
        run("Build and start release candidates", compose + [
            "up", "-d", "--build", "--wait", "--wait-timeout", "120",
            "gateway", "notification-service", "monitor-fixture", "notification-webhook",
        ])

    run("Gateway routes, asset caching, and security headers", ["sh", "scripts/smoke-test.sh"])
    run("Frontend production build and unit tests", compose + ["run", "--build", "--rm", "--no-deps", "frontend-test"])
    for service in ("monitor-service", "incident-service", "notification-service"):
        run(f"{service} automated tests", compose + ["run", "--rm", "--no-deps", f"{service}-test"])

    script("test-gateway-recovery.py", docker_access=True)
    run("Playwright dashboard workflows", [*browser_suite, "--workers=1"])
    script("test-monitor-api.py", env={**os.environ, "MONITOR_TEST_TARGET_ORIGIN": "http://monitor-fixture:8090"})
    script("test-monitor-checks.py", docker_access=True)
    script("test-event-pipeline.py", docker_access=True, extra=("--acceptance",))
    script("test-incident-lifecycle.py", docker_access=True)
    script("test-event-reliability.py", docker_access=True)
    script("test-notification-delivery.py", docker_access=True)

    print(f"\nPhase 6 release acceptance passed ({len(CRITERIA)}/{len(CRITERIA)}).")
    for criterion in CRITERIA:
        print(f"PASS {criterion}")


if __name__ == "__main__":
    main()
