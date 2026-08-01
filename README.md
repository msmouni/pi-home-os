# Pi-Home-OS ![Raspberry Pi Images](https://github.com/msmouni/pi-home-os/actions/workflows/github-actions.yml/badge.svg)

Pi-Home OS is the main [Buildroot](https://buildroot.org/) based system for the Pi-Home project.

It provides a lightweight Linux environment for Raspberry Pi and integrates the different Pi-Home services:

* [pi-home-sensors](https://github.com/msmouni/pi-home-sensors) — collects data from sensors connected directly to the Raspberry Pi and stores it in SQLite.
* [pi-home-dashboard](https://github.com/msmouni/pi-home-dashboard) — provides the web interface for monitoring sensors and controlling devices.
* [pi-home-display](https://github.com/msmouni/pi-home-display) — handles local OLED, LCD, and SPI displays.
* [pi-home-lafvin-ui](https://github.com/msmouni/pi-home-lafvin-ui) — provides the LVGL-based graphical interface for the Lafvin SPI display.
* [libsensors](https://github.com/msmouni/libsensors) — common sensor-handling functionality shared across the project.

The system combines local sensors, MQTT devices, web monitoring, device control, and physical displays into a single embedded home monitoring and automation platform.
