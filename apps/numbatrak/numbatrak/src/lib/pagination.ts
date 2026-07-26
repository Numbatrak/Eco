/** Windowed page numbers for table pagination (max 5 visible). */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  maxButtons = 5
): number[] {
  if (totalPages <= 0) return [];

  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);

  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }

  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}
