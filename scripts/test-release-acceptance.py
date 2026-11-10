"""Build the local development stack and run all nine Phase 6 acceptance checks."""

import argparse
import os
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
    "Java, Go, and end-to-end suites",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    docker = ["sudo", "docker"] if args.sudo_docker else ["docker"]
    compose = docker + ["compose", "-f", "compose.yml", "-f", "compose.monitor-dev.yml",
                        "-f", "compose.notification-dev.yml"]

    def run(label, command, env=None):
        print(f"\n=== {label} ===", flush=True)
        try:
            subprocess.run(command, cwd=ROOT, env=env, check=True)
        except subprocess.CalledProcessError as error:
            hint = " Rerun with --sudo-docker if Docker requires sudo." if label == "Docker access" and not args.sudo_docker else ""
            raise SystemExit(f"Acceptance stopped at {label} (exit {error.returncode}).{hint}") from None
        except FileNotFoundError as error:
            raise SystemExit(f"Required command unavailable: {error.filename}") from None

    def script(name, *, docker_access=False, extra=(), env=None):
        options = ["--sudo-docker"] if args.sudo_docker and docker_access else []
        run(name, [sys.executable, f"scripts/{name}", *options, *extra], env)

    run("Docker access", docker + ["info", "--format", "{{.ServerVersion}}"])
    run("Compose configuration", compose + ["config", "--quiet"])
    run("Refresh development fixtures", compose + [
        "up", "-d", "--force-recreate", "--no-deps", "monitor-fixture", "notification-webhook",
    ])
    run("Build and start release candidates", compose + [
        "up", "-d", "--build", "--wait", "--wait-timeout", "120",
        "monitor-service", "incident-service", "notification-service", "monitor-fixture", "notification-webhook",
    ])

    for service in ("monitor-service", "incident-service", "notification-service"):
        run(f"{service} automated tests", compose + ["run", "--rm", "--no-deps", f"{service}-test"])

    run("Service health and identity", ["sh", "scripts/smoke-test.sh"])
    script("test-monitor-api.py", env={**os.environ, "MONITOR_TEST_TARGET_ORIGIN": "http://monitor-fixture:8090"})
    script("test-monitor-checks.py", docker_access=True)
    script("test-event-pipeline.py", docker_access=True, extra=("--acceptance",))
    script("test-incident-lifecycle.py", docker_access=True)
    script("test-event-reliability.py", docker_access=True)
    script("test-notification-delivery.py", docker_access=True)

    print("\nPhase 6 release acceptance passed (9/9).")
    for criterion in CRITERIA:
        print(f"PASS {criterion}")


if __name__ == "__main__":
    main()
