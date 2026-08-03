import { inject, injectable } from 'inversify';
import * as XLSX from 'xlsx';
import { DataSource, In } from 'typeorm';
import { CustomerRepository } from '../repository/customer.repository';
import { Customer } from '../entity/customer.entity';

import AppError from '../../../utils/appError';
import { TYPES } from '../../../types';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../../../middleware/spaces.config';

import { buildQuery, PaginationOptions } from '../../../utils/pagination';
import { OfficeUseOnly } from '../entity/officeUseOnlyCust.entity';

import { keyMobileNoData } from '../entity/keyMobileNoCust.entity';
import { ProductSpecification } from '../entity/productSpecificationCust.entity';
import { BankDetailsCust } from '../entity/bankDetailsCust.entity';
import { StatutoryDetails } from '../entity/statutoryCust.entity';
import { BillingDetailsCust } from '../entity/billingdetailsCust.entity';
import { DeliveryDetails } from '../entity/deliveryDetailsCust.entity';
import { PaymentTerms } from '../entity/paymentDetailsCust.entity';
import { generateIncrementalCode } from '../../../utils/codeGeneration';
import { UserRepository } from '../../../employee/repository/user.repository';
;
import { Status } from '../../../utils/status.enum';
import { formatDateTime } from '../../../utils/dateUtils';
import { CacheService } from '../../../global/cache.service';
import { CreateCustomerDto, CustomerListResponseDto, CustomerViewResponseDto, PaginatedResponse } from '../dtos/createCustomer.dto';
import { CustomerCategoryService } from '../../customerCategory/service/customerCategory.service';
import { CustomerTypeService } from '../../customerType/service/customerType.service';
import { AddressService } from '../../../address/service/address.service';
import { AuditLogService } from '../../../employeeActivity/service/auditLog.service';
import { Role } from '../../../employee/entity/user.entity';
import { CustomerCategory } from '../../customerCategory/entity/customerCategory.entity';
import { CustomerType } from '../../customerType/entity/customerType.entity';
import { Address } from '../../../address/entity/address.entity';

const CACHE_PREFIX = 'customer';
const CACHE_TTL = 180;       // 3 min for lists
const CACHE_TTL_DETAIL = 300; // 5 min for detail views

