import {  Repository } from "typeorm";
import { SecondSale } from "../entities/secondSale.entity";
import { SecondSaleProduct } from "./entity/secondSaleProduct.entity";


export class SecondSaleProductRepository extends Repository<SecondSaleProduct> {

}
