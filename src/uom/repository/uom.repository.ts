// UserRepository.ts
import { Repository } from "typeorm";

import { UOM } from "../entities/uom.entity";

export class UOMRepository extends Repository<UOM> {}
