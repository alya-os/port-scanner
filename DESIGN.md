---
name: PortRoot
description: A dense relationship-first desktop workbench for understanding and safely managing local ports and processes.
colors:
  graphite-canvas: "#071017"
  graphite-sidebar: "#08131a"
  graphite-surface: "#0a151c"
  graphite-raised: "#0d1a22"
  graphite-hover: "#11232c"
  graphite-selected: "#0c3037"
  graphite-selected-strong: "#0d3a42"
  graphite-line: "#1d2c34"
  graphite-line-strong: "#2b4049"
  text-primary: "#eaf0f2"
  text-soft: "#c3cdd1"
  text-muted: "#8fa1aa"
  text-faint: "#8799a2"
  teal-signal: "#12a9a8"
  teal-bright: "#22c3bd"
  teal-ink: "#021516"
  teal-soft: "rgba(18, 169, 168, 0.14)"
  green-activity: "#24c979"
  amber-review: "#f3ad25"
  red-danger: "#ff5258"
  red-danger-soft: "rgba(255, 82, 88, 0.08)"
  lavender-protected: "#b477ff"
  lavender-protected-soft: "rgba(180, 119, 255, 0.1)"
  overlay-scrim: "rgba(1, 7, 10, 0.72)"
  runtime-folder: "#27a5ff"
  runtime-python: "#e3b52c"
  runtime-node: "#55bd73"
  runtime-docker: "#28a8ef"
  runtime-database: "#7db3dc"
  white: "#ffffff"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Ubuntu, Cantarell, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Ubuntu, Cantarell, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Ubuntu, Cantarell, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  action:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Ubuntu, Cantarell, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Ubuntu, Cantarell, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.055em"
  code:
    fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  signal: "2px"
  keycap: "4px"
  compact: "6px"
  control: "7px"
  picker: "9px"
  surface: "11px"
  icon: "12px"
  dialog: "14px"
spacing:
  micro: "3px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.teal-signal}"
    textColor: "{colors.teal-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.teal-bright}"
    textColor: "{colors.teal-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.text-soft}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.red-danger-soft}"
    textColor: "{colors.red-danger}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  input-search:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 12px"
    height: "40px"
  navigation-active:
    backgroundColor: "{colors.graphite-selected-strong}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 6px"
    height: "76px"
  process-selected:
    backgroundColor: "{colors.graphite-selected}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "0"
    padding: "0 18px 0 28px"
    height: "54px"
  origin-card:
    backgroundColor: "{colors.teal-soft}"
    textColor: "{colors.teal-bright}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "11px 10px"
---

# Design System: PortRoot

## Overview

**Creative North Star: "The Local Systems Workbench"**

PortRoot should feel like a purpose-built instrument on a developer's desk: quiet, exact, and ready for sustained daily use. Its density is deliberate. Graphite planes suppress visual noise so relationships, live state, risk, and origin can be read in one pass without turning the interface into a generic monitoring dashboard.

The visual world is relationship-first rather than widget-first. A persistent category rail, a structured process tree, a technical inspector, and a slim status strip form one continuous operating surface. Color is rare and semantic: teal marks current focus, green indicates healthy activity, amber requests review, red communicates exposure or destruction, and lavender marks protected system state.

### Direction Contract

- **THESIS — Origin before action.** The interface must first explain which working folder or application owns a process, how its instances relate, and which ports belong to it; destructive controls come only after that context.
- **OWN-WORLD — A local systems instrument.** Build an authored desktop workbench of graphite planes, precise seams, compact hierarchy, and technical readouts—not a collection of floating dashboard cards.
- **STORY — Folder to process to port to decision.** The scan begins with project origin, descends through process families and instances, exposes ports and scope, then resolves into evaluation, protection, and safe action.
- **FIRST VIEWPORT — One persistent tri-pane workbench.** The first frame holds a narrow category rail, top command bar, scrollable relationship tree, persistent technical inspector, and bottom system status without page scrolling.
- **FORM — Pinned visual composition, no seed.** No FORM seed applies because this build follows a user-selected composition created before Impeccable was invoked. `design/reference-dark.png` is the source of truth for layout, anatomy, density, hierarchy, color, typography, and visible emphasis.
- **FINISH — Quiet graphite, sharp semantics.** Use native desktop type, monospace only for machine data, one-pixel dividers, restrained radii, low-motion state changes, and disciplined semantic accents. The final surface should feel maintained and operational, never ornamental.

