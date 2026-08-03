// UserRepository.ts
import { Repository } from "typeorm";
import { TPVoucher } from "./transportPaymentvoucher.entity";



export class TPVoucherRepository extends Repository<TPVoucher> {}
