import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { GrnProductRepository } from "../repositories/grnProduct.repository";

@injectable()
export class GrnProductService {

    constructor(@inject(TYPES.GrnProductRepository) private readonly grnProductRepository: GrnProductRepository) {
    }


}