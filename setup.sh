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
cd - > /dev/null

echo "Setup complete!"

# Find and run setup scripts in electros-* folders
for dir in electros-*/; do
    echo
    if [ -d "$dir" ]; then
        echo "Checking setup scripts in $dir..."
        
        if [ -f "${dir}setup.sh" ]; then
            echo "Running setup script in $dir..."
            cd "$dir"
            bash setup.sh
            cd - > /dev/null
        fi
        
        if [ -f "${dir}install.sh" ]; then
            echo "Running install script in $dir..."
            cd "$dir"
            bash install.sh
            cd - > /dev/null
        fi
    fi
done

