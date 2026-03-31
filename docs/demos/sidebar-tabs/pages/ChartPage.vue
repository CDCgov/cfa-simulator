<template>
  <h1>Chart</h1>
  <p>
    This page would display a chart visualization. The sidebar controls on the
    left stay consistent across all tabs.
  </p>
  <div class="placeholder">
    <svg viewBox="0 0 200 100" width="100%">
      <polyline
        points="0,80 30,60 60,70 90,30 120,45 150,20 180,35 200,10"
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="2"
      />
      <line
        x1="0"
        y1="90"
        x2="200"
        y2="90"
        stroke="var(--color-border)"
        stroke-width="1"
      />
    </svg>
  </div>
</template>

<style scoped>
.placeholder {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-4);
}
</style>
