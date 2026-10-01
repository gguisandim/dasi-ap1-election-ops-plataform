import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { AuditQueryDto } from "./dto/audit-query.dto";
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: AuditQueryDto) {
    const where: Prisma.AuditEventWhereInput = { actorId: query.actorId, action: query.action, entityType: query.entityType, entityId: query.entityId, createdAt: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined };
    const [items, total] = await Promise.all([this.prisma.auditEvent.findMany({ where, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.auditEvent.count({ where })]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }
}
