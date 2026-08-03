import { Repository } from "typeorm";


import { SalesTarget } from "../entities/salesTarget.entity";
import { SalesTargetProduct } from "./entity/salesTargetProduct.entity";

export class SalesTargetProductRepository extends Repository<SalesTargetProduct> {}
