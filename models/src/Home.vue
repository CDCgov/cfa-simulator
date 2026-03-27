<script setup lang="ts">
import { RouterLink } from "vue-router";
import { models } from "./router";
</script>

<template>
  <div class="home">
    <h1>Models</h1>
    <div class="model-list">
      <RouterLink
        v-for="model in models"
        :key="model.path"
        :to="model.path"
        class="model-card"
      >
        <h2>{{ model.name }}</h2>
        <p>{{ model.description }}</p>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 48rem;
  margin: 2rem auto;
  padding: 0 1rem;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.model-card {
  display: block;
  padding: 1.25rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 0.5rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.model-card:hover {
  border-color: var(--color-text-secondary, #6b7280);
}

.model-card h2 {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
}

.model-card p {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}
</style>
