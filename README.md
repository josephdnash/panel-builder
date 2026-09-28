MSFS Web Panel Builder ✈️

https://centennial-simulations.com/panel-builder/

A highly optimized, web-based electronic flight bag (EFB) and custom panel builder for Microsoft Flight Simulator.

Designed to run beautifully on iPads, tablets, or secondary monitors, this application allows flight simulation enthusiasts to build, customize, and share interactive instrument panels without writing a single line of code. By connecting to MSFS via a high-frequency WebSocket relay, the Panel Builder provides zero-latency telemetry to custom gauges, switches, and dials.

Whether you need a simple button box for a Cessna 172 or a complex, multi-page FMC setup for an airliner, this tool provides a drag-and-drop canvas to make it happen.

Key Features
Real-Time Telemetry: Consumes 20Hz background data streams from MSFS to drive live gauges, active CSS toggle states, and numeric readouts.

Visual Layout Editor: A drag-and-drop grid system supporting dynamic pagination, nested folders, and custom component creation.

Cloud Synchronization: Authenticated users can save their aircraft-specific layouts to the cloud via Firebase, ensuring panels are accessible across any device.

Community Sharing: Generate unique "Share Codes" to instantly export and import panel layouts with the global flight sim community.

Bulletproof Variable Handling: Advanced dictionary logic seamlessly parses standard SimVars and custom L-Vars with automatic case-correction and fallback rendering.

Theming Engine: Toggle between a sleek "Modern" dark mode or aviation-inspired "Retro" CRT themes (Green, Amber, Blue).


Under the Hood

Built for absolute maximum performance, the React architecture is specifically engineered to handle aggressive WebSocket spam without choking the CPU.

Frontend: React (Vite) with heavily optimized React.memo cell rendering to prevent unnecessary DOM updates.

Backend: Firebase Authentication & Realtime Database.

Optimization: Custom debounced cloud-saving hooks protect the database from rate limits during rapid user inputs.

Testing: Comprehensive unit test coverage via Vitest and JSDOM, mocking WebSocket connections to guarantee flawless data handling.
