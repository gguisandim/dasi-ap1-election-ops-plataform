import { Module } from "@nestjs/common";
import { TransmissionController } from "./transmission.controller";
import { TransmissionService } from "./transmission.service";

@Module({ controllers: [TransmissionController], providers: [TransmissionService], exports: [TransmissionService] })
export class TransmissionModule {}
