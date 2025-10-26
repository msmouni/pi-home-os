# 🏠 Pi-Home-OS ![Raspberry Pi Images](https://github.com/msmouni/pi-home-os/actions/workflows/github-actions.yml/badge.svg)

*A lightweight embedded Linux system for Raspberry Pi featuring secure sensor monitoring and a modern Rust web dashboard.*

**Pi-Home-OS** is a custom **Buildroot-based OS** integrating:

* [**pi-home-sensors**](https://github.com/msmouni/pi-home-sensors) — a C daemon for I²C sensor acquisition and SQLite data logging.
* [**pi-home-dashboard**](https://github.com/msmouni/pi-home-dashboard) — a Rust/Axum web application providing authentication and real-time visualization.
* **SysV init** for daemon management and automated network setup.
* **GitHub Actions** for continuous integration and automated image releases.
