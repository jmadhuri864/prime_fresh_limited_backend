import { Repository } from "typeorm";

import { ProcurementTarget } from "../entities/procurmentTarget.entity";
import { ProcurementTargetProduct } from "./procurementTargetProduct.entity";

export class ProcurementTargetProductRepository extends Repository<ProcurementTargetProduct> {}
