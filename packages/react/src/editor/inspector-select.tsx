"use client";

import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select.js";
import { cn } from "../lib/utils.js";

type OptionProps = {
  readonly value: string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
};
/** Declarative option metadata; InspectorSelect owns the accessible composition. */
export function InspectorSelectOption(props: OptionProps) {
  void props;
  return null;
}

type Props = Omit<
  ComponentProps<typeof SelectTrigger>,
  "value" | "onChange" | "children"
> & {
  readonly value?: string | number | readonly string[];
  readonly children: ReactNode;
  readonly onChange?: (change: {
    readonly currentTarget: { readonly value: string };
  }) => void;
};

/** Private controlled choice adapter, using the source's Radix Select behavior. */
export function InspectorSelect({
  value = "",
  onChange,
  children,
  className,
  disabled,
  ...props
}: Props) {
  const options = Children.toArray(children).filter(
    isValidElement<OptionProps>,
  );
  const selected = String(value);
  // Encode every value, so empty/inherited choices cannot collide with a Host option.
  const choice = (value: string) => `choice:${value}`;
  const current = options.find((option) => option.props.value === selected);
  return (
    <Select
      value={choice(selected)}
      disabled={Boolean(disabled)}
      onValueChange={(next) =>
        onChange?.({ currentTarget: { value: next.slice("choice:".length) } })
      }
    >
      <SelectTrigger
        {...props}
        disabled={disabled}
        className={cn("w-full min-w-0", className)}
        data-value={selected}
      >
        <SelectValue>{current?.props.children}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.props.value}
              value={choice(option.props.value)}
              disabled={Boolean(option.props.disabled)}
              data-value={option.props.value}
            >
              {option.props.children}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
