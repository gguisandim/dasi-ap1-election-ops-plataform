export interface DomainEventMap {
  "incident.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    severity: string;
    electionId: string;
    pollingPlaceId?: string;
  };

  "incident.assigned": {
    entityId: string;
    actorId?: string;
    code: string;
    assignedToId?: string;
    assignedToName: string;
    from?: string;
    to: string;
    reason?: string;
  };

  "incident.resolved": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.updated": {
    entityId: string;
    actorId?: string;
    code: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  "incident.acknowledged": {
    entityId: string;
    actorId: string;
    code: string;
    acknowledgedAt: string;
  };

  "incident.status_changed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.severity_changed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
  };

  "incident.escalated": {
    entityId: string;
    actorId: string;
    code: string;
    from: number;
    to: number;
    reason: string;
  };

  "incident.comment_added": {
    entityId: string;
    actorId?: string;
    code: string;
    message: string;
  };

  "incident.reopened": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.closed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.cancelled": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.category_created": {
    entityId: string;
    actorId: string;
    key: string;
    name: string;
  };

  "incident.category_updated": {
    entityId: string;
    actorId: string;
    key: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  "asset.created": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    name: string;
  };

  "asset.moved": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    origin: string;
    destination: string;
    responsibleName: string;
  };

  "asset.status_changed": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    from: string;
    to: string;
  };

  "asset.reservation_requested": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
    requesterName: string;
    startsAt: string;
    endsAt: string;
  };

  "asset.reservation_approved": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
  };

  "asset.reservation_cancelled": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
    reason?: string;
  };

  "asset.checked_out": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    responsibleId?: string;
    responsibleName: string;
    expectedReturnAt?: string;
  };

  "asset.checked_in": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    condition: string;
    problemDetected: boolean;
  };

  "asset.maintenance_opened": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
    type: string;
  };

  "asset.maintenance_started": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
  };

  "asset.maintenance_completed": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
    returnToService: boolean;
  };

  "asset.maintenance_cancelled": {
    entityId: string;
    actorId?: string;
    assetId: string;
    assetTag: string;
  };

  "user.created": {
    entityId: string;
    actorId?: string;
    email: string;
    name: string;
  };

  "access.role_created": {
    entityId: string;
    actorId?: string;
    key: string;
    name: string;
    permissionKeys: string[];
  };

  "access.role_updated": {
    entityId: string;
    actorId?: string;
    key: string;
    name: string;
    permissionKeys: string[];
  };

  "access.role_deactivated": {
    entityId: string;
    actorId?: string;
    key: string;
    name: string;
  };

  "access.user_roles_changed": {
    entityId: string;
    actorId?: string;
    userId: string;
    from: string[];
    to: string[];
  };

  "access.user_status_changed": {
    entityId: string;
    actorId?: string;
    userId: string;
    from: string;
    to: string;
  };

  "election.created": {
    entityId: string;
    actorId?: string;
    name: string;
    year: number;
  };

  "route.created": {
    entityId: string;
    actorId?: string;
    code: string;
    name: string;
    electionId: string;
    electoralZoneId: string;
  };

  "route.ready": {
    entityId: string;
    actorId?: string;
    code: string;
  };

  "route.dispatched": {
    entityId: string;
    actorId?: string;
    code: string;
    dispatchedAt: string;
  };

  "route.started": {
    entityId: string;
    actorId?: string;
    code: string;
    departedAt: string;
  };

  "route.completed": {
    entityId: string;
    actorId?: string;
    code: string;
    arrivedAt: string;
  };

  "route.cancelled": {
    entityId: string;
    actorId?: string;
    code: string;
    reason: string;
  };

  "route.stop_arrived": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
  };

  "route.stop_completed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
  };

  "route.stop_failed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "route.stop_skipped": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "route.stops_reordered": {
    entityId: string;
    actorId?: string;
    code: string;
    stopIds: string[];
  };

  "route.exception_created": {
    entityId: string;
    actorId?: string;
    routeId: string;
    reason: string;
    description: string;
  };

  "route.exception_resolved": {
    entityId: string;
    actorId?: string;
    routeId: string;
    resolution: string;
  };

  "delivery.completed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
  };

  "delivery.failed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "transmission.completed": {
    entityId: string;
    actorId?: string;
    identification: string;
    electionId: string;
    electoralZoneId: string;
    attemptNumber: number;
  };

  "transmission.failed": {
    entityId: string;
    actorId?: string;
    identification: string;
    electionId: string;
    electoralZoneId: string;
    attemptNumber: number;
    error: string;
  };

  "transmission.connectivity_changed": {
    entityId: string;
    actorId?: string;
    identification: string;
    from: string;
    to: string;
  };

  "transmission.alert_created": {
    entityId: string;
    actorId?: string;
    pointId: string;
    identification: string;
    alertType: string;
    message: string;
  };

  "transmission.alert_acknowledged": {
    entityId: string;
    actorId?: string;
    alertId: string;
    pointId: string;
    identification: string;
    alertType: string;
  };

  "transmission.alert_resolved": {
    entityId: string;
    actorId?: string;
    alertId: string;
    pointId: string;
    identification: string;
    alertType: string;
  };

  "transmission.retry_requested": {
    entityId: string;
    actorId?: string;
    pointIds: string[];
    count: number;
    reason?: string;
  };

  "simulation.started": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    scenarioId?: string;
  };

  "simulation.resumed": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    elapsedSeconds: number;
  };

  "simulation.paused": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    elapsedSeconds: number;
  };

  "simulation.finished": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    elapsedSeconds: number;
    incidentCount: number;
  };

  "simulation.scored": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    score: number;
    executedEvents: number;
    plannedEvents: number;
  };

  "field_team.allocated": {
    entityId: string;
    actorId?: string;
    teamId?: string;
    memberId?: string;
    electionId: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    routeId?: string;
  };

  "field_member.checked_in": {
    entityId: string;
    actorId?: string;
    memberId: string;
    memberName: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    occurredAt: string;
  };

  "field_member.checked_out": {
    entityId: string;
    actorId?: string;
    memberId: string;
    memberName: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    occurredAt: string;
  };

  "field_member.availability_changed": {
    entityId: string;
    actorId: string;
    memberName: string;
    from: string;
    to: string;
  };

  "field_member.unavailability_created": {
    entityId: string;
    actorId: string;
    memberId: string;
    memberName: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  };

  "field_member.unavailability_removed": {
    entityId: string;
    actorId: string;
    memberId: string;
    memberName: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  };

  "field_member.specialty_changed": {
    entityId: string;
    actorId: string;
    memberName: string;
    specialtyIds: string[];
  };

  "field_dispatch.created": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
    incidentId?: string | null;
    priority: string;
    title: string;
  };

  "field_dispatch.dispatched": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
    priority: string;
  };

  "field_dispatch.accepted": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
  };

  "field_dispatch.rejected": {
    entityId: string;
    actorId: string;
    teamId: string;
    taskId?: string | null;
    reason: string;
  };

  "field_dispatch.departed": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
  };

  "field_dispatch.arrived": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
  };

  "field_dispatch.started": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
  };

  "field_dispatch.completed": {
    entityId: string;
    actorId: string;
    teamId: string;
    memberId?: string | null;
    taskId?: string | null;
    summary: string;
  };

  "field_dispatch.cancelled": {
    entityId: string;
    actorId: string;
    teamId: string;
    taskId?: string | null;
    reason: string;
  };

  "communication.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    priority: string;
    electionId: string;
    status: string;
  };

  "communication.published": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    priority: string;
    electionId: string;
    recipientCount: number;
  };

  "communication.cancelled": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    reason?: string;
  };

  "communication.expired": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    expiredAt: string;
  };

  "communication.archived": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
  };

  "communication.read": {
    entityId: string;
    actorId?: string;
    communicationId: string;
    recipientId: string;
    recipientName: string;
    code: string;
  };

  "communication.acknowledged": {
    entityId: string;
    actorId?: string;
    communicationId: string;
    recipientId: string;
    recipientName: string;
    code: string;
    title: string;
  };

  "evidence.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    type: string;
    size: number;
    checksum: string;
  };

  "evidence.versioned": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    version: number;
    size: number;
    checksum: string;
  };

  "evidence.archived": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
  };

  "runbook.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    categoryKey?: string;
  };

  "runbook.published": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    stepCount: number;
  };

  "runbook.matched": {
    entityId: string;
    actorId?: string;
    incidentId?: string;
    matchCount: number;
  };

  "runbook.executed": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    outcome: string;
    resolved: boolean;
    incidentId?: string;
  };

  "risk.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    electionId: string;
    score: number;
    level: string;
  };

  "risk.escalated": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    fromLevel: string;
    toLevel: string;
    score: number;
  };

  "risk.materialized": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    level: string;
    actualImpact: string;
    incidentId?: string;
  };

  "risk.closed": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    level: string;
  };

  "preparation_checklist.approved": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    electoralZoneId: string;
    pollingPlaceId: string;
    approvedBy: string;
    approvedAt: string;
  };

  "preparation_checklist.blocked": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "preparation_checklist.readiness_changed": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    pollingPlaceId: string;
    from: number;
    to: number;
  };

  "preparation_checklist.blocker_detected": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    pollingPlaceId: string;
    blockers: string[];
  };

  "task.created": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    priority: string;
  };

  "task.assigned": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    assigneeId: string | null;
  };

  "task.status_changed": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    from: string;
    to: string;
  };

  "task.completed": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
  };

  "task.blocked": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    reason: string;
  };

  "task.subtask_created": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    parentId: string;
  };

  "task.bulk_updated": {
    entityId: string;
    actorId?: string;
    taskIds: string[];
    count: number;
    fields: string[];
  };

  "shift.created": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    teamId: string;
    startsAt: string;
    endsAt: string;
  };
  "shift.started": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
  };
  "shift.completed": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
  };
  "shift.cancelled": {
    entityId: string;
    actorId: string;
    name: string;
    electionId: string;
    from: string;
    to: string;
  };
  "shift.updated": {
    entityId: string;
    actorId: string;
    name: string;
    electionId: string;
    changes: string[];
  };
  "shift.assignment_added": {
    entityId: string;
    actorId: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    status: string;
  };
  "shift.presence_registered": {
    entityId: string;
    actorId: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    occurredAt: string;
  };
  "shift.on_call_activated": {
    entityId: string;
    actorId: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    activatedAt: string;
  };
  "shift.replacement_created": {
    entityId: string;
    actorId: string;
    shiftId: string;
    electionId: string;
    originalMemberId: string;
    substituteMemberId: string;
    substituteName: string;
    reason?: string;
  };
  "shift.template_created": {
    entityId: string;
    actorId: string;
    name: string;
    teamId: string;
  };
  "shift.template_updated": {
    entityId: string;
    actorId: string;
    name: string;
    teamId: string;
    changes: string[];
  };
  "shift.assignment_changed": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    change: string;
  };
  "shift.absence_registered": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    reason?: string;
  };
  "shift.replacement_registered": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    originalMemberId: string;
    substituteMemberId: string;
    substituteName: string;
  };
  "shift.coverage_insufficient": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    requiredOperators: number;
    availableOperators: number;
  };
  "shift_handover.created": {
    entityId: string;
    actorId: string;
    shiftId: string;
    senderUserId: string;
    recipientUserId: string;
  };
  "shift_handover.updated": {
    entityId: string;
    actorId: string;
    shiftId: string;
    senderUserId: string;
    recipientUserId: string;
    changes: string[];
  };
  "shift_handover.submitted": {
    entityId: string;
    actorId: string;
    shiftId: string;
    shiftName: string;
    senderUserId: string;
    recipientUserId: string;
    from: string;
    to: string;
    submittedAt: string;
  };
  "shift_handover.confirmed": {
    entityId: string;
    actorId: string;
    shiftId: string;
    shiftName: string;
    senderUserId: string;
    recipientUserId: string;
    from: string;
    to: string;
    confirmedAt: string;
  };
  "shift_handover.cancelled": {
    entityId: string;
    actorId: string;
    shiftId: string;
    shiftName: string;
    senderUserId: string;
    recipientUserId: string;
    from: string;
    to: string;
    reason?: string;
    cancelledAt: string;
  };

  "resource_request.created": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    priority: string;
    status: string;
  };
  "resource_request.submitted": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    priority: string;
    from: string;
    to: string;
    requestedById: string;
    submittedAt: string;
  };
  "resource_request.triaged": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    priority: string;
    ownerId?: string | null;
    ownerChanged: boolean;
    priorityChanged: boolean;
    from: string;
    to: string;
  };
  "resource_request.approved": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    requestedById: string;
    from: string;
    to: string;
    approvedAt: string;
  };
  "resource_request.rejected": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    requestedById: string;
    from: string;
    to: string;
    reason?: string;
    rejectedAt: string;
  };
  "resource_request.partially_fulfilled": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    requestedById: string;
    from: string;
    to: string;
    fulfilledQuantity: number;
    requiredQuantity: number;
  };
  "resource_request.fulfilled": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    requestedById: string;
    from: string;
    to: string;
    fulfilledAt: string;
  };
  "resource_request.cancelled": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    electionId: string;
    from: string;
    to: string;
    reason?: string;
    cancelledAt: string;
  };

  "postmortem.created": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    primaryIncidentId: string;
    status: string;
  };
  "postmortem.submitted": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    primaryIncidentId: string;
    from: string;
    to: string;
    reviewerIds: string[];
    submittedForReviewAt: string;
  };
  "postmortem.changes_requested": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    ownerId?: string | null;
    reviewerId: string;
    from: string;
    to: string;
    comment?: string;
  };
  "postmortem.approved": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    ownerId?: string | null;
    from: string;
    to: string;
    approvedAt: string;
  };
  "postmortem.published": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    ownerId?: string | null;
    reviewerIds: string[];
    from: string;
    to: string;
    publishedAt: string;
  };
  "postmortem.archived": {
    entityId: string;
    actorId: string;
    code: string;
    title: string;
    from: string;
    to: string;
    archivedAt: string;
  };
  "postmortem.action_overdue": {
    entityId: string;
    actorId: string;
    actionItemId: string;
    postmortemId: string;
    code: string;
    title: string;
    ownerUserId?: string | null;
    dueAt: string;
    overdueAt: string;
  };

  "command_center.snapshot_created": {
    entityId: string;
    actorId: string;
    name: string;
    health: string;
    electionId?: string | null;
    electoralZoneId?: string | null;
  };
  "command_center.shared_view_created": {
    entityId: string;
    actorId: string;
    name: string;
    layoutMode: string;
  };

  "simulation.failed": {
    entityId: string;
    actorId: string;
    name: string;
    electionId: string;
    reason: string;
    elapsedSeconds: number;
  };
  "simulation.cancelled": {
    entityId: string;
    actorId: string;
    name: string;
    electionId: string;
    elapsedSeconds: number;
  };
  "simulation.decision_recorded": {
    entityId: string;
    actorId: string;
    simulationId: string;
    kind: string;
    offsetSeconds: number;
    rationale: string;
  };
  "simulated_incident.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    severity: string;
    electionId: string;
    simulationId: string;
    pollingPlaceId?: string;
  };

  "report_view.created": {
    entityId: string;
    actorId: string;
    name: string;
    granularity: string;
  };
  "report_view.shared": {
    entityId: string;
    actorId: string;
    name: string;
  };

  "transmission.state_transition": {
    entityId: string;
    actorId?: string;
    pointId: string;
    identification: string;
    from: string;
    to: string;
    reason?: string;
    circuitId?: string;
  };
  "transmission.circuit_created": {
    entityId: string;
    actorId: string;
    pointId: string;
    identification: string;
    code: string;
    isPrimary: boolean;
  };
  "transmission.circuit_status_changed": {
    entityId: string;
    actorId: string;
    pointId: string;
    code: string;
    from: string;
    to: string;
  };
  "transmission.failover_started": {
    entityId: string;
    actorId: string;
    pointId: string;
    identification: string;
    toCircuitCode: string;
    reason: string;
  };
  "transmission.failover_recovered": {
    entityId: string;
    actorId: string;
    pointId: string;
    identification: string;
  };
  "transmission.provider_updated": {
    entityId: string;
    actorId: string;
    code: string;
    name: string;
    active: boolean;
  };
}

