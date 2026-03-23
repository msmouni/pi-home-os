#!/bin/bash

set -e

CONFIG_FILE="$BINARIES_DIR/rpi-firmware/config.txt"

# Function to append a line if it doesn't already exist
append_if_not_exists() {
    local line="$1"
    local file="$2"
    
    # -q: Quiet mode (no output, just return success/failure).
    # -x: Match the whole line exactly.
    # -F: Interpret the pattern as a fixed string (not a regex).
    grep -qxF "$line" "$file" || echo "$line" >> "$file"
}

append_if_not_exists "# Appending I2C settings" "$CONFIG_FILE"
append_if_not_exists "dtparam=i2c_arm=on" "$CONFIG_FILE"
append_if_not_exists "dtparam=i2c1=on" "$CONFIG_FILE"

append_if_not_exists "# Appending SPI settings" "$CONFIG_FILE"
append_if_not_exists "dtparam=spi=on" "$CONFIG_FILE"
append_if_not_exists "dtoverlay=piscreen,speed=16000000,invx=1" "$CONFIG_FILE"

./board/raspberrypi4/post-image.sh
