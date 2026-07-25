"use client";

import { ChevronDown } from "lucide-react";
import { Button, ListBox, ListBoxItem, Popover, Select } from "react-aria-components";
import { CURRENCIES, getCurrencyMeta } from "@/lib/currency";

interface CurrencySelectProps {
  value: string;
  onChange: (code: string) => void;
}

export function CurrencySelect({ value, onChange }: CurrencySelectProps) {
  const selected = getCurrencyMeta(value);

  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as string)}
      aria-label="Currency"
    >
      <Button className="flex w-full items-center gap-2 rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text">
        <span className={`fi fi-${selected.country} rounded-[3px]`} aria-hidden="true" />
        <span className="font-bold">{selected.code}</span>
        <span className="truncate text-muted-2">{selected.label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
      </Button>
      <Popover className="w-(--trigger-width) rounded-md border border-ink/14 bg-white shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] dark:border-white/14 dark:bg-dark-card">
        <ListBox className="max-h-72 overflow-auto py-1 outline-none">
          {CURRENCIES.map((c) => (
            <ListBoxItem
              key={c.code}
              id={c.code}
              textValue={`${c.code} ${c.label}`}
              className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm text-ink outline-none data-[focused]:bg-mint-tint data-[focused]:text-forest dark:text-dark-text dark:data-[focused]:bg-mint/16 dark:data-[focused]:text-mint"
            >
              <span className={`fi fi-${c.country} rounded-[3px]`} aria-hidden="true" />
              <span className="font-bold">{c.code}</span>
              <span className="text-muted-2">{c.label}</span>
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
