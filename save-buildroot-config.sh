#!/bin/bash

source shared.sh

# Save Buildroot defconfig
make -C buildroot savedefconfig BR2_DEFCONFIG=$RPI4_SENSORS_DEFCONFIG_REL_BUILDROOT

# Save Linux defconfig if enabled
if [ -e buildroot/.config ] && ls buildroot/output/build/linux-*/.config 1>/dev/null 2>&1; then
    grep -q "BR2_LINUX_KERNEL_CUSTOM_CONFIG_FILE" buildroot/.config
    if [ $? -eq 0 ]; then
        echo "Saving Linux defconfig"
        make -C buildroot linux-update-defconfig \
            BR2_LINUX_KERNEL_CUSTOM_CONFIG_FILE=$RPI4_SENSORS_LINUX_CONFIG_REL_BUILDROOT
    fi
fi