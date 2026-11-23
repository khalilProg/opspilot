#!/usr/bin/env bash
set -euo pipefail

destination=$1
shift
mkdir -p "$destination"
download_dir=$(mktemp -d)
trap 'rm -rf "$download_dir"' EXIT

for tool in "$@"; do
    case "$tool" in
        trivy)
            asset=https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_Linux-64bit.tar.gz
            checksum=bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf
            ;;
        gitleaks)
            asset=https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
            checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
            ;;
        regctl)
            asset=https://github.com/regclient/regclient/releases/download/v0.11.7/regctl-linux-amd64
            checksum=3737fbbdd791e04e7a831640b681f3397a376498e80e2ad9b1b2d27296f239bc
            ;;
        *)
            echo "Unknown security tool: $tool" >&2
            exit 1
            ;;
    esac

    curl --fail --silent --show-error --location --retry 3 "$asset" -o "$download_dir/asset"
    printf '%s  %s\n' "$checksum" "$download_dir/asset" | sha256sum --check --status
    if [[ "$asset" == *.tar.gz ]]; then
        tar -xzf "$download_dir/asset" -C "$download_dir" "$tool"
        install -m 0755 "$download_dir/$tool" "$destination/$tool"
    else
        install -m 0755 "$download_dir/asset" "$destination/$tool"
    fi
done
