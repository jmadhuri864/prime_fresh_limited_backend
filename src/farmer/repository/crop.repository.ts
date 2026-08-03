import { Repository } from "typeorm";
import { Crop } from "../farmer/crop.entity";

export class CropRepository extends Repository<Crop> {}