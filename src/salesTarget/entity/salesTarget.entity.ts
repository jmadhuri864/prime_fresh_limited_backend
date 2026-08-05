//sale target entity
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";

import { SalesTargetProduct } from "./salesTargetProduct.entity";
import { User } from "../../employee/entity/user.entity";
import Model from "../../global/model.entity";

export enum Status {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  REJECTED ="rejected",
  APPROVED = "approved"
}

@Entity("sales_targets")
export class SalesTarget extends Model {

  @ManyToOne(() => User)
  @JoinColumn({ name: "employee_id" })
  employee: User;

  @Column({ nullable: true })
  month: number;

  @Column({ nullable: true })
  year: number;

  @Column({ type: "decimal", default: 0 })
  totalMonthlySale: number; // auto-calculated

  @Column({ default: "DRAFT" })
  status: Status; // DRAFT, SUBMITTED, APPROVED


}