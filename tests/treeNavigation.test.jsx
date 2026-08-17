import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { ProcessTree } from "../src/components/ProcessTree.tsx";
import { I18nProvider } from "../src/lib/i18n.ts";
import { buildProcessTree } from "../src/lib/processTree.ts";

function record(overrides) {
  return {
    id: `tcp-${overrides.port}-${overrides.pid}`,
    protocol: "TCP",
    localAddress: "127.0.0.1",
    scope: "local",
    parentPid: 1,
    launcher: null,
    launcherPid: null,
    ai: false,
    processPath: "/opt/homebrew/bin/node",
    command: "node server.js",
    dockerContainerId: null,
    category: "other",
    startedAt: 1_700_000_000,
    uptimeSeconds: 600,
    cpuUsage: 0.2,
    memoryBytes: 1024,
    activeConnections: 0,
    protected: false,
    protectionReasons: [],
    ...overrides,
  };
}

// Un dossier ordinaire, déplié d'office, et un groupe système, replié d'office :
// les deux états de départ dont la navigation a besoin.
const RECORDS = [
  record({
    port: 3000,
    pid: 41,
    processName: "node",
    processPath: "/opt/homebrew/bin/node",
    workingDirectory: "/Users/jp/Projects/api",
    groupName: "api",
    identification: "api",
  }),
  record({
    port: 3001,
    pid: 42,
    processName: "node",
    processPath: "/opt/homebrew/bin/node",
    workingDirectory: "/Users/jp/Projects/api",
    groupName: "api",
    identification: "api",
  }),
  record({
    port: 7000,
    pid: 785,
    processName: "ControlCenter",
    processPath: "/System/Library/CoreServices/ControlCenter",
    workingDirectory: null,
    groupName: "Services macOS",
    identification: "AirPlay",
    category: "system",
  }),
];

function renderTree() {
  const groups = buildProcessTree(RECORDS, "all", "", "name", "en", "ascending");
  return render(
    <I18nProvider language="en">
      <ProcessTree
        groups={groups}
        selectedId={null}
        onSelect={() => {}}
        scanning={false}
        platform="macos"
        sort="name"
        sortDirection="ascending"
        onSortChange={() => {}}
      />
    </I18nProvider>,
  );
}

function rows() {
  return within(screen.getByRole("tree")).getAllByRole("treeitem");
}

afterEach(cleanup);

test("expose la hiérarchie comme un arbre, avec ses niveaux", () => {
  renderTree();

  const tree = screen.getByRole("tree");
  const levels = () =>
    within(tree)
      .getAllByRole("treeitem")
      .map((row) => row.getAttribute("aria-level"));

  // Dossier déplié -> son processus replié, puis le groupe système replié.
  expect(levels()).toEqual(["1", "2", "1"]);
});

test("ne laisse plus aucun rôle de grille orphelin", () => {
  renderTree();

  // `row`, `columnheader` et `aria-sort` n'ont de sens que sous une grille.
  // Sans elle, ils étaient ignorés : ils ne doivent plus être là du tout.
  expect(screen.queryAllByRole("row")).toHaveLength(0);
  expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  expect(document.querySelectorAll("[aria-sort]")).toHaveLength(0);
});

test("l'état du tri est annoncé par le bouton lui-même", () => {
  renderTree();

  expect(
    screen.getByRole("button", { name: /item, sorted ascending/i }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: /^sort by port$/i })).toBeTruthy();
});

test("une seule ligne est atteignable par tabulation", () => {
  renderTree();

  const tabbable = rows().filter((row) => row.getAttribute("tabindex") === "0");
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]).toBe(rows()[0]);
});

test("les flèches haut et bas parcourent les lignes visibles", async () => {
  const user = userEvent.setup();
  renderTree();

  rows()[0].focus();
  expect(document.activeElement).toBe(rows()[0]);

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(rows()[1]);

  await user.keyboard("{ArrowDown}{ArrowUp}");
  expect(document.activeElement).toBe(rows()[1]);
});

test("la flèche droite déplie, la flèche gauche replie", async () => {
  const user = userEvent.setup();
  renderTree();

  rows()[0].focus();
  await user.keyboard("{End}");

  const systemGroup = document.activeElement;
  expect(systemGroup.getAttribute("aria-expanded")).toBe("false");

  await user.keyboard("{ArrowRight}");
  expect(systemGroup.getAttribute("aria-expanded")).toBe("true");
  expect(rows()).toHaveLength(4);

  await user.keyboard("{ArrowLeft}");
  expect(systemGroup.getAttribute("aria-expanded")).toBe("false");
  expect(rows()).toHaveLength(3);
});

test("la flèche gauche remonte au parent quand la ligne est déjà repliée", async () => {
  const user = userEvent.setup();
  renderTree();

  rows()[0].focus();
  // Dossier -> processus, qu'on déplie pour atteindre ses ports.
  await user.keyboard("{ArrowDown}{ArrowRight}{ArrowDown}");
  expect(rows()[2].getAttribute("aria-level")).toBe("3");
  expect(document.activeElement).toBe(rows()[2]);

  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(rows()[1]);

  await user.keyboard("{ArrowLeft}");
  expect(rows()[1].getAttribute("aria-expanded")).toBe("false");
});

test("Entrée sélectionne le processus sous le curseur", async () => {
  const user = userEvent.setup();
  const selected = [];
  const groups = buildProcessTree(RECORDS, "all", "", "name", "en", "ascending");
  render(
    <I18nProvider language="en">
      <ProcessTree
        groups={groups}
        selectedId={null}
        onSelect={(process) => selected.push(process.identification)}
        scanning={false}
        platform="macos"
        sort="name"
        sortDirection="ascending"
        onSortChange={() => {}}
      />
    </I18nProvider>,
  );

  rows()[0].focus();
  await user.keyboard("{ArrowDown}{Enter}");

  expect(selected).toEqual(["api"]);
});
