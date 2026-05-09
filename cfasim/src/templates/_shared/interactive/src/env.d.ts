declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
{% if runtime == "python" %}
declare module "*.py?raw" {
  const content: string;
  export default content;
}
{% endif %}