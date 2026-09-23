"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { formatModelName, formatPricePerMillion, formatVendor } from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";

export interface ModelPickerModel {
  id: string;
  name: string;
  vendor: string;
  api_identifier: string;
  pricing_input?: number | null;
  category?: string | null;
}

export interface ModelPickerProps<M extends ModelPickerModel = ModelPickerModel> {
  models: readonly M[];
  /** Selected value (matches `valueKey`, default the model `id`). */
  value: string | null | undefined;
  onValueChange: (value: string, model: M) => void;
  /** Which field is used as the value. Defaults to `"id"`. */
  valueKey?: "id" | "api_identifier";
  placeholder?: string;
  searchPlaceholder?: string;
  /** Pre-filter applied before search (e.g. only `:free` models). */
  filter?: (model: M) => boolean;
  /** Rendered but not selectable (e.g. the model already chosen on the other side). */
  isItemDisabled?: (model: M) => boolean;
  /** Group results under vendor headings. */
  groupByVendor?: boolean;
  /** Cap on rendered rows; a "refine search" hint shows when more match. Default 100. */
  maxResults?: number;
  disabled?: boolean;
  /** Form field name for the hidden input. */
  name?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

interface VendorGroup<M> {
  value: string;
  items: M[];
}

function matches(model: ModelPickerModel, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = `${model.name} ${model.vendor} ${formatVendor(model.vendor)} ${model.api_identifier} ${model.category ?? ""}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function rank(model: ModelPickerModel, q: string): number {
  const name = formatModelName(model.name).toLowerCase();
  if (name.startsWith(q)) return 0;
  if (model.api_identifier.toLowerCase().includes(q)) return 1;
  if (name.includes(q)) return 2;
  return 3;
}

/**
 * Searchable model combobox for large catalogs (500+ models).
 * Keyboard: type to filter, ↑/↓ to move, Enter to select, Esc to close.
 */
export function ModelPicker<M extends ModelPickerModel = ModelPickerModel>({
  models,
  value,
  onValueChange,
  valueKey = "id",
  placeholder = "Select a model…",
  searchPlaceholder = "Search by name, vendor or ID…",
  filter,
  isItemDisabled,
  groupByVendor = false,
  maxResults = 100,
  disabled = false,
  name,
  id,
  className,
  "aria-label": ariaLabel,
}: ModelPickerProps<M>) {
  const [query, setQuery] = useState("");

  const pool = filter ? models.filter(filter) : [...models];
  const selected = models.find((m) => m[valueKey] === value) ?? null;

  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const matched = pool.filter((m) => matches(m, terms));
  if (q) matched.sort((a, b) => rank(a, q) - rank(b, q));
  const shown = matched.slice(0, Math.max(1, maxResults));
  const hiddenCount = matched.length - shown.length;

  let items: M[] | VendorGroup<M>[] = shown;
  if (groupByVendor) {
    const byVendor = new Map<string, M[]>();
    for (const m of shown) {
      const key = formatVendor(m.vendor);
      const list = byVendor.get(key);
      if (list) list.push(m);
      else byVendor.set(key, [m]);
    }
    items = [...byVendor.entries()].map(([vendor, list]) => ({ value: vendor, items: list }));
  }

  const renderItem = (m: M) => (
    <ComboboxItem
      key={m.id}
      value={m}
      disabled={isItemDisabled?.(m) ?? false}
      className="items-start gap-2.5 py-2 pl-2"
    >
      <span
        aria-hidden
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: getVendorColor(m.vendor) }}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{formatModelName(m.name)}</span>
        <span className="truncate text-xs text-muted-foreground">
          {formatVendor(m.vendor)}
          <span className="font-mono"> · {m.api_identifier}</span>
        </span>
      </span>
      {m.pricing_input !== undefined && (
        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatPricePerMillion(m.pricing_input)}
        </span>
      )}
    </ComboboxItem>
  );

  return (
    <Combobox<M>
      items={pool}
      filteredItems={items}
      value={selected}
      onValueChange={(next) => {
        if (next) onValueChange(next[valueKey], next);
      }}
      inputValue={query}
      onInputValueChange={(next) => setQuery(next)}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
      itemToStringLabel={(m) => formatModelName(m.name)}
      itemToStringValue={(m) => m[valueKey]}
      isItemEqualToValue={(a, b) => a[valueKey] === b[valueKey]}
      disabled={disabled}
      name={name}
      autoHighlight
    >
      <ComboboxTrigger
        id={id}
        aria-label={ariaLabel ?? (selected ? `Model: ${selected.name}` : placeholder)}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-foreground shadow-2xs outline-none",
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50 data-popup-open:border-ring",
          className
        )}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: getVendorColor(selected.vendor) }}
            />
            <span className="truncate font-medium">{formatModelName(selected.name)}</span>
            <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline">
              {formatVendor(selected.vendor)}
            </span>
            {selected.pricing_input !== undefined && (
              <span className="ml-auto hidden shrink-0 font-mono text-xs text-muted-foreground tabular-nums sm:inline">
                {formatPricePerMillion(selected.pricing_input)}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
        )}
      </ComboboxTrigger>

      <ComboboxContent className="min-w-[min(24rem,var(--available-width))]">
        <ComboboxInput showTrigger={false} placeholder={searchPlaceholder} aria-label="Search models">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden className="size-3.5" />
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxEmpty>No models match “{query.trim()}”.</ComboboxEmpty>
        <ComboboxList>
          {groupByVendor
            ? (group: VendorGroup<M>) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel className="sticky -top-1 z-10 bg-popover font-medium">
                    {group.value}
                  </ComboboxLabel>
                  <ComboboxCollection>{(m: M) => renderItem(m)}</ComboboxCollection>
                </ComboboxGroup>
              )
            : (m: M) => renderItem(m)}
        </ComboboxList>
        {hiddenCount > 0 && (
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Showing {shown.length} of {matched.length} — refine your search to see more.
          </p>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
