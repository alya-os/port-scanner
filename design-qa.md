# Design QA

- Source visual truth: `design/reference-dark.png`
- Implementation screenshot: `design/qa/implementation-dark-final.png`
- Viewport: 1440 × 1024
- State: dark theme, all categories, Brandtracker selected and expanded
- Full-view comparison evidence: `design/qa/comparison-dark-final.png`
- Focused sidebar evidence: `design/qa/comparison-sidebar-final.png`
- Focused inspector evidence: `design/qa/comparison-inspector-final.png`
- Annotated feedback source: `design/annotations/sidebar-controls-and-scrollbars.png`
- Annotated feedback comparison: `design/qa/comparison-annotation-sidebar-final.png`
- Sort-menu feedback source: `design/annotations/sort-menu-native-dark-contrast.png`
- Sort-menu comparison: `design/qa/comparison-sort-menu-final.png`
- Language comparison: `design/qa/comparison-settings-language-final.png`
- Additional states: `design/qa/implementation-light-v1.png`, `design/qa/implementation-compact-final.png`, `design/qa/implementation-sidebar-collapsed-final.png`, `design/qa/implementation-sort-menu-dark-final.png`, `design/qa/implementation-sort-menu-light-final.png`, `design/qa/implementation-french-final.png`, `design/qa/implementation-english-final.png`

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the implementation uses the native UI family for each operating system and a dedicated monospace stack only for commands, PIDs, ports, and addresses. Weight, scale, line height, truncation, and dense-table hierarchy preserve the source intent.
- Spacing and layout rhythm: the sidebar, toolbar, relationship tree, inspector, and status bar retain the source composition. The 1440 × 1024 frame has no page overflow. At 1080 × 700 the compact grid has no horizontal or body overflow and keeps the persistent action area visible.
- Colors and visual tokens: graphite surfaces, teal selection, green activity, amber review, red exposure/destruction, and lavender system protection match the source semantics in both themes. The light theme preserves the same information hierarchy.
- Image and icon fidelity: the interface has no raster content requirement. All visible icons come from one Phosphor icon family; the requested grid, monitor, Apple, puzzle, and lock navigation semantics are present. Process icons adapt to Python, Node, Docker, database, and system types.
- Copy and content: labels are French and actions name their consequence. The browser evidence is explicitly marked “Données de démonstration”; the packaged Tauri application uses the native scanner.
- States and interactions: search, category filters, sorting, expansion, selection, theme toggle, settings, protection rules, kill confirmation, loading, empty, disabled, success, and error states are implemented.
- Sidebar utilities: the former decorative top mark is now the sidebar collapse control; theme and settings remain reachable at the bottom in both expanded and collapsed states.
- Scroll ownership: the process tree, inspector, settings content, and rule list use graphite tracks and thumbs with teal hover feedback in dark and light themes.
- Accessibility: semantic buttons and regions, visible focus, keyboard search shortcut, Escape handling, modal focus entry/trapping/restoration, accessible switch labels, reduced-motion support, and readable contrast are present. The faint-text tokens measure 6.49:1 in dark mode and 5.05:1 in light mode against their primary surfaces.

## Intentional Product Deviations

- The working folder name replaces the generic “Développement” group when a real directory is known. This makes project origin and duplicate families faster to identify, matching the user’s explicit priority.
- The left navigation owns category filtering, so the redundant top category segmented control from the generated image is omitted.
- The inspector adds memory, active connections, multiple PIDs, copy actions, and protection reasons because these values are available from the real scanner.

## Comparison History

### Pass 1

- P2: the working directory was truncated to one line in the inspector.
- P2: the compact 1080 px layout produced a 13 px horizontal tree overflow.
- P2: the selected-process icon did not reflect the detected runtime type.

Fixes:

- Expanded the origin path to a readable two-line field and widened the desktop inspector to 430 px.
- Rebalanced compact grid tracks; measured tree `clientWidth` and `scrollWidth` now both equal 616 px.
- Added type-aware inspector icons using the same icon family as the process tree.

### Pass 2

- Full-view and focused comparisons show the selected hierarchy, icon language, inspector actions, and destructive separation intact.
- 1440 px layout: body `clientWidth` = `scrollWidth` = 1440 px.
- 1080 px layout: body `clientWidth` = `scrollWidth` = 1080 px; tree `clientWidth` = `scrollWidth` = 616 px; inspector actions end at y = 652 within a 700 px viewport.
- Browser console: zero warnings and zero errors.

