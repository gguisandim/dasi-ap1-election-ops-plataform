import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { PollingPlaceListPage } from "./client/pages/PollingPlaceListPage";
import { PollingPlaceDetailPage } from "./client/pages/PollingPlaceDetailPage";
import { PollingPlaceFormPage } from "./client/pages/PollingPlaceFormPage";

export const pollingPlacesPlugin: PlatformPlugin = {
  manifest,
  View: PollingPlaceListPage,
  routes: [
    { path: "/polling-places", Component: PollingPlaceListPage },
    { path: "/polling-places/new", Component: PollingPlaceFormPage },
    { path: "/polling-places/:id/edit", Component: PollingPlaceFormPage },
    { path: "/polling-places/:id", Component: PollingPlaceDetailPage },
  ],
};
