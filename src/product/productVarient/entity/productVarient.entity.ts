import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeUpdate,
  BeforeInsert,
} from 'typeorm';
import Model from './model.entity';
import { Product } from './product.entity';

import { Exclude } from 'class-transformer';

@Entity('productVarient')
export class ProductVarient extends Model {
  @ManyToOne(() => Product, (product) => product.variant, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @Exclude()
  @Column({ type: 'varchar', length: 200, nullable: true })
  productName?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  variantName?: string;

  @Column({
    name: 'varient_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  variantCode: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  count: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  variety: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  origin: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'int', nullable: true })
  thresholdStock: number | null;

  
}
