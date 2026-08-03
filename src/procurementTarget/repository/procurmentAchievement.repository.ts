import { Repository } from "typeorm";

import { ProcurementTarget } from "../entities/procurmentTarget.entity";
import { ProcurementAchievement } from "./entity/procurementAchievement.entity";

export class ProcurementTargetAchievementRepository extends Repository<ProcurementAchievement> {}
