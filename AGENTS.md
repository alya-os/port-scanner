# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

# Product decisions

- The confirmed public product name is **PortRoot**. Use `portroot` for package/repository slugs and `ca.jplefebvre.portroot` for the desktop identifier.
- The product promise is “Every port, traced to its root.” / “Chaque port, jusqu’à sa racine.”
- The selected source is `design/reference-dark.png`.
- Dark mode is the default daily-use theme; light and system themes must remain available.
- Keep the relationship-first hierarchy: working folder/application -> process family -> ports.
- The left navigation must use the selected icon language for Tous, Applications, macOS/System, Autres, and Proteges.
- Keep the sidebar collapsible from its top control, with theme and settings utilities anchored at the bottom.
- Scrollbars should use PortRoot's quiet graphite track/thumb treatment with teal interaction states.
- Make the working directory, duplicate processes, process activity, scope, and protection state easy to scan.
- Destructive process actions require confirmation and backend protection checks.
- The production target is Tauri 2 + React/TypeScript + Rust for macOS, Windows, and Linux.