### Pass 3

- Corrected process identity grouping so two projects with the same leaf-folder and process names remain separate when their full executable or working-directory paths differ.
- Changed one-click protection to create a project-path rule when a working folder is available, with the same check repeated by the native backend immediately before a stop request.
- Made system icons platform-aware for macOS, Windows, and Linux.
- Added an explicit demo-data indicator to the browser preview and strengthened faint-text contrast in both themes.
- Keyboard checks confirm initial focus, forward and reverse tab trapping, and focus restoration for Settings and stop-confirmation dialogs.

### Pass 4

- Applied the annotated sidebar feedback without changing the relationship-first hierarchy: the top control collapses the rail from 102 px to 64 px and expands the center workspace.
- Moved theme and settings from the toolbar into a persistent bottom sidebar utility group. Both controls remain keyboard accessible and functional while the sidebar is collapsed.
- Replaced generic browser scrollbars with Port Scanner graphite thumbs/tracks and teal interaction states. Computed dark-mode inspector thumb color is `rgb(53, 80, 90)`.
- 1440 × 1024 interaction checks: sidebar width = 64 px when collapsed, toolbar left edge = 64 px, and category labels are visually hidden while accessible button names remain available.
- 1080 × 760 compact check: body `clientWidth` = `scrollWidth` = 1080 px; toolbar `clientWidth` = `scrollWidth` = 992 px; tree `clientWidth` = `scrollWidth` = 631 px.
- Settings opens from the new sidebar position; theme changes dark → light → dark; collapse changes expanded → collapsed → expanded.

### Pass 5

- Replaced the operating-system `<select>` popup, whose white surface made dark-mode options unreadable, with a Port Scanner-owned listbox menu.
- The open menu now uses the raised graphite surface, strong graphite seam, teal selected state, checkmark, focus halo, and the same compact 7 px control radius as the toolbar.
- Dark open-state colors: menu `rgb(13, 26, 34)`, unselected option text `rgb(195, 205, 209)`, selected text `rgb(34, 195, 189)`.
- Light open-state colors: menu `rgb(255, 255, 255)`, unselected option text `rgb(52, 74, 83)`.
- Pointer selection, Arrow Up/Down, Home/End, Enter/Space selection, Escape dismissal with focus restoration, Tab dismissal, and outside-click dismissal are implemented.
- Browser checks confirm Arrow Down moves focus from Évaluation to Activité, Enter selects Activité, and Escape closes the menu and restores focus to the trigger.
- At 1080 × 760 with the menu open, body and toolbar both have equal client/scroll widths, the picker contracts to 154 px, and the menu remains inside the viewport.

### Pass 6

- Added a persistent Français / English interface-language setting. French remains the migration-safe default for existing installations.
- Changing the draft language updates the Settings dialog immediately; saving applies the selected language to navigation, toolbar, process tree, inspector, status bar, confirmations, notifications, dates, durations, memory units, accessibility labels, and built-in protection-rule labels.
- Browser flow passed: Réglages → English → Save switches the full app and sets `<html lang="en">`; reloading preserves English. Settings → Français → Enregistrer restores the full app and `<html lang="fr">`; reloading preserves French.
- English singular grammar is verified (`1 process`), while technical names, project paths, commands, PIDs, and custom rule labels remain unchanged.
- At the measured 1094 × 998 viewport, body and toolbar client/scroll widths remain equal in English. The Settings dialog keeps its footer actions visible and scrolls only its content region.
- Browser console: zero warnings and zero errors.

## Primary Interactions Tested

- Filter to Applications and return to Tous.
- Search for port 5432 and clear the search.
- Toggle dark to light and back to dark.
- Open and close Settings.
- Collapse and expand the sidebar, including checking label visibility and gained workspace width.
- Open the sort menu in dark and light themes; select by pointer and keyboard; dismiss with Escape.
- Switch Settings from French to English and back, save each language, reload, and verify full-interface persistence.
- Open and cancel the multi-process stop confirmation.
- Confirm that the dialog explains backend protection revalidation.
- Confirm that protecting Brandtracker creates a rule scoped to its full project directory, then remove the test rule.
- Confirm Settings and stop-confirmation focus entry, tab wrapping, and focus restoration.

final result: passed
