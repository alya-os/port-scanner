import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  CaretDown,
  Check,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useI18n, type TranslationKey } from "../lib/i18n";
import type { SortMode } from "../types";

const sortOptions: Array<{ value: SortMode; label: TranslationKey }> = [
  { value: "evaluation", label: "sort.evaluation" },
  { value: "activity", label: "sort.activity" },
  { value: "age", label: "sort.age" },
  { value: "port", label: "sort.port" },
];

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  onScan: () => void;
  scanning: boolean;
}

export function Toolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  onScan,
  scanning,
}: ToolbarProps) {
  const { t } = useI18n();
  const [sortOpen, setSortOpen] = useState(false);
  const sortRootRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedSort = sortOptions.find((option) => option.value === sort) ?? sortOptions[0];

  useEffect(() => {
    if (!sortOpen) return;
    const selectedIndex = sortOptions.findIndex((option) => option.value === sort);
    const focusFrame = window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!sortRootRef.current?.contains(event.target as Node)) setSortOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [sort, sortOpen]);

  const closeSortMenu = (restoreFocus = false) => {
    setSortOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => sortButtonRef.current?.focus());
  };

  const selectSort = (value: SortMode) => {
    onSortChange(value);
    closeSortMenu(true);
  };

  const handleSortKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && sortOpen) {
      event.preventDefault();
      closeSortMenu(true);
      return;
    }
    if (event.key === "Tab") {
      setSortOpen(false);
      return;
    }
    if (sortOpen && ["Enter", " "].includes(event.key)) {
      const activeIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
      if (activeIndex >= 0) {
        event.preventDefault();
        selectSort(sortOptions[activeIndex].value);
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    if (!sortOpen) {
      setSortOpen(true);
      return;
    }

    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? sortOptions.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + sortOptions.length) % sortOptions.length
          : (currentIndex - 1 + sortOptions.length) % sortOptions.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <span className="title-signal" aria-hidden="true" />
        <div>
          <strong>PortRoot</strong>
          <span>{t("app.tagline")}</span>
        </div>
      </div>
      <label className="search-field">
        <MagnifyingGlass size={19} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("toolbar.searchPlaceholder")}
          aria-label={t("toolbar.search")}
        />
        <kbd>⌘K</kbd>
      </label>
      <div className={`sort-picker ${sortOpen ? "is-open" : ""}`} ref={sortRootRef} onKeyDown={handleSortKeyDown}>
        <button
          className="sort-field"
          ref={sortButtonRef}
          type="button"
          onClick={() => setSortOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          aria-controls="sort-options"
        >
          <SlidersHorizontal size={18} />
          <span className="sort-prefix">{t("toolbar.sort")}</span>
          <span className="sort-value">{t(selectedSort.label)}</span>
          <CaretDown className="sort-caret" size={15} weight="bold" />
        </button>
        {sortOpen && (
          <div className="sort-menu" id="sort-options" role="listbox" aria-label={t("toolbar.sortAria")}>
            {sortOptions.map((option, index) => {
              const selected = option.value === sort;
              return (
                <button
                  className={`sort-option ${selected ? "is-selected" : ""}`}
                  key={option.value}
                  ref={(element) => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectSort(option.value)}
                >
                  <span>{t(option.label)}</span>
                  {selected && <Check size={16} weight="bold" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="toolbar-actions">
        <button className="primary-button" type="button" onClick={onScan} disabled={scanning}>
          <ArrowClockwise className={scanning ? "is-spinning" : ""} size={19} weight="bold" />
          {scanning ? t("toolbar.scanning") : t("toolbar.analyze")}
        </button>
      </div>
    </header>
  );
}
