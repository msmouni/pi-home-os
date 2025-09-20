################################################################################
# rpi_web_app.mk - Buildroot package for Raspberry Pi sensors web application
################################################################################

RPI_WEB_APP_SITE = $(TOPDIR)/../rpi_web_app
RPI_WEB_APP_SITE_METHOD = local

RPI_WEB_APP_DEPENDENCIES = host-rustc host-cargo sqlite

define RPI_WEB_APP_BUILD_CMDS
    cd $(@D) && $(HOST_DIR)/bin/cargo build --release --target $(RUSTC_TARGET_NAME)
endef

define RPI_WEB_APP_INSTALL_TARGET_CMDS
    $(INSTALL) -D -m 0755 $(@D)/target/$(RUSTC_TARGET_NAME)/release/rpi_web_app $(TARGET_DIR)/usr/bin/rpi_web_app
    $(INSTALL) -D -m 0644 $(@D)/templates/index.html $(TARGET_DIR)/usr/share/rpi_web_app/templates/index.html
endef

$(eval $(generic-package))
