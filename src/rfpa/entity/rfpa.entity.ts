import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import Model from '../global/model.entity';
import { Vendor } from '../vendor/vendor.entity';
import { Farmer } from './farmer.entity';
import { PaymentInfoForRFPA } from '../entities/rfpaPayementInfo.entity';
import { Department, Source } from '../utils/status.enum';
import { RFPAProduct } from './rfpaProduct.entity'; // Import the RFPAProduct entity

import { Branches } from '../entities/branches.entity';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('rfpa')
export class RFPA extends Model {
  @Column()
  rfpaId: string;

  @Column({
    type: 'enum',
    enum: Department,
    nullable: true,
  })
  requestingDepartment: Department;

  @ManyToOne(() => Company, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  companyName: Company;

  @ManyToOne(() => Branches, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'purchaselocation_id' })
  purchaseLocation: Branches;

  @ManyToOne(() => Branches, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'purchaseforwhich_id' })
  purchaseForSalesLocation: Branches;

  @Column({ nullable: true })
  otherPurchaseLoc: string;
  @Column({ nullable: true })
  otherPurchaseForSalesLoc: string;

  @Column('character varying', {
    name: 'delivery_receiving_person',
    nullable: true,
  })
  deliveryReceivingPerson: string;

  @Column('character varying', { name: 'packing_instruction', nullable: true })
  packingInstruction: string;

  @ManyToOne(() => Vendor, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'vendor_id' })
  selectedVendor: Vendor;

  @ManyToOne(() => Farmer, {
    onDelete: 'SET NULL',
    nullable: true,
    cascade: true,
  })
  @JoinColumn({ name: 'farmer_id' })
  selectedFarmer: Farmer;

  @Column('character varying', { name: 'special_request', nullable: true })
  specialReq: string;

  @Column({
    type: 'enum',
    enum: Source,
    nullable: true,
  })
  source: Source;

  @OneToOne(() => PaymentInfoForRFPA, { onDelete: 'SET NULL', cascade: true })
  @JoinColumn({ name: 'payment_info_id' })
  paymentInfo: PaymentInfoForRFPA;

  @OneToMany(() => RFPAProduct, (rfpaProduct) => rfpaProduct.rfpa, {
    onDelete: 'SET NULL',
    cascade: true,
  })
  rfpaProducts: RFPAProduct[];

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ default: false })
  isDealSlipCreated: boolean;

 

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}

