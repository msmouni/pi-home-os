################################################################################
# pi-home-dashboard.mk - Buildroot package for Raspberry Pi sensors web application
################################################################################

PI_HOME_DASHBOARD_VERSION = main
PI_HOME_DASHBOARD_SITE = https://github.com/msmouni/pi-home-dashboard.git
PI_HOME_DASHBOARD_SITE_METHOD = git
PI_HOME_SENSORS_GIT_SUBMODULES = YES

define PI_HOME_DASHBOARD_BUILD_CMDS
	cd $(@D) && \
	cargo build --target aarch64-unknown-linux-gnu --release
endef

define PI_HOME_DASHBOARD_INSTALL_TARGET_CMDS
	# Install binary
	$(INSTALL) -D -m 0755 \
		$(@D)/target/$(RUSTC_TARGET_NAME)/release/pi-home-dashboard \
		$(TARGET_DIR)/usr/bin/pi-home-dashboard

	# Install web resources
	$(INSTALL) -D -m 0644 $(@D)/templates/* \
		$(TARGET_DIR)/usr/share/pi-home-dashboard/templates/

	$(INSTALL) -D -m 0644 $(@D)/static/* \
		$(TARGET_DIR)/usr/share/pi-home-dashboard/static/
endef

$(eval $(generic-package))
