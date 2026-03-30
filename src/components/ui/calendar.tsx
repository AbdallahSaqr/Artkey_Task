"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "relative flex flex-col",
        month: "space-y-4 w-full p-2",
        month_caption:
          "flex justify-center pt-2 relative items-center w-full pb-3 border-b border-white/5",
        caption_label:
          "text-sm font-bold tracking-tight text-foreground",

        // ── Nav: sits in the same row as the caption, flush left/right ──
        nav: "absolute inset-x-2 top-2 flex items-center justify-between z-10",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
        ),

        month_grid: "w-full border-collapse mt-4",
        weekdays: "grid grid-cols-7 w-full mb-1",
        weekday:
          "text-muted-foreground font-bold text-[10px] uppercase tracking-widest text-center flex items-center justify-center h-8",
        week: "grid grid-cols-7 w-full mt-0.5",
        day: "h-9 w-full text-center text-sm p-0 relative flex items-center justify-center [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 text-[11px] p-0 font-medium aria-selected:opacity-100 flex items-center justify-center transition-all hover:bg-white/10 rounded-full"
        ),
        range_end: "range-end rounded-r-full",
        range_start: "range-start rounded-l-full",
        selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground !ring-0",
        today:
          "bg-white/10 text-foreground ring-1 ring-inset ring-white/20 rounded-full aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:ring-0",
        outside:
          "outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="size-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }