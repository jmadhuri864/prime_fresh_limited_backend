import { inject, injectable } from "inversify";
import { format } from "date-fns"; // Make sure to install the date-fns library
import { Vendor } from "./vendor.entity";
import { VendorRepository } from "../repository/vendor.repository";
import { TYPES } from "../../../types";
import AppError from "../../../utils/appError";
import * as XLSX from "xlsx";
import { AddressService } from "../address/address.service";
import { VendorCategoryService } from "./vendorCategory.service";
import { VendorSubcategoryService } from "./vendorSubcategory.service";
import { BankDetailsvendService } from "../services/vendorBankDetails.service";
import { VendorSaleInfoService } from "../vendorsaleinfo.service";
import { AuditLogService } from "../services/auditLog.service";
import { AppDataSource } from "../../../utils/data-source";
import { buildQuery, PaginationOptions } from "../../../utils/pagination";
import { Address } from "../address/address.entity";
import { BankDetailsvend } from "../entities/bankDetailsVend.entity";
import { VendorSaleInfo } from "../entities/vendorsaleinfo.entity";
import { VendorCategoryRepository } from "../../vendor/vendorCategory/vendorCategory.repository";
import { VendorSubcategoryRepository } from "../../vendorSubcategory/repository/vendorSubcategory.repository";
import { VendorCategory } from "../../vendorCategory/entity/vendorCategory.entity";
import { VendorSubcategory } from "../entities/vendorSubcategory.entity";
import { Product } from "../entities/product.entity";
import { User } from "../entities/user.entity";
import { In } from "typeorm";
import { ProductRepository } from "../../../product/createproduct/repository/product.repository";
import { UserRepository } from "../../../employee/repository/user.repository";
import { PackingMaterialRepository } from "../../../packingMaterial/repository/packingMaterial.repository";
import { Role } from "../entities/user.entity";
import { Status } from "../../../utils/status.enum";
import { formatDateTime } from "../../../utils/dateUtils";
import { PackingMaterial } from "../entities/packingMaterial.entity";
import { formatAddress } from "../../../utils/addressFormate.utils";
import { CacheService } from "../../../global/cache.service";
import { createHash } from "crypto";
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorListResponseDto,
  VendorViewResponseDto,
  VendorUpdateFormDto,
  VendorDropdownDto,
  VendorFilterDto,
} from "../dtos/vendor.dto";

const CACHE_PREFIX = "vendor";
const CACHE_TTL = 180;
const CACHE_TTL_DETAIL = 300;

