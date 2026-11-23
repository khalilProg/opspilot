#!/usr/bin/env bash
set -euo pipefail

report=$1
blocked=$(jq -er '
    if .SchemaVersion != 2 or (.ArtifactName | type) != "string" then
        error("Invalid Trivy report")
    else
        [.Results[]?.Vulnerabilities[]? | select(
            .Severity == "CRITICAL" or
            (.Severity == "HIGH" and ((.FixedVersion // "") | length > 0))
        )] | length
    end
' "$report")

trivy convert --format table --severity HIGH,CRITICAL "$report"
if (( blocked > 0 )); then
    echo "::error::$blocked vulnerability findings violate the policy in $report"
    exit 1
fi