**Key Characteristics:**

- Dense, relationship-first process and port hierarchy
- Full-height desktop composition with persistent controls and inspector
- Dark graphite default with an accessible semantic light remap
- Teal focus, green activity, amber review, red danger, and lavender protection
- Native UI typography paired with tabular monospace machine data
- Thin seams and tonal planes instead of decorative card stacks

## Colors

The palette is a dark graphite instrument panel whose limited chromatic signals carry operational meaning rather than decoration.

### Primary

- **Local Teal** (`teal-signal`): the active control, current navigation marker, and high-confidence focus signal.
- **Bright Teal** (`teal-bright`): hover, focus, and high-visibility teal detail; use it as an energized state rather than a second brand color.
- **Selected Teal Depths** (`graphite-selected`, `graphite-selected-strong`): broad row and navigation selection surfaces that keep white text readable while preserving data density.

### Secondary

- **Live Green** (`green-activity`): healthy activity, completed scans, and positive status bars.
- **Review Amber** (`amber-review`): duplicate candidates, partial access, and states requiring judgment.
- **Stop Red** (`red-danger`): network exposure and destructive actions only; the shared hue intentionally connects risk with consequence.

### Tertiary

- **Protected Lavender** (`lavender-protected`): protected processes, system groups, safety explanations, and blocked destructive states. It is never a generic decorative accent.
- **Runtime Markers** (`runtime-folder`, `runtime-python`, `runtime-node`, `runtime-docker`, `runtime-database`): small recognition cues attached to origin or runtime icons, never large backgrounds.

### Neutral

- **Graphite Canvas** (`graphite-canvas`): the deepest application ground.
- **Sidebar Graphite** (`graphite-sidebar`): a slight structural distinction for category navigation.
- **Work Surfaces** (`graphite-surface`, `graphite-raised`, `graphite-hover`): adjacent tonal planes for the toolbar, tree, inspector, fields, and hover feedback.
- **Graphite Seams** (`graphite-line`, `graphite-line-strong`): one-pixel structure and control boundaries.
- **Text Ladder** (`text-primary`, `text-soft`, `text-muted`, `text-faint`): four deliberate contrast levels for identity, values, labels, and tertiary metadata.

Light mode is a semantic remap, not a separate visual identity. Preserve the same role ordering and keep the paired `data-theme="light"` CSS-variable overrides together whenever a role changes.

### Named Rules

**The Semantic Rarity Rule.** Teal, green, amber, red, and lavender must explain state; do not use them to decorate empty space.

**The Risk Is Red Rule.** Red belongs to network exposure, destructive affordances, destructive confirmation, and errors—never ordinary selection or benign emphasis.

**The Protection Is Lavender Rule.** Lavender always means protected system state or a safety barrier; this consistent meaning makes blocked actions legible at a glance.

## Typography

**Display Font:** None; this is a utility workbench, not a marketing surface.
**Body Font:** Native system UI sans with Segoe, Ubuntu, Cantarell, and generic sans fallbacks.
**Label/Mono Font:** SFMono-Regular with Consolas and Liberation Mono fallbacks.

**Character:** Native sans type keeps the application platform-appropriate and quiet. Monospace appears only where exact character alignment helps verify commands, paths, PIDs, ports, addresses, and timestamps.

### Hierarchy

- **Headline** (700, 19px, 1.2): inspector and dialog headings with tight tracking.
- **Title** (700, 17px, 1.2): application identity and empty-state titles.
- **Body** (400, 14px, 1.5): primary interface copy and data rows; compact component-specific text may step down to 12–13px.
- **Label** (700, 11px, 0.055em): uppercase column headers and section labels; section labels tighten further to 10px with 0.08em tracking.
- **Code** (400, 11px, 1.55): commands and technical values; use tabular numerals and permit long paths to wrap in the inspector.

