#!/bin/bash

echo "Initializing submodules..."

# Initialize and update all submodules
git submodule init
git submodule update

# Update each submodule individually to ensure latest versions
echo "Updating GUI elemento-gui-new..."
git submodule update --remote elemento-gui-new

echo "Updating nested submodules..."
cd elemento-gui-new
git submodule init
git submodule update --remote
cd -

echo "Setup complete!"
