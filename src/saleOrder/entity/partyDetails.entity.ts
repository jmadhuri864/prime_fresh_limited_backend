import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "./model.entity";
import { Address } from "../address/address.entity";
import { Company } from "../../company/entity/company.entity";

@Entity({ name: "party_details" })
export class PartyDetails extends Model {
  @ManyToOne(() => Company, {cascade: true,nullable: true,onDelete: "SET NULL" })
   @JoinColumn({name: "company_id"})
    companyName: Company;

  @ManyToOne(() => Address, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "address_id" })
  address: Address;

  @Column({ nullable: true })
  gstn: string;

  @Column({ nullable: true })
  contactNo: string;
}