export type DomainEventName = keyof DomainEventMap;

export interface DomainEvent<K extends DomainEventName = DomainEventName> {
  name: K;
  payload: DomainEventMap[K];
  occurredAt: Date;
  /**
   * Correlation ID da cadeia operacional que originou o evento, quando houver.
   * Preenchido pelo EventBus a partir do contexto assíncrono ativo; `undefined`
   * nunca é erro.
   */
  correlationId?: string;
}

export type DomainEventHandler<K extends DomainEventName> = (
  event: DomainEvent<K>,
) => void | Promise<void>;

export interface NotificationEventDefinition {
  eventName: DomainEventName;
  domain: string;
  label: string;
  description: string;
  requiredPermission?: string;
}

export const NOTIFICATION_EVENT_CATALOG = [
  {
    eventName: "incident.created",
    domain: "Incidentes",
    label: "Novo incidente",
    description: "Incidente registrado na operação.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.acknowledged",
    domain: "Incidentes",
    label: "Incidente reconhecido",
    description: "Um operador assumiu conhecimento do incidente.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.assigned",
    domain: "Incidentes",
    label: "Incidente atribuído",
    description: "Responsável pelo atendimento alterado.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.escalated",
    domain: "Incidentes",
    label: "Incidente escalado",
    description: "Nível de escalonamento aumentado.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.resolved",
    domain: "Incidentes",
    label: "Incidente resolvido",
    description: "Incidente marcado como resolvido.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.reopened",
    domain: "Incidentes",
    label: "Incidente reaberto",
    description: "Incidente retornou ao atendimento.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.closed",
    domain: "Incidentes",
    label: "Incidente fechado",
    description: "Incidente encerrado definitivamente.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "incident.comment_added",
    domain: "Incidentes",
    label: "Comentário adicionado",
    description: "Novo comentário na timeline.",
    requiredPermission: "incidents.read",
  },
  {
    eventName: "asset.status_changed",
    domain: "Inventário",
    label: "Status de ativo alterado",
    description: "Ativo mudou de estado operacional.",
    requiredPermission: "inventory.read",
  },
  {
    eventName: "asset.maintenance_opened",
    domain: "Inventário",
    label: "Manutenção de ativo aberta",
    description: "Ativo foi bloqueado para manutenção preventiva ou corretiva.",
    requiredPermission: "inventory.read",
  },
  {
    eventName: "route.exception_created",
    domain: "Rotas",
    label: "Exceção logística registrada",
    description: "Uma ocorrência exige atenção durante a execução da rota.",
    requiredPermission: "routes.read",
  },
  {
    eventName: "delivery.failed",
    domain: "Rotas",
    label: "Falha de entrega",
    description: "Uma entrega não pôde ser concluída.",
    requiredPermission: "routes.read",
  },
  {
    eventName: "transmission.failed",
    domain: "Transmissão",
    label: "Falha de transmissão",
    description: "Ponto registrou falha de transmissão.",
    requiredPermission: "transmission.read",
  },
  {
    eventName: "transmission.connectivity_changed",
    domain: "Transmissão",
    label: "Conectividade alterada",
    description: "Conectividade do ponto mudou.",
    requiredPermission: "transmission.read",
  },
  {
    eventName: "task.assigned",
    domain: "Tarefas",
    label: "Tarefa atribuída",
    description: "Responsável de uma tarefa foi alterado.",
    requiredPermission: "tasks.read",
  },
  {
    eventName: "task.blocked",
    domain: "Tarefas",
    label: "Tarefa bloqueada",
    description: "Tarefa encontrou impedimento.",
    requiredPermission: "tasks.read",
  },
  {
    eventName: "shift.coverage_insufficient",
    domain: "Escalas",
    label: "Cobertura insuficiente",
    description: "Turno sem operadores suficientes.",
    requiredPermission: "shifts.read",
  },
  {
    eventName: "shift.absence_registered",
    domain: "Escalas",
    label: "Ausência registrada",
    description: "Operador marcado como ausente em um turno.",
    requiredPermission: "shifts.read",
  },
  {
    eventName: "shift.on_call_activated",
    domain: "Escalas",
    label: "Sobreaviso acionado",
    description: "Operador de sobreaviso foi acionado.",
    requiredPermission: "shifts.read",
  },
  {
    eventName: "shift.replacement_created",
    domain: "Escalas",
    label: "Substituição registrada",
    description: "Operador de um turno foi substituído.",
    requiredPermission: "shifts.read",
  },
  {
    eventName: "shift_handover.submitted",
    domain: "Passagem de turno",
    label: "Passagem recebida",
    description: "Uma passagem de turno aguarda sua confirmação.",
    requiredPermission: "shift-handovers.read",
  },
  {
    eventName: "shift_handover.confirmed",
    domain: "Passagem de turno",
    label: "Passagem confirmada",
    description: "O destinatário confirmou uma passagem de turno.",
    requiredPermission: "shift-handovers.read",
  },
  {
    eventName: "shift_handover.cancelled",
    domain: "Passagem de turno",
    label: "Passagem cancelada",
    description: "Uma passagem de turno foi cancelada.",
    requiredPermission: "shift-handovers.read",
  },
  {
    eventName: "field_dispatch.created",
    domain: "Operação de campo",
    label: "Dispatch solicitado",
    description: "Nova demanda operacional registrada para envio de equipe.",
    requiredPermission: "field-teams.read",
  },
  {
    eventName: "field_dispatch.dispatched",
    domain: "Operação de campo",
    label: "Dispatch atribuído",
    description: "Demanda enviada para uma equipe de campo.",
    requiredPermission: "field-teams.read",
  },
  {
    eventName: "field_dispatch.rejected",
    domain: "Operação de campo",
    label: "Dispatch rejeitado",
    description: "Equipe recusou a demanda operacional enviada.",
    requiredPermission: "field-teams.read",
  },
  {
    eventName: "resource_request.submitted",
    domain: "Solicitações de recurso",
    label: "Solicitação recebida",
    description: "Uma solicitação operacional aguarda triagem ou aprovação.",
    requiredPermission: "resource-requests.approve",
  },
  {
    eventName: "resource_request.triaged",
    domain: "Solicitações de recurso",
    label: "Solicitação triada",
    description: "A solicitação recebeu responsável ou nova prioridade.",
    requiredPermission: "resource-requests.read",
  },
  {
    eventName: "resource_request.approved",
    domain: "Solicitações de recurso",
    label: "Solicitação aprovada",
    description: "A solicitação foi aprovada e aguarda atendimento.",
    requiredPermission: "resource-requests.read",
  },
  {
    eventName: "resource_request.rejected",
    domain: "Solicitações de recurso",
    label: "Solicitação rejeitada",
    description: "A solicitação não foi aprovada.",
    requiredPermission: "resource-requests.read",
  },
  {
    eventName: "resource_request.fulfilled",
    domain: "Solicitações de recurso",
    label: "Solicitação atendida",
    description: "Todos os itens solicitados foram atendidos.",
    requiredPermission: "resource-requests.read",
  },
  {
    eventName: "postmortem.submitted",
    domain: "Postmortem",
    label: "Postmortem para revisão",
    description: "Uma análise pós-incidente aguarda sua revisão.",
    requiredPermission: "postmortems.review",
  },
  {
    eventName: "postmortem.changes_requested",
    domain: "Postmortem",
    label: "Mudanças solicitadas",
    description: "A revisão pediu ajustes na análise.",
    requiredPermission: "postmortems.read",
  },
  {
    eventName: "postmortem.approved",
    domain: "Postmortem",
    label: "Postmortem aprovado",
    description: "Todos os revisores aprovaram a análise.",
    requiredPermission: "postmortems.read",
  },
  {
    eventName: "postmortem.published",
    domain: "Postmortem",
    label: "Postmortem publicado",
    description: "A análise foi publicada para consulta.",
    requiredPermission: "postmortems.read",
  },
  {
    eventName: "transmission.failover_started",
    domain: "Transmissão",
    label: "Failover acionado",
    description: "Um ponto passou a operar por circuito alternativo.",
    requiredPermission: "transmission.read",
  },
  {
    eventName: "transmission.failover_recovered",
    domain: "Transmissão",
    label: "Failover recuperado",
    description: "O ponto voltou a operar pelo circuito de origem.",
    requiredPermission: "transmission.read",
  },
  {
    eventName: "postmortem.action_overdue",
    domain: "Postmortem",
    label: "Ação corretiva vencida",
    description: "Uma ação corretiva passou do prazo definido.",
    requiredPermission: "postmortems.read",
  },
] as const satisfies readonly NotificationEventDefinition[];

