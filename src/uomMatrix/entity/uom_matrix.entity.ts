import { Entity, Column, ManyToOne } from "typeorm";
import Model from "../global/model.entity";
import { UOM } from "./uom.entity";

@Entity("UOM_conversion_matrix")
export class UOMConversionMatrix extends Model {
  @ManyToOne(() => UOM, { nullable: false,onDelete: "SET NULL" })
  fromUOM: UOM;

  @ManyToOne(() => UOM, { nullable: false,onDelete: "SET NULL" })
  toUOM: UOM;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  conversionFactor: number;
}
