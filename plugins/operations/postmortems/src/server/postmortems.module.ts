import { Module } from "@nestjs/common";
import { PostmortemsController } from "./postmortems.controller";
import { PostmortemsService } from "./postmortems.service";

@Module({
  controllers: [PostmortemsController],
  providers: [PostmortemsService],
})
export class PostmortemsModule {}
