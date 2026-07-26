"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

import { cn } from "./utils";
import "./select.css";

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon style={{ width: "1rem", height: "1rem", opacity: 0.5 }} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-position={position}
        className={cn(className)}
        position={position}
        sideOffset={4}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-slot="select-viewport"
          className={position === "popper" ? "select-viewport-popper" : ""}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(className)}
      {...props}
    />
  );
}

function SelectItem(props: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const { className, children, value, ...restProps } = props;
  
  // Ensure value is always a valid string (Radix UI requires this)
  // Empty string is allowed for "Unassigned" options
  const safeValue: string = (() => {
    if (value === null || value === undefined) {
      return "";
    }
    try {
      const strValue = String(value);
      // Ensure it's a valid string (not NaN, Infinity, etc.)
      if (strValue === "NaN" || strValue === "Infinity" || strValue === "-Infinity") {
        console.warn(`SelectItem received invalid value: ${value}, converting to empty string`);
        return "";
      }
      return strValue;
    } catch (error) {
      console.warn(`SelectItem failed to convert value to string: ${value}`, error);
      return "";
    }
  })();
  
  // Ensure children is valid (Radix UI requires this)
  const safeChildren = children === null || children === undefined ? "" : children;

  // Warn if value was converted from a non-empty value to empty string
  if (value !== null && value !== undefined && value !== "" && safeValue === "") {
    console.warn(`SelectItem value was converted to empty string from: ${value}`);
  }

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(className)}
      {...restProps}
      value={safeValue}
    >
      <span>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon style={{ width: "1rem", height: "1rem" }} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{safeChildren}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(className)}
      {...props}
    >
      <ChevronUpIcon style={{ width: "1rem", height: "1rem" }} />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(className)}
      {...props}
    >
      <ChevronDownIcon style={{ width: "1rem", height: "1rem" }} />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
