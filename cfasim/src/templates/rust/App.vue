<script setup lang="ts">
import { SidebarLayout } from "@cfasim-ui/components";
import { useModel } from "@cfasim-ui/wasm";

const { result, loading } = useModel("%%project_name%%", "hello");
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>%%project_name%%</h2>
      <p>Controls go here</p>
    </template>
    <h1>%%project_name%%</h1>
    <p>{{ loading ? "Loading..." : result }}</p>
  </SidebarLayout>
</template>
