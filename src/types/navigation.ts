import type { ModuleKey } from "@/types/permissions";

export interface NavigationItem {
  label: string;
  path: string;
  moduleKey: ModuleKey;
  icon: string;
}
