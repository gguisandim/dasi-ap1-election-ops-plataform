import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import {
  AddCommentDto,
  AddFulfillmentDto,
  CancelRequestDto,
  CreateRequestDto,
  ReferencesQueryDto,
  RejectRequestDto,
  RequestQueryDto,
  TriageRequestDto,
  UpdateRequestDto,
} from "./dto/resource-requests.dto";
import { ResourceRequestsService } from "./resource-requests.service";

@Permissions(PERMISSIONS.resourceRequests.read)
@Controller("resource-requests")
export class ResourceRequestsController {
  constructor(private readonly service: ResourceRequestsService) {}

  @Get("dashboard") dashboard() {
    return this.service.dashboard();
  }

  @Get("queue") queue(@Query() query: RequestQueryDto) {
    return this.service.queue(query);
  }

  @Get("references") references(@Query() query: ReferencesQueryDto) {
    return this.service.references(query.electionId);
  }

  @Get() list(@Query() query: RequestQueryDto) {
    return this.service.list(query);
  }

  @Get(":id") detail(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.findOne(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.manage)
  @Post() create(@Body() dto: CreateRequestDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.resourceRequests.manage)
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.manage)
  @Post(":id/submit") submit(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.submit(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.manage)
  @Post(":id/triage") triage(
    @Param("id") id: string,
    @Body() dto: TriageRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.triage(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.approve)
  @Post(":id/approve") approve(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.approve(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.approve)
  @Post(":id/reject") reject(
    @Param("id") id: string,
    @Body() dto: RejectRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reject(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.manage)
  @Post(":id/cancel") cancel(
    @Param("id") id: string,
    @Body() dto: CancelRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.fulfill)
  @Post(":id/fulfillments") addFulfillment(
    @Param("id") id: string,
    @Body() dto: AddFulfillmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addFulfillment(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.resourceRequests.fulfill)
  @Delete(":id/fulfillments/:fulfillmentId") removeFulfillment(
    @Param("id") id: string,
    @Param("fulfillmentId") fulfillmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeFulfillment(
      id,
      fulfillmentId,
      request.user.id,
      request.user.permissions,
    );
  }

  @Post(":id/comments") addComment(
    @Param("id") id: string,
    @Body() dto: AddCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addComment(id, dto, request.user.id, request.user.permissions);
  }
}
