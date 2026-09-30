import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { SectionListPage } from "./client/pages/SectionListPage";
import { SectionDetailPage } from "./client/pages/SectionDetailPage";
import { SectionFormPage } from "./client/pages/SectionFormPage";
export const pollingSectionsPlugin: PlatformPlugin = {
  manifest,
  View: SectionListPage,
  routes: [
    { path: "/polling-sections", Component: SectionListPage },
    { path: "/polling-sections/new", Component: SectionFormPage },
    { path: "/polling-sections/:id/edit", Component: SectionFormPage },
    { path: "/polling-sections/:id", Component: SectionDetailPage },
  ],
};
