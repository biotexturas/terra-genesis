#!/usr/bin/env bash
# mock-capture.sh — Emulates a TerraScope capture for testing.
# Produces a fake image and metadata in the output directory.
# Follows ADR-0009 contract: $1 = output directory.

set -euo pipefail

OUTPUT_DIR="${1:?Usage: mock-capture.sh <output-dir>}"

# Generate a deterministic fake image (random-ish but reproducible from hostname)
echo "TERRASCOPE-MOCK-IMAGE-$(hostname)-$(date +%s)" > "${OUTPUT_DIR}/capture.jpg"

# Generate metadata
cat > "${OUTPUT_DIR}/metadata.json" <<EOF
{
  "camera_tool": "mock",
  "resolution": "640x480",
  "quality": 90,
  "image_file": "capture.jpg",
  "captured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "terrascope_version": "mock-1.0"
}
EOF

echo "Mock capture complete: ${OUTPUT_DIR}/capture.jpg + ${OUTPUT_DIR}/metadata.json"
