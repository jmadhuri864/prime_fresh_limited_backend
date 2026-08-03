import { Repository } from "typeorm";

import { Invoice } from "../entities/invoice.entity";



export class InvoiceRepository extends Repository<Invoice> {}
