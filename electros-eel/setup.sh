#! /bin/bash

# Create and activate virtual environment
python3 -m venv env
source env/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt
deactivate
