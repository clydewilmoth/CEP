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

export function StringNullToBlank(value: string) {
  return value ? String(value) : "";
}

export function stringToBoolean(value: string | undefined | null): boolean {
  return value?.toLowerCase() === "true";
}

export function booleanToString(value: boolean): string {
  return value ? "true" : "false";
}

export function maxCrop (string: string, max: number){
  return string.length > max ? string.substring(0, max) + "..." : string;
};
