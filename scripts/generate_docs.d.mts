export type ComponentEntry = readonly [
  slug: string,
  outDir: "components" | "charts",
  vuePath: string,
  docPath: string,
];

export const components: readonly ComponentEntry[];

export function regenerateComponent(
  entry: ComponentEntry,
  opts?: { updatePackage?: boolean },
): {
  name: string;
  slug: string;
  outDir: "components" | "charts";
  keywords: string[];
  meta: {
    props: {
      name: string;
      type: string;
      required: boolean;
      default?: string;
    }[];
    models: { name: string; type: string }[];
    emits: { name: string; payload: string }[];
  };
};

export function findComponentForSource(
  filePath: string,
): ComponentEntry | undefined;

export function generateAll(): void;
