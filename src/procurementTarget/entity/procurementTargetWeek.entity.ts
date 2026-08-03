import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import Model from './model.entity';
import { ProcurementTargetProduct } from './procurementTargetProduct.entity';


export enum WeekNo {
  WEEK_1 = 1,
  WEEK_2 = 2,
  WEEK_3 = 3,
  WEEK_4 = 4,
  WEEK_5 = 5,
}

@Entity('procurement_target_weeks')
export class ProcurementTargetWeek extends Model {

  @ManyToOne(
    () => ProcurementTargetProduct,
    product => product.weeklyProcurement,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'product_target_id' })
  productTarget: ProcurementTargetProduct;

  @Column({ type: 'enum', enum: WeekNo })
  weekNo: WeekNo;

  @Column('decimal', { precision: 10, scale: 2 })
  qty: number;

  @Column({type: 'date'})
  weekStartDate: Date;

  @Column({type: 'date'})
  weekEndDate: Date;
}
