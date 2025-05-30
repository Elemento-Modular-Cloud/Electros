#!/bin/bash

export GITHUB_TOKEN=$CI_TOKEN

# Function to check if required tools are installed
check_requirements() {
    command -v curl >/dev/null 2>&1 && echo "Dependency satisfied: curl" || { echo "Error: curl is required but not installed." >&2; exit 1; }
    command -v jq >/dev/null 2>&1 && echo "Dependency satisfied: jq" || { echo "Error: jq is required but not installed." >&2; exit 1; }
}

# Function to get the latest release version
get_latest_release() {
    local repo="Elemento-Modular-Cloud/elemento-monorepo-client"
    local api_url="https://api.github.com/repos/${repo}/releases/latest"
    
    [ -z "$GITHUB_TOKEN" ] && { echo "Error: GITHUB_TOKEN environment variable is not set" >&2; exit 1; }
    
    echo "Fetching latest release info from ${repo}..." >&2
    
    local version=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$api_url" | jq -r '.tag_name' | sed 's/^v//')
    [ -z "$version" ] || [ "$version" = "null" ] && { echo "Error: Could not determine version number" >&2; exit 1; }

    echo "Found latest version: $version" >&2
    echo "$version"
}

# Function to get asset information for a specific version
get_release_assets() {
    local version="$1"
    local repo="Elemento-Modular-Cloud/elemento-monorepo-client"
    local api_url="https://api.github.com/repos/${repo}/releases/tags/v${version}"
    
    echo "Fetching assets for version ${version}..." >&2
    
    local release_data=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "$api_url")
    [ $? -ne 0 ] && { echo "Error: Failed to fetch release data" >&2; exit 1; }
    
    # Return array of asset_id|filename|url
    echo "$release_data" | jq -r '.assets[] | "\(.id)|\(.name)|\(.browser_download_url)"'
}

# Function to download a single asset
download_asset() {
    local asset_id="$1"
    local filename="$2"
    local target_dir="$3"
    local repo="Elemento-Modular-Cloud/elemento-monorepo-client"
    
    echo "Downloading $filename to $target_dir..."
    
    curl_command="curl -L \
        -H \"Accept: application/octet-stream\" \
        -H \"Authorization: Bearer $GITHUB_TOKEN\" \
        -H \"X-GitHub-Api-Version: 2022-11-28\" \
        -o \"$target_dir/$filename\" \
        \"https://api.github.com/repos/${repo}/releases/assets/${asset_id}\""
    

    echo "Executing: $curl_command"
    eval $curl_command
        
    [ $? -eq 0 ] && {
        echo "Successfully downloaded $filename"
        chmod +x "$target_dir"/*
    } || echo "Failed to download $filename"
}

# Function to determine platform and architecture from filename
get_platform_info() {
    local filename="$1"
    local platform=""
    local arch=""
    
    case "$filename" in
        *"linux"*)
            platform="linux"
            [[ $filename == *"arm"* ]] && arch="arm64" || arch="x64"
            ;;
        *"mac"*)
            platform="mac"
            [[ $filename == *"arm"* ]] && arch="arm64" || arch="x64"
            ;;
        *"win"*)
            platform="win"
            arch="x64"
            ;;
    esac
    
    [ -n "$platform" ] && [ -n "$arch" ] && echo "${platform}|${arch}"
}

main() {
    selected_platforms=()
    selected_archs=()

    while [[ "$#" -gt 0 ]]; do
        case $1 in
            --platform) selected_platforms+=("$2"); shift ;;
            --arch) selected_archs+=("$2"); shift ;;
        esac
        shift
    done

    # Default to all platforms if none specified
    if [ ${#selected_platforms[@]} -eq 0 ]; then
        selected_platforms=("mac" "linux" "win")
    fi

    # Default to all architectures if none specified
    if [ ${#selected_archs[@]} -eq 0 ]; then
        selected_archs=("x64" "arm64")
    fi

    echo "Selected platforms: ${selected_platforms[@]}"
    echo "Selected architectures: ${selected_archs[@]}"


    check_requirements
    
    # Get latest version
    local version=$(get_latest_release)
    echo "Processing version: $version"
    
    # Get all assets for this version
    local output_dir="electros-daemons"
    
    get_release_assets "$version" | while IFS='|' read -r asset_id filename url; do
        [ -z "$asset_id" ] && continue
        
        # Get platform info
        local platform_info=$(get_platform_info "$filename")
        [ -z "$platform_info" ] && continue
        
        # Create target directory and download
        IFS='|' read -r platform arch <<< "$platform_info"
        local target_dir="${output_dir}/${platform}/${arch}"


        if [[ ! " ${selected_platforms[@]} " =~ " ${platform} " ]]; then
            continue
        fi

        if [[ ! " ${selected_archs[@]} " =~ " ${arch} " ]]; then
            continue
        fi

        mkdir -p "$target_dir"
        
        download_asset "$asset_id" "$filename" "$target_dir"

        if [[ "$filename" == *.zip ]]; then
            echo "Extracting contents of $filename"
            unzip "${target_dir}/${filename}" -d "$target_dir"
            # Find the DMG file inside the extracted contents
            dmg_file=$(find "$target_dir" -name "*.dmg" -type f)
            if [[ -n "$dmg_file" ]]; then
                echo "Found DMG file: $dmg_file"
                # Move the DMG file to the target directory if it's in a subdirectory
                if [[ "$(dirname "$dmg_file")" != "$target_dir" ]]; then
                    mv "$dmg_file" "$target_dir/"
                fi
                dmg_filename=$(basename "$dmg_file")
                # Clean up everything except the DMG
                find "$target_dir" -not -name "$dmg_filename" -not -path "$target_dir" -delete
            fi
            rm "${target_dir}/${filename}"
        elif [[ "$filename" == *.tar.gz ]]; then
            echo "Extracting contents of $filename"
            tar -xzf "${target_dir}/${filename}" -C "$target_dir"
            rm "${target_dir}/${filename}"
        fi

        # Now handle the DMG file that was either downloaded directly or extracted from ZIP
        dmg_file=$(find "$target_dir" -name "*.dmg" -type f)
        if [[ -n "$dmg_file" ]]; then
            echo "Processing DMG file: $dmg_file"
            hdiutil attach "$dmg_file"
            dmg_mount_point="/Volumes/Elemento_daemons"
            echo "Mount point: ${dmg_mount_point}"
            ls -la "${dmg_mount_point}"
            rsync -E -p -t -r -l "${dmg_mount_point}/elemento_client_daemons.app" "$target_dir/"
            hdiutil detach "${dmg_mount_point}"
            rm "$dmg_file"
        fi
    done
}

# Run main function
main "$@"
