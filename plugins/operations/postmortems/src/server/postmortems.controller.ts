import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import {
  CreateActionDto,
  CreateCauseDto,
  CreateLessonDto,
  CreatePostmortemDto,
  EligibleIncidentQueryDto,
  ImportTimelineDto,
  PostmortemQueryDto,
  PublishDto,
  RelatedIncidentDto,
  ReviewDecisionDto,
  ReviewerDto,
  TimelineEntryDto,
  UpdateActionDto,
  UpdateCauseDto,
  UpdateLessonDto,
  UpdatePostmortemDto,
} from "./dto/postmortems.dto";
import { PostmortemsService } from "./postmortems.service";

@Permissions(PERMISSIONS.postmortems.read)
@Controller("postmortems")
export class PostmortemsController {
  constructor(private readonly service: PostmortemsService) {}

  @Get("dashboard") async dashboard(@Req() request: AuthenticatedRequest) {
    await this.service.notifyOverdueActions(request.user.id);
    return this.service.dashboard();
  }

  @Get("insights") insights() {
    return this.service.insights();
  }

  @Get("references") references() {
    return this.service.references();
  }

  @Get("eligible-incidents") eligibleIncidents(
    @Query() query: EligibleIncidentQueryDto,
  ) {
    return this.service.eligibleIncidents(query.electionId);
  }

  @Get() list(@Query() query: PostmortemQueryDto) {
    return this.service.list(query);
  }

  @Get(":id") detail(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.findOne(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post() create(@Body() dto: CreatePostmortemDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdatePostmortemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/causes") addCause(
    @Param("id") id: string,
    @Body() dto: CreateCauseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addCause(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Patch(":id/causes/:causeId") updateCause(
    @Param("id") id: string,
    @Param("causeId") causeId: string,
    @Body() dto: UpdateCauseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateCause(
      id,
      causeId,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Delete(":id/causes/:causeId") removeCause(
    @Param("id") id: string,
    @Param("causeId") causeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeCause(id, causeId, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/lessons") addLesson(
    @Param("id") id: string,
    @Body() dto: CreateLessonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addLesson(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Patch(":id/lessons/:lessonId") updateLesson(
    @Param("id") id: string,
    @Param("lessonId") lessonId: string,
    @Body() dto: UpdateLessonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateLesson(
      id,
      lessonId,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Delete(":id/lessons/:lessonId") removeLesson(
    @Param("id") id: string,
    @Param("lessonId") lessonId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeLesson(
      id,
      lessonId,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/actions") addAction(
    @Param("id") id: string,
    @Body() dto: CreateActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addAction(id, dto, request.user.id, request.user.permissions);
  }

  @Patch(":id/actions/:actionId") updateAction(
    @Param("id") id: string,
    @Param("actionId") actionId: string,
    @Body() dto: UpdateActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateAction(
      id,
      actionId,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Delete(":id/actions/:actionId") removeAction(
    @Param("id") id: string,
    @Param("actionId") actionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeAction(
      id,
      actionId,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Put(":id/related-incidents") setRelatedIncidents(
    @Param("id") id: string,
    @Body() dto: RelatedIncidentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.setRelatedIncidents(
      id,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Put(":id/reviewers") setReviewers(
    @Param("id") id: string,
    @Body() dto: ReviewerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.setReviewers(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/timeline") addTimelineEntry(
    @Param("id") id: string,
    @Body() dto: TimelineEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addTimelineEntry(
      id,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/timeline/import") importTimeline(
    @Param("id") id: string,
    @Body() dto: ImportTimelineDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.importTimeline(
      id,
      dto,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Delete(":id/timeline/:entryId") removeTimelineEntry(
    @Param("id") id: string,
    @Param("entryId") entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeTimelineEntry(
      id,
      entryId,
      request.user.id,
      request.user.permissions,
    );
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/submit-for-review") submitForReview(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.submitForReview(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.review)
  @Post(":id/reviews") review(
    @Param("id") id: string,
    @Body() dto: ReviewDecisionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.review(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.publish)
  @Post(":id/publish") publish(
    @Param("id") id: string,
    @Body() dto: PublishDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.publish(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.postmortems.manage)
  @Post(":id/archive") archive(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.archive(id, request.user.id, request.user.permissions);
  }
}