### Named Rules

**The Machine Data Rule.** Use monospace only when exact symbols or numeric alignment improve verification; process names and explanatory prose stay in the native sans family.

**The Dense but Legible Rule.** Rows may be compact, but primary identity stays at 13–14px and tertiary labels never replace the main text contrast level.

## Layout

The desktop shell is a fixed, full-height grid: a 102px category rail, a flexible center work area, and a 430px inspector; a 78px toolbar spans the two work columns and a 48px status strip anchors the bottom. The tree is the flexible center of gravity. It uses five aligned columns for element, port, scope, activity, and evaluation, with indentation lines making group → process → port ancestry visible.

At 1240px and below, the rail contracts to 88px and the inspector to 360px, secondary toolbar metadata disappears, activity copy yields to the bars, and the tree columns rebalance without changing the information order. The supported minimum canvas is 1080 × 700: controls and inspector actions must remain visible, the body must not scroll, and only the tree and inspector interiors may scroll independently.

Spacing follows a compact 4px-derived rhythm with frequent 8px, 12px, 16px, 20px, and 24px steps. Rows use height to express hierarchy: group rows are 43px, process rows 54px, and port rows 40px. Do not loosen this rhythm into airy card spacing; the application earns clarity through alignment, repetition, and controlled contrast.

### Named Rules

**The One-Frame Rule.** Search, filtering, process relationships, selected-process context, available actions, and scan status must remain accessible in the first viewport.

**The Relationship Rail Rule.** Preserve indentation guides and aligned columns; hierarchy must be understood spatially before users read every label.

## Elevation & Depth

The system is flat by default. Depth comes from adjacent graphite tones, one-pixel seams, selected-row fills, and scroll ownership—not from card shadows. The only lifted surfaces are dialogs and transient toasts, which use the shared ambient shadow (`0 18px 48px rgba(0, 0, 0, 0.36)`) over a dark scrim; light mode uses the same geometry with a softer neutral shadow.

### Shadow Vocabulary

- **Ambient Modal Lift** (`0 18px 48px rgba(0, 0, 0, 0.36)`): dialogs and transient toasts only.
- **Focused Field Halo** (`0 0 0 3px rgba(18, 169, 168, 0.14)`): a search-field focus-within response, never general surface elevation.

### Named Rules

**The Flat Workbench Rule.** Resting application planes use tone and seams; shadows are reserved for overlays and transient surfaces that truly sit above the workbench.

## Shapes

The form language is compact and machined. Rows and major application planes stay square and edge-aligned. Interactive controls use gently curved 7px corners; tiny utility controls use 4–6px corners; status dots and activity bars use micro-radius geometry; inspector icons use 12px corners; dialogs use the softest 14px corners. Borders are one pixel and always reinforce ownership or interaction.

Pills are intentionally rare. Protection and evaluation read as inline icon-and-label states rather than badge collections, while activity is encoded as a five-bar sparkline. The selected process remains a full-width rectangular band so ancestry and column alignment are never interrupted.

### Named Rules

**The Rows Stay Rows Rule.** Do not round each process or port into a card; selection is a continuous band inside the hierarchy.

**The Radius Tracks Elevation Rule.** Flat controls are compact, signature icon tiles are slightly softer, and only true overlays receive the largest corners.

## Components

### Buttons

- **Shape:** compact gently curved controls (7px radius), usually 40px high.
- **Primary:** solid Local Teal with near-black teal ink and 16px horizontal padding; use for scan and confirmed save actions.
- **Hover / Focus:** brighten to Bright Teal and lift by 1px over 180ms; retain the 2px Bright Teal focus-visible outline with 2px offset.
- **Secondary / Ghost:** raised graphite or transparent backgrounds with strong graphite borders; brighten tone and border on hover without competing with the primary action.
- **Danger:** red-on-red-soft in the inspector, becoming solid red with white text on hover; confirmation dialogs may start solid red because the user has already crossed a safety boundary.