@injectable()
export class VendorService {
  constructor(
    @inject(TYPES.VendorRepository)
    private readonly vendorRepository: VendorRepository,
    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    @inject(TYPES.VendorCategoryRepository)
    private readonly vendorCategoryRepository: VendorCategoryRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.PackingMaterialRepository)
    private readonly packingMaterialRepository: PackingMaterialRepository,
    @inject(TYPES.VendorSubcategoryRepository)
    private readonly vendorSubcategoryRepository: VendorSubcategoryRepository,

    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.VendorCategoryService)
    private readonly vendorCategoryService: VendorCategoryService,
    @inject(TYPES.BankDetailsvendService)
    private readonly vendorBankDetailService: BankDetailsvendService,
    @inject(TYPES.VendorSaleInfoService)
    private readonly vendorSaleInfoService: VendorSaleInfoService,
    @inject(TYPES.VendorSubcategoryService)
    private readonly vendorSubCategoryService: VendorSubcategoryService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateVendorCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:filter:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:dropdown:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:view:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:update:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:withid:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:filter:id:${id}`),
      );
    }
    await Promise.all(tasks);
  }
async createVendor(vendorDto: CreateVendorDto & Record<string, any>): Promise<Vendor> {
    // Create the new Vendor entity

    const user = await this.userRepository.findOneBy({id: vendorDto.createdBy});

    // Always set status to draft - must go through submit → pending → approve flow
   // vendorDto.status = Status.DRAFT;

   if (!user) {
           throw new AppError(404, 'User not found');
         }

     // If the logged-in user is an admin or verifier, bypass the approval flow and set status to approved directly
      if (user.roles && (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.VERIFIER))) {
        vendorDto.status = Status.APPROVED;
      }
      else{
        vendorDto.status = Status.PENDING;
      }

    if(vendorDto.listOfAllProducts && Array.isArray(vendorDto.listOfAllProducts)){
      const productIds = vendorDto.listOfAllProducts.map((p: any) => p.id || p);
      
      const foundProducts = await this.productRepository.findBy({id: In(productIds)});
      
      vendorDto.listOfAllProducts = foundProducts;
    }

    // Handle mainProduct if provided
    if(vendorDto.mainProduct && typeof vendorDto.mainProduct === 'object' && vendorDto.mainProduct.id) {
      const mainProduct = await this.productRepository.findOneBy({id: vendorDto.mainProduct.id});
      if(mainProduct) {
        vendorDto.mainProduct = mainProduct;
      }
    }

    // Handle listOfPackingMaterial if provided
    if (vendorDto.listOfPackingMaterial && Array.isArray(vendorDto.listOfPackingMaterial)) {
      const pmIds = vendorDto.listOfPackingMaterial.map((p: any) => p.id || p);
      vendorDto.listOfPackingMaterial = await this.packingMaterialRepository.findBy({ id: In(pmIds) });
    }

    // Handle mainPackingMaterial if provided
    if (vendorDto.mainPackingMaterial && typeof vendorDto.mainPackingMaterial === 'object' && vendorDto.mainPackingMaterial.id) {
      const mainPM = await this.packingMaterialRepository.findOneBy({ id: vendorDto.mainPackingMaterial.id });
      if (mainPM) vendorDto.mainPackingMaterial = mainPM;
    } else if (typeof vendorDto.mainPackingMaterial === 'string' && vendorDto.mainPackingMaterial) {
      const mainPM = await this.packingMaterialRepository.findOneBy({ id: vendorDto.mainPackingMaterial });
      if (mainPM) vendorDto.mainPackingMaterial = mainPM;
    }
    //vendorDto.officeAddress = JSON.parse(vendorDto.officeAddress);

    const year = new Date().getFullYear();
    const prefix = `VENDOR${year}`;

    // Retry loop to handle race conditions where two requests generate the same code simultaneously
    let saved: Vendor | undefined;
    let attempts = 0;
    while (true) {
      attempts++;
      if (attempts > 10) throw new AppError(500, 'Failed to generate a unique vendor code after multiple attempts');

      // Use raw SQL to find the highest vendor code for this year,
      // bypassing TypeORM's soft-delete filter (deletedAt IS NULL) so we never
      // re-use a code that belongs to a soft-deleted or isDeleted record.
      const result = await this.vendorRepository.query(
        `SELECT vendor_code FROM vendor WHERE vendor_code LIKE $1 ORDER BY vendor_code DESC LIMIT 1`,
        [`${prefix}%`]
      );

      let nextNumber = 1;
      if (result.length > 0 && result[0].vendor_code) {
        const lastNumber = parseInt(result[0].vendor_code.slice(prefix.length), 10);
        if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
      }

      const vendorCode = `${prefix}${String(nextNumber).padStart(4, '0')}`;
      vendorDto.vendorCode = vendorCode;
      const newVendor = this.vendorRepository.create(vendorDto as any) as unknown as Vendor;

      try {
        saved = await this.vendorRepository.save(newVendor);
        break; // success
      } catch (err: any) {
        // Postgres unique violation code
        if (err?.driverError?.code === '23505' || err?.code === '23505') {
          continue; // retry with next number
        }
        throw err; // unrelated error, rethrow
      }
    }

    await this.invalidateVendorCache();
    return saved!;
  }

  async submitVendor(
    vendorId: string,
    fileUpdates: Record<string, string | null> = {},
    vendorData: Record<string, any> = {},
  ): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['officeAddress', 'ref1Address', 'ref2Address', 'vendorSaleInfo', 'vendorBankDetails'],
    });
    if (!vendor) throw new AppError(404, 'Vendor not found');

    vendor.status = Status.PENDING;

    // ── Scalar fields apply
    const scalarFields: (keyof Vendor)[] = [
      'companyName', 'officeContactNo', 'officeEmail', 'gstn', 'ifGstnCopy',
      'panNo', 'ifPanCardCopy', 'msmeNo', 'ifMsmeCopy', 'website',
      'creditTerms', 'classification', 'vendorCode', 'vendorGrade',
      'dateOfIncorporation', 'inFandVBusinessSince', 'dispatchCenter',
      'warehouseLocations', 'packingCenterLocation', 'tradeLicenseNumber',
      'proposedPaymentTerms', 'anyDetailsTeamAndInfra', 'otherProductOrService',
      'paymentMode', 'ref1FName', 'ref1MName', 'ref1LName', 'ref1PrimaryCNumb',
      'ref1AltrCNumb', 'ref1Email', 'ref2FName', 'ref2MName', 'ref2LName',
      'ref2PrimaryCNumb', 'ref2AltrCNumb', 'ref2Email',
    ];

    for (const field of scalarFields) {
      if (vendorData[field] !== undefined && vendorData[field] !== null && vendorData[field] !== '') {
        (vendor as any)[field] = vendorData[field];
      }
    }

    // ── Helper: multipart/form-data madhe nested objects JSON string mhanun yetaat ──
    const parseIfString = (val: any): any => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    // ── Nested object fields ──────────────────────────────────────────────
    const officeAddressData = parseIfString(vendorData.officeAddress);
    if (officeAddressData && typeof officeAddressData === 'object') {
      Object.assign(vendor.officeAddress ??= {} as Address, officeAddressData);
    }
    const ref1AddressData = parseIfString(vendorData.ref1Address);
    if (ref1AddressData && typeof ref1AddressData === 'object') {
      Object.assign(vendor.ref1Address ??= {} as Address, ref1AddressData);
    }
    const ref2AddressData = parseIfString(vendorData.ref2Address);
    if (ref2AddressData && typeof ref2AddressData === 'object') {
      Object.assign(vendor.ref2Address ??= {} as Address, ref2AddressData);
    }
    const vendorSaleInfoData = parseIfString(vendorData.vendorSaleInfo);
    if (vendorSaleInfoData && typeof vendorSaleInfoData === 'object') {
      Object.assign(vendor.vendorSaleInfo ??= {} as VendorSaleInfo, vendorSaleInfoData);
    }
    const vendorBankDetailsData = parseIfString(vendorData.vendorBankDetails);
    if (vendorBankDetailsData && typeof vendorBankDetailsData === 'object') {
      Object.assign(vendor.vendorBankDetails ??= {} as BankDetailsvend, vendorBankDetailsData);
    }

    // ── File updates apply करा ────────────────────────────────────────────
    if (fileUpdates.gstnCopy !== undefined)    vendor.gstnCopy    = fileUpdates.gstnCopy    ?? vendor.gstnCopy;
    if (fileUpdates.panCardCopy !== undefined) vendor.panCardCopy = fileUpdates.panCardCopy ?? vendor.panCardCopy;
    if (fileUpdates.msmeCopy !== undefined)    vendor.msmeCopy    = fileUpdates.msmeCopy    ?? vendor.msmeCopy;
    // cancelledChequeCopy is inside vendorBankDetails — handled above via nested object

    await this.vendorRepository.save(vendor);
    await this.invalidateVendorCache(vendorId);

    // Fresh fetch to ensure returned status reflects DB state
    const updated = await this.vendorRepository.findOne({ where: { id: vendorId } });
    return updated!;
  }

async approveVendor(vendorId: string, approverId: string, status: Status) {
  // Validate status — only approved or rejected are valid outcomes
  if (status !== Status.APPROVED && status !== Status.REJECTED) {
    throw new AppError(400, `Invalid status '${status}'. Only 'approved' or 'rejected' are allowed.`);
  }

  const approver = await this.userRepository.findOne({ where: { id: approverId } });
  if (!approver) throw new AppError(404, 'Approver not found');

  // Only VERIFIER role can approve/reject vendors
  if (!approver.roles || !approver.roles.includes(Role.VERIFIER)) {
    throw new AppError(403, 'Only a Verifier can approve or reject vendors');
  }

  const vendor = await this.vendorRepository.findOne({ where: { id: vendorId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  // Vendor must be in 'pending' status — draft means not yet submitted
  if (vendor.status !== Status.PENDING) {
    throw new AppError(400, `Vendor cannot be approved because its current status is '${vendor.status}'. Only vendors with status 'pending' can be approved or rejected.`);
  }

  vendor.status = status;
  const saved = await this.vendorRepository.save(vendor);
  await this.invalidateVendorCache(vendorId);
  return saved;
}
  
  async getVendorById(id: string): Promise<Vendor | null> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const vendor = await this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.vendorBankDetails", "vendorBankDetails")
      .leftJoinAndSelect("vendorBankDetails.branchAddress", "branchAddress")
      .leftJoinAndSelect("vendor.ref1Address", "ref1Address")
      .leftJoinAndSelect("vendor.ref2Address", "ref2Address")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .leftJoinAndSelect("vendor.category", "category")
      .where("vendor.id = :id", { id })
      .getOne();

    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }

    const result = {
      ...vendor,
      subcategory: vendor.subcategory?.id || null,
      category: vendor.category?.id || null,
    } as any;

    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }


//service

async getVendorByIdforview(id: string): Promise<VendorViewResponseDto> {
  const key = `${CACHE_PREFIX}:view:${id}`;
  const cached = await this.cacheService.get<any>(key);
  if (cached) return cached;

  const vendor = await this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoin('vendor.officeAddress', 'officeAddress')
    .leftJoin('vendor.vendorSaleInfo', 'vendorSaleInfo')
    .leftJoin('vendor.vendorBankDetails', 'vendorBankDetails')
    .leftJoin('vendorBankDetails.branchAddress', 'branchAddress')
    .leftJoin('vendor.ref1Address', 'ref1Address')
    .leftJoin('vendor.ref2Address', 'ref2Address')
    .leftJoin('vendor.subcategory', 'subcategory')
    .leftJoin('vendor.category', 'category')
    .leftJoin('vendor.mainProduct', 'mainProduct')
    .leftJoin('vendor.listOfAllProducts', 'listOfAllProducts')
    .leftJoin('vendor.mainPackingMaterial', 'mainPackingMaterial')
    .leftJoin('vendor.listOfPackingMaterial', 'listOfPackingMaterial')
    .leftJoin('vendor.createdBy', 'createdBy')
    .select([
      'vendor.id', 'vendor.vendorCode', 'vendor.companyName', 'vendor.classification',
      'vendor.status', 'vendor.vendorGrade', 'vendor.paymentMode', 'vendor.creditTerms',
      'vendor.proposedPaymentTerms', 'vendor.otherProductOrService', 'vendor.dateOfIncorporation',
      'vendor.inFandVBusinessSince', 'vendor.dispatchCenter', 'vendor.warehouseLocations',
      'vendor.packingCenterLocation', 'vendor.tradeLicenseNumber', 'vendor.anyDetailsTeamAndInfra',
      'vendor.officeContactNo', 'vendor.officeEmail', 'vendor.website',
      'vendor.gstn', 'vendor.gstnCopy', 'vendor.ifGstnCopy',
      'vendor.panNo', 'vendor.panCardCopy', 'vendor.ifPanCardCopy',
      'vendor.msmeNo', 'vendor.msmeCopy', 'vendor.ifMsmeCopy',
      'vendor.ref1FName', 'vendor.ref1MName', 'vendor.ref1LName',
      'vendor.ref1PrimaryCNumb', 'vendor.ref1AltrCNumb', 'vendor.ref1Email',
      'vendor.ref2FName', 'vendor.ref2MName', 'vendor.ref2LName',
      'vendor.ref2PrimaryCNumb', 'vendor.ref2AltrCNumb', 'vendor.ref2Email',
      'vendor.createdAt',
      'officeAddress.address1', 'officeAddress.address2', 'officeAddress.location',
      'officeAddress.city', 'officeAddress.state', 'officeAddress.pincode',
      'vendorSaleInfo.contactFName', 'vendorSaleInfo.contactMName', 'vendorSaleInfo.contactLName',
      'vendorSaleInfo.directContactNumber', 'vendorSaleInfo.mobileNumber', 'vendorSaleInfo.email',
      'vendorBankDetails.beneficiaryFName', 'vendorBankDetails.beneficiaryMName', 'vendorBankDetails.beneficiaryLName',
      'vendorBankDetails.bankName', 'vendorBankDetails.typeOfAcc', 'vendorBankDetails.ifscCode',
      'vendorBankDetails.swiftNo', 'vendorBankDetails.invoiceCurrency',
      'vendorBankDetails.cancelledChequeCopy', 'vendorBankDetails.ifCancelledCheque','vendorBankDetails.bankCompanyName',
      'branchAddress.address1', 'branchAddress.address2', 'branchAddress.location',
      'branchAddress.city', 'branchAddress.state', 'branchAddress.pincode',
      'ref1Address.address1', 'ref1Address.address2', 'ref1Address.location',
      'ref1Address.city', 'ref1Address.state', 'ref1Address.pincode',
      'ref2Address.address1', 'ref2Address.address2', 'ref2Address.location',
      'ref2Address.city', 'ref2Address.state', 'ref2Address.pincode',
      'subcategory.name', 'category.name',
      'mainProduct.name', 'listOfAllProducts.name',
      'mainPackingMaterial.packagingMaterialName', 'listOfPackingMaterial.packagingMaterialName',
      'createdBy.firstName', 'createdBy.lastName',
    ])
    .where('vendor.id = :id', { id })
    .getOne();

  if (!vendor) throw new AppError(404, 'Vendor not found');

 

  if (!vendor) {
    throw new AppError(404, "Vendor not found");
  }

  const formattedResult = {
    id: vendor.id,
    vendorCode: vendor.vendorCode,
    companyName: vendor.companyName,
    classification: vendor.classification,
    status: vendor.status,

    category: vendor.category?.name || null,
    subcategory: vendor.subcategory?.name || null,

    vendorGrade: vendor.vendorGrade,
    paymentMode: vendor.paymentMode,
    creditTerms: vendor.creditTerms,
    proposedPaymentTerms: vendor.proposedPaymentTerms,
    otherProductOrService: vendor.otherProductOrService,

    // 🔹 Date formatting
    dateOfIncorporation: vendor.dateOfIncorporation,
      // ? format(new Date(vendor.dateOfIncorporation), "dd-MM-yyyy")
      // : null,
    inFandVBusinessSince: vendor.inFandVBusinessSince,

    // 🔹 Product relations
    mainProduct: vendor.mainProduct?.name || null,
     
    

    // 🔹 Packing material relations
    mainPackingMaterial: vendor.mainPackingMaterial?.packagingMaterialName || null,
     listOfPackingMaterial: vendor.listOfPackingMaterial?.map(p => p.packagingMaterialName),
     
  listOfAllProducts: vendor.listOfAllProducts?.map(p => p.name),



    dispatchCenter: vendor.dispatchCenter,
    warehouseLocations: vendor.warehouseLocations,
    packingCenterLocation: vendor.packingCenterLocation,
    tradeLicenseNumber: vendor.tradeLicenseNumber,
    anyDetailsTeamAndInfra: vendor.anyDetailsTeamAndInfra,

    // --- Office Details ---
    officeAddress: vendor.officeAddress
      ? {
          address1: vendor.officeAddress.address1,
          address2: vendor.officeAddress.address2,
          location: vendor.officeAddress.location,
          city: vendor.officeAddress.city,
          state: vendor.officeAddress.state,
          pincode: vendor.officeAddress.pincode,
        }
      : null,
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    website: vendor.website,

    // --- Tax and Regulatory Details ---
    gstn: vendor.gstn,
    gstnCopy: vendor.gstnCopy,
    ifGstnCopy: vendor.ifGstnCopy,
    panNo: vendor.panNo,
    panCardCopy: vendor.panCardCopy,
    ifPanCardCopy: vendor.ifPanCardCopy,
    msmeNo: vendor.msmeNo,
    msmeCopy: vendor.msmeCopy,
    ifMsmeCopy: vendor.ifMsmeCopy,

    // --- Contact Person (Vendor Sale Info) ---
    vendorSaleInfo: vendor.vendorSaleInfo
      ? {
          contactFName: vendor.vendorSaleInfo.contactFName,
          contactMName: vendor.vendorSaleInfo.contactMName,
          contactLName: vendor.vendorSaleInfo.contactLName,
          directContactNumber: vendor.vendorSaleInfo.directContactNumber,
          mobileNumber: vendor.vendorSaleInfo.mobileNumber,
          email: vendor.vendorSaleInfo.email,
        }
      : null,

    // --- Bank Details ---
    vendorBankDetails: vendor.vendorBankDetails
      ? {
          beneficiaryFName: vendor.vendorBankDetails.beneficiaryFName,
          beneficiaryMName: vendor.vendorBankDetails.beneficiaryMName,
          beneficiaryLName: vendor.vendorBankDetails.beneficiaryLName,
          bankName: vendor.vendorBankDetails.bankName,
          bankCompanyName:vendor.vendorBankDetails.bankCompanyName,
          typeOfAcc: vendor.vendorBankDetails.typeOfAcc,
          ifscCode: vendor.vendorBankDetails.ifscCode,
          swiftNo: vendor.vendorBankDetails.swiftNo,
          invoiceCurrency: vendor.vendorBankDetails.invoiceCurrency,
          cancelledChequeCopy: vendor.vendorBankDetails.cancelledChequeCopy,
          ifCancelledCheque: vendor.vendorBankDetails.ifCancelledCheque,
          branchAddress: vendor.vendorBankDetails.branchAddress
            ? {
                address1: vendor.vendorBankDetails.branchAddress.address1,
                address2: vendor.vendorBankDetails.branchAddress.address2,
                location: vendor.vendorBankDetails.branchAddress.location,
                city: vendor.vendorBankDetails.branchAddress.city,
                state: vendor.vendorBankDetails.branchAddress.state,
                pincode: vendor.vendorBankDetails.branchAddress.pincode,
              }
            : null,
        }
      : null,

    // --- Reference 1 ---
    
      ref1FName: vendor.ref1FName,
      ref1MName: vendor.ref1MName,
      ref1LName: vendor.ref1LName,
     ref1PrimaryCNumb: vendor.ref1PrimaryCNumb,
      ref1AltrCNumb :vendor.ref1AltrCNumb,
      ref1Email: vendor.ref1Email,
      ref1Address: vendor.ref1Address
        ? {
            address1: vendor.ref1Address.address1,
            address2: vendor.ref1Address.address2,
            location: vendor.ref1Address.location,
            city: vendor.ref1Address.city,
            state: vendor.ref1Address.state,
            pincode: vendor.ref1Address.pincode,
          }
        : null,
  

    // --- Reference 2 ---
    
      ref2FName: vendor.ref2FName,
      ref2MName: vendor.ref2MName,
      ref2LName: vendor.ref2LName,
      ref2PrimaryCNumb: vendor.ref2PrimaryCNumb,
      ref2AltrCNumb: vendor.ref2AltrCNumb,
      ref2Email: vendor.ref2Email,
      ref2Address: vendor.ref2Address
        ? {
            address1: vendor.ref2Address.address1,
            address2: vendor.ref2Address.address2,
            location: vendor.ref2Address.location,
            city: vendor.ref2Address.city,
            state: vendor.ref2Address.state,
            pincode: vendor.ref2Address.pincode,
          }
        : null,
  

    createdBy: vendor.createdBy?.firstName+' '+vendor.createdBy?.lastName,
    createdTime:formatDateTime(vendor.createdAt).createdTime,
    createdDate: formatDateTime(vendor.createdAt).createdDate,
      // ? {
      //     id: vendor.createdBy.id,
      //     username: vendor.createdBy.username,
      //     email: vendor.createdBy.email,
      //   }
      // : null,
  };

  await this.cacheService.set(key, formattedResult, CACHE_TTL_DETAIL);
  return formattedResult;
}


async getVendorByIdforupdate(id: string): Promise<VendorUpdateFormDto> {
  const key = `${CACHE_PREFIX}:update:${id}`;
  const cached = await this.cacheService.get<any>(key);
  if (cached) return cached;

  const vendor = await this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoin('vendor.officeAddress', 'officeAddress')
    .leftJoin('vendor.vendorSaleInfo', 'vendorSaleInfo')
    .leftJoin('vendor.vendorBankDetails', 'vendorBankDetails')
    .leftJoin('vendorBankDetails.branchAddress', 'branchAddress')
    .leftJoin('vendor.ref1Address', 'ref1Address')
    .leftJoin('vendor.ref2Address', 'ref2Address')
    .leftJoin('vendor.subcategory', 'subcategory')
    .leftJoin('vendor.category', 'category')
    .leftJoin('vendor.mainProduct', 'mainProduct')
    .leftJoin('vendor.listOfAllProducts', 'listOfAllProducts')
    .leftJoin('vendor.mainPackingMaterial', 'mainPackingMaterial')
    .leftJoin('vendor.listOfPackingMaterial', 'listOfPackingMaterial')
    .leftJoin('vendor.createdBy', 'createdBy')
    .select([
      'vendor.id', 'vendor.vendorCode', 'vendor.companyName', 'vendor.classification',
      'vendor.status', 'vendor.vendorGrade', 'vendor.paymentMode', 'vendor.creditTerms',
      'vendor.proposedPaymentTerms', 'vendor.otherProductOrService', 'vendor.dateOfIncorporation',
      'vendor.inFandVBusinessSince', 'vendor.dispatchCenter', 'vendor.warehouseLocations',
      'vendor.packingCenterLocation', 'vendor.tradeLicenseNumber', 'vendor.anyDetailsTeamAndInfra',
      'vendor.officeContactNo', 'vendor.officeEmail', 'vendor.website',
      'vendor.gstn', 'vendor.gstnCopy', 'vendor.ifGstnCopy',
      'vendor.panNo', 'vendor.panCardCopy', 'vendor.ifPanCardCopy',
      'vendor.msmeNo', 'vendor.msmeCopy', 'vendor.ifMsmeCopy',
      'vendor.ref1FName', 'vendor.ref1MName', 'vendor.ref1LName',
      'vendor.ref1PrimaryCNumb', 'vendor.ref1AltrCNumb', 'vendor.ref1Email',
      'vendor.ref2FName', 'vendor.ref2MName', 'vendor.ref2LName',
      'vendor.ref2PrimaryCNumb', 'vendor.ref2AltrCNumb', 'vendor.ref2Email',
      'vendor.createdAt',
     
      'officeAddress.address1', 'officeAddress.address2', 'officeAddress.location',
      'officeAddress.city', 'officeAddress.state', 'officeAddress.pincode',
      'vendorSaleInfo.contactFName', 'vendorSaleInfo.contactMName', 'vendorSaleInfo.contactLName',
      'vendorSaleInfo.directContactNumber', 'vendorSaleInfo.mobileNumber', 'vendorSaleInfo.email',
      'vendorBankDetails.beneficiaryFName', 'vendorBankDetails.beneficiaryMName', 'vendorBankDetails.beneficiaryLName',
      'vendorBankDetails.bankName', 'vendorBankDetails.typeOfAcc', 'vendorBankDetails.ifscCode',
      'vendorBankDetails.swiftNo', 'vendorBankDetails.invoiceCurrency',
      'vendorBankDetails.cancelledChequeCopy', 'vendorBankDetails.ifCancelledCheque','vendorBankDetails.bankCompanyName',
      'branchAddress.address1', 'branchAddress.address2', 'branchAddress.location',
      'branchAddress.city', 'branchAddress.state', 'branchAddress.pincode',
      'ref1Address.address1', 'ref1Address.address2', 'ref1Address.location',
      'ref1Address.city', 'ref1Address.state', 'ref1Address.pincode',
      'ref2Address.address1', 'ref2Address.address2', 'ref2Address.location',
      'ref2Address.city', 'ref2Address.state', 'ref2Address.pincode',
      'subcategory.id', 'category.id',
      'mainProduct.id', 'listOfAllProducts.id',
      'mainPackingMaterial.id', 'listOfPackingMaterial.id',
      'createdBy.id',
    ])
    .where('vendor.id = :id', { id })
    .getOne();

  if (!vendor) throw new AppError(404, 'Vendor not found');

  const { createdDate, createdTime } = formatDateTime(vendor.createdAt);
  const mapAddress = (addr: any) => addr ? {
    address1: addr.address1, address2: addr.address2, location: addr.location,
    city: addr.city, state: addr.state, pincode: addr.pincode,
  } : null;

  const formattedResult = {
    id: vendor.id,
    vendorCode: vendor.vendorCode,
    companyName: vendor.companyName,
    classification: vendor.classification,
    status: vendor.status,

    category: vendor.category?.id ?? null,
    subcategory: vendor.subcategory?.id ?? null,
    vendorGrade: vendor.vendorGrade,
    paymentMode: vendor.paymentMode,
    creditTerms: vendor.creditTerms,
    proposedPaymentTerms: vendor.proposedPaymentTerms,
    otherProductOrService: vendor.otherProductOrService,
    dateOfIncorporation: vendor.dateOfIncorporation,
    inFandVBusinessSince: vendor.inFandVBusinessSince,
    mainProduct: vendor.mainProduct?.id ?? null,
    listOfAllProducts: vendor.listOfAllProducts?.map(p => p.id) ?? [],
    mainPackingMaterial: vendor.mainPackingMaterial?.id ?? null,
    listOfPackingMaterial: vendor.listOfPackingMaterial?.map(p => p.id) ?? [],
    dispatchCenter: vendor.dispatchCenter,
    warehouseLocations: vendor.warehouseLocations,
    packingCenterLocation: vendor.packingCenterLocation,
    tradeLicenseNumber: vendor.tradeLicenseNumber,
    anyDetailsTeamAndInfra: vendor.anyDetailsTeamAndInfra,
    officeAddress: mapAddress(vendor.officeAddress),
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    website: vendor.website,
    gstn: vendor.gstn, gstnCopy: vendor.gstnCopy, ifGstnCopy: vendor.ifGstnCopy,
    panNo: vendor.panNo, panCardCopy: vendor.panCardCopy, ifPanCardCopy: vendor.ifPanCardCopy,
    msmeNo: vendor.msmeNo, msmeCopy: vendor.msmeCopy, ifMsmeCopy: vendor.ifMsmeCopy,
    vendorSaleInfo: vendor.vendorSaleInfo ? {
      contactFName: vendor.vendorSaleInfo.contactFName,
      contactMName: vendor.vendorSaleInfo.contactMName,
      contactLName: vendor.vendorSaleInfo.contactLName,
      directContactNumber: vendor.vendorSaleInfo.directContactNumber,
      mobileNumber: vendor.vendorSaleInfo.mobileNumber,
      email: vendor.vendorSaleInfo.email,
    } : null,
    vendorBankDetails: vendor.vendorBankDetails ? {
      beneficiaryFName: vendor.vendorBankDetails.beneficiaryFName,
      beneficiaryMName: vendor.vendorBankDetails.beneficiaryMName,
      beneficiaryLName: vendor.vendorBankDetails.beneficiaryLName,
      bankName: vendor.vendorBankDetails.bankName,
      bankCompanyName:vendor.vendorBankDetails.bankCompanyName,
      typeOfAcc: vendor.vendorBankDetails.typeOfAcc,
      ifscCode: vendor.vendorBankDetails.ifscCode,
      swiftNo: vendor.vendorBankDetails.swiftNo,
      invoiceCurrency: vendor.vendorBankDetails.invoiceCurrency,
      cancelledChequeCopy: vendor.vendorBankDetails.cancelledChequeCopy,
      ifCancelledCheque: vendor.vendorBankDetails.ifCancelledCheque,
      branchAddress: mapAddress(vendor.vendorBankDetails.branchAddress),
    } : null,
    ref1FName: vendor.ref1FName, ref1MName: vendor.ref1MName, ref1LName: vendor.ref1LName,
    ref1PrimaryCNumb: vendor.ref1PrimaryCNumb, ref1AltrCNumb: vendor.ref1AltrCNumb,
    ref1Email: vendor.ref1Email, ref1Address: mapAddress(vendor.ref1Address),
    ref2FName: vendor.ref2FName, ref2MName: vendor.ref2MName, ref2LName: vendor.ref2LName,
    ref2PrimaryCNumb: vendor.ref2PrimaryCNumb, ref2AltrCNumb: vendor.ref2AltrCNumb,
    ref2Email: vendor.ref2Email, ref2Address: mapAddress(vendor.ref2Address),
    createdBy: vendor.createdBy?.id ?? null,
    createdDate,
    createdTime,
  };

  await this.cacheService.set(key, formattedResult, CACHE_TTL_DETAIL);
  return formattedResult;
}
async createVendorWithExcel(fileUrl: string): Promise<any> {
  try {
    
    // First, download the file from DigitalOcean Spaces
    let fileBuffer: Buffer;
    
    if (fileUrl.startsWith('https://')) {
      // Extract the key from the URL
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Gets "single/filename"
      
      // Download file from Spaces
      fileBuffer = await this.getExcelFromSpaces(key);
    } else {
      // If it's already a local path or key, try to get it from Spaces
      fileBuffer = await this.getExcelFromSpaces(fileUrl);
    }
    
    // Read the Excel file from buffer instead of file path
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    // const vendorRepository = AppDataSource.getRepository(Vendor);

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

      if (jsonData.length < 2) {
        continue;
      }

      const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
        h ? String(h).trim() : `UNKNOWN`
      );

      const dataRows = jsonData.slice(1); // Skip header row

      for (const rowUntyped of dataRows) {
        if (!Array.isArray(rowUntyped) || rowUntyped.length === 0) continue;

        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = rowUntyped[index];
        });

        if (!rowData["Company Name"] || !rowData["Vendor Category"]) {
          continue;
        }


        //Checking category and subcategory
        let categoryEntity: any = null;
        let subCategoryEntity: any = null;
        
        const categoryName = rowData["Vendor Category"];
        
        const subCategoryName = rowData["Vendor Subcategory"];
        const isCategoryPresent = await this.vendorCategoryRepository.findOne({
          where: { name: categoryName },
        });
        
        if (!isCategoryPresent) {
          const createNewCategory = this.vendorCategoryRepository.create({
            name: rowData["Vendor Category"],
          });
          const saveCategory = await this.vendorCategoryRepository.save(createNewCategory);
          categoryEntity = saveCategory;

          const createSubCategory = await this.vendorSubcategoryRepository.create({
            name: rowData["Vendor Subcategory"],
            category: saveCategory,
          });
          const saveSubCategory = await this.vendorSubcategoryRepository.save(createSubCategory);
          subCategoryEntity = saveSubCategory;

        } else {
          categoryEntity = isCategoryPresent;
          
          const isSubCategoryPresent = await this.vendorSubcategoryRepository.findOne({
            where: { name: subCategoryName, category: { id: categoryEntity.id } },
          });

          if (!isSubCategoryPresent) {
            const createSubCategory = await this.vendorSubcategoryRepository.create({
              name: rowData["Vendor Subcategory"],
              category: categoryEntity,
            });
            const saveSubCategory = await this.vendorSubcategoryRepository.save(createSubCategory);
            subCategoryEntity = saveSubCategory;
          } else {
            subCategoryEntity = isSubCategoryPresent;
          }
        }



      const bulkYear = new Date().getFullYear();
      const bulkPrefix = `VENDOR${bulkYear}`;
      const lastBulkVendor = await this.vendorRepository
        .createQueryBuilder('vendor')
        .where('vendor.vendorCode LIKE :prefix', { prefix: `${bulkPrefix}%` })
        .orderBy('vendor.vendorCode', 'DESC')
        .getOne();
      let bulkNextNumber = 1;
      if (lastBulkVendor?.vendorCode) {
        const lastNum = parseInt(lastBulkVendor.vendorCode.slice(bulkPrefix.length), 10);
        if (!isNaN(lastNum)) bulkNextNumber = lastNum + 1;
      }
      const vendorCode = `${bulkPrefix}${String(bulkNextNumber).padStart(4, '0')}`;

        // --- Vendor Base ---
        const vendor = new Vendor();
        vendor.companyName = rowData["Company Name"];
        vendor.vendorCode = vendorCode;
        vendor.category = categoryEntity; // Assign the actual entity object
        vendor.subcategory = subCategoryEntity; // Assign the actual entity object
        vendor.inFandVBusinessSince = rowData["In FandV Business Since"];
        if (rowData["Date Of Incorporation"])
          vendor.dateOfIncorporation = new Date(rowData["Date Of Incorporation"]);
        
        // Handle Main Product lookup
        if (rowData["Main Product"]) {
          const mainProductName = rowData["Main Product"].trim();
          const mainProduct = await this.productRepository
            .createQueryBuilder('product')
            .where('LOWER(product.name) = LOWER(:name)', { name: mainProductName })
            .getOne();
          
          if (mainProduct) {
            vendor.mainProduct = mainProduct;
          } else {
            // Continue without setting mainProduct - it's nullable
          }
        }
        
        // Handle List of All Products (comma-separated string)
        if (rowData["List Of All Products"]) {
          const productNames = rowData["List Of All Products"].split(',').map((name: string) => name.trim());
          const products = [];
          
          for (const productName of productNames) {
            if (productName) {
              const product = await this.productRepository
                .createQueryBuilder('product')
                .where('LOWER(product.name) = LOWER(:name)', { name: productName })
                .getOne();
              
              if (product) {
                products.push(product);
              } else {
              }
            }
          }
          
          vendor.listOfAllProducts = products;
        }
        
        // Handle createdBy field if provided in Excel
        if (rowData['Created By']) {
          
          // Find user by name (case-insensitive search)
          const createdByName = rowData['Created By'].trim();
          const user = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(CONCAT(user.firstName, \' \', user.lastName)) = LOWER(:name)', { name: createdByName })
            .getOne();
          
          if (user) {
            vendor.createdBy = user;
          } else {
            // Continue without setting createdBy - it's nullable
          }
        }
        
        vendor.dispatchCenter = rowData["Dispatch Center"];
        vendor.warehouseLocations = rowData["Ware House Locations"];
        vendor.gstn = rowData["GSTN"];
        vendor.gstnCopy = rowData["GSTN_Copy"];
        vendor.ifGstnCopy = rowData["If_GSTN_Copy"];
        vendor.panNo = rowData["Pan_No"];
        vendor.panCardCopy = rowData["Pan_Card_Copy"];
        vendor.ifPanCardCopy = rowData["If_Pan_Card_Copy"];
        vendor.msmeNo = rowData["MSME_No"];
        vendor.msmeCopy = rowData["MSME_Copy"];
        vendor.ifMsmeCopy = rowData["If_MSME_Copy"];
        vendor.tradeLicenseNumber = rowData["Trade_License_Number"];
        vendor.proposedPaymentTerms = rowData["Proposed_Payment_Terms"];
        vendor.creditTerms = rowData["Credit Terms"];
        vendor.anyDetailsTeamAndInfra = rowData["Any Other Details Regarding Team And Infrastructure"];

        // --- Office Address ---
        const officeAddress = new Address();
        officeAddress.address1 = rowData["Office Address1"];
        officeAddress.address2 = rowData["Office Address2"];
        officeAddress.location = rowData["Office Location"];
        officeAddress.city = rowData["Office City"];
        officeAddress.state = rowData["Office State"];
        officeAddress.pincode = rowData["Office Pincode"];
        vendor.officeAddress = officeAddress;

        vendor.officeContactNo = rowData["Office Contact No"];
        vendor.officeEmail = rowData["Office Email"];
        vendor.website = rowData["Website"];

        // --- Contact Person ---
        const contact = new VendorSaleInfo();
        contact.contactFName = rowData["Contact First Name"];
        contact.contactMName = rowData["Contact Mddele Name"];
        contact.contactLName = rowData["Contact Last Name"];
        contact.directContactNumber = rowData["Direct Contact Number"];
        contact.mobileNumber = rowData["Mobile Number"];
        contact.email = rowData["Email"];
        vendor.vendorSaleInfo = contact;

        // --- Bank Details with Branch Address ---
        const bank = new BankDetailsvend();
        bank.beneficiaryFName = rowData["Beneficiary First Name"];
        bank.beneficiaryMName = rowData["Beneficiary Middle Name"];
        bank.beneficiaryLName = rowData["Beneficiary Last Name"];
        bank.bankName = rowData["Bank Name"];
        bank.typeOfAcc = rowData["Type Of Acc"];
        bank.ifscCode = rowData["Ifsc Code"];
        bank.swiftNo = rowData["Swift No"];
        bank.invoiceCurrency = rowData["Invoice Currency"];
        bank.cancelledChequeCopy = rowData["Cancelled Cheque Copy"];
        bank.ifCancelledCheque = rowData["If Cancelled Cheque"];

        const branchAddress = new Address();
        branchAddress.address1 = rowData["Branch Address1"];
        branchAddress.address2 = rowData["Branch Address2"];
        branchAddress.location = rowData["Branch Location"];
        branchAddress.city = rowData["Branch City"];
        branchAddress.state = rowData["Branch State"];
        branchAddress.pincode = rowData["Branch Pincode"];
        bank.branchAddress = branchAddress;

        vendor.vendorBankDetails = bank;

        // --- Reference 1 ---
       // const ref1 = new Reference();
        vendor.ref1FName = rowData["Ref1_First_Name"];
        vendor.ref1MName = rowData["Ref1_Middle_Name"];
        vendor.ref1LName = rowData["Ref1_Last_Name"];
        vendor.ref1PrimaryCNumb = rowData["Ref1_Primary_Contact_Number"];
        vendor.ref1AltrCNumb = rowData["Ref1_Alternative_Contact_Number"];
       // vendor.email = rowData["Ref1_Email"];

        const ref1Address = new Address();
        ref1Address.address1 = rowData["Ref1_Address1"];
        ref1Address.address2 = rowData["Ref1_Address2"];
        ref1Address.location = rowData["Ref1_Location"];
        ref1Address.city = rowData["Ref1_City"];
        ref1Address.state = rowData["Ref1_State"];
        ref1Address.pincode = rowData["Ref1_Pincode"];
        vendor.ref1Address = ref1Address;

        // --- Reference 2 ---
    //    const ref2 = new Reference();
        vendor.ref2FName = rowData["Ref2_First_Name"];
        vendor.ref2MName = rowData["Ref2_Middle_Name"];
        vendor.ref2LName = rowData["Ref2_Last_Name"];
        vendor.ref2PrimaryCNumb = rowData["Ref2_Primary_Contact_Number"];
        vendor.ref2AltrCNumb = rowData["Ref2_Alternative_Contact_Number"];
       // vendor.email = rowData["Ref2_Email"];

        const ref2Address = new Address();
        ref2Address.address1 = rowData["Ref2_Address1"];
        ref2Address.address2 = rowData["Ref2_Address2"];
        ref2Address.location = rowData["Ref2_Location"];
        ref2Address.city = rowData["Ref2_City"];
        ref2Address.state = rowData["Ref2_State"];
        ref2Address.pincode = rowData["Ref2_Pincode"];
        vendor.ref2Address = ref2Address;

      //  vendor.references = [ref1, ref2];
        const result = await this.vendorRepository.save(vendor);
      }
    }

    // 🗑️ Delete the file from DigitalOcean Spaces after successful processing
    await this.deleteFileFromSpaces(fileUrl);
    
  } catch (error) {
    
    // 🗑️ Still attempt to delete the file even if processing failed
    try {
      await this.deleteFileFromSpaces(fileUrl);
    } catch (deleteError) {
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
      return fileBuffer;
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${key}`);
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   * @param fileUrl - The full URL or key of the file to delete
   */
  private async deleteFileFromSpaces(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the full URL
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
    } catch (error) {
      // Don't throw error here to avoid breaking the main flow
    }
  }







  /**
   * Get available users for reference when uploading vendor data
   */

  //   const key = `${CACHE_PREFIX}:ref:users`;
  //   const cached = await this.cacheService.get<any>(key);
  //   if (cached) return cached;

  //   const users = await this.userRepository
  //     .createQueryBuilder('user')
  //     .select(['user.id', 'user.firstName', 'user.lastName'])
  //     .orderBy('user.firstName', 'ASC')
  //     .getMany();
    
  //   const result = users.map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}` }));
  //   await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
  //   return result;
  // }


