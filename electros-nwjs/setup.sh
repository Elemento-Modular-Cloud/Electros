#

# Download NW.js
echo "Downloading NW.js..."

# Allow overrides from command line for version, OS type, and CPU architecture
NWJS_VERSION=${1:-v0.94.1}
OS_TYPE=${2:-}
CPU_ARCH=${3:-}

# Determine OS type if not provided
if [[ -z "$OS_TYPE" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="osx"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_TYPE="linux"
    elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        OS_TYPE="win"
    else
        echo "Unsupported OS type: $OSTYPE"
        exit 1
    fi
fi

# Set default CPU architecture if not provided
if [[ -z "$CPU_ARCH" ]]; then
    if [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        CPU_ARCH="x64" # Assuming 64-bit architecture for Windows
    else
        CPU_ARCH=$(uname -m)
    fi
fi

wget https://dl.nwjs.io/$NWJS_VERSION/nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH.zip
unzip nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH.zip
if [[ "$OS_TYPE" == "osx" ]]; then
    mv nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH/nwjs.app .
else
    mv nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH/nwjs .
fi
rm -rf nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH.zip
rm -rf nwjs-sdk-$NWJS_VERSION-$OS_TYPE-$CPU_ARCH

echo "NW.js downloaded and installed successfully."
echo

# Install nwjs-builder-phoenix
echo "Installing nwjs-builder-phoenix..."
npm install nwjs-builder-phoenix --save-dev
echo "nwjs-builder-phoenix installed successfully."
