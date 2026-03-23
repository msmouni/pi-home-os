################################################################################
# pi-home-lafvin-ui.mk - Buildroot package for Raspberry Pi lafvin UI
################################################################################

PI_HOME_LAFVIN_UI_VERSION = main
PI_HOME_LAFVIN_UI_SITE = https://github.com/msmouni/pi-home-lafvin-ui.git
PI_HOME_LAFVIN_UI_SITE_METHOD = git
PI_HOME_LAFVIN_UI_GIT_SUBMODULES = YES

PI_HOME_LAFVIN_UI_CONF_OPTS += -DBUILD_SHARED_LIBS=OFF

define PI_HOME_LAFVIN_UI_PRE_BUILD_HOOK
    $(TARGET_MAKE_ENV) $(@D)/generate_lv_conf.sh
endef

PI_HOME_LAFVIN_UI_PRE_BUILD_HOOKS += PI_HOME_LAFVIN_UI_PRE_BUILD_HOOK

$(eval $(cmake-package))