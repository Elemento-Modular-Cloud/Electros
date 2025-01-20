#! /bin/bash
script_dir="$(cd "$(dirname "$0")" && pwd)"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --platform) platforms+=("$2"); shift ;;
        --arch) user_archs+=("$2"); shift ;;
    esac
    shift
done

cd "${script_dir}/.."

if [ ${#platforms[@]} -gt 0 ] || [ ${#user_archs[@]} -gt 0 ]; then
    ./populate_daemons.sh --platform "${platforms[@]}" --arch "${user_archs[@]}"
else
    ./populate_daemons.sh
fi

cd "${script_dir}"

if [ ${#platforms[@]} -gt 0 ] || [ ${#user_archs[@]} -gt 0 ]; then
    ./build.sh --platform "${platforms[@]}" --arch "${user_archs[@]}"
else
    ./build.sh
fi

cd "${script_dir}/.."

rm -rf ./electros-daemons

cd "${script_dir}"

rm -rf ./dist
rm -rf ./electros-daemons
