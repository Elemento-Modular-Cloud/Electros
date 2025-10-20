#!/bin/bash
set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
dist_dir="${script_dir}/dist"

platform=""
arch=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --platform) platform="$2"; shift ;;
        --arch) arch="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$platform" ]; then
    echo "Error: --platform must be specified (linux, win, mac)"
    exit 1
fi

# Default archs by platform if not specified
if [ -z "$arch" ]; then
    case "$platform" in
        mac) arch="x64,arm64" ;;
        linux) arch="x64,arm64" ;;
        win) arch="x64" ;;
        *) echo "Unsupported platform: $platform"; exit 1 ;;
    esac
fi

echo "🔧 Building Electros locally"
echo "   Platform: $platform"
echo "   Arch:     $arch"

cd "$script_dir"

# Clean dist
rm -rf "$dist_dir"
mkdir -p "$dist_dir"

# Run electron-builder
npx electron-builder --$platform --$arch

echo "✅ Build complete. Artifacts are in: $dist_dir"
