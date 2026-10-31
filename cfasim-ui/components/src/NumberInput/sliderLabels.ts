export interface SliderLabelInput {
  /** Thumb center, px from the container's left edge. */
  center: number;
  /** Label width in px. */
  width: number;
}

export interface SliderLabelPlacement {
  /** Label left edge, px from the container's left edge. */
  left: number;
  /** 0 is the row just above the track; each row stacks one label higher. */
  row: number;
}

/**
 * Lays out the value labels above slider thumbs. Each label stays centered on
 * its thumb when it can; it is kept inside `[0, containerWidth]`, and labels
 * that would collide are spread apart, as far as having an edge on their
 * thumb (so a left label right-aligns and a right label left-aligns). Labels
 * that still cannot fit side by side move up a row. With `maxRows`, a label
 * that would need another row instead overlaps in the row with the most room,
 * centered on its thumb as far as the container allows.
 */
export function layoutSliderLabels(
  labels: SliderLabelInput[],
  containerWidth: number,
  { gap = 6, maxRows = Infinity }: { gap?: number; maxRows?: number } = {},
): SliderLabelPlacement[] {
  const order = labels
    .map((_, i) => i)
    .sort((a, b) => labels[a].center - labels[b].center);
  const bounds = labels.map(({ center, width }) => {
    // Wider than the container: pin to the left edge, it overflows anyway.
    if (width >= containerWidth) return [0, 0] as const;
    const lo = Math.max(0, center - width);
    const hi = Math.min(containerWidth - width, center);
    return [lo, Math.max(lo, hi)] as const;
  });

  // Lowest row where the label fits after that row's previous label, using
  // the leftmost position allowed (which is what decides whether it fits).
  const rowEnds: number[] = [];
  const rows: number[][] = [];
  const out: SliderLabelPlacement[] = labels.map(() => ({ left: 0, row: 0 }));
  for (const i of order) {
    const [lo, hi] = bounds[i];
    let r = rowEnds.findIndex((end) => Math.max(lo, end + gap) <= hi);
    if (r === -1 && rowEnds.length >= Math.max(1, maxRows)) {
      const row = rowEnds.indexOf(Math.min(...rowEnds));
      const { center, width } = labels[i];
      const left = Math.min(
        Math.max(0, center - width / 2),
        Math.max(0, containerWidth - width),
      );
      out[i] = { left, row };
      continue;
    }
    if (r === -1) {
      r = rowEnds.length;
      rowEnds.push(-Infinity);
      rows.push([]);
    }
    rowEnds[r] = Math.max(lo, rowEnds[r] + gap) + labels[i].width;
    rows[r].push(i);
  }

  rows.forEach((members, r) => {
    const lefts = placeRow(
      members.map((i) => labels[i]),
      members.map((i) => bounds[i]),
      gap,
    );
    members.forEach((i, k) => (out[i] = { left: lefts[k], row: r }));
  });
  return out;
}

// Places one row's labels (sorted by center, known to fit) without overlap.
function placeRow(
  labels: SliderLabelInput[],
  bounds: (readonly [number, number])[],
  gap: number,
): number[] {
  const n = labels.length;
  const ideal = labels.map((l) => l.center - l.width / 2);

  // Spread colliding labels symmetrically: merge overlapping runs and center
  // each run on the mean of its members' ideal positions.
  const clusters: { start: number; end: number; left: number }[] = [];
  const offset = (start: number, i: number) => {
    let o = 0;
    for (let k = start; k < i; k++) o += labels[k].width + gap;
    return o;
  };
  const clusterRight = (c: { start: number; end: number; left: number }) =>
    c.left + offset(c.start, c.end) - gap;
  for (let i = 0; i < n; i++) {
    let c = { start: i, end: i + 1, left: ideal[i] };
    while (clusters.length) {
      const prev = clusters[clusters.length - 1];
      if (clusterRight(prev) + gap <= c.left) break;
      clusters.pop();
      const start = prev.start;
      const end = c.end;
      let sum = 0;
      for (let k = start; k < end; k++) sum += ideal[k] - offset(start, k);
      c = { start, end, left: sum / (end - start) };
    }
    clusters.push(c);
  }
  const spread = new Array<number>(n);
  for (const c of clusters) {
    for (let k = c.start; k < c.end; k++)
      spread[k] = c.left + offset(c.start, k);
  }

  // Leftmost and rightmost feasible positions; any position between them that
  // keeps clear of the previous label leaves room for the rest.
  const minLeft = new Array<number>(n);
  const maxLeft = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const prevEnd = i ? minLeft[i - 1] + labels[i - 1].width + gap : -Infinity;
    minLeft[i] = Math.max(bounds[i][0], prevEnd);
  }
  for (let i = n - 1; i >= 0; i--) {
    const nextStart = i < n - 1 ? maxLeft[i + 1] - gap : Infinity;
    maxLeft[i] = Math.max(
      minLeft[i],
      Math.min(bounds[i][1], nextStart - labels[i].width),
    );
  }
  const lefts = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const prevEnd = i ? lefts[i - 1] + labels[i - 1].width + gap : -Infinity;
    lefts[i] = Math.max(
      Math.min(Math.max(spread[i], minLeft[i]), maxLeft[i]),
      prevEnd,
    );
  }
  return lefts;
}
