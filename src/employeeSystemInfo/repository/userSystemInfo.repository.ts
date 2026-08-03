// UserRepository.ts
import { Repository } from "typeorm";
import { SystemLog } from "../entities/userSystemInfo.entity";



export class UserSystemInfoRepository extends Repository<SystemLog> {}
