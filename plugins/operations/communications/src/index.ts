import type { PlatformPlugin } from "@eops/plugin-sdk";
import { CommunicationCreatePage } from "./client/pages/CommunicationCreatePage";
import { CommunicationDashboardPage } from "./client/pages/CommunicationDashboardPage";
import { CommunicationDetailPage } from "./client/pages/CommunicationDetailPage";
import { CommunicationEditPage } from "./client/pages/CommunicationEditPage";
import { CommunicationInboxPage } from "./client/pages/CommunicationInboxPage";
import { CommunicationListPage } from "./client/pages/CommunicationListPage";
import { CommunicationTemplatesPage } from "./client/pages/CommunicationTemplatesPage";
import { CommunicationTrackingPage } from "./client/pages/CommunicationTrackingPage";
import { manifest } from "./manifest";

export const communicationsPlugin: PlatformPlugin = {
  manifest,
  View: CommunicationDashboardPage,
  routes: [
    { path: "/communications", Component: CommunicationDashboardPage },
    { path: "/communications/messages", Component: CommunicationListPage },
    { path: "/communications/messages/new", Component: CommunicationCreatePage },
    { path: "/communications/messages/:id/edit", Component: CommunicationEditPage },
    { path: "/communications/messages/:id/tracking", Component: CommunicationTrackingPage },
    { path: "/communications/messages/:id", Component: CommunicationDetailPage },
    { path: "/communications/templates", Component: CommunicationTemplatesPage },
    { path: "/communications/inbox", Component: CommunicationInboxPage },
  ],
};

export { manifest } from "./manifest";
export { communicationService } from "./client/services/communicationService";
export type {
  CommunicationFilters,
  RecipientFilters,
  ReferenceData,
} from "./client/services/communicationService";