//  public async getAllVendors1(queryOptions: PaginationOptions): Promise<any> {
//   const queryBuilder = this.vendorRepository
//     .createQueryBuilder('vendor')
//     .leftJoinAndSelect('vendor.createdBy', 'createdBy') // ✅ include who created
//     .leftJoinAndSelect('vendor.officeAddress', 'officeAddress')
//     .leftJoinAndSelect('vendor.vendorSaleInfo', 'vendorSaleInfo')
//     .leftJoinAndSelect('vendor.vendorBankDetails', 'vendorBankDetails')
//     .leftJoinAndSelect('vendor.ref1Address', 'ref1Address')
//     .leftJoinAndSelect('vendor.ref2Address', 'ref2Address')
//     .leftJoinAndSelect('vendor.subcategory', 'subcategory')
//     .leftJoinAndSelect('vendor.category', 'category')
//     .orderBy('vendor.createdAt', 'DESC');

//   const vendors = await buildQuery(queryBuilder, queryOptions, 'vendor');

  
//   const formattedData = vendors.data.map((vendor: any) => {
//     const { createdDate, createdTime } = formatDateTime(vendor.createdAt);

//     return {
//       ...vendor,
//       createdBy: `${vendor.createdBy?.firstName ?? ''} ${vendor.createdBy?.lastName ?? ''}`.trim(),
        
