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
  users: { read: "users.read", manage: "users.manage" },
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
  PERMISSIONS.users.read,
  PERMISSIONS.users.manage,
  PERMISSIONS.audit.read,
  PERMISSIONS.simulation.read,
  PERMISSIONS.simulation.manage,
] as const;

export type PermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number];
