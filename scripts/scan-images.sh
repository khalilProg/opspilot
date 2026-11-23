#!/usr/bin/env bash
set -euo pipefail

source_type=$1
report_dir=$2
shift 2
mkdir -p "$report_dir"

scan_options=(--image-src "$source_type")
if [[ "$source_type" == remote ]]; then
    scan_options+=(--insecure)
fi

blocked=0
for target in "$@"; do
    component=${target%%=*}
    image=${target#*=}
    if [[ -z "$image" || ( "$source_type" == remote && "$image" != localhost:5000/* ) ]]; then
        echo "::error::Invalid image reference for $component"
        exit 1
    fi
    report="$report_dir/$component.vulnerabilities.json"
    trivy image "${scan_options[@]}" --scanners vuln --list-all-pkgs --no-progress \
        --format json --output "$report" "$image"
    trivy convert --format cyclonedx --output "$report_dir/$component.cdx.json" "$report"
    if ! bash scripts/check-vulnerabilities.sh "$report"; then
        blocked=1
    fi
done
exit "$blocked"
