import type { PlatformPlugin } from "@eops/plugin-sdk";
import { EvidenceDetailPage } from "./client/pages/EvidenceDetailPage";
import { EvidenceEditPage } from "./client/pages/EvidenceEditPage";
import { EvidenceGalleryPage } from "./client/pages/EvidenceGalleryPage";
import { EvidenceListPage } from "./client/pages/EvidenceListPage";
import { EvidenceUploadPage } from "./client/pages/EvidenceUploadPage";
import { EvidenceVersionsPage } from "./client/pages/EvidenceVersionsPage";
import { manifest } from "./manifest";

export const documentsEvidencePlugin: PlatformPlugin = {
  manifest,
  View: EvidenceListPage,
  routes: [
    { path: "/evidence", Component: EvidenceListPage },
    { path: "/evidence/new", Component: EvidenceUploadPage },
    { path: "/evidence/gallery", Component: EvidenceGalleryPage },
    { path: "/evidence/:id/edit", Component: EvidenceEditPage },
    { path: "/evidence/:id/versions", Component: EvidenceVersionsPage },
    { path: "/evidence/:id", Component: EvidenceDetailPage },
  ],
};

export { manifest } from "./manifest";
export { evidenceService } from "./client/services/evidenceService";
export type {
  EvidenceFilters,
  EvidenceReferenceData,
  EvidenceUploadInput,
} from "./client/services/evidenceService";