export function requiredPermissionForEvent(
  name: DomainEventName,
): string | undefined {
  const configured = NOTIFICATION_EVENT_CATALOG.find(
    (item) => item.eventName === name,
  );
  if (configured?.requiredPermission) return configured.requiredPermission;
  if (name.startsWith("incident.")) return "incidents.read";
  if (name.startsWith("asset.")) return "inventory.read";
  if (name.startsWith("transmission.")) return "transmission.read";
  if (name.startsWith("simulation.")) return "simulation.read";
  if (name.startsWith("task.")) return "tasks.read";
  if (name.startsWith("shift_handover.")) return "shift-handovers.read";
  if (name.startsWith("shift.")) return "shifts.read";
  if (name.startsWith("route.") || name.startsWith("delivery."))
    return "routes.read";
  if (name.startsWith("field_team.") || name.startsWith("field_member."))
    return "field-teams.read";
  if (name.startsWith("field_dispatch.")) return "field-teams.read";
  if (name.startsWith("communication.")) return "communications.read";
  if (name.startsWith("evidence.")) return "evidence.read";
  if (name.startsWith("runbook.")) return "knowledge.read";
  if (name.startsWith("risk.")) return "risks.read";
  if (name.startsWith("preparation_checklist."))
    return "preparation-checklists.read";
  if (name.startsWith("simulated_incident.")) return "incidents.read";
  if (name.startsWith("report_view.")) return "reports.read";
  if (name.startsWith("resource_request.")) return "resource-requests.read";
  if (name.startsWith("postmortem.")) return "postmortems.read";
  if (name.startsWith("command_center.")) return "command-center.read";
  if (name.startsWith("user.")) return "users.read";
  if (name.startsWith("election.")) return "elections.read";
  return undefined;
}
