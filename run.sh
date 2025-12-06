#!/usr/bin/env bash

# Exit immediately on error
set -e

# Activate the virtual environment
source .venv/bin/activate

# Run the Django development server
python manage.py runserver
