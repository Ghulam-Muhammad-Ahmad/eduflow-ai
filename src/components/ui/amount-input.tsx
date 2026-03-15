"use client";

import * as React from "react";
import { formatAmountInput, cleanAmountInput } from "@/lib/formatAmount";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AmountInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Amount/price input that displays values with thousand separators (e.g. 1,234.56).
 * Parent should store the raw string; use parseAmountFromDisplay() when submitting.
 */
const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const displayValue = formatAmountInput(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = cleanAmountInput(e.target.value);
      onChange(cleaned);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={cn(className)}
        {...props}
      />
    );
  }
);
AmountInput.displayName = "AmountInput";

export { AmountInput };