//       createdDate,
//       createdTime,
//       //createdAt: createdDate && createdTime ? `${createdDate} ${createdTime}` : null,
//     };
//   });

//   return {
//     ...vendors,
//     data: formattedData,
//   };
// }

public async getAllVendors1(queryOptions: PaginationOptions, userId: string): Promise<VendorListResponseDto> {
  // Fetch the user to check their role
  const user = await this.userRepository.findOneBy({ id: userId });
  const isPrivileged = user?.roles &&
    (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.VERIFIER));

  // Include userId in cache key so different users don't share results
  const hash = createHash('md5').update(JSON.stringify(queryOptions)).digest('hex');
  const key = `${CACHE_PREFIX}:list:${userId}:${hash}`;
  const cached = await this.cacheService.get<any>(key);
  if (cached) return cached;

  const queryBuilder = this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoin('vendor.createdBy', 'createdBy')
    .leftJoin('vendor.officeAddress', 'officeAddress')
    .leftJoin('vendor.mainProduct', 'mainProduct')
    .leftJoin('vendor.listOfAllProducts', 'listOfAllProducts')
    .leftJoin('vendor.mainPackingMaterial', 'mainPackingMaterial')
    .leftJoin('vendor.listOfPackingMaterial', 'listOfPackingMaterial')
    .leftJoin('vendor.subcategory', 'subcategory')
    .leftJoin('vendor.category', 'category')
    .select([
      'vendor.id', 'vendor.status', 'vendor.vendorCode', 'vendor.companyName',
      'vendor.officeContactNo', 'vendor.officeEmail', 'vendor.gstn', 'vendor.panNo',
      'vendor.msmeNo', 'vendor.tradeLicenseNumber', 'vendor.paymentMode',
      'vendor.proposedPaymentTerms', 'vendor.creditTerms', 'vendor.dispatchCenter',
      'vendor.warehouseLocations', 'vendor.packingCenterLocation', 'vendor.classification',
      'vendor.createdAt',
      'createdBy.firstName', 'createdBy.lastName',
      'officeAddress.location', 'officeAddress.city', 'officeAddress.state', 'officeAddress.pincode',
      'mainProduct.name',
      'listOfAllProducts.name',
      'mainPackingMaterial.packagingMaterialName',
      'listOfPackingMaterial.packagingMaterialName',
      'subcategory.name',
      'category.name',
    ])
    .orderBy('vendor.createdAt', 'DESC');

  // Non-privileged users only see vendors they created
  if (!isPrivileged) {
    queryBuilder.where('createdBy.id = :userId', { userId });
  }

  const vendors = await buildQuery(queryBuilder, queryOptions, 'vendor');

  const formattedData = vendors.data.map((vendor) => {
    const { createdDate, createdTime } = formatDateTime(vendor.createdAt);
    return {
      id: vendor.id,
      status: vendor.status,
      vendorCode: vendor.vendorCode?.toUpperCase() ?? '',
      companyName: vendor.companyName,
      category: vendor.category?.name ?? '',
      subcategory: vendor.subcategory?.name ?? '',
      officeAddress: vendor.officeAddress ? formatAddress(vendor.officeAddress) : '',
      officeContactNo: vendor.officeContactNo,
      officeEmail: vendor.officeEmail,
      gstn: vendor.gstn?.toUpperCase() ?? '',
      panNo: vendor.panNo?.toUpperCase() ?? '',
      msmeNo: vendor.msmeNo?.toUpperCase() ?? '',
      tradeLicenseNumber: vendor.tradeLicenseNumber?.toUpperCase() ?? '',
      paymentMode: vendor.paymentMode,
      proposedPaymentTerms: vendor.proposedPaymentTerms,
      creditTerms: vendor.creditTerms,
      dispatchCenter: vendor.dispatchCenter,
      warehouseLocations: vendor.warehouseLocations,
      packingCenterLocation: vendor.packingCenterLocation,
      classification: vendor.classification,
      mainProduct: vendor.mainProduct?.name ?? '',
      listOfAllProducts: vendor.listOfAllProducts?.map((p: Product) => p.name).join(',') ?? '',
      mainPackingMaterial: vendor.mainPackingMaterial?.packagingMaterialName ?? null,
      listOfPackingMaterial: vendor.listOfPackingMaterial?.map((p: PackingMaterial) => p.packagingMaterialName).join(',') ?? '',
      createdBy: `${vendor.createdBy?.firstName ?? ''} ${vendor.createdBy?.lastName ?? ''}`.trim(),
      createdDate,
      createdTime,
    };
  });

  const result = { ...vendors, data: formattedData };
  await this.cacheService.set(key, result, CACHE_TTL);
  return result;
}


  
  public async getAllVendor(subcategoryId?: string): Promise<VendorDropdownDto[]> {
    const key = `${CACHE_PREFIX}:dropdown:${subcategoryId || 'all'}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")

      .leftJoinAndSelect("vendor.category", "category") // Fixed extra space
      .leftJoin("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.officeContactNo",
        "vendor.email",
        "category.id",
        "subcategory.id",
        "vendor.vendorCode",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
      ]);

    // Add the filter condition if subcategoryId is provided
    if (subcategoryId) {
      queryBuilder.where("subcategory.id = :subcategoryId", { subcategoryId });
    }

    // Fetch data from the database
    const vendors = await queryBuilder.getMany();

    // Map the results to the desired format
    const result = vendors.map((vendor) => ({
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      email: vendor.officeEmail,
      subcategory: vendor.subcategory?.id || null,
      category: vendor.category?.id || null,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress
        ? {
            address1: vendor.officeAddress.address1,
            address2: vendor.officeAddress.address2,
            location: vendor.officeAddress.location,
            city: vendor.officeAddress.city,
            state: vendor.officeAddress.state,
            pincode: vendor.officeAddress.pincode,
          }
        : null,
    }));
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }






  async getAllVendors(): Promise<Vendor[]> {
    return this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .orderBy("vendor.createdAt", "DESC")
      .getMany();
  }




  public async updateVendor(
    id: string,
    vendorData: UpdateVendorDto & Record<string, any>,
    updateBy: string
  ): Promise<Vendor | null> {
    const vendor = await this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.ref1Address", "ref1Address")
      .leftJoinAndSelect("vendor.ref2Address", "ref2Address")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.vendorBankDetails", "vendorBankDetails")
      .leftJoinAndSelect("vendor.mainProduct", "mainProduct")
      .leftJoinAndSelect("vendor.listOfAllProducts", "listOfAllProducts")
      .leftJoinAndSelect("vendor.mainPackingMaterial", "mainPackingMaterial")
      .leftJoinAndSelect("vendor.listOfPackingMaterial", "listOfPackingMaterial")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .leftJoinAndSelect("vendor.category", "category")
      .where("vendor.id = :id", { id })
      .getOne();

    if (!vendor) return null;

    // ---- Addresses ----
    if (vendorData.officeAddress) {
      vendor.officeAddress = {
        ...vendor.officeAddress,
        ...vendorData.officeAddress,
      } as Address;
    }

    if (vendorData.ref1Address) {
      vendor.ref1Address = {
        ...vendor.ref1Address,
        ...vendorData.ref1Address,
      } as Address;
    }

    if (vendorData.ref2Address) {
      vendor.ref2Address = {
        ...vendor.ref2Address,
        ...vendorData.ref2Address,
      } as Address;
    }

    // ---- Sale Info ----
    if (vendorData.vendorSaleInfo) {
      vendor.vendorSaleInfo = {
        ...vendor.vendorSaleInfo,
        ...vendorData.vendorSaleInfo,
      } as VendorSaleInfo;
    }

    // ---- Bank Details ----
    if (vendorData.vendorBankDetails) {
      vendor.vendorBankDetails = {
        ...vendor.vendorBankDetails,
        ...vendorData.vendorBankDetails,
      } as BankDetailsvend;
    }

    // ---- Main Product ----
    if (vendorData.mainProduct) {
      const mainProductId = (vendorData.mainProduct as any)?.id || vendorData.mainProduct;
      if (mainProductId && typeof mainProductId === 'string') {
        const foundProduct = await this.productRepository.findOneBy({ id: mainProductId });
        if (foundProduct) vendor.mainProduct = foundProduct;
      }
    }

    // ---- List of All Products ----
    if (vendorData.listOfAllProducts?.length) {
      const productIds = vendorData.listOfAllProducts.map((p: any) => p?.id || p).filter(Boolean);
      vendor.listOfAllProducts = await this.productRepository.findBy({
        id: In(productIds),
      });
    }

    // ---- Main Packing Material ----
    if ((vendorData as any).mainPackingMaterial) {
      const pmId = (vendorData as any).mainPackingMaterial?.id || (vendorData as any).mainPackingMaterial;
      if (pmId && typeof pmId === 'string') {
        const foundPM = await this.packingMaterialRepository.findOneBy({ id: pmId });
        if (foundPM) vendor.mainPackingMaterial = foundPM;
      }
    }

    // ---- List of Packing Materials ----
    if ((vendorData as any).listOfPackingMaterial?.length) {
      const pmIds = (vendorData as any).listOfPackingMaterial.map((p: any) => p?.id || p).filter(Boolean);
      vendor.listOfPackingMaterial = await this.packingMaterialRepository.findBy({ id: In(pmIds) });
    }

    // ---- Category / Subcategory ----
    if ((vendorData as any).category) {
      const catId = (vendorData as any).category?.id || (vendorData as any).category;
      if (catId && typeof catId === 'string') {
        vendor.category = { id: catId } as any;
      }
    }
    if ((vendorData as any).subcategory) {
      const subId = (vendorData as any).subcategory?.id || (vendorData as any).subcategory;
      if (subId && typeof subId === 'string') {
        vendor.subcategory = { id: subId } as any;
      }
    }

    // ---- Simple fields ----
    // Exclude nested relation fields that were already handled above
    const {
      officeAddress,
      ref1Address,
      ref2Address,
      vendorSaleInfo,
      vendorBankDetails,
      mainProduct,
      listOfAllProducts,
      mainPackingMaterial,
      listOfPackingMaterial,
      subcategory,
      category,
      ...simpleFields
    } = vendorData as any;
    Object.assign(vendor, simpleFields);

    // Save everything
    const saved = await this.vendorRepository.save(vendor);
    await this.invalidateVendorCache(id);
    return saved;
  }


  async deleteVendor(id: string): Promise<boolean> {
    // Step 1: Find the vendor by ID
    const vendor = await this.vendorRepository.findOne({ where: { id } });

    // Step 2: If the vendor doesn't exist, return false
    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion

    // Step 4: Set the deletionScheduledAt field and null out vendorCode
    // to free the unique constraint slot so the code is never re-blocked.
    vendor.deletionScheduledAt = sixMonthsFromNow;
    vendor.vendorCode = null as any;
    await this.vendorRepository.save(vendor);
    await this.invalidateVendorCache(id);
    return true;
  }




  async getAllVendorsbyfilter(queryOptions: PaginationOptions): Promise<any> {
    const hash = createHash('md5').update(JSON.stringify(queryOptions)).digest('hex');
    const key = `${CACHE_PREFIX}:filter:${hash}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.vendorRepository
    .createQueryBuilder("vendor")
    .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
    .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
    .leftJoinAndSelect("vendor.category", "category")
    .leftJoinAndSelect("vendor.subcategory", "subcategory")
    .leftJoin("vendor.createdBy", "createdBy")
    .select([
      "vendor.id",
      "vendor.companyName",
      "vendor.vendorCode",
      "vendor.officeContactNo",
      "vendor.officeEmail",
      "vendor.paymentMode",
      "vendor.proposedPaymentTerms",
      "vendor.creditTerms",
      "vendor.status",
      "createdBy.firstName",
      "createdBy.lastName",
      "category.name",
      "subcategory.name",
      "vendorSaleInfo.contactFName",
      "vendorSaleInfo.contactMName",
      "vendorSaleInfo.contactLName",
      "officeAddress.id",
      "officeAddress.address1",
      "officeAddress.address2",
      "officeAddress.location",
      "officeAddress.city",
      "officeAddress.state",
      "officeAddress.pincode",
    ]);

  // Use your reusable buildQuery function
  const result = await buildQuery(queryBuilder, queryOptions, "vendor");

  // Map final result with custom formatting
  const transformed = result.data.map((vendor: any) => ({
    id: vendor.id,
    companyName: vendor.companyName,
    vendorCode: vendor.vendorCode,
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    status: vendor.status || null,
    createdBy: vendor.createdBy
      ? `${vendor.createdBy.firstName || ''} ${vendor.createdBy.lastName || ''}`.trim() || null
      : null,
    paymentMode: vendor.paymentMode || null,
    proposedPaymentTerms: vendor.proposedPaymentTerms || null,
    creditTerms: vendor.creditTerms || null,
    contactPersonName: vendor.vendorSaleInfo
      ? `${vendor.vendorSaleInfo.contactFName || ""} ${vendor.vendorSaleInfo.contactMName || ""} ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
      : null,
    officeAddress: vendor.officeAddress,
    category: vendor.category?.name || null,
    subcategory: vendor.subcategory?.name || null,
  }));

  const finalResult = {
    data: transformed,
    meta: result.meta,
  };
  await this.cacheService.set(key, finalResult, CACHE_TTL);
  return finalResult;
}


  async getVendorByIdWithFilter(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:filter:id:v2:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const qb = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.category", "category")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .leftJoinAndSelect("vendor.createdBy", "createdBy")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.vendorCode",
        "vendor.officeContactNo",
        "vendor.officeEmail",
        "vendor.paymentMode",
        "vendor.proposedPaymentTerms",
        "vendor.creditTerms",
        "vendor.status",
        "category.name",
        "subcategory.name",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
        "createdBy.id",
        "createdBy.firstName",
        "createdBy.lastName",
      ]);

    if (isUuid) {
      qb.where("vendor.id = :id", { id });
    } else {
      qb.where("LOWER(vendor.companyName) = LOWER(:name)", { name: id });
    }

    const vendor = await qb.getOne();
    if (!vendor) return null;

    const result = {
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      officeEmail: vendor.officeEmail,
      paymentMode: vendor.paymentMode ?? null,
      proposedPaymentTerms: vendor.proposedPaymentTerms ?? null,
      creditTerms: vendor.creditTerms ?? null,
      status: vendor.status ?? null,
      createdBy: vendor.createdBy
        ? `${vendor.createdBy.firstName || ""} ${vendor.createdBy.lastName || ""}`.trim()
        : null,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress,
      category: vendor.category?.name || null,
      subcategory: vendor.subcategory?.name || null,
    };
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }




  async getAllVendorsbyquery(filter: string): Promise<any[]> {
    const query = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.category", "category")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.vendorCode",
        "vendor.officeContactNo",
        "vendor.officeEmail",
        "category.name",
        "subcategory.name",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
      ]);
  
    // Apply filtering only if 'filter' is provided
    if (filter) {
      query.where("vendor.companyName ILIKE :filter", { filter: `%${filter}%` });
    }
  
    const vendors = await query.getMany();
  
    return vendors.map((vendor) => ({
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      officeEmail: vendor.officeEmail,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress,
      category: vendor.category?.name || null,
      subcategory: vendor.subcategory?.name || null,
    }));
  }


async softDeleteVendors(vendorIds: string[]) {
  // Null out vendorCode before soft-deleting so the unique constraint
  // slot is freed and the code can be reused (or at least not block new inserts).
  await this.vendorRepository
    .createQueryBuilder()
    .update(Vendor)
    .set({ vendorCode: () => 'NULL' })
    .where('id IN (:...ids)', { ids: vendorIds })
    .execute();

  const result = await this.vendorRepository.softDelete({
    id: In(vendorIds)
  });
  await this.invalidateVendorCache();
  return result;
}



}


  // async getAllVendorsbyfilter(): Promise<any[]> {
  //   const vendors = await this.vendorRepository
  //     .createQueryBuilder("vendor")
  //     .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo") // Fixed alias
  //     .leftJoinAndSelect("vendor.officeAddress", "officeAddress") // Fixed alias
  //     .leftJoinAndSelect("vendor.category", "category") // Fixed alias
  //     .leftJoinAndSelect("vendor.subcategory", "subcategory") // Fixed alias
  //     .select([
  //       "vendor.id",
  //       "vendor.companyName",
  //       "vendor.vendorCode",
  //       "vendor.officeContactNo",
  //       "vendor.officeEmail",
  //       "category.name",
  //       "subcategory.name",
  //       "vendorSaleInfo.contactFName",
  //       "vendorSaleInfo.contactMName",
  //       "vendorSaleInfo.contactLName",
  //       "officeAddress.id", // Ensure this alias matches the join
  //       "officeAddress.address1",
  //       "officeAddress.address2",
  //       "officeAddress.location",
  //       "officeAddress.city",
  //       "officeAddress.state",
  //       "officeAddress.pincode",
  //     ])
  //     .getMany();

  //   return vendors.map((vendor) => ({
  //     id: vendor.id,
  //     companyName: vendor.companyName,
  //     vendorCode: vendor.vendorCode,
  //     officeContactNo: vendor.officeContactNo,
  //     officeEmail: vendor.officeEmail,
  //     contactPersonName: vendor.vendorSaleInfo
  //       ? `${vendor.vendorSaleInfo.contactFName || ""} ${
  //           vendor.vendorSaleInfo.contactMName || ""
  //         } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
  //       : null,
  //     officeAddress: vendor.officeAddress,
  //     category: vendor.category || null,
  //     subcategory: vendor.subcategory?.name || null,
  //   }));
  // }


  // async createVendor(vendorDto: any): Promise<any> {
  //   // Create the new Vendor entity
  //   //vendorDto.officeAddress = JSON.parse(vendorDto.officeAddress);
  //   const newVendor = this.vendorRepository.create(vendorDto);
  //   // Save the new Vendor to the database
  //   return await this.vendorRepository.save(newVendor);
  // }

  // async updateVendor(
  //   id: string,
  //   vendorData: UpdateVendor,
  //   updatedBy: string
  // ): Promise<Vendor | null> {
  //   // Step 1: Retrieve the existing vendor to capture the original data
  //   const vendor = await this.vendorRepository.findOne({
  //     where: { id },
  //     relations: [
  //       "officeAddress",
  //       "vendorSaleInfo",
  //       "vendorBankDetails",
  //       "ref1Address",
  //       "ref2Address",
  //       "subcategory",
  //       "category",
  //     ],
  //   });

  //   if (!vendor) {
  //     throw new AppError(404, "Vendor not found");
  //   }

  //   // Step 2: Capture the original vendor data for audit purposes
  //   const originalVendor = { ...vendor };

  //   // Step 3: Update the address if provided
  //   if (vendorData.address) {
  //     if (vendor.officeAddress) {
  //       // Update existing address
  //       const updatedAddress = await this.addressService.update(
  //         vendor.officeAddress.id,
  //         vendorData.address
  //       );
  //     }
  //   }

  //   // Step 4: Update vendor fields
  //   Object.assign(vendor, vendorData);

  //   // Step 5: Save the updated vendor
  //   const updatedVendor = await this.vendorRepository.save(vendor);

  //   // Step 6: Log the change using the audit log service
  //   await this.auditLogService.logChange(
  //     "Vendor", // Entity name
  //     id, // Entity ID
  //     originalVendor, // Original data (before update)
  //     updatedVendor, // Updated data (after update)
  //     updatedBy // User who made the update
  //   );

  //   // Step 7: Return the updated vendor
  //   return updatedVendor;
  // }


  // async getAvailableUsers(): Promise<{ id: string; name: string }[]> {


  // /**
  //  * Get available products for reference when uploading vendor data
  //  */
  // async getAvailableProducts(): Promise<{ id: string; name: string }[]> {
  //   const key = `${CACHE_PREFIX}:ref:products`;
  //   const cached = await this.cacheService.get<any>(key);
  //   if (cached) return cached;

  //   const products = await this.productRepository
  //     .createQueryBuilder('product')
  //     .select(['product.id', 'product.name'])
  //     .orderBy('product.name', 'ASC')
  //     .getMany();
    
  //   const result = products.map(product => ({ id: product.id, name: product.name }));
  //   await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
  //   return result;
  // }


  // /**
  //  * Get available vendor subcategories for reference when uploading vendor data
  //  */
  // async getAvailableVendorSubcategories(categoryId?: string): Promise<{ id: string; name: string; categoryName: string }[]> {
  //   const key = `${CACHE_PREFIX}:ref:subcategories:${categoryId || 'all'}`;
  //   const cached = await this.cacheService.get<any>(key);
  //   if (cached) return cached;

  //   const queryBuilder = this.vendorSubcategoryRepository
  //     .createQueryBuilder('subcategory')
  //     .leftJoinAndSelect('subcategory.category', 'category')
  //     .select(['subcategory.id', 'subcategory.name', 'category.name'])
  //     .orderBy('category.name', 'ASC')
  //     .addOrderBy('subcategory.name', 'ASC');
    
  //   if (categoryId) {
  //     queryBuilder.where('category.id = :categoryId', { categoryId });
  //   }
    
  //   const subcategories = await queryBuilder.getMany();
  //   const result = subcategories.map(subcategory => ({
  //     id: subcategory.id,
  //     name: subcategory.name,
  //     categoryName: subcategory.category?.name || 'Unknown'
  //   }));
  //   await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
  //   return result;
  // }


  // /**
  //  * Get available vendor categories for reference when uploading vendor data
  //  */
  // async getAvailableVendorCategories(): Promise<{ id: string; name: string }[]> {
  //   const key = `${CACHE_PREFIX}:ref:categories`;
  //   const cached = await this.cacheService.get<any>(key);
  //   if (cached) return cached;

  //   const categories = await this.vendorCategoryRepository
  //     .createQueryBuilder('category')
  //     .select(['category.id', 'category.name'])
  //     .orderBy('category.name', 'ASC')
  //     .getMany();
    
  //   const result = categories.map(category => ({ id: category.id, name: category.name }));
  //   await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
  //   return result;
  // }


//   async filterVendors(filters: VendorFilterDto) {
//   const {
//     classification,
//     categoryId,
//     subcategoryId,
//     pincode,
//     city,
//     state,
//     productId,
//     page,
//     limit,
//   } = filters;

//   const query = this.vendorRepository
//     .createQueryBuilder('vendor')
//     .leftJoinAndSelect('vendor.category', 'category')
//     .leftJoinAndSelect('vendor.subcategory', 'subcategory')
//     .leftJoinAndSelect('vendor.officeAddress', 'officeAddress')
//     .leftJoinAndSelect('vendor.mainProduct', 'mainProduct')
//     .leftJoinAndSelect('vendor.listOfAllProducts', 'listOfAllProducts')
//     .where('1=1');

//   // ✅ Apply filters dynamically
//   if (classification) query.andWhere('vendor.classification = :classification', { classification });
//   if (categoryId) query.andWhere('category.id = :categoryId', { categoryId });
//   if (subcategoryId) query.andWhere('subcategory.id = :subcategoryId', { subcategoryId });
//   if (pincode) query.andWhere('officeAddress.pincode ILIKE :pincode', { pincode: `%${pincode}%` });
//   if (city) query.andWhere('officeAddress.city ILIKE :city', { city: `%${city}%` });
//   if (state) query.andWhere('officeAddress.state ILIKE :state', { state: `%${state}%` });
//   if (productId) {
//     query.andWhere('(mainProduct.id = :productId OR listOfAllProducts.id = :productId)', { productId });
//   }

//   query.orderBy('vendor.createdAt', 'DESC');

//   // ✅ If pagination params are provided
//   if (page && limit) {
//     const skip = (page - 1) * limit;
//     const [vendors, total] = await query.skip(skip).take(limit).getManyAndCount();

//     return {
//       data: vendors,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   }

  
// }


  // public async getvendorwithid(id?: string): Promise<any> {
  //   const key = `${CACHE_PREFIX}:withid:${id || 'all'}`;
  //   const cached = await this.cacheService.get<any>(key);
  //   if (cached) return cached;

  //   const queryBuilder = this.vendorRepository
  //     .createQueryBuilder("vendor")
  //     .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
  //     .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
  //     .leftJoinAndSelect("vendor.category", "category")
  //     .leftJoinAndSelect("vendor.subcategory", "subcategory")
  //     .select([
  //       "vendor.id",
  //       "vendor.companyName",
  //       "vendor.officeContactNo",
  //       "vendor.email",
  //       "vendor.vendorCode",
  //       "officeAddress.id",
  //       "officeAddress.address1",
  //       "officeAddress.address2",
  //       "officeAddress.location",
  //       "officeAddress.city",
  //       "officeAddress.state",
  //       "officeAddress.pincode",
  //       "vendorSaleInfo.contactFName",
  //       "vendorSaleInfo.contactMName",
  //       "vendorSaleInfo.contactLName",
  //       "category.id",
  //       "subcategory.id",
  //     ]);

  //   if (id) {
  //     queryBuilder.where("vendor.id = :id", { id });
  //   }

  //   const vendor = await queryBuilder.getOne();
  //   if (!vendor) return null;

  //   const result = {
  //     id: vendor.id,
  //     companyName: vendor.companyName,
  //     officeContactNo: vendor.officeContactNo,
  //     email: vendor.officeEmail,
  //     vendorCode: vendor.vendorCode,
  //     officeAddress: vendor.officeAddress
  //       ? {
  //           id: vendor.officeAddress.id,
  //           address1: vendor.officeAddress.address1,
  //           address2: vendor.officeAddress.address2,
  //           location: vendor.officeAddress.location,
  //           city: vendor.officeAddress.city,
  //           state: vendor.officeAddress.state,
  //           pincode: vendor.officeAddress.pincode,
  //         }
  //       : null,
  //     contactPersonName: vendor.vendorSaleInfo
  //       ? `${vendor.vendorSaleInfo.contactFName || ""} ${
  //           vendor.vendorSaleInfo.contactMName || ""
  //         } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
  //       : null,
  //     category: vendor.category?.id || null,
  //     subcategory: vendor.subcategory?.id || null,
  //   };
  //   await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
  //   return result;
  // }


  // async getVendorByVendorName(companyName: string): Promise<Vendor | null> {
  //   const vendor = await this.vendorRepository
  //     .createQueryBuilder("vendor")
  //     .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
  //     .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
  //     .leftJoinAndSelect("vendor.vendorBankDetails", "vendorBankDetails")
  //     .leftJoinAndSelect("vendorBankDetails.branchAddress", "branchAddress")
  //     .leftJoinAndSelect("vendor.ref1Address", "ref1Address")
  //     .leftJoinAndSelect("vendor.ref2Address", "ref2Address")
  //     .leftJoinAndSelect("vendor.subcategory", "subcategory")
  //     .leftJoinAndSelect("vendor.category", "category")
  //     .where("vendor.companyName = :companyName", { companyName })
  //     .getOne();

  //   if (!vendor) throw new AppError(404, "Vendor not found");
  //   return vendor;
  // }


  // async getVendorByVendorCode(vendorCode: string): Promise<Vendor | null> {
  //   const vendor = await this.vendorRepository
  //     .createQueryBuilder("vendor")
  //     .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
  //     .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
  //     .leftJoinAndSelect("vendor.vendorBankDetails", "vendorBankDetails")
  //     .leftJoinAndSelect("vendorBankDetails.branchAddress", "branchAddress")
  //     .leftJoinAndSelect("vendor.ref1Address", "ref1Address")
  //     .leftJoinAndSelect("vendor.ref2Address", "ref2Address")
  //     .leftJoinAndSelect("vendor.subcategory", "subcategory")
  //     .leftJoinAndSelect("vendor.category", "category")
  //     .where("vendor.vendorCode = :vendorCode", { vendorCode })
  //     .getOne();

  //   if (!vendor) throw new AppError(404, "Vendor not found");
  //   return vendor;
  // }

