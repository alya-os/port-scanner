# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Delegated implementation choice: Tauri 2 with a React/TypeScript interface and a Rust system layer. The same product must run on macOS, Windows, and Linux, while platform commands adapt to each operating system.

## Users

The primary user is a developer who runs many local applications, containers, previews, APIs, and databases and needs to understand which ports and background processes are still active.

## Product Purpose

The product inventories listening TCP ports and bound UDP ports, connects them to processes and working folders, separates system services from user-launched work, and makes stale or duplicate development processes easy to identify and stop safely.

## Positioning

The product explains open ports through the developer's actual project hierarchy: application or working folder, process family, process instance, and child ports. It combines network visibility with safe local cleanup instead of presenting an anonymous socket table.

## Operating Context

- Runs locally as a desktop utility.
- Scans real sockets and process metadata on the current machine.
- Opens a process working directory in the native file manager or terminal.
- Supports frequent rescans while development tools are starting and stopping.
- Is prepared for publication as the open-source `alya-os/port-scanner` GitHub repository.

## Capabilities and Constraints

- List all discoverable listening TCP sockets and fixed bound UDP sockets.
- Show port, protocol, bound address, network scope, PID, parent PID, executable, command, working directory, start time, uptime, CPU activity, memory, and active connection count when the OS permits it.
- Categorize entries as Applications, operating-system services, or Others.
- Search, sort, filter, expand, collapse, and inspect process families and their ports.
- Distinguish confirmed identical independent processes from possible similarities and managed workers by comparing executable, working directory, normalized command, process relationships, and listener ownership.
- Open the working folder and start a terminal in that folder.
- Stop one or several selected process instances only after confirmation.
- Stop the exact selected Docker container by container ID instead of treating Docker Desktop's shared backend PID as the target.
- Enforce protection rules in the Rust backend as well as the interface.
- Ship editable protection rules for processes, paths, and ports, with system services protected by default.
- Default to dark mode, with light and system modes available.
- Some system-owned process details can remain unavailable without elevated privileges; the product must report that limitation instead of pretending the scan is complete.
- The confirmed public product name is **Port Scanner** with the positioning line “Every port, traced to its root.” / “Chaque port, jusqu’à sa racine.”

## Brand Commitments

- The selected source of visual truth is `design/reference-dark.png`.
- The confirmed application logo is `src-tauri/icons/icon.png`.
- Preserve its relationship-first tree, compact data density, technical inspector, teal selection, amber review states, red destructive states, and lavender protected-system state.
- Reuse the sidebar labels and icon semantics: Tous, Applications, macOS or System, Autres, and Proteges.

## Evidence on Hand

- Dark implementation target: `design/reference-dark.png`.
- A real macOS scan in the originating conversation identified 34 listening TCP ports, 10 fixed UDP ports, Docker mappings, Local services, orphaned Python/Node servers, and system services.
- Repository target: `https://github.com/alya-os/port-scanner`.
- License: MIT, copyright ALYA Labs (2026).
- No analytics or signed public distribution policy has been confirmed.

## Product Principles

1. Explain origin before offering destruction.
2. Prefer safe defaults and backend-enforced protections.
3. Preserve technical truth while translating it into useful project context.
4. Make duplicates, exposure, activity, and age scannable in seconds.
5. Adapt platform commands without changing the core workflow.

## Accessibility & Inclusion

Keyboard access, visible focus, reduced-motion support, readable dense typography, and WCAG-readable contrast are required for the primary workflow.
