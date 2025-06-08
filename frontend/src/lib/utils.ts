import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: string): string[] {
  if (!timestamp) return ["", ""];

  try {
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return ["", ""];
    }

    const day = date.getUTCDate().toString().padStart(2, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");

    return [`${day}.${month}.${year}`,`${hours}:${minutes}`];
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return ["", ""];
  }
}
