# Keep the runtime modular and Host-operated

`pagebldr` provides optional server lifecycle, Storage adapters, route Runtime,
framework helpers, and versioned events because these remove repeated
correctness work across Hosts. It operates no hosted database, API, route, or
telemetry collector: the Host mounts modules, supplies authorization/scope/Event
sinks, and bears all traffic and operational responsibility, preserving
local-only use and preventing the package from becoming a hosted CMS.
