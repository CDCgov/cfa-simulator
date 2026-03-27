<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
import { models } from "./router";
</script>

<template>
  <nav class="models-nav">
    <RouterLink to="/" class="models-nav-home">Models</RouterLink>
    <RouterLink
      v-for="model in models"
      :key="model.path"
      :to="model.path"
      class="models-nav-link"
    >
      {{ model.name }}
    </RouterLink>
  </nav>
  <RouterView />
</template>

<style scoped>
.models-nav {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-0);
}

.models-nav-home {
  font-weight: 600;
  margin-right: 0.5rem;
}

.models-nav a {
  text-decoration: none;
  color: var(--color-text-secondary);
}

.models-nav a.router-link-active {
  color: var(--color-text);
  font-weight: 500;
}
</style>
