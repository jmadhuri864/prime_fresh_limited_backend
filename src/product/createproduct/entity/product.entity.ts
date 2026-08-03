import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import Model from './model.entity';
import { ProductCategory } from './product_category.entity';
import { ProductSubcategory } from './product_subcategory.entity';
import { UOM } from './uom.entity';
import { ProductClassification } from './product_classification.entity';
import { QualityParameter } from './quantityParameter.entity';

import { ProductVarient } from './productVarient.entity';



@Entity('product')
export class Product extends Model {
  @Index()
  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ name: 'product_image', type: 'text', nullable: true })
  image: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @ManyToOne(
    () => ProductClassification,
    (classification) => classification.categories,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'classification_id' })
  classification: ProductClassification | null;

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory | null;

  @ManyToOne(() => ProductSubcategory, (subcategory) => subcategory.products, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: ProductSubcategory | null;

  @ManyToOne(() => UOM, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uom_id' })
  uom: UOM | null;

  @OneToMany(() => ProductVarient, (variant) => variant.product, {
    cascade: true,
    onDelete: 'CASCADE',
    nullable  :true,
  })
  variant:ProductVarient[];

  // @Index({ unique: true })
  @Column({ name: 'product_code', type: 'varchar', length: 100, nullable:true })
  productCode: string;

  
  @Column({ name: 'packing_type', type: 'varchar', length: 150, nullable: true })
  packingType: string;

  @Column({ name: 'prefix', type: 'varchar', length: 20, nullable: true })
  prefix: string;

  @Column({ name: 'shelf_life', type: 'int', nullable: true })
  shelfLife: number| null;

  @Column({ name: 'storage_temp', type: 'int', nullable: true })
  storageTemp: number | null;

  // @OneToMany(() =>  ProductVarients, (variant) => variant.productTemplate, {
  //   cascade: true,
  //   onDelete: 'CASCADE',
  // })
  // variants:ProductVarients[];

  @OneToMany(
    () => QualityParameter,
    (qualityParameter) => qualityParameter.product,
    {
      nullable:true,
      cascade: true,
      onDelete: 'CASCADE',
    },
  )
  qualityParameters: QualityParameter[];
}
