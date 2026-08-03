import { Repository } from "typeorm";

import { StockReportEod } from "../entities/eodReportforinvendtory.entity";

export class EodRepository extends Repository<StockReportEod> {}
