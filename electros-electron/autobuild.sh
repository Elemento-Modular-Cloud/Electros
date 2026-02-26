#! /bin/bash
script_dir="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${GITHUB_ACTIONS}" ]; then
    source "${script_dir}/venv/bin/activate" || exit 1
fi

version=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --platform) platforms+=("$2"); shift ;;
        --arch) user_archs+=("$2"); shift ;;
        --version) version="$2"; shift ;;
    esac
    shift
done

cd "${script_dir}/.."

# if [ ${#platforms[@]} -gt 0 ] || [ ${#user_archs[@]} -gt 0 ]; then
#     ./populate_daemons.sh --platform "${platforms[@]}" --arch "${user_archs[@]}"
# else
#     ./populate_daemons.sh
# fi

cd "${script_dir}"

build_args=()
if [ ${#platforms[@]} -gt 0 ]; then
    build_args+=(--platform "${platforms[@]}")
fi
if [ ${#user_archs[@]} -gt 0 ]; then
    build_args+=(--arch "${user_archs[@]}")
fi
if [ -n "$version" ]; then
    build_args+=(--version "$version")
fi

if [ ${#build_args[@]} -gt 0 ]; then
    ./build.sh "${build_args[@]}"
else
    ./build.sh
fi

cd "${script_dir}/.."

rm -rf ./electros-daemons

cd "${script_dir}"

rm -rf ./dist
rm -rf ./electros-daemons
