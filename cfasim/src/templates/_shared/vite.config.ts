import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
{% if runtime == "python" -%}
import { cfasimPyodide } from "cfasim-ui/pyodide/vite";
{%- elif runtime == "python-server" or runtime == "rust-server" -%}
import { cfasimServer } from "cfasim-ui/server/vite";
{%- else -%}
import { cfasimWasm } from "cfasim-ui/wasm/vite";
{%- endif %}

export default defineConfig({
  root: "interactive",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [vue(), {% if runtime == "python" %}cfasimPyodide({ model: ".."{% if local_ui_dir %}, localDeps: ["{{ local_ui_dir }}/cfasim-model-py"]{% endif %} }){% elif runtime == "python-server" or runtime == "rust-server" %}cfasimServer(){% else %}cfasimWasm({ model: "..", name: "{{ module_name }}" }){% endif %}],
});
