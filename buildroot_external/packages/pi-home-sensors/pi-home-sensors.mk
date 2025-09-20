################################################################################
# pi-home-sensors.mk - Buildroot package for Raspberry Pi sensors
################################################################################

PI_HOME_SENSORS_VERSION = main
PI_HOME_SENSORS_SITE = https://github.com/msmouni/pi-home-sensors.git
PI_HOME_SENSORS_SITE_METHOD = git

PI_HOME_SENSORS_DEPENDENCIES = sqlite

define PI_HOME_SENSORS_BUILD_CMDS
	$(MAKE) -C $(@D) \
	    CC="$(TARGET_CC)"
endef

define PI_HOME_SENSORS_INSTALL_TARGET_CMDS
	# Create writable directory for the DB
	mkdir -p $(TARGET_DIR)/var/lib/pi-home-sensors_data
	
	$(INSTALL) -D -m 0755 $(@D)/build/bin/pi-home-sensors $(TARGET_DIR)/usr/bin/pi-home-sensors
endef

$(eval $(generic-package))
