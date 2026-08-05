import { inject, injectable } from "inversify";
import { TYPES } from "../../types";
import { ProductVarientRepository } from "../../product/productVarient/repository/varients.repository";
import { DataSource, In } from "typeorm";
import logger, { UserLogger } from "../../utils/logger";
import { ReturnToVendorRepository } from "../repository/returnToVendor.repository";
import { InventoryStockRepository } from "../../inventoryStock/repository/inventoryStock.repository";
import { DocumentStatus, DocumentTypeEnum } from "../../approvalFlow/entity/docuemnt.entity";
import { DocumentTypeEnum as DocDefEnum } from "../../documentDef/entity/documentdef.entity";
import { PaginationOptions } from "../../utils/pagination";
import { formatDateTime } from "../../utils/dateUtils";
import { CacheService } from "../../global/cache.service";
import { createHash } from "crypto";
import {
  CreateRTVDto,
  UpdateRTVDto,
  RTVListResponseDto,
  RTVViewDto,
  RTVUpdateFormDto,
  SoftDeleteRTVResultDto,
  BulkDeleteRTVResultDto,
} from "../dto/returnToVendor.dto";
import { BulkDeleteResultDto } from "../../global/general.dto";
import { GrnRepository } from "../../grn/repository/grn.repository";
import { DocumentbService, DocumentWithRelatedData } from "../../approvalFlow/service/documentb.service";
import { DocDoubleApproverService } from "../../approvalFlow/service/docDoubleApprover.service";
import { ReturnToVendor } from "../entity/returnToVendor.entity";

@injectable()
export class ReturnToVendorService {

    constructor(@inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
               @inject(TYPES.ProductVarientRepository)
                       private productVarientsRepository: ProductVarientRepository,
                    @inject(TYPES.ReturnToVendorRepository) private postReturnToVendorRepository: ReturnToVendorRepository,
                    @inject(TYPES.InventoryStockRepository) private inventoryStockRepository: InventoryStockRepository,
                    @inject(TYPES.DocumentbService) private documentbService: DocumentbService,
                    @inject(TYPES.DataSource) private dataSource: DataSource,
                    @inject(TYPES.DocDoubleApproverService)
    private readonly docDoubleApproverService: DocDoubleApproverService,
                    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
        ) {}

    private readonly CACHE_PREFIX = 'returnToVendor';
    private readonly CACHE_TTL = 180;

