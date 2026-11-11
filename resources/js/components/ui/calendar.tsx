import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import { DayPicker } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Theme-styled date picker (react-day-picker). Weeks start on Monday. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8"),
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-[0.75rem] font-normal",
        week: "mt-1 flex",
        day: "relative size-9 p-0 text-center text-sm",
        day_button:
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-md font-normal outline-none focus-visible:ring-[3px] disabled:pointer-events-none",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        range_start: "rounded-l-md bg-accent",
        range_middle:
          "bg-accent [&>button]:!bg-transparent [&>button]:!text-accent-foreground",
        range_end: "rounded-r-md bg-accent",
        today: "[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