@injectable()
export class CustomerService {
  private customerRepository: CustomerRepository;
  private customerCategoryService: CustomerCategoryService;
  private customerTypeService: CustomerTypeService;
  private addressService: AddressService;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.CustomerCategoryService)
    customerCategoryService: CustomerCategoryService,
    @inject(TYPES.CustomerTypeService) customerTypeService: CustomerTypeService,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.AddressService) addressService: AddressService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {
    this.customerRepository = this.dataSource.getRepository(Customer) as CustomerRepository;
    this.customerCategoryService = customerCategoryService;
    this.customerTypeService = customerTypeService;
    this.addressService = addressService;
  }

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateCustomerCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
      this.cacheService.del(`${CACHE_PREFIX}:names`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:view:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:update:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:filter:${id}`),
      );
    }
    await Promise.all(tasks);
  }


  //TODo:New Code 
  public async create(customerData: CreateCustomerDto): Promise<Customer> {
    console.log('in the service', customerData);

    return await this.dataSource.transaction(async (manager) => {
      // Validate user exists
      const user = await this.userRepository.findOneBy({
        id: customerData.createdBy,
      });
      
      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Set status to draft regardless of role - must go through submit → pending → approve flow
      //customerData.status = Status.DRAFT;

      // If the logged-in user is an admin or verifier, bypass the approval flow and set status to approved directly
      if (user.roles && (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.VERIFIER))) {
        customerData.status = Status.APPROVED;
      }
      else{
        customerData.status = Status.PENDING;
      }

      // Generate customer code using raw SQL to bypass soft-delete filter
      const custYear = new Date().getFullYear();
      const custPrefix = `CUST${custYear}`;
      const lastCustCode = await this.customerRepository.query(
        `SELECT customercode FROM customers WHERE customercode LIKE $1 ORDER BY customercode DESC LIMIT 1`,
        [`${custPrefix}%`]
      );
      let custNext = 1;
      if (lastCustCode.length > 0 && lastCustCode[0].customercode) {
        const lastNum = parseInt(lastCustCode[0].customercode.slice(custPrefix.length), 10);
        if (!isNaN(lastNum)) custNext = lastNum + 1;
      }
      customerData.customerCode = `${custPrefix}${String(custNext).padStart(4, '0')}`;

      // Create main customer entity
      const customer = new Customer();
      customer.organisationName = customerData.organisationName;
      customer.customerImage = customerData.customerImage;
      customer.organisationType = customerData.organisationType;
      customer.otherType = customerData.otherType??"";
      customer.primaryContactNo = customerData.primaryContactNo;
      customer.secondaryContactNo = customerData.secondaryContactNo??"";
      customer.emailPrimary = customerData.emailPrimary;
      customer.emailSecondary = customerData.emailSecondary??"";
      customer.customerCode = customerData.customerCode;
      customer.status = customerData.status;
      customer.createdBy = user;

      // Handle customer category
      if (customerData.customerCategory) {
        const category = await manager.findOne(CustomerCategory, {
          where: { id: customerData.customerCategory }
        });
        if (category) {
          customer.customerCategory = category;
        }
      }

      // Handle customer type
      if (customerData.customerTypes) {
        const type = await manager.findOne(CustomerType, {
          where: { id: customerData.customerTypes }
        });
        if (type) {
          customer.customerTypes = type;
        }
      }

      // Create and save customer address
      if (customerData.customerAddress) {
        const address = new Address();
        Object.assign(address, customerData.customerAddress);
        const savedAddress = await manager.save(Address, address);
        customer.customerAddress = savedAddress;
      }

      // Create and save bank details
      if (customerData. bankDetails ) {
        const bankData = customerData.bankDetails 
        const bankDetails = new BankDetailsCust();
        Object.assign(bankDetails, bankData);
        
        // Handle bank address if provided
        if (bankData.bankAddress) {
          const bankAddress = new Address();
          Object.assign(bankAddress, bankData.bankAddress);
          const savedBankAddress = await manager.save(Address, bankAddress);
          bankDetails.bankAddress = savedBankAddress;
        }
        
        const savedBankDetails = await manager.save(BankDetailsCust, bankDetails);
        customer.bankDetails = savedBankDetails;
      }

      // Create and save statutory details
      if (customerData.statutoryDetails) {
        const statutory = new StatutoryDetails();
        Object.assign(statutory, customerData.statutoryDetails);
        const savedStatutory = await manager.save(StatutoryDetails, statutory);
        customer.statutoryDetails = savedStatutory;
      }

      // Create and save billing details
      if (customerData.billingDetails) {
        const billing = new BillingDetailsCust();
        Object.assign(billing, customerData.billingDetails);
        
        // Handle billing address if provided
        if (customerData.billingDetails.billingAddress) {
          const billingAddress = new Address();
          Object.assign(billingAddress, customerData.billingDetails.billingAddress);
          const savedBillingAddress = await manager.save(Address, billingAddress);
          billing.billingAddress = savedBillingAddress;
        }
        
        const savedBilling = await manager.save(BillingDetailsCust, billing);
        customer.billingDetails = savedBilling;
      }

      // Create and save delivery details
      if (customerData.deliveryDetails) {
        const delivery = new DeliveryDetails();
        Object.assign(delivery, customerData.deliveryDetails);
        
        // Handle delivery address if provided
        if (customerData.deliveryDetails.deliveryAddress) {
          const deliveryAddress = new Address();
          Object.assign(deliveryAddress, customerData.deliveryDetails.deliveryAddress);
          const savedDeliveryAddress = await manager.save(Address, deliveryAddress);
          delivery.deliveryAddress = savedDeliveryAddress;
        }
        
        const savedDelivery = await manager.save(DeliveryDetails, delivery);
        customer.deliveryDetails = savedDelivery;
      }

      // Create and save payment terms
      if (customerData.paymentTerms) {
        const payment = new PaymentTerms();
        Object.assign(payment, customerData.paymentTerms);
        const savedPayment = await manager.save(PaymentTerms, payment);
        customer.paymentTerms = savedPayment;
      }

      // Create and save office use only
      if (customerData.officeUseOnly) {
        const office = new OfficeUseOnly();
        Object.assign(office, customerData.officeUseOnly);
        const savedOffice = await manager.save(OfficeUseOnly, office);
        customer.officeUseOnly = savedOffice;
      }

      // Create and save key mobile numbers
      if (customerData.keyMobileNumbers) {
        const keyMobile = new keyMobileNoData();
        Object.assign(keyMobile, customerData.keyMobileNumbers);
        
        // Handle ref1 address if provided
        if (customerData.keyMobileNumbers.ref1Address) {
          const ref1Address = new Address();
          Object.assign(ref1Address, customerData.keyMobileNumbers.ref1Address);
          const savedRef1Address = await manager.save(Address, ref1Address);
          keyMobile.ref1Address = savedRef1Address;
        }
        
        // Handle ref2 address if provided
        if (customerData.keyMobileNumbers.ref2Address) {
          const ref2Address = new Address();
          Object.assign(ref2Address, customerData.keyMobileNumbers.ref2Address);
          const savedRef2Address = await manager.save(Address, ref2Address);
          keyMobile.ref2Address = savedRef2Address;
        }
        
        const savedKeyMobile = await manager.save(keyMobileNoData, keyMobile);
        customer.keyMobileNumbers = savedKeyMobile;
      }

      // Save the main customer entity
      const savedCustomer = await manager.save(Customer, customer);

      // Create and save product specifications
      if (customerData.productSpecification && Array.isArray(customerData.productSpecification)) {
        for (const specData of customerData.productSpecification) {
          const spec = new ProductSpecification();
          Object.assign(spec, specData);
          spec.customer = savedCustomer;
          await manager.save(ProductSpecification, spec);
        }
      }

      // Return customer without productSpecification to avoid circular reference
      const { productSpecification, ...customerWithoutSpecs } = savedCustomer;
      await this.invalidateCustomerCache();
      return customerWithoutSpecs as Customer;
    });
  }

  //TODO:New Code
async findAllCustomers(queryOptions: PaginationOptions, userId: string): Promise<PaginatedResponse<CustomerListResponseDto>> {
  // Fetch the user to check their role
  const user = await this.userRepository.findOneBy({ id: userId });
  const isPrivileged = user?.roles &&
    (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.VERIFIER));

  // Include userId in cache key so different users don't share results
  const key = `${CACHE_PREFIX}:list:${userId}:${JSON.stringify(queryOptions)}`;
  const cached = await this.cacheService.get<any>(key);
  if (cached) return cached;

  // Only join what the list view actually uses — drop 7 unused joins
  const queryBuilder = this.customerRepository
    .createQueryBuilder('customer')
    .leftJoin('customer.customerCategory', 'customerCategory')
    .leftJoin('customer.createdBy', 'createdBy')
    .leftJoin('customer.customerTypes', 'customerTypes')
    .leftJoin('customer.customerAddress', 'customerAddress')
    .leftJoin('customer.billingDetails', 'billingDetails')
    .select([
      'customer.id',
      'customer.organisationName',
      'customer.organisationType',
      'customer.primaryContactNo',
      'customer.emailPrimary',
      'customer.customerCode',
      'customer.status',
      'customer.createdAt',
      'customerCategory.name',
      'createdBy.firstName',
      'createdBy.lastName',
      'customerTypes.name',
      'customerAddress.address1',
      'customerAddress.address2',
      'customerAddress.city',
      'customerAddress.state',
      'customerAddress.pincode',
      'billingDetails.contactPersonFName',
      'billingDetails.contactPersonMName',
      'billingDetails.contactPersonLName',
    ])
    .orderBy('customer.createdAt', 'DESC');

  // Non-privileged users only see customers they created
  if (!isPrivileged) {
    queryBuilder.where('createdBy.id = :userId', { userId });
  }

  const customers = await buildQuery(queryBuilder, queryOptions, 'customer');

  const formattedData: CustomerListResponseDto[] = customers.data.map((cust):CustomerListResponseDto => {
    const { createdDate, createdTime } = formatDateTime(cust.createdAt);

    return {
      id: cust.id,
      createdBy: `${cust.createdBy?.firstName ?? ''} ${cust.createdBy?.lastName ?? ''}`.trim() || null,
      customerTypes: cust.customerTypes?.name || null,
      createdDate,
      createdTime,
      status: cust.status.charAt(0).toUpperCase() + cust.status.slice(1),
      customerCode: cust.customerCode.toUpperCase(),
      organisationName: cust.organisationName,
      organisationType: cust.organisationType,
      customerCategory: cust.customerCategory?.name,
      primaryContactNo: cust.primaryContactNo,
      emailPrimary: cust.emailPrimary,
      customerAddress: `${cust.customerAddress?.address1|| ''} , ${cust.customerAddress?.address2 || ''}  ${cust.customerAddress?.city || ''} , ${cust.customerAddress?.state || ''} , ${cust.customerAddress?.pincode || ''}`.trim() || null,
      contactPersonName: `${cust.billingDetails?.contactPersonFName ?? ''} ${cust.billingDetails?.contactPersonMName ?? ''} ${cust.billingDetails?.contactPersonLName ?? ''}`.trim() || null,
    };
  });
  const result = { ...customers, data: formattedData };
  await this.cacheService.set(key, result, CACHE_TTL);
  return result;
}

  async findCustomerById(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const result = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.customerCategory', 'customerCategory')
      .leftJoinAndSelect('customer.customerTypes', 'customerTypes')
      .leftJoinAndSelect('customer.bankDetails', 'bankDetails')
      .leftJoinAndSelect('bankDetails.bankAddress', 'bankAddress')
      .leftJoinAndSelect('customer.customerAddress', 'customerAddress')
      .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
      .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
      .leftJoinAndSelect('billingDetails.billingAddress', 'billingAddress')
      .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
      .leftJoinAndSelect('deliveryDetails.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('customer.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('customer.officeUseOnly', 'officeUseOnly')
      .leftJoinAndSelect('customer.keyMobileNumbers', 'keyMobileNumbers')
      .leftJoinAndSelect('keyMobileNumbers.ref1Address', 'ref1Address')
      .leftJoinAndSelect('keyMobileNumbers.ref2Address', 'ref2Address')
      .leftJoinAndSelect('customer.productSpecification', 'productSpecification')
      .where('customer.id = :id', { id })
      .getOne();

    if (result) await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  async findCustomerByIdforview(id: string): Promise<CustomerViewResponseDto> {
    const key = `${CACHE_PREFIX}:view:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const data = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin('customer.customerCategory', 'customerCategory')
      .leftJoin('customer.customerTypes', 'customerTypes')
      .leftJoin('customer.createdBy', 'createdBy')
      .leftJoin('customer.bankDetails', 'bankDetails')
      .leftJoin('bankDetails.bankAddress', 'bankAddress')
      .leftJoin('customer.customerAddress', 'customerAddress')
      .leftJoin('customer.statutoryDetails', 'statutoryDetails')
      .leftJoin('customer.billingDetails', 'billingDetails')
      .leftJoin('billingDetails.billingAddress', 'billingAddress')
      .leftJoin('customer.deliveryDetails', 'deliveryDetails')
      .leftJoin('deliveryDetails.deliveryAddress', 'deliveryAddress')
      .leftJoin('customer.paymentTerms', 'paymentTerms')
      .leftJoin('customer.officeUseOnly', 'officeUseOnly')
      .leftJoin('customer.keyMobileNumbers', 'keyMobileNumbers')
      .leftJoin('keyMobileNumbers.ref1Address', 'ref1Address')
      .leftJoin('keyMobileNumbers.ref2Address', 'ref2Address')
      .leftJoin('customer.productSpecification', 'productSpecification')
      .select([
        'customer.id', 'customer.organisationName', 'customer.customerImage',
        'customer.organisationType', 'customer.otherType', 'customer.customerCode',
        'customer.emailPrimary', 'customer.emailSecondary',
        'customer.primaryContactNo', 'customer.secondaryContactNo', 'customer.createdAt',
        'customerCategory.name', 'customerTypes.name',
        'createdBy.firstName', 'createdBy.lastName',
        'bankDetails.id', 'bankDetails.bankAccHolderFName', 'bankDetails.bankAccHolderMName',
        'bankDetails.bankAccHolderLName', 'bankDetails.ifscCode', 'bankDetails.bankBranch',
        'bankDetails.bankAccNo', 'bankDetails.accType', 'bankDetails.ifCancelledCheque',
        'bankDetails.notCancelledChequeReason', 'bankDetails.cancelledChequeCopy',
        'bankDetails.otherAccType', 'bankDetails.bankStatementCopy', 'bankDetails.bankName',
        'bankAddress.id', 'bankAddress.address1', 'bankAddress.address2', 'bankAddress.location',
        'bankAddress.city', 'bankAddress.state', 'bankAddress.pincode',
        'customerAddress.id', 'customerAddress.address1', 'customerAddress.address2',
        'customerAddress.location', 'customerAddress.city', 'customerAddress.state', 'customerAddress.pincode',
        'statutoryDetails.id', 'statutoryDetails.gstn', 'statutoryDetails.panNo',
        'statutoryDetails.aadharNo', 'statutoryDetails.panCopy', 'statutoryDetails.aadharCopy',
        'statutoryDetails.billBookCopy', 'statutoryDetails.certificationsDetails',
        'statutoryDetails.otherCertifications', 'statutoryDetails.corpRegiDetails',
        'statutoryDetails.otherCorpRegiDetails', 'statutoryDetails.incorpoCertificateCopy',
        'statutoryDetails.cinNo', 'statutoryDetails.regiCertificateCopy',
        'billingDetails.id', 'billingDetails.billingName', 'billingDetails.contactPersonFName',
        'billingDetails.contactPersonMName', 'billingDetails.contactPersonLName',
        'billingDetails.commonlyKnownAs', 'billingDetails.primaryContactNo',
        'billingDetails.secondaryContactNo', 'billingDetails.billingFormatCopy',
        'billingDetails.billingAddressProofCopy', 'billingDetails.emailPrimary', 'billingDetails.emailSecondary',
        'billingAddress.id', 'billingAddress.address1', 'billingAddress.address2',
        'billingAddress.location', 'billingAddress.city', 'billingAddress.state', 'billingAddress.pincode',
        'deliveryDetails.id', 'deliveryDetails.deliveryAddressProofCopy', 'deliveryDetails.deliveryTime',
        'deliveryDetails.receivingPersonFName', 'deliveryDetails.receivingPersonMName',
        'deliveryDetails.receivingPersonLName', 'deliveryDetails.primaryContactNo',
        'deliveryDetails.secondaryContactNo', 'deliveryDetails.emailPrimary', 'deliveryDetails.emailSecondary',
        'deliveryAddress.id', 'deliveryAddress.address1', 'deliveryAddress.address2',
        'deliveryAddress.location', 'deliveryAddress.city', 'deliveryAddress.state', 'deliveryAddress.pincode',
        'paymentTerms.id', 'paymentTerms.paymentMode', 'paymentTerms.otherPaymentMode',
        'paymentTerms.otherPaymentMade', 'paymentTerms.paymentMade', 'paymentTerms.marginDeposit',
        'paymentTerms.rtv', 'paymentTerms.agreementExecuted', 'paymentTerms.lc', 'paymentTerms.bg',
        'paymentTerms.securityDepoCheqNo', 'paymentTerms.securityDepoAmt',
        'paymentTerms.IELinAmt', 'paymentTerms.IELRecommendedBy', 'paymentTerms.IELRecommendedDate',
        'paymentTerms.RELinAmt', 'paymentTerms.RELRecommendedBy', 'paymentTerms.RELRecommendedDate',
        'paymentTerms.reason', 'paymentTerms.docEvidenceCopy',
        'officeUseOnly.id', 'officeUseOnly.proposerBDName', 'officeUseOnly.pflCoordinator',
        'officeUseOnly.recommendedBy', 'officeUseOnly.dispatchLocationPfl', 'officeUseOnly.approvedBy',
        'officeUseOnly.relationshipManager', 'officeUseOnly.avgBillingMonthly', 'officeUseOnly.volumeMonthly',
        'officeUseOnly.customerVerification', 'officeUseOnly.verificationAgency', 'officeUseOnly.validityPeriod',
        'officeUseOnly.dueDiligenceDone', 'officeUseOnly.creditWorthinessDue',
        'officeUseOnly.keyAccountPersonAssigned', 'officeUseOnly.sinceWhen',
        'officeUseOnly.ledgerCreatedDate', 'officeUseOnly.ledgerCreatedBy',
        'officeUseOnly.ledgerVerifiedApprovedBy', 'officeUseOnly.createdBy', 'officeUseOnly.additionalNotes',
        'keyMobileNumbers.id', 'keyMobileNumbers.accDeptFName', 'keyMobileNumbers.accDeptMName',
        'keyMobileNumbers.accDeptLName', 'keyMobileNumbers.accDeptMobileNo',
        'keyMobileNumbers.ownerFName', 'keyMobileNumbers.ownerMName', 'keyMobileNumbers.ownerLName',
        'keyMobileNumbers.ownerMobileNo', 'keyMobileNumbers.mandiLicenceNo', 'keyMobileNumbers.mandiLicenceCopy',
        'keyMobileNumbers.regiNo', 'keyMobileNumbers.regiCopy', 'keyMobileNumbers.electricityBill',
        'keyMobileNumbers.electricityBillCopy', 'keyMobileNumbers.notElectricityBillReason',
        'keyMobileNumbers.consumerNo', 'keyMobileNumbers.customerBlacklisted',
        'keyMobileNumbers.ifBlacklistedReason', 'keyMobileNumbers.blackListedBy',
        'keyMobileNumbers.visitingCard', 'keyMobileNumbers.visitingCardCopy',
        'keyMobileNumbers.visitingContactNo', 'keyMobileNumbers.notVisitingCardReason',
        'keyMobileNumbers.ref1FName', 'keyMobileNumbers.ref1MName', 'keyMobileNumbers.ref1LName',
        'keyMobileNumbers.ref1ContactNo', 'keyMobileNumbers.ref1Email',
        'keyMobileNumbers.ref2FName', 'keyMobileNumbers.ref2MName', 'keyMobileNumbers.ref2LName',
        'keyMobileNumbers.ref2ContactNo', 'keyMobileNumbers.ref2Email',
        'ref1Address.id', 'ref1Address.address1', 'ref1Address.address2', 'ref1Address.location',
        'ref1Address.city', 'ref1Address.state', 'ref1Address.pincode',
        'ref2Address.id', 'ref2Address.address1', 'ref2Address.address2', 'ref2Address.location',
        'ref2Address.city', 'ref2Address.state', 'ref2Address.pincode',
        'productSpecification.id', 'productSpecification.articleName', 'productSpecification.specifications',
        'productSpecification.packingMaterialSpec', 'productSpecification.parameters',
        'productSpecification.rejectionCriteria', 'productSpecification.comment',
      ])
      .where('customer.id = :id', { id })
      .getOne();

    if (!data) throw new AppError(404, 'Customer not found');

    const { createdDate, createdTime } = formatDateTime(data.createdAt);
    const mapAddress = (addr: any) => addr ? {
      id: addr.id, address1: addr.address1, address2: addr.address2,
      location: addr.location, city: addr.city, state: addr.state, pincode: addr.pincode,
    } : null;

    const formatteddata: CustomerViewResponseDto = {
      id: data.id,
      organisationName: data.organisationName,
      customerImage: data.customerImage,
      organisationType: data.organisationType,
      otherType: data.otherType,
      customerCategory: data.customerCategory?.name || 'Unknown Category',
      createdBy: data.createdBy 
        ? `${data.createdBy.firstName} ${data.createdBy.lastName}`
        : 'Unknown User',
      createdTime: formatDateTime(data.createdAt).createdTime,
      createdDate: formatDateTime(data.createdAt).createdDate,
       customerCode: data.customerCode,
      emailSecondary: data.emailSecondary,
       emailPrimary: data.emailPrimary,
       secondaryContactNo: data.secondaryContactNo,
       primaryContactNo: data.primaryContactNo,
      // ? {
      //     id: data.customerCategory.id,
      //     name: data.customerCategory.name,
      //   }
      // : null,
      customerTypes: data.customerTypes?.name || 'Unknown Type',
      // ? {
      //     id: data.customerTypes.id,
      //     name: data.customerTypes.name,
      //   }
      // : null,
      bankDetails: data.bankDetails
        ? {
            id: data.bankDetails.id,
       bankAccHolderFName: data.bankDetails.bankAccHolderFName,
            bankAccHolderMName: data.bankDetails.bankAccHolderMName,
            bankAccHolderLName: data.bankDetails.bankAccHolderLName,
            ifscCode: data.bankDetails.ifscCode,
            bankBranch: data.bankDetails.bankBranch,
            bankAccNo: data.bankDetails.bankAccNo,
            accType: data.bankDetails.accType,
            ifCancelledCheque: data.bankDetails.ifCancelledCheque,
            notCancelledChequeReason: data.bankDetails.notCancelledChequeReason,
            cancelledChequeCopy: data.bankDetails.cancelledChequeCopy,
            otherAccType: data.bankDetails.otherAccType,
            bankStatementCopy: data.bankDetails.bankStatementCopy,
            bankName: data.bankDetails.bankName,
            bankAddress: data.bankDetails.bankAddress
              ? {
                  id: data.bankDetails.bankAddress.id,
                  address1: data.bankDetails.bankAddress.address1,
                  address2: data.bankDetails.bankAddress.address2,
                  location: data.bankDetails.bankAddress.location,
                  city: data.bankDetails.bankAddress.city,
                  state: data.bankDetails.bankAddress.state,
                  pincode: data.bankDetails.bankAddress.pincode,
                }
              : null,
          }
        : null,
      customerAddress: data.customerAddress
        ? {
            id: data.customerAddress.id,
            address1: data.customerAddress.address1,
            address2: data.customerAddress.address2,
            location: data.customerAddress.location,
            city: data.customerAddress.city,
            state: data.customerAddress.state,
            pincode: data.customerAddress.pincode,
          }
        : null,
      statutoryDetails: data.statutoryDetails
        ? {
            id: data.statutoryDetails.id,
            gstn: data.statutoryDetails.gstn,
            panNo: data.statutoryDetails.panNo,
            aadharNo: data.statutoryDetails.aadharNo,
            panCopy: data.statutoryDetails.panCopy,
            aadharCopy: data.statutoryDetails.aadharCopy,
            billBookCopy: data.statutoryDetails.billBookCopy,
            certificationsDetails: data.statutoryDetails.certificationsDetails,
            otherCertifications: data.statutoryDetails.otherCertifications,
            corpRegiDetails: data.statutoryDetails.corpRegiDetails,
            otherCorpRegiDetails: data.statutoryDetails.otherCorpRegiDetails,
            incorpoCertificateCopy:
              data.statutoryDetails.incorpoCertificateCopy,
            cinNo: data.statutoryDetails.cinNo,
            regiCertificateCopy: data.statutoryDetails.regiCertificateCopy,
          }
        : null,

      billingDetails: data.billingDetails
        ? {
            id: data.billingDetails.id,
            billingName: data.billingDetails.billingName,
            contactPersonFName: data.billingDetails.contactPersonFName,
            contactPersonLName: data.billingDetails.contactPersonLName,
            contactPersonMName: data.billingDetails.contactPersonMName,
            commonlyKnownAs: data.billingDetails.commonlyKnownAs,
            primaryContactNo: data.billingDetails.primaryContactNo,
            secondaryContactNo: data.billingDetails.secondaryContactNo,
            billingFormatCopy: data.billingDetails.billingFormatCopy,
            billingAddressProofCopy:
              data.billingDetails.billingAddressProofCopy,
            emailPrimary: data.billingDetails.emailPrimary,
            emailSecondary: data.billingDetails.emailSecondary,
            billingAddress: data.billingDetails.billingAddress
              ? {
                  id: data.billingDetails.billingAddress.id,
                  address1: data.billingDetails.billingAddress.address1,
                  address2: data.billingDetails.billingAddress.address2,
                  location: data.billingDetails.billingAddress.location,
                  city: data.billingDetails.billingAddress.city,
                  state: data.billingDetails.billingAddress.state,
                  pincode: data.billingDetails.billingAddress.pincode,
                }
              : null,
          }
        : null,
      deliveryDetails: data.deliveryDetails
        ? {
            deliveryAddress: data.deliveryDetails.deliveryAddress
              ? {
                  id: data.deliveryDetails.deliveryAddress.id,
                  address1: data.deliveryDetails.deliveryAddress.address1,
                  address2: data.deliveryDetails.deliveryAddress.address2,
                  location: data.deliveryDetails.deliveryAddress.location,
                  city: data.deliveryDetails.deliveryAddress.city,
                  state: data.deliveryDetails.deliveryAddress.state,
                  pincode: data.deliveryDetails.deliveryAddress.pincode,
                }
              : null,
            deliveryAddressProofCopy:
              data.deliveryDetails.deliveryAddressProofCopy,
            deliveryTime: data.deliveryDetails.deliveryTime,
            receivingPersonFName: data.deliveryDetails.receivingPersonFName,
            receivingPersonMName: data.deliveryDetails.receivingPersonMName,
            receivingPersonLName: data.deliveryDetails.receivingPersonLName,
            primaryContactNo: data.deliveryDetails.primaryContactNo,
            secondaryContactNo: data.deliveryDetails.secondaryContactNo,
            emailPrimary: data.deliveryDetails.emailPrimary,
            emailSecondary: data.deliveryDetails.emailSecondary,
          }
        : null,

      paymentTerms: data.paymentTerms
        ? {
            id: data.paymentTerms.id,
            paymentMode: data.paymentTerms.paymentMode,
            otherPaymentMode: data.paymentTerms.otherPaymentMode,
            otherPaymentMade: data.paymentTerms.otherPaymentMade,
            paymentMade: data.paymentTerms.paymentMade,
            marginDeposit: data.paymentTerms.marginDeposit,
            rtv: data.paymentTerms.rtv,
            agreementExecuted: data.paymentTerms.agreementExecuted,
            lc: data.paymentTerms.lc,
            bg: data.paymentTerms.bg,
            securityDepoCheqNo: data.paymentTerms.securityDepoCheqNo,
            securityDepoAmt: data.paymentTerms.securityDepoAmt,
            IELinAmt: data.paymentTerms.IELinAmt,
            IELRecommendedBy: data.paymentTerms.IELRecommendedBy,
            IELRecommendedDate: data.paymentTerms.IELRecommendedDate,
            RELinAmt: data.paymentTerms.RELinAmt,
            RELRecommendedBy: data.paymentTerms.RELRecommendedBy,
            RELRecommendedDate: data.paymentTerms.RELRecommendedDate,
            reason: data.paymentTerms.reason,
            docEvidenceCopy: data.paymentTerms.docEvidenceCopy,
          }
        : null,

      officeUseOnly: data.officeUseOnly
        ? {
            id: data.officeUseOnly.id,
            proposerBDName: data.officeUseOnly.proposerBDName,
            pflCoordinator: data.officeUseOnly.pflCoordinator,
            recommendedBy: data.officeUseOnly.recommendedBy,
            dispatchLocationPfl: data.officeUseOnly.dispatchLocationPfl,
            approvedBy: data.officeUseOnly.approvedBy,
            relationshipManager: data.officeUseOnly.relationshipManager,
            avgBillingMonthly: data.officeUseOnly.avgBillingMonthly,
            volumeMonthly: data.officeUseOnly.volumeMonthly,
            customerVerification: data.officeUseOnly.customerVerification,
            verificationAgency: data.officeUseOnly.verificationAgency,
            validityPeriod: data.officeUseOnly.validityPeriod,
            dueDiligenceDone: data.officeUseOnly.dueDiligenceDone,
            creditWorthinessDue: data.officeUseOnly.creditWorthinessDue,
            keyAccountPersonAssigned:
              data.officeUseOnly.keyAccountPersonAssigned,
            sinceWhen: data.officeUseOnly.sinceWhen,
            ledgerCreatedDate: data.officeUseOnly.ledgerCreatedDate,
            ledgerCreatedBy: data.officeUseOnly.ledgerCreatedBy,
            ledgerVerifiedApprovedBy:
              data.officeUseOnly.ledgerVerifiedApprovedBy,
            createdBy: data.officeUseOnly.createdBy,
            additionalNotes: data.officeUseOnly.additionalNotes,
          }
        : null,
      keyMobileNumbers: data.keyMobileNumbers
        ? {
            id: data.keyMobileNumbers.id,
            accDeptFName: data.keyMobileNumbers.accDeptFName,
            accDeptMName: data.keyMobileNumbers.accDeptMName,
            accDeptLName: data.keyMobileNumbers.accDeptLName,
            accDeptMobileNo: data.keyMobileNumbers.accDeptMobileNo,
            ownerFName: data.keyMobileNumbers.ownerFName,
            ownerMName: data.keyMobileNumbers.ownerMName,
            ownerLName: data.keyMobileNumbers.ownerLName,
            ownerMobileNo: data.keyMobileNumbers.ownerMobileNo,
            mandiLicenceNo: data.keyMobileNumbers.mandiLicenceNo,
            mandiLicenceCopy: data.keyMobileNumbers.mandiLicenceCopy,
            regiNo: data.keyMobileNumbers.regiNo,
            regiCopy: data.keyMobileNumbers.regiCopy,
            electricityBill: data.keyMobileNumbers.electricityBill,
            electricityBillCopy: data.keyMobileNumbers.electricityBillCopy,
            notElectricityBillReason:
              data.keyMobileNumbers.notElectricityBillReason,
            consumerNo: data.keyMobileNumbers.consumerNo,
            customerBlacklisted: data.keyMobileNumbers.customerBlacklisted,
            ifBlacklistedReason: data.keyMobileNumbers.ifBlacklistedReason,
            blackListedBy: data.keyMobileNumbers.blackListedBy,
            visitingCard: data.keyMobileNumbers.visitingCard,
            visitingCardCopy: data.keyMobileNumbers.visitingCardCopy,
            visitingContactNo: data.keyMobileNumbers.visitingContactNo,
            notVisitingCardReason: data.keyMobileNumbers.notVisitingCardReason,

            ref1FName: data.keyMobileNumbers.ref1FName,
            ref1MName: data.keyMobileNumbers.ref1MName,
            ref1LName: data.keyMobileNumbers.ref1LName,
            ref1ContactNo: data.keyMobileNumbers.ref1ContactNo,
            ref1Email: data.keyMobileNumbers.ref1Email,
            ref1Address: data.keyMobileNumbers.ref1Address
              ? {
                  id: data.keyMobileNumbers.ref1Address.id,
                  address1: data.keyMobileNumbers.ref1Address.address1,
                  address2: data.keyMobileNumbers.ref1Address.address2,
                  location: data.keyMobileNumbers.ref1Address.location,
                  city: data.keyMobileNumbers.ref1Address.city,
                  state: data.keyMobileNumbers.ref1Address.state,
                  pincode: data.keyMobileNumbers.ref1Address.pincode,
                }
              : null,
            ref2FName: data.keyMobileNumbers.ref2FName,
            ref2MName: data.keyMobileNumbers.ref2MName,
            ref2LName: data.keyMobileNumbers.ref2LName,
            ref2ContactNo: data.keyMobileNumbers.ref2ContactNo,
            ref2Email: data.keyMobileNumbers.ref2Email,
            ref2Address: data.keyMobileNumbers.ref2Address
              ? {
                  id: data.keyMobileNumbers.ref2Address.id,
                  address1: data.keyMobileNumbers.ref2Address.address1,
                  address2: data.keyMobileNumbers.ref2Address.address2,
                  location: data.keyMobileNumbers.ref2Address.location,
                  city: data.keyMobileNumbers.ref2Address.city,
                  state: data.keyMobileNumbers.ref2Address.state,
                  pincode: data.keyMobileNumbers.ref2Address.pincode,
                }
              : null,
          }
        : null,
      productSpecification: (data.productSpecification ?? []).map((spec) => ({
        id: spec.id,
        articleName: spec.articleName,
        specifications: spec.specifications,
        packingMaterialSpec: spec.packingMaterialSpec,
        parameters: spec.parameters,

        rejectionCriteria: spec.rejectionCriteria,
        comment: spec.comment,
      })),
    };
    await this.cacheService.set(key, formatteddata, CACHE_TTL_DETAIL);
    return formatteddata;
  }

   async findCustomerByIdforupdate(id: string): Promise<CustomerViewResponseDto> {
    const key = `${CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const data = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.customerCategory', 'customerCategory')
      .leftJoinAndSelect('customer.customerTypes', 'customerTypes')
      .leftJoinAndSelect('customer.createdBy', 'createdBy')
      .leftJoinAndSelect('customer.bankDetails', 'bankDetails')
      .leftJoinAndSelect('bankDetails.bankAddress', 'bankAddress')
      .leftJoinAndSelect('customer.customerAddress', 'customerAddress')
      .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
      .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
      .leftJoinAndSelect('billingDetails.billingAddress', 'billingAddress')
      .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
      .leftJoinAndSelect('deliveryDetails.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('customer.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('customer.officeUseOnly', 'officeUseOnly')
      .leftJoinAndSelect('customer.keyMobileNumbers', 'keyMobileNumbers')
      .leftJoinAndSelect('keyMobileNumbers.ref1Address', 'ref1Address')
      .leftJoinAndSelect('keyMobileNumbers.ref2Address', 'ref2Address')
      .leftJoinAndSelect('customer.productSpecification', 'productSpecification')
      .where('customer.id = :id', { id })
      .getOne();

    if (!data) {
      throw new AppError(404, 'Customer not found');
    }
    const formatteddata: CustomerViewResponseDto = {
      id: data.id,
      organisationName: data.organisationName,
      customerImage: data.customerImage,
      organisationType: data.organisationType,
      otherType: data.otherType,
      status:data.status,
      customerCategory: data.customerCategory?.id || null,
      customerCode: data.customerCode,
      emailSecondary: data.emailSecondary,
       emailPrimary: data.emailPrimary,
       secondaryContactNo: data.secondaryContactNo,
       primaryContactNo: data.primaryContactNo,
        createdBy: data.createdBy?.id ?? null,
          
      createdTime: formatDateTime(data.createdAt).createdTime,
      createdDate: formatDateTime(data.createdAt).createdDate,
      // ? {
      //     id: data.customerCategory.id,
      //     name: data.customerCategory.name,
      //   }
      // : null,
      customerTypes: data.customerTypes?.id || null,
      // ? {
      //     id: data.customerTypes.id,
      //     name: data.customerTypes.name,
      //   }
      // : null,
      bankDetails: data.bankDetails
        ? {
            id: data.bankDetails.id,
            bankAccHolderFName: data.bankDetails.bankAccHolderFName,
            bankAccHolderMName: data.bankDetails.bankAccHolderMName,
            bankAccHolderLName: data.bankDetails.bankAccHolderLName,
            ifscCode: data.bankDetails.ifscCode,
            bankBranch: data.bankDetails.bankBranch,
            bankAccNo: data.bankDetails.bankAccNo,
            accType: data.bankDetails.accType,
            ifCancelledCheque: data.bankDetails.ifCancelledCheque,
            notCancelledChequeReason: data.bankDetails.notCancelledChequeReason,
            cancelledChequeCopy: data.bankDetails.cancelledChequeCopy,
            otherAccType: data.bankDetails.otherAccType,
            bankStatementCopy: data.bankDetails.bankStatementCopy,
            bankName: data.bankDetails.bankName,
            bankAddress: data.bankDetails.bankAddress
              ? {
                  id: data.bankDetails.bankAddress.id,
                  address1: data.bankDetails.bankAddress.address1,
                  address2: data.bankDetails.bankAddress.address2,
                  location: data.bankDetails.bankAddress.location,
                  city: data.bankDetails.bankAddress.city,
                  state: data.bankDetails.bankAddress.state,
                  pincode: data.bankDetails.bankAddress.pincode,
                }
              : null,
          }
        : null,
      customerAddress: data.customerAddress
        ? {
            id: data.customerAddress.id,
            address1: data.customerAddress.address1,
            address2: data.customerAddress.address2,
            location: data.customerAddress.location,
            city: data.customerAddress.city,
            state: data.customerAddress.state,
            pincode: data.customerAddress.pincode,
          }
        : null,
      statutoryDetails: data.statutoryDetails
        ? {
            id: data.statutoryDetails.id,
            gstn: data.statutoryDetails.gstn,
            panNo: data.statutoryDetails.panNo,
            aadharNo: data.statutoryDetails.aadharNo,
            panCopy: data.statutoryDetails.panCopy,
            aadharCopy: data.statutoryDetails.aadharCopy,
            billBookCopy: data.statutoryDetails.billBookCopy,
            certificationsDetails: data.statutoryDetails.certificationsDetails,
            otherCertifications: data.statutoryDetails.otherCertifications,
            corpRegiDetails: data.statutoryDetails.corpRegiDetails,
            otherCorpRegiDetails: data.statutoryDetails.otherCorpRegiDetails,
            incorpoCertificateCopy:
              data.statutoryDetails.incorpoCertificateCopy,
            cinNo: data.statutoryDetails.cinNo,
            regiCertificateCopy: data.statutoryDetails.regiCertificateCopy,
          }
        : null,

      billingDetails: data.billingDetails
        ? {
            id: data.billingDetails.id,
            billingName: data.billingDetails.billingName,
            contactPersonFName: data.billingDetails.contactPersonFName,
            contactPersonLName: data.billingDetails.contactPersonLName,
            contactPersonMName: data.billingDetails.contactPersonMName,
            commonlyKnownAs: data.billingDetails.commonlyKnownAs,
            primaryContactNo: data.billingDetails.primaryContactNo,
            secondaryContactNo: data.billingDetails.secondaryContactNo,
            billingFormatCopy: data.billingDetails.billingFormatCopy,
            billingAddressProofCopy:
              data.billingDetails.billingAddressProofCopy,
            emailPrimary: data.billingDetails.emailPrimary,
            emailSecondary: data.billingDetails.emailSecondary,
            billingAddress: data.billingDetails.billingAddress
              ? {
                  id: data.billingDetails.billingAddress.id,
                  address1: data.billingDetails.billingAddress.address1,
                  address2: data.billingDetails.billingAddress.address2,
                  location: data.billingDetails.billingAddress.location,
                  city: data.billingDetails.billingAddress.city,
                  state: data.billingDetails.billingAddress.state,
                  pincode: data.billingDetails.billingAddress.pincode,
                }
              : null,
          }
        : null,
      deliveryDetails: data.deliveryDetails
        ? {
            deliveryAddress: data.deliveryDetails.deliveryAddress
              ? {
                  id: data.deliveryDetails.deliveryAddress.id,
                  address1: data.deliveryDetails.deliveryAddress.address1,
                  address2: data.deliveryDetails.deliveryAddress.address2,
                  location: data.deliveryDetails.deliveryAddress.location,
                  city: data.deliveryDetails.deliveryAddress.city,
                  state: data.deliveryDetails.deliveryAddress.state,
                  pincode: data.deliveryDetails.deliveryAddress.pincode,
                }
              : null,
            deliveryAddressProofCopy:
              data.deliveryDetails.deliveryAddressProofCopy,
            deliveryTime: data.deliveryDetails.deliveryTime,
            receivingPersonFName: data.deliveryDetails.receivingPersonFName,
            receivingPersonMName: data.deliveryDetails.receivingPersonMName,
            receivingPersonLName: data.deliveryDetails.receivingPersonLName,
            primaryContactNo: data.deliveryDetails.primaryContactNo,
            secondaryContactNo: data.deliveryDetails.secondaryContactNo,
            emailPrimary: data.deliveryDetails.emailPrimary,
            emailSecondary: data.deliveryDetails.emailSecondary,
          }
        : null,

      paymentTerms: data.paymentTerms
        ? {
            id: data.paymentTerms.id,
            paymentMode: data.paymentTerms.paymentMode,
            otherPaymentMode: data.paymentTerms.otherPaymentMode,
            otherPaymentMade: data.paymentTerms.otherPaymentMade,
            paymentMade: data.paymentTerms.paymentMade,
            marginDeposit: data.paymentTerms.marginDeposit,
            rtv: data.paymentTerms.rtv,
            agreementExecuted: data.paymentTerms.agreementExecuted,
            lc: data.paymentTerms.lc,
            bg: data.paymentTerms.bg,
            securityDepoCheqNo: data.paymentTerms.securityDepoCheqNo,
            securityDepoAmt: data.paymentTerms.securityDepoAmt,
            IELinAmt: data.paymentTerms.IELinAmt,
            IELRecommendedBy: data.paymentTerms.IELRecommendedBy,
            IELRecommendedDate: data.paymentTerms.IELRecommendedDate,
            RELinAmt: data.paymentTerms.RELinAmt,
            RELRecommendedBy: data.paymentTerms.RELRecommendedBy,
            RELRecommendedDate: data.paymentTerms.RELRecommendedDate,
            reason: data.paymentTerms.reason,
            docEvidenceCopy: data.paymentTerms.docEvidenceCopy,
          }
        : null,

      officeUseOnly: data.officeUseOnly
        ? {
            id: data.officeUseOnly.id,
            proposerBDName: data.officeUseOnly.proposerBDName,
            pflCoordinator: data.officeUseOnly.pflCoordinator,
            recommendedBy: data.officeUseOnly.recommendedBy,
            dispatchLocationPfl: data.officeUseOnly.dispatchLocationPfl,
            approvedBy: data.officeUseOnly.approvedBy,
            relationshipManager: data.officeUseOnly.relationshipManager,
            avgBillingMonthly: data.officeUseOnly.avgBillingMonthly,
            volumeMonthly: data.officeUseOnly.volumeMonthly,
            customerVerification: data.officeUseOnly.customerVerification,
            verificationAgency: data.officeUseOnly.verificationAgency,
            validityPeriod: data.officeUseOnly.validityPeriod,
            dueDiligenceDone: data.officeUseOnly.dueDiligenceDone,
            creditWorthinessDue: data.officeUseOnly.creditWorthinessDue,
            keyAccountPersonAssigned:
              data.officeUseOnly.keyAccountPersonAssigned,
            sinceWhen: data.officeUseOnly.sinceWhen,
            ledgerCreatedDate: data.officeUseOnly.ledgerCreatedDate,
            ledgerCreatedBy: data.officeUseOnly.ledgerCreatedBy,
            ledgerVerifiedApprovedBy:
              data.officeUseOnly.ledgerVerifiedApprovedBy,
            createdBy: data.officeUseOnly.createdBy,
            additionalNotes: data.officeUseOnly.additionalNotes,
          }
        : null,
      keyMobileNumbers: data.keyMobileNumbers
        ? {
            id: data.keyMobileNumbers.id,
            accDeptFName: data.keyMobileNumbers.accDeptFName,
            accDeptMName: data.keyMobileNumbers.accDeptMName,
            accDeptLName: data.keyMobileNumbers.accDeptLName,
            accDeptMobileNo: data.keyMobileNumbers.accDeptMobileNo,
            ownerFName: data.keyMobileNumbers.ownerFName,
            ownerMName: data.keyMobileNumbers.ownerMName,
            ownerLName: data.keyMobileNumbers.ownerLName,
            ownerMobileNo: data.keyMobileNumbers.ownerMobileNo,
            mandiLicenceNo: data.keyMobileNumbers.mandiLicenceNo,
            mandiLicenceCopy: data.keyMobileNumbers.mandiLicenceCopy,
            regiNo: data.keyMobileNumbers.regiNo,
            regiCopy: data.keyMobileNumbers.regiCopy,
            electricityBill: data.keyMobileNumbers.electricityBill,
            electricityBillCopy: data.keyMobileNumbers.electricityBillCopy,
            notElectricityBillReason:
              data.keyMobileNumbers.notElectricityBillReason,
            consumerNo: data.keyMobileNumbers.consumerNo,
            customerBlacklisted: data.keyMobileNumbers.customerBlacklisted,
            ifBlacklistedReason: data.keyMobileNumbers.ifBlacklistedReason,
            blackListedBy: data.keyMobileNumbers.blackListedBy,
            visitingCard: data.keyMobileNumbers.visitingCard,
            visitingCardCopy: data.keyMobileNumbers.visitingCardCopy,
            visitingContactNo: data.keyMobileNumbers.visitingContactNo,
            notVisitingCardReason: data.keyMobileNumbers.notVisitingCardReason,

            ref1FName: data.keyMobileNumbers.ref1FName,
            ref1MName: data.keyMobileNumbers.ref1MName,
            ref1LName: data.keyMobileNumbers.ref1LName,
            ref1ContactNo: data.keyMobileNumbers.ref1ContactNo,
            ref1Email: data.keyMobileNumbers.ref1Email,
            ref1Address: data.keyMobileNumbers.ref1Address
              ? {
                  id: data.keyMobileNumbers.ref1Address.id,
                  address1: data.keyMobileNumbers.ref1Address.address1,
                  address2: data.keyMobileNumbers.ref1Address.address2,
                  location: data.keyMobileNumbers.ref1Address.location,
                  city: data.keyMobileNumbers.ref1Address.city,
                  state: data.keyMobileNumbers.ref1Address.state,
                  pincode: data.keyMobileNumbers.ref1Address.pincode,
                }
              : null,
            ref2FName: data.keyMobileNumbers.ref2FName,
            ref2MName: data.keyMobileNumbers.ref2MName,
            ref2LName: data.keyMobileNumbers.ref2LName,
            ref2ContactNo: data.keyMobileNumbers.ref2ContactNo,
            ref2Email: data.keyMobileNumbers.ref2Email,
            ref2Address: data.keyMobileNumbers.ref2Address
              ? {
                  id: data.keyMobileNumbers.ref2Address.id,
                  address1: data.keyMobileNumbers.ref2Address.address1,
                  address2: data.keyMobileNumbers.ref2Address.address2,
                  location: data.keyMobileNumbers.ref2Address.location,
                  city: data.keyMobileNumbers.ref2Address.city,
                  state: data.keyMobileNumbers.ref2Address.state,
                  pincode: data.keyMobileNumbers.ref2Address.pincode,
                }
              : null,
          }
        : null,
      productSpecification: (data.productSpecification ?? []).map((spec) => ({
        id: spec.id,
        articleName: spec.articleName,
        specifications: spec.specifications,
        packingMaterialSpec: spec.packingMaterialSpec,
        parameters: spec.parameters,

        rejectionCriteria: spec.rejectionCriteria,
        comment: spec.comment,
      })),
    };
    await this.cacheService.set(key, formatteddata, CACHE_TTL_DETAIL);
    return formatteddata;
  }
 

  // Method to get a customer by ID
  // async findCustomerfilterById(id: string): Promise<Customer|null> {
  //   return this.customerRepository.findOne({
  //     where: { id },
  //     relations: [

  //       'statutoryDetails',
  //       'billingDetails',
  //       'deliveryDetails',

  //     ],
  //   });
  // }
  // async getcustomerfilterById(id: string): Promise<any> {
  //   const customer = await this.customerRepository
  //     .createQueryBuilder('customer')
  //     .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
  //     .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
  //     .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
  //     .select([
  //       'customer.id',
  //       'customer.organisationName',
  //       'billingDetails.billingAddress.id',
  //       'deliveryDetails.deliveryAddress',
  //       'statutoryDetails.gstn',
  //       'statutoryDetails.panNo',
  //     ])
  //     .where('customer.id = :id', { id })
  //     .getRawOne();

  //   if (!customer) {
  //     throw new Error('Customer not found');
  //   }

  //   return customer
  // }
  async getCustomerFilterById(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:filter:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const customer = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
      .leftJoinAndSelect('billingDetails.billingAddress', 'billingAddress')
      .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
      .leftJoinAndSelect('deliveryDetails.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
      .select([
        'customer.id AS "id"',
        'customer.organisationName AS "organisationName"',
        'billingDetails.id AS "billingDetailsId"',
        'billingAddress.address1 AS "billingAddressLine1"',
        'billingAddress.address2 AS "billingAddressLine2"',
        'billingAddress.location AS "billingAddressLocation"',
        'billingAddress.city AS "billingAddressCity"',
        'billingAddress.state AS "billingAddressState"',
        'billingAddress.pincode AS "billingAddressPincode"',
        'deliveryAddress.id AS "deliveryAddressID"',
        'deliveryAddress.address1 AS "deliveryAddressLine1"',
        'deliveryAddress.address2 AS "deliveryAddressLine2"',
        'deliveryAddress.location AS "deliveryAddressLocation"',
        'deliveryAddress.city AS "deliveryAddressCity"',
        'deliveryAddress.state AS "deliveryAddressState"',
        'deliveryAddress.pincode AS "deliveryAddressPincode"',
        'statutoryDetails.gstn AS "gstNumber"',
        'statutoryDetails.panNo AS "panNumber"',
      ])
      .where('customer.id = :id', { id })
      .getRawOne();

    if (!customer) {
      throw new Error('Customer not found');
    }

    const result = {
      customer: {
        id: customer.id,
        organisationName: customer.organisationName,
        billingAddress: {
          id: customer.billingDetailsId,
          address1: customer.billingAddressLine1,
          address2: customer.billingAddressLine2,
          location: customer.billingAddressLocation,
          city: customer.billingAddressCity,
          state: customer.billingAddressState,
          pincode: customer.billingAddressPincode,
        },
        deliveryAddress: {
          id: customer.deliveryAddressID,
          address1: customer.deliveryAddressLine1,
          address2: customer.deliveryAddressLine2,
          location: customer.deliveryAddressLocation,
          city: customer.deliveryAddressCity,
          state: customer.deliveryAddressState,
          pincode: customer.deliveryAddressPincode,
        },
        gstNumber: customer.gstNumber,
        panNumber: customer.panNumber,
      },
    };
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  // public async updateCustomer(
  //   id: string,
  //   updateData: any,
  //   updatedBy: string,
  // ): Promise<Customer | null> {
  //   console.log('in service', id), console.log('inservice', updateData);
    
  //   const customer = await this.customerRepository.findOne({
  //     where: { id },
  //     relations: [
  //       'customerCategory',
  //       'customerTypes',
  //       'bankDetails',
  //       'bankDetails.bankAddress',
  //       'customerAddress',
  //       'statutoryDetails',
  //       'billingDetails',
  //       'billingDetails.billingAddress',
  //       'deliveryDetails',
  //       'deliveryDetails.deliveryAddress',
  //       'paymentTerms',
  //       'officeUseOnly',
  //       'keyMobileNumbers',
  //       'productSpecification',
  //     ],
  //   });

  //   if (!customer) {
  //     throw new AppError(404, 'Customer not found');
  //   }

  //   const originalCustomer = { ...customer };

  //   // Remove fields that should not be updated
  //   const { 
  //     createdBy, 
  //     createdAt, 
  //     id: updateId, 
  //     createdDate,
  //     createdTime,
  //     ...safeUpdateData 
  //   } = updateData;
    
  //   //console.log('Safe update data (excluding system fields):', safeUpdateData);

  //   const updatedCustomer = this.customerRepository.merge(customer, {
  //     ...safeUpdateData,
  //     updatedBy,
  //   });

  //   const updatedCustomer1 = await this.customerRepository.save(updatedCustomer);

  //   await this.auditLogService.logChange('Customer', id, originalCustomer, updatedCustomer1, updatedBy);
  //   await this.invalidateCustomerCache(id);

  //   return updatedCustomer1;
  // }

  public async updateCustomer(
  id: string,
  updateData: CreateCustomerDto,
  updatedBy: string,
): Promise<Customer | null> {
  return await this.dataSource.transaction(async (manager) => {

    const customer = await manager.findOne(Customer, {
      where: { id },
      relations: [
        'customerCategory',
        'customerTypes',
        'bankDetails',
        'bankDetails.bankAddress',
        'customerAddress',
        'statutoryDetails',
        'billingDetails',
        'billingDetails.billingAddress',
        'deliveryDetails',
        'deliveryDetails.deliveryAddress',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileNumbers',
        'keyMobileNumbers.ref1Address',
        'keyMobileNumbers.ref2Address',
        'productSpecification',
      ],
    });

    console.log("existing customer data...",customer)
    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    const originalCustomer = JSON.parse(JSON.stringify(customer));
    console.log("original Customer data",originalCustomer)

    // ------------------------
    // CUSTOMER BASIC DETAILS
    // ------------------------

    customer.organisationName = updateData.organisationName ?? customer.organisationName;
    customer.customerImage = updateData.customerImage ?? customer.customerImage;
    customer.organisationType = updateData.organisationType ?? customer.organisationType;
    customer.otherType = updateData.otherType ?? customer.otherType;
    customer.primaryContactNo = updateData.primaryContactNo ?? customer.primaryContactNo;
    customer.secondaryContactNo = updateData.secondaryContactNo ?? customer.secondaryContactNo;
    customer.emailPrimary = updateData.emailPrimary ?? customer.emailPrimary;
    customer.emailSecondary = updateData.emailSecondary ?? customer.emailSecondary;

    // ------------------------
    // CATEGORY
    // ------------------------

    if (updateData.customerCategory) {
      const category = await manager.findOne(CustomerCategory, {
        where: { id: String(updateData.customerCategory) },
      });

      if (category) {
        customer.customerCategory = category;
      }
    }

    // ------------------------
    // TYPE
    // ------------------------

    if (updateData.customerTypes) {
      const type = await manager.findOne(CustomerType, {
        where: { id: String(updateData.customerTypes) },
      });

      if (type) {
        customer.customerTypes = type;
      }
    }

    // ------------------------
    // CUSTOMER ADDRESS
    // ------------------------

    if (updateData.customerAddress) {

      if (!customer.customerAddress) {
        customer.customerAddress = new Address();
      }

      Object.assign(
        customer.customerAddress,
        updateData.customerAddress,
      );

      await manager.save(Address, customer.customerAddress);
    }

    // ------------------------
    // BANK DETAILS
    // ------------------------

    if (updateData.bankDetails) {

      if (!customer.bankDetails) {
        customer.bankDetails = new BankDetailsCust();
      }

      Object.assign(
        customer.bankDetails,
        updateData.bankDetails,
      );

      if (updateData.bankDetails.bankAddress) {

        if (!customer.bankDetails.bankAddress) {
          customer.bankDetails.bankAddress = new Address();
        }

        Object.assign(
          customer.bankDetails.bankAddress,
          updateData.bankDetails.bankAddress,
        );

        await manager.save(
          Address,
          customer.bankDetails.bankAddress,
        );
      }

      await manager.save(
        BankDetailsCust,
        customer.bankDetails,
      );
    }

    // ------------------------
    // STATUTORY DETAILS
    // ------------------------

    if (updateData.statutoryDetails) {

      if (!customer.statutoryDetails) {
        customer.statutoryDetails = new StatutoryDetails();
      }

      Object.assign(
        customer.statutoryDetails,
        updateData.statutoryDetails,
      );

      await manager.save(
        StatutoryDetails,
        customer.statutoryDetails,
      );
    }

    // ------------------------
    // BILLING DETAILS
    // ------------------------

    if (updateData.billingDetails) {

      if (!customer.billingDetails) {
        customer.billingDetails = new BillingDetailsCust();
      }

      Object.assign(
        customer.billingDetails,
        updateData.billingDetails,
      );

      if (updateData.billingDetails.billingAddress) {

        if (!customer.billingDetails.billingAddress) {
          customer.billingDetails.billingAddress = new Address();
        }

        Object.assign(
          customer.billingDetails.billingAddress,
          updateData.billingDetails.billingAddress,
        );

        await manager.save(
          Address,
          customer.billingDetails.billingAddress,
        );
      }

      await manager.save(
        BillingDetailsCust,
        customer.billingDetails,
      );
    }

    // ------------------------
    // DELIVERY DETAILS
    // ------------------------

    if (updateData.deliveryDetails) {

      if (!customer.deliveryDetails) {
        customer.deliveryDetails = new DeliveryDetails();
      }

      Object.assign(
        customer.deliveryDetails,
        updateData.deliveryDetails,
      );

      if (updateData.deliveryDetails.deliveryAddress) {

        if (!customer.deliveryDetails.deliveryAddress) {
          customer.deliveryDetails.deliveryAddress = new Address();
        }

        Object.assign(
          customer.deliveryDetails.deliveryAddress,
          updateData.deliveryDetails.deliveryAddress,
        );

        await manager.save(
          Address,
          customer.deliveryDetails.deliveryAddress,
        );
      }

      await manager.save(
        DeliveryDetails,
        customer.deliveryDetails,
      );
    }

    // ------------------------
    // PAYMENT TERMS
    // ------------------------

    if (updateData.paymentTerms) {

      if (!customer.paymentTerms) {
        customer.paymentTerms = new PaymentTerms();
      }

      Object.assign(
        customer.paymentTerms,
        updateData.paymentTerms,
      );

      await manager.save(
        PaymentTerms,
        customer.paymentTerms,
      );
    }

    // ------------------------
    // OFFICE USE ONLY
    // ------------------------

    if (updateData.officeUseOnly) {

      if (!customer.officeUseOnly) {
        customer.officeUseOnly = new OfficeUseOnly();
      }

      Object.assign(
        customer.officeUseOnly,
        updateData.officeUseOnly,
      );

      await manager.save(
        OfficeUseOnly,
        customer.officeUseOnly,
      );
    }

    // ------------------------
    // KEY MOBILE NUMBERS
    // ------------------------

    if (updateData.keyMobileNumbers) {

      if (!customer.keyMobileNumbers) {
        customer.keyMobileNumbers = new keyMobileNoData();
      }

      Object.assign(
        customer.keyMobileNumbers,
        updateData.keyMobileNumbers,
      );

      await manager.save(
        keyMobileNoData,
        customer.keyMobileNumbers,
      );
    }

    // ------------------------
    // PRODUCT SPECIFICATION
    // ------------------------

    if (updateData.productSpecification) {

      await manager.delete(ProductSpecification, {
        customer: {
          id: customer.id,
        },
      });

      for (const item of updateData.productSpecification) {

        const spec = new ProductSpecification();

        Object.assign(spec, item);

        spec.customer = customer;

        await manager.save(
          ProductSpecification,
          spec,
        );
      }
    }

    const savedCustomer = await manager.save(Customer, customer);
    console.log("Saved Customer",savedCustomer)

    await this.auditLogService.logChange(
      'Customer',
      id,
      originalCustomer,
      savedCustomer,
      updatedBy,
    );

    await this.invalidateCustomerCache(id);

    return savedCustomer;
  });
}
  public async getCustomersName(): Promise<{ id: string; organisationName: string }[]> {
    const key = `${CACHE_PREFIX}:names`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const customers = await this.customerRepository.find({
      select: ['id', 'organisationName'],
    });
    const result = customers.map((customer) => ({
      id: customer.id,
      organisationName: customer.organisationName,
    }));
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }
  //TODO:upload customer excel file
  async upload(filePath: string): Promise<any> {
    try {
      // First, download the file from DigitalOcean Spaces
      let fileBuffer: Buffer;
      
      if (filePath.startsWith('https://')) {
        // Extract the key from the URL
        const urlParts = filePath.split('/');
        const key = urlParts.slice(-2).join('/'); // Gets "documents/filename"
        console.log('Downloading file from Spaces with key:', key);
        
        // Download file from Spaces
        fileBuffer = await this.getExcelFromSpaces(key);
      } else {
        // If it's already a local path or key, try to get it from Spaces
        fileBuffer = await this.getExcelFromSpaces(filePath);
      }
      
      // Read the Excel file from buffer instead of file path
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      console.log('Sheet Names:', workbook.SheetNames);

      const sheetName = workbook.SheetNames[0];
      console.log('Sheet Name:', sheetName); // Log the sheet name to verify

      const worksheet = workbook.Sheets[sheetName];
      // Show raw data array
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Raw Data:', rawData);

      const data: any = XLSX.utils.sheet_to_json(worksheet);
      console.log('Data from Excel:', data); // Log the data to see its structure

      // Validate the structure of the data
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid or empty Excel data');
      }
      const customerRepo = this.dataSource.getRepository(Customer);
      const categoryRepo = this.dataSource.getRepository(CustomerCategory);
      const typeRepo = this.dataSource.getRepository(CustomerType);

      const savedCustomers = [];

      for (const row of data) {
        console.log('Row keys:', Object.keys(row)); // Add this line
        let category = null;
        if (row.customerCategory) {
          category = await categoryRepo.findOneBy({ name: row.customerCategory });
          if (!category) {
            category = categoryRepo.create({ name: row.customerCategory });
            await categoryRepo.save(category);
          }
        }

        let type = null;
        if (row.customerType) {
          type = await typeRepo.findOneBy({ name: row.customerType });
          if (!type) {
            type = typeRepo.create({ name: row.customerType });
            await typeRepo.save(type);
          }
        }

        let sequenceNumber = await customerRepo.count();
        const customerCode = `CUST${new Date().getFullYear()}${String(
          ++sequenceNumber,
        ).padStart(4, '0')}`;

        const officeUseOnly = OfficeUseOnly.create({
          proposerBDName: row.proposerDBName,
          pflCoordinator: row.pflCoordinator,
          approvedBy: row.approvedBy,
          relationshipManager: row.relationshipManager,
          createdBy: row.createdBy,
        });

        const keyMobileData = keyMobileNoData.create({
          accDeptFName: row.accDeptFName,
          accDeptLName: row.accDeptLName,
          accDeptMobileNo: row.accDeptMobileNo,
          ownerFName: row.ownerFName,
          ownerLName: row.ownerLName,
          ownerMobileNo: row.ownerMobileNo,
        });

        const productSpecification = ProductSpecification.create({
          articleName: row.articleName,
          packingMaterialSpec: row.packingMaterialSpec,
          parameters: row.parameters,
          rejectionCriteria: row.rejectionCriteria,
          comment: row.comment,
          specifications: row.specifications,
        });

        const bankDetails = BankDetailsCust.create({
          bankAccHolderFName: row.bankAccHolderFName,
          bankAccHolderMName: row.bankAccHolderMName,
          bankAccHolderLName: row.bankAccHolderLName,
          bankName: row.bankName,
          bankBranch: row.bankBranch,
          bankAccNo: row.bankAccNo,
          ifscCode: row.ifscCode,
          accType: row.accType,
          otherAccType: row.otherAccType,
          //ifCancelledCheque: row.ifCancelledCheque,
          // notCancelledChequereason: row.notCancelledChequeReason, // <-- property name must match entity
          //cancelledChequeCopy: row.cancelledChequeCopy,
          //bankStatementCopy: row.bankStatementCopy
        });

        const address = Address.create({
          address1: row.address1,
          address2: row.address2,
          location: row.location,
          city: row.city,
          state: row.state,
          pincode: row.pincode,
        });

        const statutoryDetails = StatutoryDetails.create({
          panNo: row.panNo,
          aadharNo: row.aadharNo,
          // panCopy: row.panCopy,
          //aadharCopy: row.aadharCopy,
          gstn: row.gstn,
          //billBookCopy: row.billBookCopy,
          certificationsDetails: row.certificationsDetails,
          otherCertifications: row.otherCertifications,
          corpRegiDetails: row.corpRegiDetails,
          otherCorpRegiDetails: row.otherCorpRegiDetails,
          //incorpoCertificateCopy: row.incorpoCertificateCopy,
          cinNo: row.cinNo,
          //regiCertificateCopy: row.regiCertificateCopy
        });

        const billingDetails = BillingDetailsCust.create({
          billingName: row.billingName,
          contactPersonFName: row.contactPersonFName,
          contactPersonMName: row.contactPersonMName,
          contactPersonLName: row.contactPersonLName,
          commonlyKnownAs: row.commonlyKnownAs,
          primaryContactNo: row.primaryContactNo_billing,
          secondaryContactNo: row.secondaryContactNo_billing,
          emailPrimary: row.emailPrimary_billing,
          emailSecondary: row.emailSecondary_billing,
          //billingFormatCopy: row.billingFormatCopy,
          //billingAddressProofCopy: row.billingAddressProofCopy
        });

        const deliveryDetails = DeliveryDetails.create({
          //deliveryAddressProofCopy: row.deliveryAddressProofCopy,
          deliveryTime: row.deliveryTime,
          receivingPersonFName: row.receivingPersonFName,
          receivingPersonMName: row.receivingPersonMName,
          receivingPersonLName: row.receivingPersonLName,
          primaryContactNo: row.primaryContactNo_delivery,
          secondaryContactNo: row.secondaryContactNo_delivery,
          emailPrimary: row.emailPrimary_delivery,
          emailSecondary: row.emailSecondary_delivery,
        });

        const paymentTerms = PaymentTerms.create({
          paymentMode: row.paymentMode,
          otherPaymentMode: row.otherPaymentMode,
          otherPaymentMade: row.otherPaymentMade,
          paymentMade: row.paymentMade,
          marginDeposit: row.marginDeposit,
          rtv: row.rtv,
          agreementExecuted: row.agreementExecuted,
          lc: row.lc,
          bg: row.bg,
          securityDepoCheqNo: row.securityDepoCheqNo,
          securityDepoAmt: row.securityDepoAmt,
          IELinAmt: row.IELinAmt,
          IELRecommendedBy: row.IELRecommendedBy,
          IELRecommendedDate: row.IELRecommendedDate,
          RELinAmt: row.RELinAmt,
          RELRecommendedBy: row.RELRecommendedBy,
          RELRecommendedDate: row.RELRecommendedDate,
          reason: row.reason,
          // docEvidenceCopy: row.docEvidenceCopy
        });

        const customerData = {
          organisationName: row.organisationName,
          organisationType: row.organisationType,
          otherType: row.otherType,
          customerCategory: category || undefined,
          customerTypes: type || undefined,
          customerCode: customerCode,
          bankDetails: bankDetails,
          customerAddress: address,
          statutoryDetails: statutoryDetails,
          billingDetails: billingDetails,
          deliveryDetails: deliveryDetails,
          paymentTerms: paymentTerms,
          primaryContactNo: row.primaryContactNo,
          secondaryContactNo: row.secondaryContactNo,
          emailPrimary: row.emailPrimary,
          emailSecondary: row.emailSecondary,
          officeUseOnly: officeUseOnly,
          keyMobileNumbers: keyMobileData,
          productSpecification: [productSpecification],
        };

        const customer = customerRepo.create(customerData);

        await customerRepo.save(customer);
        savedCustomers.push(customer);
      }

      // 🗑️ Delete the file from DigitalOcean Spaces after successful processing
      await this.deleteFileFromSpaces(filePath);
      
      return savedCustomers;
    } catch (error) {
      console.error('Error processing customer upload:', error);
      
      // 🗑️ Still attempt to delete the file even if processing failed
      try {
        await this.deleteFileFromSpaces(filePath);
      } catch (deleteError) {
        console.error('Error deleting file after failed processing:', deleteError);
      }
      
      throw error;
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
   * Get Excel file from DigitalOcean Spaces
   * @param key - Spaces key/path to the Excel file
   * @returns Buffer containing the file data
   */
  private async getExcelFromSpaces(key: string): Promise<Buffer> {
    try {
      console.log('📂 Reading Excel file from Spaces:', key);

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
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

  async submitCustomer(
    customerId: string,
    fileUpdates: Record<string, string | null> = {},
    customerData: Record<string, any> = {},
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['customerAddress', 'bankDetails', 'statutoryDetails', 'billingDetails', 'deliveryDetails', 'paymentTerms', 'keyMobileNumbers', 'officeUseOnly'],
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    console.log(`[submitCustomer] before save - id: ${customerId}, current status: ${customer.status}`);

    customer.status = Status.PENDING;

    // ── Scalar fields apply करा ───────────────────────────────────────────
    const scalarFields: (keyof Customer)[] = [
      'organisationName', 'organisationType', 'otherType',
      'primaryContactNo', 'secondaryContactNo', 'emailPrimary', 'emailSecondary',
      'customerCode',
    ];

    for (const field of scalarFields) {
      if (customerData[field] !== undefined && customerData[field] !== null && customerData[field] !== '') {
        (customer as any)[field] = customerData[field];
      }
    }

    // ── Helper: multipart/form-data madhe nested objects JSON string mhanun yetaat ──
    const parseIfString = (val: any): any => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    // ── Nested relation objects apply करा ─────────────────────────────────
    const nestedRelations = [
      'bankDetails', 'statutoryDetails', 'billingDetails',
      'deliveryDetails', 'paymentTerms', 'keyMobileNumbers',
      'customerAddress', 'officeUseOnly',
    ];
    for (const rel of nestedRelations) {
      const parsed = parseIfString(customerData[rel]);
      if (parsed && typeof parsed === 'object') {
        (customer as any)[rel] = { ...(customer as any)[rel], ...parsed };
      }
    }

    // ── File updates apply करा ────────────────────────────────────────────
    // File keys map to their nested location on the entity
    Object.entries(fileUpdates).forEach(([key, value]) => {
      if (value !== undefined) (customer as any)[key] = value;
    });

    await this.customerRepository.save(customer);
    await this.invalidateCustomerCache(customerId);

    // Fresh fetch to ensure returned status reflects DB state
    const updated = await this.customerRepository.findOne({ where: { id: customerId } });
    console.log(`[submitCustomer] after save - id: ${customerId}, new status: ${updated?.status}`);
    return updated!;
  }

  async approveCustomer(customerId: string, approverId: string, status: Status) {
    // Validate status — only approved or rejected are valid outcomes
    if (status !== Status.APPROVED && status !== Status.REJECTED) {
      throw new AppError(400, `Invalid status '${status}'. Only 'approved' or 'rejected' are allowed.`);
    }

    const approver = await this.userRepository.findOne({
      where: { id: approverId },
    });
    if (!approver) throw new AppError(404, 'Approver not found');

    // Only VERIFIER role can approve/reject customers
    if (!approver.roles || !approver.roles.includes(Role.VERIFIER)) {
      throw new AppError(403, 'Only a Verifier can approve or reject customers');
    }

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new AppError(404, 'Customer not found');

    // Customer must be in 'pending' status — draft means not yet submitted
    if (customer.status !== Status.PENDING) {
      throw new AppError(400, `Customer cannot be approved because its current status is '${customer.status}'. Only customers with status 'pending' can be approved or rejected.`);
    }

    customer.status = status;
    const saved = await this.customerRepository.save(customer);
    await this.invalidateCustomerCache(customerId);
    return saved;
  }
  public async deleteCustomer(id: string): Promise<{ organisationName: string } | null> {
    const customer = await this.customerRepository.findOne({
      where: { id },
    });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `Customer with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Null out customerCode to free the unique constraint slot
    customer.deletionScheduledAt = sixMonthsFromNow;
    customer.customerCode = null as any;
    await this.customerRepository.save(customer);
    await this.invalidateCustomerCache(id);
    return { organisationName: customer.organisationName };
  }

  async softDeleteCustomers(userIds: string[]): Promise<{ affected?: number | null; deleted: { id: string; organisationName: string }[] }> {
    // Fetch names before deletion for activity log
    const customers = await this.customerRepository.find({
      where: { id: In(userIds) },
      select: ['id', 'organisationName'],
    });
    const deleted = customers.map(c => ({ id: c.id, organisationName: c.organisationName }));

    // Null out customerCode before soft-deleting so the unique constraint
    // slot is freed and the code is never re-blocked.
    await this.customerRepository
      .createQueryBuilder()
      .update(Customer)
      .set({ customerCode: () => 'NULL' })
      .where('id IN (:...ids)', { ids: userIds })
      .execute();

    const result = await this.customerRepository.softDelete({ id: In(userIds) });
    await this.invalidateCustomerCache();
    return { affected: result.affected, deleted };
  }
}
