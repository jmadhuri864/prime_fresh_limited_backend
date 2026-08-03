import {
    Entity,
    Column,
   
    ManyToOne,
    JoinColumn,
  } from "typeorm";
import Model from "../global/model.entity";
import { VehicleDispatch } from "./vehicleDispatch.entity";

  
  @Entity({ name: "sku" })
  export class SKU extends Model {
   
  
    @Column()
    skuName: string;
  
    @Column({ type: "float" })
    dispatchQuantity: number;
  
    
  
    @ManyToOne(() => VehicleDispatch , { onDelete: "SET NULL" })
    @JoinColumn({ name: "dispatchId" })
    dispatch: VehicleDispatch ;
  }
  