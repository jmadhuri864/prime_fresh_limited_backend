import {  Repository } from "typeorm";

import { RFPA } from "./rfpa.entity";
import { PaymentInfoForRFPA } from "../entities/rfpaPayementInfo.entity";

export class RfpaPaymentInfoRepository extends Repository<PaymentInfoForRFPA> {

}
