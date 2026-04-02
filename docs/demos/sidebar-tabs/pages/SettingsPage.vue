<template>
  <h1>Settings</h1>
  <p>This page would display configuration options for the simulation.</p>
  <div class="settings-list">
    <div class="setting">
      <span class="setting-label">Model type</span>
      <span class="setting-value">SIR</span>
    </div>
    <div class="setting">
      <span class="setting-label">Random seed</span>
      <span class="setting-value">42</span>
    </div>
    <div class="setting">
      <span class="setting-label">Output format</span>
      <span class="setting-value">CSV</span>
    </div>
  </div>
</template>

<style scoped>
.settings-list {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setting {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-1);
}

.setting-label {
  font-weight: 500;
}

.setting-value {
  color: var(--color-text-secondary);
}
</style>
