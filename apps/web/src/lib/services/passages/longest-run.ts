/**
 * The longest run of items, in their order, where each may follow the one before it. Items that
 * break the order drop out. Of runs equally long, the earliest.
 */
export function longestRun<T>(items: readonly T[], mayFollow: (before: T, after: T) => boolean) {
  const length: number[] = [];
  const previous: number[] = [];
  let best = -1;
  items.forEach((item, i) => {
    length[i] = 1;
    previous[i] = -1;
    for (let j = 0; j < i; j++) {
      if (length[j] + 1 > length[i] && mayFollow(items[j], item)) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
    if (best === -1 || length[i] > length[best]) best = i;
  });
  const run: T[] = [];
  for (let i = best; i !== -1; i = previous[i]) run.unshift(items[i]);
  return run;
}
