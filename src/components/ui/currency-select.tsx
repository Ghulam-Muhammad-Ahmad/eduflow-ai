"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CURRENCY_OPTIONS,
  getCurrencyLabel,
  getCurrencySearchText,
  type CurrencyOption,
} from "@/lib/currency-data";

export interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function CurrencySelect({
  value,
  onChange,
  placeholder = "Select currency",
  className,
  id,
  disabled,
}: CurrencySelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => CURRENCY_OPTIONS.find((o) => o.code === value),
    [value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span
                  className={cn("fi shrink-0 rounded-sm", `fi-${selected.countryCode}`)}
                  style={{ width: 24, height: 18 }}
                  aria-hidden
                />
                <span>{selected.code}</span>
                {getCurrencyLabel(selected.code) !== selected.code && (
                  <span className="hidden text-muted-foreground sm:inline">
                    · {getCurrencyLabel(selected.code).split(" · ")[1]}
                  </span>
                )}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search currency or country..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {CURRENCY_OPTIONS.map((option: CurrencyOption) => {
                const label = getCurrencyLabel(option.code);
                const isSelected = value === option.code;
                return (
                  <CommandItem
                    key={option.code}
                    value={getCurrencySearchText(option)}
                    onSelect={() => {
                      onChange(option.code);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={cn("fi mr-2 shrink-0 rounded-sm", `fi-${option.countryCode}`)}
                      style={{ width: 24, height: 18 }}
                      aria-hidden
                    />
                    <span className="flex-1">{option.code}</span>
                    {label !== option.code && (
                      <span className="text-muted-foreground">{label.split(" · ")[1]}</span>
                    )}
                    {isSelected ? (
                      <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