### Chips

- **Style:** status is expressed as a 7px semantic dot plus 11–12px label, not a decorative filled pill.
- **State:** teal means local focus, green activity, amber review, red exposure, and lavender protection. Counts may use compact 19px bordered squares in the navigation rail.

### Cards / Containers

- **Corner Style:** most containers are square and separated by seams; origin and protection callouts use 7px corners, icon tiles 12px, and dialogs 14px.
- **Background:** use graphite tonal layering; the origin card alone receives a restrained teal wash because it is the key explanatory object.
- **Shadow Strategy:** follow the Flat Workbench Rule; dialogs and toasts are the only lifted containers.
- **Border:** one-pixel graphite seams or strong control borders.
- **Internal Padding:** 8–12px for compact callouts, 18–24px for major inspector or dialog regions.

### Inputs / Fields

- **Style:** 40px raised-graphite fields with a 1px strong graphite border and 7px radius; icons and shortcut hints sit inside the field.
- **Focus:** shift the border to Local Teal and add the restrained 3px teal halo.
- **Error / Disabled:** preserve structure and reduce disabled opacity to 0.48; errors use Stop Red without changing layout.

### Navigation

The left rail is persistent and icon-led. Each item stacks a 24px platform-aware Phosphor icon, compact count, and 12px semibold label inside a 76px-high target. Hover introduces the graphite hover tone; active state uses the stronger teal-selected plane plus a 2px Bright Teal edge signal. Keep the established meanings for Tous, Applications, macOS/System, Autres, and Protégés.

### Process Relationship Tree

The tree is the signature component. Folder groups open into process rows, process rows open into port rows, and one-pixel branch guides make ancestry tangible. A selected process receives a full-width teal-depth band with matching seam; ports stay subordinate at 40px height. Runtime icons provide recognition, five activity bars show intensity, and the final column carries a semantic dot plus evaluation copy.

### Technical Inspector

The inspector is a persistent 430px technical column with its own scrolling details and fixed action area. Lead with identity and evaluation, then emphasize the working folder in a teal-washed origin card before listing PIDs, time, scope, activity, command, and ports. Keep safe actions together and isolate the stop zone below a divider; protected state replaces destructive emphasis with lavender safety language.

### Dialogs

Dialogs sit on a dark scrim, use the shared ambient lift and 14px corners, and trap focus. Destructive confirmation names the process, summarizes PIDs, ports, and folder, explains backend protection revalidation, and presents Cancel before Stop. Settings reuse the same surface but preserve dense sections and a fixed footer.

## Do's and Don'ts

### Do:

- **Do** preserve the category rail → relationship tree → technical inspector hierarchy from `design/reference-dark.png`.
- **Do** make working directory, duplicate instances, activity, network scope, and protection state scannable without opening a second screen.
- **Do** keep dark mode as the default and maintain equivalent semantic roles, contrast, and hierarchy in light and system modes.
- **Do** use native sans typography for interface language and tabular monospace for commands, paths, PIDs, ports, addresses, and timestamps.
- **Do** enforce a visible 2px teal focus outline, keyboard access, independent interior scrolling, and reduced-motion behavior.
- **Do** separate destructive controls visually and require the confirmation surface before a stop request.

### Don't:

- **Don't** flatten the application → process family → port relationship into an anonymous socket table.
- **Don't** introduce floating dashboard cards, gradients, glass effects, decorative shadows, or oversized hero typography.
- **Don't** use semantic accents interchangeably; teal is focus, green is activity, amber is review, red is risk/destruction, and lavender is protection.
- **Don't** round every row or replace the branch structure with disconnected tiles.
- **Don't** hide the working-folder origin behind secondary interaction or place stop controls before explanatory context.
- **Don't** treat the browser's demonstration data as live scan output; keep the demo status explicit wherever that preview state is shown.
