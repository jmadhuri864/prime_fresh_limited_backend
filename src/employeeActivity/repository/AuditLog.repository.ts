import { Repository } from "typeorm";
import { AuditLog } from "../entities/auditLog.entity";

export class AuditLogRepository extends Repository<AuditLog> {}