    /**
     * Invalidate RTV caches.
     * @param rtvId   - The ReturnToVendor entity id (used by getById / getByIdForUpdate)
     * @param docId   - The Documentb id (used by getByIdForView whose key is returnToVendor:view:{docId})
     */
    private async invalidateCache(rtvId?: string, docId?: string): Promise<void> {
        const tasks: Promise<any>[] = [
            this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
            this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:all:*`),
        ];
        if (rtvId) {
            tasks.push(
                this.cacheService.del(`${this.CACHE_PREFIX}:id:${rtvId}`),
                this.cacheService.del(`${this.CACHE_PREFIX}:update:${rtvId}`),
                // view key when called with the RTV entity id directly
                this.cacheService.del(`${this.CACHE_PREFIX}:view:${rtvId}`),
            );
        }
        if (docId) {
            // view key when called with the Documentb id (used by getByIdForView)
            tasks.push(this.cacheService.del(`${this.CACHE_PREFIX}:view:${docId}`));
        }
        await Promise.all(tasks);
    }

    private async generateSerialNo(): Promise<string> {
      const now = new Date();
      const yyyy = now.getFullYear().toString();
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const datePrefix = `RTV${yyyy}${mm}${dd}`;

      const result = await this.postReturnToVendorRepository
        .createQueryBuilder('rtv')
        .select('MAX(rtv.rtvNo)', 'maxNo')
        .where('rtv.rtvNo LIKE :prefix', { prefix: `${datePrefix}%` })
        .getRawOne();

      let nextSeq = 1;
      if (result?.maxNo) {
        const parsed = parseInt(result.maxNo.replace(datePrefix, ''), 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }
      return `${datePrefix}${nextSeq.toString().padStart(5, '0')}`;
    }

    public async createReturn(returnData: CreateRTVDto & Record<string, any>, requestedBy: string, clientIp?: string): Promise<ReturnToVendor> {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
          if (!returnData.grnNo) {
            throw new Error('GRN number is required');
          }
          returnData.isChanged = true;

          const grn = await queryRunner.manager.findOne(this.grnRepository.target, {
            where: { id: returnData.grnNo },
            relations: ['selectedVendor', 'grnProducts', 'grnProducts.productName', 'grnProducts.variant'],
          });

          if (!grn) {
            throw new Error('GRN not found');
          }

          let variantIds: string[] = [];
          if (Array.isArray(returnData.variants)) {
            variantIds = returnData.variants;
          } else if (returnData.variants) {
            variantIds = [returnData.variants];
          }

          const variants = await this.productVarientsRepository.find({
            where: { id: In(variantIds) },
            relations: ['product'],
          });

          const productIds = variants.map((v: any) => v.product?.id).filter(Boolean);

          const rtvNo = await this.generateSerialNo();
          const newReturn = queryRunner.manager.create(this.postReturnToVendorRepository.target, {
            ...returnData,
            rtvNo,
            createdBy: requestedBy,
            variants: variants.map((v: any) => ({ id: v.id })),
            products: productIds.map((id: any) => ({ id })),
          } as any) as unknown as ReturnToVendor;

          const savedNewReturn = await queryRunner.manager.save(newReturn);
          const savedreturn = Array.isArray(savedNewReturn) ? savedNewReturn[0] : savedNewReturn;

          await queryRunner.commitTransaction();

          const document = await this.documentbService.createDocument({
            type: DocumentTypeEnum.RETURN_TO_VENDOR,
            docDef: DocDefEnum.OPERATION,
            status: DocumentStatus.HOLD,
            remarks: 'Document auto-created with Return To Vendor',
            lastActionBy: { id: requestedBy },
            document_type_id: savedreturn.id,
          });

          try {
            await this.documentbService.startApprovalFlow(document.id);
          } catch (approvalError: any) {
            logger.warn('Approval flow not started (no flow configured):', approvalError?.message);
          }

          if (Array.isArray(savedreturn.rtvProducts)) {
            await this.processInventoryForReturn(savedreturn);
          }

          UserLogger.logRfpaCreated(savedreturn.id, requestedBy, clientIp);
          await this.invalidateCache();
          return savedreturn;

      } catch (error: any) {
          try {
            await queryRunner.rollbackTransaction();
          } catch {
          }
          throw error;
      } finally {
          await queryRunner.release();
      }
    }

    private async processInventoryForReturn(returnRecord: any): Promise<void> {
        try {
            const companyId = returnRecord?.companyName?.id ?? returnRecord?.companyName;
            const locationId = returnRecord?.location?.id ?? returnRecord?.location;

            if (!Array.isArray(returnRecord.rtvProducts) || returnRecord.rtvProducts.length === 0) {
                return;
            }

            const productGroups = new Map<string, any[]>();
            for (const item of returnRecord.rtvProducts) {
                const productId = item?.productName?.id ?? item?.productName;
                if (productId) {
                    if (!productGroups.has(productId)) {
                        productGroups.set(productId, []);
                    }
                    productGroups.get(productId)?.push(item);
                }
            }

            for (const item of returnRecord.rtvProducts) {
                const itemVariantId = item?.variant?.id ?? item?.variant;
                const itemProductId = item?.productName?.id ?? item?.productName;
                
                const variantCount = productGroups.get(itemProductId)?.length || 1;
                const isMultiVariant = variantCount > 1;

                if (!itemProductId || !itemVariantId || !companyId || !locationId) {
                    logger.warn(`❌ Skipping item due to missing relation ids:`, {
                        product: itemProductId,
                        variant: itemVariantId,
                        company: companyId,
                        location: locationId,
                    });
                    continue;
                }

                const itemNetWeight = Number(item.netWeight) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemUnitPrice = Number(item.unitPrice) || 0;
                const amount = +(itemUnitPrice * itemQuantity).toFixed(2);

                const variantLabel = isMultiVariant ? `[Variant ${variantCount}/${productGroups.get(itemProductId)?.length}]` : '';

                const existingStock = await this.inventoryStockRepository.findOne({
                    where: {
                        company: { id: companyId },
                        product: { id: itemProductId },
                        variant: { id: itemVariantId },
                        location: { id: locationId },
                    },
                });

                if (existingStock) {
                    const currentInwardQty = Number(existingStock.inwardQty) || 0;
                    const currentInwardAmt = Number(existingStock.inwardAmt) || 0;

                    existingStock.inwardQty = +(currentInwardQty - itemNetWeight).toFixed(2);
                    existingStock.inwardAmt = +(currentInwardAmt - amount).toFixed(2);

                    await this.inventoryStockRepository.save(existingStock);
                } else {
                    const newStock = this.inventoryStockRepository.create({
                        company: { id: companyId },
                        location: { id: locationId },
                        product: { id: itemProductId },
                        variant: { id: itemVariantId },
                        inwardQty: +(0 - itemNetWeight).toFixed(2),
                        inwardAmt: +(0 - amount).toFixed(2),
                        dumpQty: 0,
                        dumpAmt: 0,
                    });

                    await this.inventoryStockRepository.save(newStock);
                }
            }

        } catch (error) {
            logger.error('❌ Error processing inventory for return:', error);
            throw error;
        }
    }

    public async getAll(queryOptions: PaginationOptions, userId: string): Promise<RTVListResponseDto> {
        const hash = createHash('md5').update(`${userId}:${JSON.stringify(queryOptions)}`).digest('hex');
        const cacheKey = `${this.CACHE_PREFIX}:list:${hash}`;
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
            userId,
            DocumentTypeEnum.RETURN_TO_VENDOR,
            queryOptions,
        );

        const { search } = queryOptions;
        const typedDocuments = data as DocumentWithRelatedData[];
        const activeDocuments = typedDocuments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const rtvIds = activeDocuments
            .map(doc => doc.document_type_id)
            .filter(Boolean) as string[];

        const records = rtvIds.length
            ? await this.postReturnToVendorRepository
                .createQueryBuilder('rtv')
                .leftJoinAndSelect('rtv.grnNo', 'grnNo')
                .leftJoinAndSelect('rtv.companyName', 'companyName')
                .leftJoinAndSelect('rtv.location', 'location')
                .leftJoinAndSelect('rtv.selectedVendor', 'selectedVendor')
                .where('rtv.id IN (:...ids)', { ids: rtvIds })
                .andWhere('rtv.isDeleted = false')
                .andWhere('rtv.deletedAt IS NULL')
                .getMany()
            : [];

        const recordMap = new Map(records.map(r => [r.id, r]));
        const docCreatedAtMap = new Map(activeDocuments.map(d => [d.id, d.createdAt]));

        let relatedDataOnly = activeDocuments
            .filter(doc => doc.document_type_id && recordMap.has(doc.document_type_id))
            .map((doc) => {
                const rd: any = recordMap.get(doc.document_type_id!)!;
                const { createdDate, createdTime } = formatDateTime(doc.createdAt);
                return {
                    id: rd.id,
                    documentId: doc.id,
                    overAllStatus: doc.status,
                    createdBy: doc.lastActionBy ? `${doc.lastActionBy.firstName} ${doc.lastActionBy.lastName}` : null,
                    createdDate,
                    createdTime,
                    grnNo: rd.grnNo?.grnNo ?? null,
                    rtvNo: rd.rtvNo ?? null,
                    companyName: rd.companyName?.name ?? null,
                    location: rd.location?.name ?? null,
                    selectedVendor: rd.selectedVendor?.companyName ?? null,
                    returnedGrossWeight: rd.returnedGrossWeight,
                    returnedNetWeight: rd.returnedNetWeight,
                    totalAmt: rd.totalAmt,
                    returnDate: rd.returnDate ?? null,
                    amtWords: rd.amtWords ?? null,
                    remark: rd.remark ?? null,
                };
            });

        const objectToString = (obj: any): string => {
            if (obj == null) return '';
            if (typeof obj === 'object') return Object.values(obj).map((v) => objectToString(v)).join(' ');
            return String(obj);
        };

        if (search && search.trim()) {
            const term = search.toLowerCase();
            relatedDataOnly = relatedDataOnly.filter((item) =>
                objectToString(item).toLowerCase().includes(term)
            );
        }

        if (queryOptions.sort) {
            const [field, direction] = queryOptions.sort.split(':');
            const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;
            const getNestedValue = (obj: any, path: string) =>
                path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
            relatedDataOnly.sort((a, b) => {
                const valA = getNestedValue(a, field);
                const valB = getNestedValue(b, field);
                if (valA == null && valB == null) return 0;
                if (valA == null) return -1 * sortOrder;
                if (valB == null) return 1 * sortOrder;
                if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
                return String(valA).localeCompare(String(valB)) * sortOrder;
            });
        } else {
            relatedDataOnly.sort((a, b) => {
                const tA = new Date(docCreatedAtMap.get(a.documentId) ?? 0).getTime();
                const tB = new Date(docCreatedAtMap.get(b.documentId) ?? 0).getTime();
                return tB - tA;
            });
        }

        const result = {
            data: relatedDataOnly,
            meta: { total: meta.total, page: meta.page, pages: meta.pages },
        };
        await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    public async getById(id: string): Promise<ReturnToVendor | null> {
        const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) return cached;

        try {
            if (!id) throw new Error('Return to vendor ID is required');

            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
                select: { 'companyName': { id: true, name: true }, 'location': { id: true, name: true }, 'selectedVendor': { id: true, companyName: true }, 'createdBy': { id: true, firstName: true, lastName: true }, 'rtvProducts': { id: true, quantity: true, unitPrice: true, netWeight: true, grossWeight: true, productName: { id: true, name: true }, variant: { id: true, variantName: true, variantCode: true }, uom: { id: true, unit: true } } },
            });

            if (!returnRecord) throw new Error(`Return to vendor record with ID ${id} not found`);

            await this.cacheService.set(cacheKey, returnRecord, this.CACHE_TTL);
            return returnRecord;
        } catch (error) {
            logger.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }

     public async getByIdForUpdate(id: string): Promise<RTVUpdateFormDto | null> {
        const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) return cached;

        try {
            if (!id) throw new Error('Return to vendor ID is required');

            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['grnNo', 'companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
            });

            if (!returnRecord) throw new Error(`Return to vendor record with ID ${id} not found`);

            const result = {
                id: returnRecord.id,
                grnNo: returnRecord.grnNo?.id || null,
                companyName: returnRecord.companyName.id || null,
                location: returnRecord.location.id || null,
                selectedVendor: returnRecord.selectedVendor.id || null,
                createdBy: returnRecord.createdBy?.id || null,
                returnedGrossWeight: returnRecord.returnedGrossWeight,
                totalAmt: returnRecord.totalAmt,
                returnedNetWeight: returnRecord.returnedNetWeight,
                returnDate: returnRecord.returnDate || null,
                amtWords: returnRecord.amtWords || null,
                remark: returnRecord.remark || null,
                rtvProducts: returnRecord.rtvProducts?.map(product => ({
                    id: product.id,
                    quantity: product.quantity,
                    amount: product.amount,
                    packingMaterialWeight: product.packingMaterialWeight,
                    reason: product.reason,
                    unitPrice: product.unitPrice,
                    netWeight: product.netWeight,
                    grossWeight: product.grossWeight,
                    productName: product.productName.id || null,
                    variant: product.variant.id || null,
                    uom: product.uom.id || null,
                })) || [],
            };
            await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
            return result;
        } catch (error) {
            logger.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }

     public async getByIdForView(docid: string): Promise<RTVViewDto | null> {
        const cacheKey = `${this.CACHE_PREFIX}:view:${docid}`;
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) return cached;

        try {
            const document1 = await this.docDoubleApproverService.getDocumentById(docid);
            if (!document1) throw new Error(`Document with ID ${docid} not found`);

            const id = document1.documentTypeId;
            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom', 'grnNo'],
            });

            if (!returnRecord) throw new Error(`Return to vendor record with ID ${id} not found`);

            const { createdDate, createdTime } = formatDateTime(document1.createdAt);

            const result = {
                id: returnRecord.id,
                documentId: document1.id,
                overAllStatus: document1.status,
                createdBy: document1.lastActionBy ? `${document1.lastActionBy.firstName} ${document1.lastActionBy.lastName}` : null,
                createdDate,
                createdTime,
                approvalSummary: document1.approvalSummary ?? null,
                grnNo: returnRecord.grnNo?.grnNo ?? null,
                rtvNo: returnRecord.rtvNo ?? null,
                companyName: returnRecord.companyName?.name ?? null,
                location: returnRecord.location?.name ?? null,
                selectedVendor: returnRecord.selectedVendor?.companyName ?? null,
                returnedGrossWeight: returnRecord.returnedGrossWeight,
                returnedNetWeight: returnRecord.returnedNetWeight,
                totalAmt: returnRecord.totalAmt,
                returnDate: returnRecord.returnDate ?? null,
                amtWords: returnRecord.amtWords ?? null,
                remark: returnRecord.remark ?? null,
                rtvProducts: returnRecord.rtvProducts?.map(product => ({
                    id: product.id,
                    productName: product.productName?.name ?? null,
                    variant: product.variant?.variantName ?? null,
                    uom: product.uom?.unit ?? null,
                    quantity: product.quantity,
                    unitPrice: product.unitPrice,
                    netWeight: product.netWeight,
                    grossWeight: product.grossWeight,
                    amount: product.amount,
                    packingMaterialWeight: product.packingMaterialWeight,
                    reason: product.reason,
                })) ?? [],
            };
            await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
            return result;
        } catch (error) {
            logger.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }

    public async updateReturn(id: string, updateData: UpdateRTVDto & Record<string, any>): Promise<ReturnToVendor> {
        try {
            if (!id) {
                throw new Error('Return to vendor ID is required');
            }

            const existingRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'companyName', 'location'],
            });

            if (!existingRecord) {
                throw new Error(`Return to vendor record with ID ${id} not found`);
            }

            const original = { ...existingRecord };

            const oldRtvProducts = existingRecord.rtvProducts.map(p => ({
    productName: p.productName?.id ?? p.productName,
    variant: p.variant?.id ?? p.variant,
    netWeight: Number(p.netWeight),
    quantity: Number(p.quantity),
    unitPrice: Number(p.unitPrice)
}));

            if(updateData.id) delete updateData.id;

            if (updateData.rtvProducts && Array.isArray(updateData.rtvProducts)) {
                await this.reprocessInventoryForUpdate(existingRecord, oldRtvProducts, updateData.rtvProducts);
            }

            Object.assign(existingRecord, updateData);

            const updatedRecord = await this.postReturnToVendorRepository.save(existingRecord);
            // Also bust the view cache keyed by documentId
            const rtvWithDoc = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['document'],
            });
            await this.invalidateCache(id, rtvWithDoc?.document?.id);
            return updatedRecord;
        } catch (error) {
            logger.error('Error updating return to vendor:', error);
            throw error;
        }
    }

    private async reprocessInventoryForUpdate(existingRecord: any, oldProducts: any[], newProducts: any[]): Promise<void> {
        try {
            const companyId = existingRecord?.companyName?.id ?? existingRecord?.companyName;
            const locationId = existingRecord?.location?.id ?? existingRecord?.location;

            if (!companyId || !locationId) {
                logger.warn('Cannot re-process inventory: missing company or location');
                return;
            }

            const makeKey = (p: any, v: any) => `${p}::${v}`;

            const oldMap = new Map<string, { productId: string, variantId: string, weight: number, amount: number, count: number }>();
            const newMap = new Map<string, { productId: string, variantId: string, weight: number, amount: number, count: number }>();

            const accumulate = (map: Map<string, any>, item: any) => {

                    const productId =
                    item?.productName?.id ??
                    item?.productName ??
                    item?.productId;

                    const variantId =
                    item?.variant?.id ??
                    item?.variant ??
                    item?.variantId;
                if (!productId || !variantId) return;
                const key = makeKey(productId, variantId);
                const netWeight = Number(item.netWeight) || 0;
                const quantity = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                const amt = +(unitPrice * quantity).toFixed(2);
                if (!map.has(key)) {
                    map.set(key, { productId, variantId, weight: 0, amount: 0, count: 0 });
                }
                const entry = map.get(key)!;
                entry.weight = +(entry.weight + netWeight).toFixed(2);
                entry.amount = +(entry.amount + amt).toFixed(2);
                entry.count = entry.count + 1;
            };

            for (const it of oldProducts) accumulate(oldMap, it);
            for (const it of newProducts) accumulate(newMap, it);

            const allKeys = new Set<string>([...oldMap.keys(), ...newMap.keys()]);
            for (const key of allKeys) {
                const oldEntry = oldMap.get(key) || { productId: null, variantId: null, weight: 0, amount: 0, count: 0 };
                const newEntry = newMap.get(key) || { productId: null, variantId: null, weight: 0, amount: 0, count: 0 };

                const productId = newEntry.productId ?? oldEntry.productId;
                const variantId = newEntry.variantId ?? oldEntry.variantId;

                if (!productId || !variantId) {
                    logger.warn('Skipping key with missing ids', { key, oldEntry, newEntry });
                    continue;
                }

                const deltaWeight = +(newEntry.weight - oldEntry.weight).toFixed(2); // positive => more returned now
                const deltaAmount = +(newEntry.amount - oldEntry.amount).toFixed(2);

                const variantLabel = (oldEntry.count + newEntry.count) > 1 ? `[Aggregated ${oldEntry.count + newEntry.count}]` : '';

                const stock = await this.inventoryStockRepository.findOne({
                    where: {
                        company: { id: companyId },
                        product: { id: productId },
                        variant: { id: variantId },
                        location: { id: locationId },
                    },
                });

                if (stock) {
                    const currentInwardQty = Number(stock.inwardQty) || 0;
                    const currentInwardAmt = Number(stock.inwardAmt) || 0;

                    stock.inwardQty = +(currentInwardQty - deltaWeight).toFixed(2);
                    stock.inwardAmt = +(currentInwardAmt - deltaAmount).toFixed(2);

                    await this.inventoryStockRepository.save(stock);
                } else {
                    if (deltaWeight === 0 && deltaAmount === 0) {
                        continue;
                    }

                    const createQty = +(0 - deltaWeight).toFixed(2);
                    const createAmt = +(0 - deltaAmount).toFixed(2);

                    const newStock = this.inventoryStockRepository.create({
                        company: { id: companyId },
                        location: { id: locationId },
                        product: { id: productId },
                        variant: { id: variantId },
                        inwardQty: createQty,
                        inwardAmt: createAmt,
                        dumpQty: 0,
                        dumpAmt: 0,
                    });

                    await this.inventoryStockRepository.save(newStock);
                }
            }

        } catch (error) {
        logger.error('❌ Error re-processing inventory:', error);
            throw error;
        }
    }

    public async softDeleteReturn(id: string): Promise<SoftDeleteRTVResultDto> {
    try {
        if (!id) {
            throw new Error("Return to vendor ID is required");
        }

        const record = await this.postReturnToVendorRepository.findOne({
            where: { id },
            relations: ["rtvProducts"],
            withDeleted: true, // important
        });

        if (!record) {
            throw new Error("RTV record not found");
        }

        if (record.isDeleted) {
            throw new Error("RTV already deleted");
        }

        await this.postReturnToVendorRepository.softDelete(id);
        record.isDeleted = true;
        record.deletedAtNew = new Date();
        await this.postReturnToVendorRepository.save(record);
        // Also bust the view cache keyed by documentId
        const rtvWithDoc = await this.postReturnToVendorRepository.findOne({
            where: { id },
            relations: ['document'],
            withDeleted: true,
        });
        await this.invalidateCache(id, rtvWithDoc?.document?.id);

        return { message: "Return to vendor soft deleted successfully", id };
    } catch (error) {
        console.error("Error soft deleting RTV:", error);
        throw error;
    }
}

    public async deleteMultipleReturnToVendor(ids: string[]): Promise<BulkDeleteResultDto> {
       // if (!ids.length) return { message: 'No IDs provided' };
    const success: { id: string; No: string }[] = [];
    const failed: { id: string; reason: string }[] = [];
        const records = await this.postReturnToVendorRepository.find({
            where: { id: In(ids) },
            withDeleted: true,
        });

        const foundIds = new Set(records.map(r => r.id));
        const missingId = ids.find(id => !foundIds.has(id));
        if (missingId) throw new Error(`Return to vendor record with ID ${missingId} not found`);

        const alreadyDeleted = records.find(r => r.isDeleted);
        if (alreadyDeleted) throw new Error(`Record with ID ${alreadyDeleted.id} is already deleted`);

        const now = new Date();
        await this.postReturnToVendorRepository.softDelete(ids);
        await this.postReturnToVendorRepository
            .createQueryBuilder()
            .update()
            .set({ isDeleted: true, deletedAtNew: now } as any)
            .whereInIds(ids)
            .execute();

        await Promise.all([
            ...ids.flatMap(id => [
                this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
                this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
                this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
            ]),
            this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
        ]);

        for(let record of records)
        {
            if(record.rtvNo)
            {
                 success.push({id:record.id,No:record.rtvNo})
            } 
        }
        
        return { success,failed,message: 'Return to vendor records deleted successfully' };
    }
}