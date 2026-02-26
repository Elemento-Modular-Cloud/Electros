#! /bin/bash
script_dir="$(cd "$(dirname "$0")" && pwd)"
build_dir="${script_dir}/build"
dist_dir="${script_dir}/dist"
mkdir -p "${build_dir}"

cd "${script_dir}"

# Function to copy daemon executable for target platform and architecture
setup_daemons() {
    local platform=$1
    local arch=$2
    
    # Remove existing daemon directory if present
    rm -rf "${script_dir}/electros-daemons"
    
    # Create new directory for appropriate daemon folder
    mkdir -p "${script_dir}/electros-daemons/${platform}"

    rsync -E -p -t -r -l "${script_dir}/../electros-daemons/${platform}/${arch}" "${script_dir}/electros-daemons/${platform}/"    
}

platforms=()
archs=()
version=""

# Parse command line arguments for platform and architecture
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --platform) platforms+=("$2"); shift ;;
        --arch) user_archs+=("$2"); shift ;;
        --version) version="$2"; shift ;;
    esac
    shift
done

# Extract version from package.json if not provided
if [ -z "$version" ]; then
    version=$(node -p "require('${script_dir}/package.json').version")
fi

clean_version=${version#v}
clean_version=${clean_version%%[-+]*}

# Default to all platforms if none specified
if [ ${#platforms[@]} -eq 0 ]; then
    platforms=("mac" "linux" "win")
fi

echo "Platforms: ${platforms[@]}"

for platform in "${platforms[@]}"; do
    # Default to all architectures for each platform if none specified
    if [ ${#user_archs[@]} -eq 0 ]; then
        if [ "$platform" == "mac" ]; then
            archs=("x64" "arm64")
        elif [ "$platform" == "linux" ]; then
            archs=("x64" "arm64")
        elif [ "$platform" == "win" ]; then
            archs=("x64")
        fi
    else
        archs=("${user_archs[@]}")
    fi
    echo "Architectures: ${archs[@]}"

    for arch in "${archs[@]}"; do
        setup_daemons "$platform" "$arch"
        npm run build -- --"$platform" --"$arch"
        mkdir -p "${build_dir}/${platform}/${arch}"
        if [ "$platform" == "mac" ]; then
            mv "${dist_dir}/Electros-${clean_version}_mac-${arch}.dmg" "${build_dir}/${platform}/${arch}/Electros-${version}-mac-${arch}.dmg"
        elif [ "$platform" == "linux" ]; then
            if [ "$arch" == "x64" ]; then
                mv "${dist_dir}/Electros-${clean_version}_linux-x86_64.AppImage" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-x64.AppImage"
                mv "${dist_dir}/Electros-${clean_version}_linux-amd64.deb" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-x64.deb"
                mv "${dist_dir}/Electros-${clean_version}_linux-x86_64.rpm" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-x64.rpm"
            elif [ "$arch" == "arm64" ]; then
                mv "${dist_dir}/Electros-${clean_version}_linux-arm64.AppImage" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-arm64.AppImage"
                mv "${dist_dir}/Electros-${clean_version}_linux-arm64.deb" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-arm64.deb"
                mv "${dist_dir}/Electros-${clean_version}_linux-aarch64.rpm" "${build_dir}/${platform}/${arch}/Electros-${version}-linux-arm64.rpm"
            fi
        elif [ "$platform" == "win" ]; then
            mv "${dist_dir}/Electros-${clean_version}_win-${arch}.exe" "${build_dir}/${platform}/${arch}/Electros-${version}-win-${arch}.exe"
        fi
    done
done

# Cleanup symlink after builds
rm -rf "${script_dir}/electros-daemons"

cd "${script_dir}"
