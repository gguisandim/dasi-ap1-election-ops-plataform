import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { CreateRiskCategoryDto, UpdateRiskCategoryDto } from "./dto/risk.dto";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Categorias de risco, cadastráveis pela operação. */
@Injectable()
export class RiskCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.riskCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { risks: true } } },
    });
  }

  async create(dto: CreateRiskCategoryDto) {
    try {
      return await this.prisma.riskCategory.create({
        data: { ...dto, key: dto.key.trim().toUpperCase() },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe uma categoria com essa chave.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRiskCategoryDto) {
    await this.require(id);
    return this.prisma.riskCategory.update({ where: { id }, data: dto });
  }

  async require(id: string) {
    const category = await this.prisma.riskCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria de risco não encontrada.");
    if (!category.active) {
      throw new NotFoundException("Categoria de risco inativa.");
    }
    return category;
  }
}
