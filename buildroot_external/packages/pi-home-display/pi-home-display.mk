################################################################################
# pi-home-display.mk - Buildroot package for Raspberry Pi display
################################################################################

PI_HOME_DISPLAY_VERSION = main
PI_HOME_DISPLAY_SITE = https://github.com/msmouni/pi-home-display.git
PI_HOME_DISPLAY_SITE_METHOD = git
PI_HOME_DISPLAY_GIT_SUBMODULES = YES

PI_HOME_DISPLAY_DEPENDENCIES = sqlite

define PI_HOME_DISPLAY_BUILD_CMDS
	$(MAKE) -C $(@D) \
	    CC="$(TARGET_CC)"
endef

define PI_HOME_DISPLAY_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/build/bin/pi-home-display $(TARGET_DIR)/usr/bin/pi-home-display
endef

$(eval $(generic-package))
