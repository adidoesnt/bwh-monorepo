import type { ActivePackage, PackageSlide } from "$lib/server/queries";

export const getPackageSlides = (
  activePackagtes: ActivePackage[],
): PackageSlide[] =>
  activePackagtes.map((pkg, i, arr) => ({
    ...pkg,
    slideId: `package-${pkg.purchaseId}`,
    prevId: `package-${arr[(i - 1 + arr.length) % arr.length].purchaseId}`,
    nextId: `package-${arr[(i + 1) % arr.length].purchaseId}`,
  }));

export const balanceProgressClass = (balance: number, sessionCount: number) => {
  const remainingRatio = sessionCount > 0 ? balance / sessionCount : 0;
  if (remainingRatio >= 0.5) return "progress-success";
  if (remainingRatio >= 0.2) return "progress-warning";
  return "progress-error";
};
