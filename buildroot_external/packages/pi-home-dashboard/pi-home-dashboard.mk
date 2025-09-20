################################################################################
# pi-home-dashboard.mk - Buildroot package for Raspberry Pi sensors web application
################################################################################

PI_HOME_DASHBOARD_VERSION = main
PI_HOME_DASHBOARD_SITE = https://github.com/msmouni/pi-home-dashboard.git
PI_HOME_DASHBOARD_SITE_METHOD = git
PI_HOME_DASHBOARD_SITE_OPTIONS = --depth=1

define PI_HOME_DASHBOARD_INSTALL_TARGET_CMDS
	# Install binary
	$(INSTALL) -D -m 0755 \
		$(@D)/target/$(RUSTC_TARGET_NAME)/release/pi-home-dashboard \
		$(TARGET_DIR)/usr/bin/pi-home-dashboard

	# Install web resources
	$(INSTALL) -D -m 0644 $(@D)/templates/index.html \
		$(TARGET_DIR)/usr/share/pi-home-dashboard/templates/index.html
endef

$(eval $(cargo-package))
