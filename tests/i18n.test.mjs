import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, formatMemory, shortAddress } from "../src/lib/format.ts";
import { localizeRuleLabel, translate } from "../src/lib/i18n.ts";

test("translates interface copy and interpolated values", () => {
  assert.equal(translate("fr", "settings.languageTitle"), "Langue");
  assert.equal(translate("en", "settings.languageTitle"), "Language");
  assert.equal(translate("en", "common.portMany", { count: 17 }), "17 ports");
  assert.equal(translate("en", "common.processOne", { count: 1 }), "1 process");
});

test("localizes built-in protection labels without changing custom labels", () => {
  const builtIn = { id: "port-53", label: "DNS et découverte locale", kind: "port", value: "53", enabled: true, builtin: true };
  const custom = { ...builtIn, id: "custom-1", label: "My dev server", builtin: false };

  assert.equal(localizeRuleLabel(builtIn, "en"), "DNS and local discovery");
  assert.equal(localizeRuleLabel(custom, "en"), "My dev server");
});

test("uses language-specific technical formatting", () => {
  assert.equal(formatDuration(90_000, "fr"), "1 j 1 h");
  assert.equal(formatDuration(90_000, "en"), "1 d 1 h");
  assert.equal(formatMemory(320_000_000, "fr"), "320 Mo");
  assert.equal(formatMemory(320_000_000, "en"), "320 MB");
  assert.equal(shortAddress("127.0.0.1", "en"), "Loopback");
});
