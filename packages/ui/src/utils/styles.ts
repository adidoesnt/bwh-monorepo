import { twMerge } from "tailwind-merge";

export const cn = (...classes: string[]) => {
  return twMerge(...classes);
};
