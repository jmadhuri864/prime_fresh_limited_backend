import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as XLSX from "xlsx";
import { TYPES } from '../../../types';
import { DataSource, In, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';

import { AuditLogService } from '../services/auditLog.service';
import { QualityParameterRepository } from '../repositories/qualityParameter.repository';

import { ProductCategory } from '../../product/productCategory/product_category.entity';
import { ProductSubcategory } from '../../productSubcategory/entity/product_subcategory.entity';
import { ProductClassification } from '../../productClassification/entity/product_classification.entity';
import { UOM } from '../entities/uom.entity';
import csvParser from 'csv-parser';
import { buildQuery, PaginationOptions } from '../../../utils/pagination';
import { ProductVarientsRepository } from '../../productVarient/repository/productVarients.repository';
import { ProductVarientRepository } from '../../productVarient/repository/varients.repository';
import { createHash } from 'crypto';
import {
  generateVariantCode,
  getVariantIdentifier,
  ProductVarientsService,
} from './varients.service';
import { AppDataSource } from '../../../utils/data-source';
import { ProductVarient } from '../entities/productVarient.entity';
import { QualityParameter } from '../entity/quantityParameter.entity';
import { CacheService } from '../../../global/cache.service';
import { CreateProductDto, ProductDetailResponseDto, ProductListResponseDto } from './product.dto';
import { PaginatedResponse } from '../dtos/createCustomer.dto';

const CACHE_PREFIX = 'product';
const CACHE_TTL = 180;
const CACHE_TTL_DETAIL = 300;

@injectable()
export class ProductService {
  private productRepository = this.dataSource.getRepository(Product);

  private categoryRepository: Repository<ProductCategory>;
  private subcategoryRepository: Repository<ProductSubcategory>;
  private classificationRepository: Repository<ProductClassification>;
  private uomRepository: Repository<UOM>;

  constructor(
    @inject(TYPES.DataSource)
    private dataSource: DataSource,
    @inject(TYPES.AuditLogService)
    private auditLogService: AuditLogService,
    @inject(TYPES.ProductVarientsService)
    private productVarientService: ProductVarientsService,
    @inject(TYPES.QualityParameterRepository)
    private qualityParameterRepository: QualityParameterRepository,
    // @inject(TYPES.ProductVarientsRepository)
    // private productVarientsRepository: ProductVarientsRepository,

    @inject(TYPES.ProductVarientRepository)
    private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {
    this.categoryRepository = this.dataSource.getRepository(ProductCategory);
    this.subcategoryRepository =
      this.dataSource.getRepository(ProductSubcategory);
    this.classificationRepository = this.dataSource.getRepository(
      ProductClassification,
    );
    this.uomRepository = this.dataSource.getRepository(UOM);
  }

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateProductCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:search:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:filter:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:ref:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:variants:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:partial:${id}`),
      );
    }
    await Promise.all(tasks);
  }

  public generateCombinations(counts: string[] = [],
    sizes: string[] = [],
    varieties: string[] = [],
    origins: string[] = [],
  ) {
    const c = Array.isArray(counts) && counts.length ? counts : [null];
    const s = Array.isArray(sizes) && sizes.length ? sizes : [null];
    const v = Array.isArray(varieties) && varieties.length ? varieties : [null];
    const o = Array.isArray(origins) && origins.length ? origins : [null];

    const combinations = [];

    for (const count of c) {
      for (const size of s) {
        for (const variety of v) {
          for (const productOrigin of o) {
            combinations.push({ count, size, variety, productOrigin });
          }
        }
      }
    }

    return combinations;
  }

  private async generateProductCode(prefix: string): Promise<string> {
    const existing = await this.productRepository
      .createQueryBuilder('product')
      .where(
        'product.prefix = :prefix AND product.productCode LIKE :likePattern',
        {
          prefix,
          likePattern: `${prefix}%`,
        },
      )
      .orderBy('product.productCode', 'DESC')
      .getOne();

    let nextNumber = 1;

    if (existing?.productCode) {
      const numberPart = existing.productCode.replace(prefix, '');
      const parsed = parseInt(numberPart, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const padded = nextNumber.toString().padStart(4, '0');
    return `${prefix}${padded}`;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const prefix = dto.prefix?.toUpperCase();
    if (!prefix) {
      throw new Error('Prefix is required for generating product code');
    }

    const productCode = await this.generateProductCode(prefix);
    dto.productCode = productCode;

    const varientData = dto.variant ?? dto.variant;
    const { variant, ...productDto } = dto;

    const product = this.productRepository.create(productDto);
    const savedProduct = await this.productRepository.save(product);

    const savedProduct1 = Array.isArray(savedProduct)
      ? savedProduct[0]
      : savedProduct;

    if (varientData) {
      // handle both array and single object payloads
      const variants = Array.isArray(varientData) ? varientData : [varientData];

      for (const item of variants) {
        const variantName = await getVariantIdentifier(
          savedProduct1.name,
          item.count ?? '',
          item.size ?? '',
          item.variety ?? '',
          item.origin ?? '',
          item.brand ?? '',
        );

        console.log("Variant name ", variantName)

        const variantCode = await generateVariantCode(
          savedProduct1.id,
          savedProduct1.prefix,
          item.count ?? '',
          item.size ?? '',
          item.variety ?? '',
          item.origin ?? '',
          item.brand ?? '',
        );

        console.log("Variant code ", variantCode);


        const variantEntity = this.productVarientsRepository.create({
          ...item,
          product: savedProduct,
          productName: savedProduct1.name,
          variantName: variantName,
          variantCode: variantCode,
        });

        await this.productVarientsRepository.save(variantEntity);
      }
    }
    await this.invalidateProductCache();
    return savedProduct1;
  }

  async getAll(options: PaginationOptions): Promise<PaginatedResponse<ProductListResponseDto>> {
    const key = `${CACHE_PREFIX}:list:${JSON.stringify(options)}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.classification', 'classification')
      .leftJoin('product.category', 'category')
      .leftJoin('product.subcategory', 'subcategory')
      .leftJoin('product.uom', 'uom')
      .select([
        'product.id', 'product.name', 'product.packingType', 'product.productCode',
        'product.shelfLife', 'product.storageTemp',
        'category.id', 'category.name',
        'classification.id', 'classification.name',
        'uom.id', 'uom.unit',
        'subcategory.id', 'subcategory.name',
      ])
      .orderBy('product.createdAt', 'DESC');

    const data1 = await buildQuery(queryBuilder, options, 'product');
    const result:PaginatedResponse<ProductListResponseDto> = {
      data: data1.data.map((pro: any) => ({
        id: pro.id,
        name: pro.name,
        packingType: pro.packingType,
        productCode: pro.productCode,
        shelfLife: pro.shelfLife || '',
        storageTemp: pro.storageTemp,
        category: { id: pro.category?.id, name: pro.category?.name },
        classification: { id: pro.classification?.id, name: pro.classification?.name },
        uom: { id: pro.uom?.id, name: pro.uom?.unit },
        subcategory: { id: pro.subcategory?.id, name: pro.subcategory?.name },
      })),
      meta: data1.meta,
    };

    console.log("result.........................",result)

    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }

  async getAllwithSearch(search?: string): Promise<any> {
    const key = `${CACHE_PREFIX}:search:${search ?? 'all'}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.classification', 'classification')
      .leftJoin('product.category', 'category')
      .leftJoin('product.subcategory', 'subcategory')
      .leftJoin('product.uom', 'uom')
      .select([
        'product.id', 'product.name', 'product.productCode',
        'classification.id', 'classification.name',
        'category.id', 'category.name',
        'subcategory.id', 'subcategory.name',
        'uom.id', 'uom.unit',
      ]);

    if (search) {
      queryBuilder.where('product.name ILIKE :search', { search: `%${search}%` });
    }

    const result = await queryBuilder.getMany();
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }

  async getById(id: string): Promise<ProductDetailResponseDto> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    try {
      const product = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.classification', 'classification')
        .leftJoin('product.variant', 'variants')
        .leftJoin('product.category', 'category')
        .leftJoin('product.subcategory', 'subcategory')
        .leftJoin('product.uom', 'uom')
        .leftJoin('product.qualityParameters', 'qualityParameters')
        .select([
          'product.id', 'product.name', 'product.image', 'product.description',
          'product.prefix', 'product.packingType', 'product.shelfLife', 'product.storageTemp',
          'classification.id', 'category.id', 'subcategory.id', 'uom.id',
          'qualityParameters.id', 'qualityParameters.name', 'qualityParameters.type',
          'variants.id', 'variants.variantCode', 'variants.count', 'variants.size',
          'variants.variety', 'variants.origin', 'variants.brand', 'variants.thresholdStock',
        ])
        .where('product.id = :id', { id })
        .getOne();

      if (!product) throw new Error('Product not found');

      const response: ProductDetailResponseDto = {
        id: product.id,
        name: product.name,
        image: product.image,
        description: product.description,
        prefix: product.prefix,
        packingType: product.packingType,
        shelfLife: product.shelfLife,
        storageTemp: product.storageTemp,
        classification: product.classification?.id ?? null,
        category: product.category?.id ?? null,
        subcategory: product.subcategory?.id ?? null,
        uom: product.uom?.id ?? null,
        qualityParameters: product.qualityParameters,
        variant: product.variant?.map((v) => ({
          id: v.id,
          variantCode: v.variantCode,
          count: v.count,
          size: v.size,
          variety: v.variety,
          origin: v.origin,
          brand: v.brand,
          thresholdStock: v.thresholdStock,
        })) ?? [],
      };

      await this.cacheService.set(key, response, CACHE_TTL_DETAIL);
      return response;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw new Error('Unable to fetch the product.');
    }
  }

  async getAllByFilter(queryOptions: PaginationOptions): Promise<any> {
    const hash = createHash('md5').update(JSON.stringify(queryOptions)).digest('hex');
    const key = `${CACHE_PREFIX}:filter:${hash}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    try {
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')

        .select([
          'product.id',
          'product.name',

          'product.productCode',
        ]);

      const result = await buildQuery(queryBuilder, queryOptions, 'product');
      await this.cacheService.set(key, result, CACHE_TTL);
      return result;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error('Unable to fetch the products.');
    }
  }

  async getVarientByProductId(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:variants:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variant', 'variants')
      .where('product.id = :id', { id })
      .getOne();

      console.log("product data",product);

    if (!product) throw new Error('Product not found');


    const result = {
      variants: product.variant?.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        variantCode: v.variantCode,
        count: v.count,
        size: v.size,
        variety: v.variety,
        origin: v.origin,
        brand: v.brand,
      })) || [],
    };
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  async getPartialByID(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:partial:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    try {
      const product = await this.productRepository
        .createQueryBuilder('product')
        .select(['product.id', 'product.name', 'product.description', 'product.productCode'])
        .where('product.id = :id', { id })
        .getOne();

      if (!product) throw new Error('Product not found');
      await this.cacheService.set(key, product, CACHE_TTL_DETAIL);
      return product;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw new Error('Unable to fetch the product.');
    }
  }
  async getByproductNameFilter(search: string): Promise<any> {
    // short TTL — search results change as products are added
    const key = `${CACHE_PREFIX}:search:name:${search}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    try {
      const product = await this.productRepository
        .createQueryBuilder('product')
        .select(['product.id', 'product.name', 'product.description'])
        .where('product.name ILIKE :search', { search: `%${search}%` })
        .getMany();

      await this.cacheService.set(key, product, 60); // 60s TTL for search
      return product;
    } catch (error) {
      throw new Error(`Error fetching product: ${error}`);
    }
  }
  async createProductWithExcel(fileUrl: string): Promise<any> {
    try {
      console.log("In create product with Excel, fileUrl:", fileUrl);

      // First, download the file from DigitalOcean Spaces
      let fileBuffer: Buffer;

      if (fileUrl.startsWith('https://')) {
        // Extract the key from the URL
        const urlParts = fileUrl.split('/');
        const key = urlParts.slice(-2).join('/'); // Gets "single/filename"
        console.log('Downloading file from Spaces with key:', key);

        // Download file from Spaces
        fileBuffer = await this.getExcelFromSpaces(key);
      } else {
        // If it's already a local path or key, try to get it from Spaces
        fileBuffer = await this.getExcelFromSpaces(fileUrl);
      }

      // Read the Excel file from buffer instead of file path
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      console.log("Sheet names found:", sheetNames);

      const productRepository = AppDataSource.getRepository(Product);
      const uomRepository = AppDataSource.getRepository(UOM);
      const categoryRepository = AppDataSource.getRepository(ProductCategory);
      const subcategoryRepository = AppDataSource.getRepository(ProductSubcategory);

      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        console.log("Processing sheet:", sheetName);

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (jsonData.length < 2) {
          console.warn("Sheet does not have enough rows:", sheetName);
          continue;
        }

        const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
          h ? String(h).trim() : `UNKNOWN`
        );
        console.log("Headers found:", headers);

        const dataRows = jsonData.slice(1); // Skip header row
        console.log("Number of data rows:", dataRows.length);

        for (const rowUntyped of dataRows) {
          if (!Array.isArray(rowUntyped) || rowUntyped.length === 0) continue;

          const rowData: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowData[header] = rowUntyped[index];
          });

          console.log("Mapped Row:", rowData);

          if (!rowData["Product Name"]) {
            console.warn("Skipping incomplete row:", rowData);
            continue;
          }

          const productCode = await this.generateProductCode(rowData["Product Code Prefix"]);

          // --- Product Base ---
          const product = new Product();
          product.name = rowData["Product Name"];
          product.productCode = productCode;
          product.description = rowData["Description"];
          product.image = rowData["Product Image"];
          product.prefix = rowData["Product Code Prefix"];
          product.packingType = rowData["Packing Type"];
          product.shelfLife = rowData["Shelf Life (Days)"];
          product.storageTemp = rowData["Storage Temp (°C)"];

          // --- Classification ---
          if (rowData["Classification"]) {
            let classification = await this.classificationRepository.findOne({ where: { name: rowData["Classification"] } });
            if (!classification) {
              classification = this.classificationRepository.create({ name: rowData["Classification"] });
              classification = await this.classificationRepository.save(classification);
            }
            product.classification = classification;
          }

          // --- UOM ---
          if (rowData["UOM"]) {
            let uom = await uomRepository.findOne({ where: { unit: rowData["UOM"] } });
            if (!uom) {
              uom = uomRepository.create({
                unit: rowData["UOM"],
                abbreviation: rowData["UOM Abbreviation"] || null,
                description: rowData["UOM Description"] || null,
              });
              uom = await uomRepository.save(uom);
            }
            product.uom = uom;
          }

          // --- Category & Subcategory ---
          const categoryName = rowData["Category"];
          const subcategoryName = rowData["Subcategory"];

          if (categoryName) {
            let category = await categoryRepository.findOne({ where: { name: categoryName } });
            if (!category) {
              category = categoryRepository.create({ name: categoryName });
              category = await categoryRepository.save(category);
            }
            product.category = category;

            if (subcategoryName) {
              let subcategory = await subcategoryRepository.findOne({
                where: { name: subcategoryName, category: { id: category.id } },
              });
              if (!subcategory) {
                subcategory = subcategoryRepository.create({ name: subcategoryName, category });
                subcategory = await subcategoryRepository.save(subcategory);
              }
              product.subcategory = subcategory;
            }
          }

          // --- Variants ---
          product.variant = [];
          let i = 1;
          while (rowData[`Variant${i}.Count`]) {
            const pv = new ProductVarient();
            pv.count = rowData[`Variant${i}.Count`] || null;
            pv.size = rowData[`Variant${i}.Size`] || null;
            pv.variety = rowData[`Variant${i}.Variety`] || null;
            pv.origin = rowData[`Variant${i}.Origin`] || null;
            pv.brand = rowData[`Variant${i}.Brand`] || null;
            pv.thresholdStock = rowData[`Variant${i}.Threshold Stock`] || null;
            product.variant.push(pv);
            i++;
          }

          // --- Quality Parameters ---
          product.qualityParameters = [];
          let j = 1;
          while (rowData[`Parameter${j}.Name`]) {
            const qp = new QualityParameter();
            qp.name = rowData[`Parameter${j}.Name`] || null;
            qp.type = rowData[`Parameter${j}.Type`] || "good";
            product.qualityParameters.push(qp);
            j++;
          }

          // --- Save Product ---
          console.log("Saving product:", product.name);
          const result = await productRepository.save(product);
          console.log("Saved product with ID:", result.id);
        }
      }

      // 🗑️ Delete the file from DigitalOcean Spaces after successful processing
      await this.deleteFileFromSpaces(fileUrl);

    } catch (error) {
      console.error('Error processing product upload:', error);

      // 🗑️ Still attempt to delete the file even if processing failed
      try {
        await this.deleteFileFromSpaces(fileUrl);
      } catch (deleteError) {
        console.error('Error deleting file after failed processing:', deleteError);
      }

      throw error;
    }
  }

  /**
   * Get Excel file from DigitalOcean Spaces
   * @param key - Spaces key/path to the Excel file
   * @returns Buffer containing the file data
   */
  private async getExcelFromSpaces(key: string): Promise<Buffer> {
    try {
      console.log('📂 Reading Excel file from Spaces:', key);

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { s3 } = await import('../../../middleware/spaces.config');
      const command = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      const response = await s3.send(command);

      if (!response.Body) {
        throw new Error('No file content found in Spaces response');
      }

      const bytes = await response.Body.transformToByteArray();
      const fileBuffer = Buffer.from(bytes);

      console.log('✅ Excel file read successfully, size:', fileBuffer.length, 'bytes');
      return fileBuffer;
    } catch (error) {
      console.error('❌ Error reading Excel file from Spaces:', error);
      throw new Error(`Failed to read Excel file: ${key}`);
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   * @param fileUrl - The full URL or key of the file to delete
   */
  private async deleteFileFromSpaces(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the fullget URL
      // URL format: https://bucket-name.sgp1.digitaloceanspaces.com/documents/filename
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Gets "documents/filename"

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const { s3 } = await import('../../../middleware/spaces.config');
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      await s3.send(deleteCommand);
      console.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      console.error(`Failed to delete file from spaces: ${fileUrl}`, error);
      // Don't throw error here to avoid breaking the main flow
    }
  }

  /**
   * Get available product categories for reference when uploading product data
   */
  async getAvailableProductCategories(): Promise<{ id: string; name: string }[]> {
    const key = `${CACHE_PREFIX}:ref:categories`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const categoryRepository = AppDataSource.getRepository(ProductCategory);
    const categories = await categoryRepository
      .createQueryBuilder('category')
      .select(['category.id', 'category.name'])
      .orderBy('category.name', 'ASC')
      .getMany();

    const result = categories.map(category => ({ id: category.id, name: category.name }));
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  /**
   * Get available product subcategories for reference when uploading product data
   */
  async getAvailableProductSubcategories(categoryId?: string): Promise<{ id: string; name: string; categoryName: string }[]> {
    const key = `${CACHE_PREFIX}:ref:subcategories:${categoryId || 'all'}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const subcategoryRepository = AppDataSource.getRepository(ProductSubcategory);
    const queryBuilder = subcategoryRepository
      .createQueryBuilder('subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .select(['subcategory.id', 'subcategory.name', 'category.name'])
      .orderBy('category.name', 'ASC')
      .addOrderBy('subcategory.name', 'ASC');

    if (categoryId) {
      queryBuilder.where('category.id = :categoryId', { categoryId });
    }

    const subcategories = await queryBuilder.getMany();
    const result = subcategories.map(subcategory => ({
      id: subcategory.id,
      name: subcategory.name,
      categoryName: subcategory.category?.name || 'Unknown',
    }));
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  /**
   * Get available UOMs for reference when uploading product data
   */
  async getAvailableUOMs(): Promise<{ id: string; unit: string; abbreviation: string }[]> {
    const key = `${CACHE_PREFIX}:ref:uoms`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const uomRepository = AppDataSource.getRepository(UOM);
    const uoms = await uomRepository
      .createQueryBuilder('uom')
      .select(['uom.id', 'uom.unit', 'uom.abbreviation'])
      .orderBy('uom.unit', 'ASC')
      .getMany();

    const result = uoms.map(uom => ({ id: uom.id, unit: uom.unit, abbreviation: uom.abbreviation || '' }));
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }


  async update(id: string, productData: CreateProductDto, updatedBy: string): Promise<any> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: [
        'qualityParameters',
        'category',
        'subcategory',
        'uom',
        'variant',
      ],
    });

    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const oldData = { ...product };
    const existingVariants = product.variant ?? [];

    if (productData?.qualityParameters) {
      await this.qualityParameterRepository.save(
        productData.qualityParameters.map((qp: any) => ({
          ...qp,
          product,
        })),
      );
    }

    console.log('existing product variants are:', product.variant);


    console.log("product data received for update is ", productData.prefix);


    const prefix = productData.prefix;

