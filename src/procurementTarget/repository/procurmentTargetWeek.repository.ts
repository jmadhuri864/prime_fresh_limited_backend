import { Repository } from "typeorm";

import { ProcurementTarget } from "../entities/procurmentTarget.entity";
import { ProcurementTargetWeek } from "../entities/procurementTargetWeek.entity";

export class ProcurementTargetWeekRepository extends Repository<ProcurementTargetWeek> {}
