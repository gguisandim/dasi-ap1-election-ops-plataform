export const PERMISSIONS = {
  elections: { read: "elections.read", manage: "elections.manage" },
  incidents: {
    read: "incidents.read",
    create: "incidents.create",
    assign: "incidents.assign",
    update: "incidents.update",
    resolve: "incidents.resolve",
    close: "incidents.close",
  },
  inventory: {
    read: "inventory.read",
    create: "inventory.create",
    update: "inventory.update",
    move: "inventory.move",
  },
  routes: { read: "routes.read", manage: "routes.manage" },
  transmission: { read: "transmission.read", manage: "transmission.manage" },
  reports: {
    read: "reports.read",
    export: "reports.export",
    manage: "reports.manage",
  },
  fieldTeams: { read: "field-teams.read", manage: "field-teams.manage" },

  communications: {
    read: "communications.read",
    manage: "communications.manage",
    publish: "communications.publish",
  },
  evidence: {
    read: "evidence.read",
    upload: "evidence.upload",
    version: "evidence.version",
    manage: "evidence.manage",
  },
  knowledge: {
    read: "knowledge.read",
    manage: "knowledge.manage",
    publish: "knowledge.publish",
    execute: "knowledge.execute",
  },
  risks: {
    read: "risks.read",
    manage: "risks.manage",
    assess: "risks.assess",
  },

  shifts: { read: "shifts.read", manage: "shifts.manage" },
  shiftHandovers: {
    read: "shift-handovers.read",
    manage: "shift-handovers.manage",
    confirm: "shift-handovers.confirm",
  },

  commandCenter: {
    read: "command-center.read",
    manage: "command-center.manage",
  },
  resourceRequests: {
    read: "resource-requests.read",
    manage: "resource-requests.manage",
    approve: "resource-requests.approve",
    fulfill: "resource-requests.fulfill",
  },
  postmortems: {
    read: "postmortems.read",
    manage: "postmortems.manage",
    review: "postmortems.review",
    publish: "postmortems.publish",
  },

  preparationChecklists: {
    read: "preparation-checklists.read",
    manage: "preparation-checklists.manage",
    approve: "preparation-checklists.approve",
  },
  tasks: {
    read: "tasks.read",
    manage: "tasks.manage",
  },

  users: { read: "users.read", manage: "users.manage" },
  roles: { read: "roles.read", manage: "roles.manage" },
  audit: { read: "audit.read" },
  simulation: { read: "simulation.read", manage: "simulation.manage" },
} as const;

export const PLATFORM_PERMISSION_KEYS = [
  PERMISSIONS.elections.read,
  PERMISSIONS.elections.manage,

  PERMISSIONS.incidents.read,
  PERMISSIONS.incidents.create,
  PERMISSIONS.incidents.assign,
  PERMISSIONS.incidents.update,
  PERMISSIONS.incidents.resolve,
  PERMISSIONS.incidents.close,

  PERMISSIONS.inventory.read,
  PERMISSIONS.inventory.create,
  PERMISSIONS.inventory.update,
  PERMISSIONS.inventory.move,

  PERMISSIONS.routes.read,
  PERMISSIONS.routes.manage,

  PERMISSIONS.transmission.read,
  PERMISSIONS.transmission.manage,

  PERMISSIONS.reports.read,
  PERMISSIONS.reports.export,
  PERMISSIONS.reports.manage,

  PERMISSIONS.fieldTeams.read,
  PERMISSIONS.fieldTeams.manage,

  PERMISSIONS.communications.read,
  PERMISSIONS.communications.manage,
  PERMISSIONS.communications.publish,

  PERMISSIONS.evidence.read,
  PERMISSIONS.evidence.upload,
  PERMISSIONS.evidence.version,
  PERMISSIONS.evidence.manage,

  PERMISSIONS.knowledge.read,
  PERMISSIONS.knowledge.manage,
  PERMISSIONS.knowledge.publish,
  PERMISSIONS.knowledge.execute,

  PERMISSIONS.risks.read,
  PERMISSIONS.risks.manage,
  PERMISSIONS.risks.assess,

  PERMISSIONS.shifts.read,
  PERMISSIONS.shifts.manage,

  PERMISSIONS.shiftHandovers.read,
  PERMISSIONS.shiftHandovers.manage,
  PERMISSIONS.shiftHandovers.confirm,

  PERMISSIONS.commandCenter.read,
  PERMISSIONS.commandCenter.manage,

  PERMISSIONS.resourceRequests.read,
  PERMISSIONS.resourceRequests.manage,
  PERMISSIONS.resourceRequests.approve,
  PERMISSIONS.resourceRequests.fulfill,

  PERMISSIONS.postmortems.read,
  PERMISSIONS.postmortems.manage,
  PERMISSIONS.postmortems.review,
  PERMISSIONS.postmortems.publish,

  PERMISSIONS.preparationChecklists.read,
  PERMISSIONS.preparationChecklists.manage,
  PERMISSIONS.preparationChecklists.approve,

  PERMISSIONS.tasks.read,
  PERMISSIONS.tasks.manage,

  PERMISSIONS.users.read,
  PERMISSIONS.users.manage,

  PERMISSIONS.roles.read,
  PERMISSIONS.roles.manage,

  PERMISSIONS.audit.read,

  PERMISSIONS.simulation.read,
  PERMISSIONS.simulation.manage,
] as const;

export type PermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number];