if (prefix && prefix !== product.prefix) {
  const productCode = await this.generateProductCode(prefix);
  productCode.toUpperCase();
  product.productCode = productCode;
}

    // if (productData.prefix !== product.prefix) {
    //   const productCode = await this.generateProductCode(productData.prefix);
    //   productCode.toUpperCase();
    //   product.productCode = productCode;
    // }

  oldData.productCode =
  productData.productCode ?? oldData.productCode;
    //oldData.productCode = productData.productCode;
    // strip variant to prevent TypeORM cascade re-inserting them
    const { variant, ...cleanProductData } = productData;
    product.variant = [];

    const updatedProduct = await this.productRepository.save({
      ...product,
      ...cleanProductData,
    });
    console.log('product id is ', updatedProduct.id);

    const incomingVariants: any[] = variant ?? variant ?? [];

    for (const variantData of incomingVariants) {
      // match by id if present, otherwise fall back to field values
      const existingVariant = variantData.id
        ? (existingVariants).find((v: any) => v.id === variantData.id)
        : (existingVariants).find((v: any) =>
          v.count === variantData.count &&
          v.size === variantData.size &&
          v.variety === variantData.variety &&
          v.origin === variantData.origin &&
          v.brand === variantData.brand
        );

      if (existingVariant) {
        await this.productVarientsRepository.save({
          ...existingVariant,
          ...variantData,
          id: existingVariant.id,
          product: updatedProduct,
          productName: updatedProduct.name,
          variantName: await getVariantIdentifier(
            updatedProduct.name,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
          variantCode: await generateVariantCode(
            updatedProduct.id,
            updatedProduct.prefix,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
        });
      } else {
        const { id: _id, ...itemData } = variantData;
        const newVariant = this.productVarientsRepository.create({
          ...itemData,
          product: updatedProduct,
          productName: updatedProduct.name,
          variantName: await getVariantIdentifier(
            updatedProduct.name,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
          variantCode: await generateVariantCode(
            updatedProduct.id,
            updatedProduct.prefix,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
        });
        await this.productVarientsRepository.save(newVariant);
      }
    }

    await this.auditLogService.logChange('Product', id, oldData, updatedProduct, updatedBy);
    await this.invalidateProductCache(id);
    return updatedProduct;
  }


  async delete(id: string): Promise<boolean> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Product with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the product
    product.deletionScheduledAt = sixMonthsFromNow;
    await this.productRepository.save(product);
    await this.invalidateProductCache(id);
    return true;
  }



  async getVarientsByProductId(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:variants:full:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['variant'],
    });
    if (!product) throw new Error('Product not found');

    const formattedproduct = {
      id: product.id,
      name: product.name,
      variant: product.variant.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        variantCode: v.variantCode,
        count: v.count,
        size: v.size,
        variety: v.variety,
        origin: v.origin,
        brand: v.brand,
        thresholdStock: v.thresholdStock,
      })),
    };
    await this.cacheService.set(key, formattedproduct, CACHE_TTL_DETAIL);
    return formattedproduct;
  }
  async softDeleteProducts(userIds: string[]) {
    const result = await this.productRepository.softDelete({ id: In(userIds) });
    await this.invalidateProductCache();
    return result;
  }

  async getProductsByIds(ids: string[]): Promise<any[]> {
    // Filter out empty strings, nulls, undefined — frontend may send ""
    const validIds = ids.filter((id) => id && id.trim() !== '');
    if (!validIds || validIds.length === 0) return [];

    return await this.productRepository
      .createQueryBuilder('product')
      .select(['product.id', 'product.name', 'product.productCode'])
      .where('product.id IN (:...ids)', { ids: validIds })
      .getMany();
  }
}


  //   async uploadProducts(filePath: string): Promise<void> {
  //     const products: Product[] = [];
  //     let sequenceNumber = await this.productRepository.count(); // Get initial count once

  //     await new Promise<void>((resolve, reject) => {
  //       fs.createReadStream(filePath)
  //         .pipe(csvParser())
  //         .on("data", async (row) => {
  //           try {
  //             console.log("Row Data:", row);

  //             // Fetch related entities
  //             const [category, subcategory, classification, uom] = await Promise.all([
  //               row["Category"] ? this.categoryRepository.findOne({ where: { name: row["Category"] } }):null ,
  //               row["Subcategory"] ? this.subcategoryRepository.findOne({ where: { name: row["Subcategory"] } }):null,
  //               row["Classification"] ? this.classificationRepository.findOne({ where: { name: row["Classification"] } }):null,
  //               row["UOM"] ? this.uomRepository.findOne({ where: { unit: row["UOM"] } }) : null,
  //             ]);

  //             // Create a new Product instance
  //             const product = new Product();
  //             product.name = row["Product Name"];
  //             product.description = row["Description"];
  //             product.productOrigin = row["Origin"];
  //             product.brand = row["Brand"];
  //             product.packingType = row["Packing Type"];
  //             product.shelfLife = row["Shelf Life"] ? parseInt(row["Shelf Life"]) : 0;
  //             product.storageTemp = row["Storage Temp"] ? parseFloat(row["Storage Temp"]) : 0;
  //             product.count = row["Count"] ? row["Count"].split(",").map((item: string) => item.trim()) : [];
  //             product.size = row["Size"] ? row["Size"].split(",").map((item: string) => item.trim()) : [];
  //             product.variety = row["Variety"] ? row["Variety"].split(",").map((item: string) => item.trim()) : [];

  // // Assign relations (ensure they are either null or an entity, not undefined)
  // product.category = category;
  // product.subcategory = subcategory ;
  // product.classification = classification
  // product.uom = uom ;

  //             // Generate product code
  //             product.productCode = await this.getNextProductCode("ARG", product.name);

  //             // Add product to the batch list
  //             products.push(product);
  //           } catch (error) {
  //             console.error("Error processing row:", row, error);
  //           }
  //         })
  //         .on("end", async () => {
  //           try {
  //             // Save all products in a batch
  //             await this.productRepository.save(products);
  //             resolve();
  //           } catch (error) {
  //             console.error("Error saving products:", error);
  //             reject(error);
  //           }
  //         })
  //         .on("error", (error) => reject(error));
  //     });

  //     // Cleanup the uploaded file
  //     fs.unlinkSync(filePath);
  //   }



  //   async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //     const product = await this.productRepository.findOne({
  //       where: { id },
  //       relations: ['qualityParameters', 'category', 'subcategory', 'uom','variant'],
  //     });
  //     console.log(product);
  //     if (productData?.qualityParameters) {
  //       let paramets = await this.qualityParameterRepository.save(
  //         productData.qualityParameters,
  //       );
  //     }
  //     if (productData?.variant) {
  //       productData.varient.product = savedProduct;
  //       productData.varient.variantCode = await generateVariantCode(

  //     productData.prefix,
  //     productData.varient.count,
  //     productData.varient.size
  // );

  //       let variants = await this.productVarientsRepository.save(productData.variant);

  //     }

  //     if (product) {
  //       const oldData = { ...product };
  //       Object.assign(product, productData);

  //       const updatedProduct = await this.productRepository.save(product);

  //       // Log changes
  //       await this.auditLogService.logChange(
  //         'Product',
  //         id,
  //         oldData,
  //         updatedProduct,
  //         updatedBy,
  //       );

  //       return updatedProduct;
  //     }
  //     return null;
  //   }

  // async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //   console.log("product data received for update is ",productData);
  //   const product = await this.productRepository.findOne({
  //     where: { id },
  //     relations: ['qualityParameters', 'category', 'subcategory', 'uom', 'variant'],
  //   });

  //   if (!product) {
  //     throw new Error(`Product with ID ${id} not found`);
  //   }

  //   // Keep old data for audit log
  //   const oldData = { ...product };

  //   // Handle quality parameters update
  //   if (productData?.qualityParameters) {
  //     await this.qualityParameterRepository.save(
  //       productData.qualityParameters.map((qp: any) => ({
  //         ...qp,
  //         product,
  //       })),
  //     );
  //   }

  // console.log("product data is ",product.variant);
  //   // Update product base fields
  //   //Object.assign(product, productData);
  //   const updatedProduct = await this.productRepository.save(product);
  // console.log("product id is ",updatedProduct.id);

  // for (const variantData of productData.variant) {
  //   const existingVariant = await this.productVarientsRepository.findOne({
  //     where: {
  //       product: { id: updatedProduct.id },
  //       count: variantData.count,
  //       size: variantData.size,
  //       variety: variantData.variety,
  //       origin: variantData.origin,
  //       brand: variantData.brand,
  //     },
  //   });

  //   if (existingVariant) {
  //     // ✅ Update and keep relation
  //     await this.productVarientsRepository.save({
  //       ...existingVariant,
  //       ...variantData,
  //       product: updatedProduct,  // make sure relation is not null
  //       productName: updatedProduct.name,
  //       variantName: await getVariantIdentifier(
  //         updatedProduct.name,
  //         variantData.count,
  //         variantData.size,
  //         variantData.variety,
  //         variantData.origin,
  //         variantData.brand,
  //       ),
  //     });
  //   } else {
  //     // ✅ Create new with relation
  //     const newVariant = this.productVarientsRepository.create({
  //       ...variantData,
  //       product: updatedProduct,  // important!
  //       productName: updatedProduct.name,
  //       variantName: await getVariantIdentifier(
  //         updatedProduct.name,
  //         variantData.count,
  //         variantData.size,
  //         variantData.variety,
  //         variantData.origin,
  //         variantData.brand,
  //       ),
  //       variantCode: await generateVariantCode(
  //         updatedProduct.id,
  //         updatedProduct.prefix,
  //         variantData.count,
  //         variantData.size,
  //       ),
  //     });

  //     await this.productVarientsRepository.save(newVariant);
  //   }
  // }

  //   // Log audit changes
  //   await this.auditLogService.logChange(
  //     'Product',
  //     id,
  //     oldData,
  //     updatedProduct,
  //     updatedBy,
  //   );

  //   // No need to save product again (already done)
  //   return updatedProduct;
  // }

  // async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //   const product = await this.productRepository.findOne({
  //     where: { id },
  //     relations: [
  //       'qualityParameters',
  //       'category',
  //       'subcategory',
  //       'uom',
  //       'variant',
  //     ],
  //   });

  //   if (!product) {
  //     throw new Error(`Product with ID ${id} not found`);
  //   }

  //   const oldData = { ...product };

  //   if (productData?.qualityParameters) {
  //     await this.qualityParameterRepository.save(
  //       productData.qualityParameters.map((qp: any) => ({
  //         ...qp,
  //         product,
  //       })),
  //     );
  //   }

  //   console.log('existing product variants are:', product.variant);

  //   const updatedProduct = await this.productRepository.save({
  //     ...product,
  //     ...productData,
  //   });
  //   console.log('product id is ', updatedProduct.id);

  //   for (const variantData of productData.variant) {
  //     const existingVariant = await this.productVarientsRepository.findOne({
  //       where: {
  //         product: { id: updatedProduct.id },
  //         count: variantData.count,
  //         size: variantData.size,
  //         variety: variantData.variety,
  //         origin: variantData.origin,
  //         brand: variantData.brand,
  //       },
  //     });

  //     console.log('Existing variant found:', existingVariant?.id);
  //     if (existingVariant) {
  //       const updatedVariant = {
  //         ...variantData,
  //         ...existingVariant,
  //         product: updatedProduct,
  //         productName: updatedProduct.name,
  //         variantName: await getVariantIdentifier(
  //           updatedProduct.name,
  //           variantData.count,
  //           variantData.size,
  //           variantData.variety,
  //           variantData.origin,
  //           variantData.brand,
  //         ),
  //         variantCode: await generateVariantCode(
  //           updatedProduct.id,
  //           updatedProduct.prefix,
  //           variantData.count,
  //           variantData.size,
  //         ),
  //       };

  //       await this.productVarientsRepository.save(updatedVariant);
  //     } else {
  //       const newVariant = this.productVarientsRepository.create({
  //         ...variantData,
  //         product: updatedProduct,
  //         productName: updatedProduct.name,
  //         variantName: await getVariantIdentifier(
  //           updatedProduct.name,
  //           variantData.count,
  //           variantData.size,
  //           variantData.variety,
  //           variantData.origin,
  //           variantData.brand,
  //         ),
  //         variantCode: await generateVariantCode(
  //           updatedProduct.id,
  //           updatedProduct.prefix,
  //           variantData.count,
  //           variantData.size,
  //         ),
  //       });

  //       await this.productVarientsRepository.save(newVariant);
  //     }
  //   }

  //   await this.auditLogService.logChange(
  //     'Product',
  //     id,
  //     oldData,
  //     updatedProduct,
  //     updatedBy,
  //   );

  //   return updatedProduct;
  // }

