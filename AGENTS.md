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
- Do not repeat the platform name below the sidebar utilities; platform identity belongs to the system navigation item only.
- Scrollbars should use PortRoot's quiet graphite track/thumb treatment with teal interaction states.
- Avoid native select popovers for themed controls; use PortRoot-styled menus so every option remains legible in dark and light modes.
- Sorting belongs directly to the five process-tree column headers; do not add a separate toolbar sort control.
- Sorting the Item column must reorder the top-level project/folder groups in the chosen direction, while system-service groups remain pinned at the bottom.
- Refreshing preserves the workbench geometry: the scan button keeps a fixed footprint and current results stay in place beneath a localized loading state until replacement data is ready.
- English is the default interface language; a user's explicit French or English choice from Settings must persist across launches.
- Make the working directory, duplicate processes, process activity, scope, and protection state easy to scan.
- Duplicate analysis must distinguish confirmed identical independent instances from possible similarities and managed workers, and expose the supporting evidence in the inspector.
- Confirmed duplicate groups must offer both actions: stop the entire group, or stop only the duplicates while keeping one explicitly selected instance open.
- Destructive process actions require confirmation and backend protection checks.
- The inspector must allow custom protections to be removed. Shared rules must disclose their full process/port impact before removal, and new Docker protections must target the exact container name instead of Docker Desktop's shared data path.
- The All view must offer a session-level toolbar filter for hiding protected processes without changing or deleting their protection rules.
- The production target is Tauri 2 + React/TypeScript + Rust for macOS, Windows, and Linux.
