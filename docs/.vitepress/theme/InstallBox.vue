<script setup lang="ts">
import { ref } from "vue";

const command = "uvx cfasim init";
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(command);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // clipboard API unavailable — ignore
  }
}
</script>

<template>
  <div class="install-box">
    <div class="install-box__container">
      <button
        type="button"
        class="install-box__command"
        :aria-label="`Copy ${command} to clipboard`"
        @click="copy"
      >
        <span class="install-box__prompt" aria-hidden="true">$</span>
        <code class="install-box__code">{{ command }}</code>
        <span class="install-box__status" :class="{ 'is-copied': copied }">
          {{ copied ? "Copied" : "Copy" }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.install-box {
  padding: 0 24px;
  margin: 48px 0;
}

.install-box__container {
  display: flex;
  justify-content: flex-start;
  max-width: 1152px;
  margin: 0 auto;
}

@media (min-width: 640px) {
  .install-box {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .install-box {
    padding: 0 64px;
  }
}

.install-box__command {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: var(--vp-code-block-bg, #1b1b1f);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition:
    border-color 0.2s,
    transform 0.1s;
}

.install-box__command:hover {
  border-color: var(--vp-c-brand-1);
}

.install-box__command:active {
  transform: translateY(1px);
}

.install-box__prompt {
  color: var(--vp-c-brand-1);
  user-select: none;
}

.install-box__code {
  background: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.install-box__status {
  font-size: 12px;
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-3);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  transition:
    color 0.2s,
    background 0.2s;
}

.install-box__status.is-copied {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

@media (max-width: 640px) {
  .install-box__command {
    font-size: 13px;
    padding: 12px 14px;
  }
}
</style>
