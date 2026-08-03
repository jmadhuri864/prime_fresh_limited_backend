import { Repository } from "typeorm";
import { Farmer } from "../entities/farmer.entity";

export class FarmerRepository extends Repository<Farmer> {}
