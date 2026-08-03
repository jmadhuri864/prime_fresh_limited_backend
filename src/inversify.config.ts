import { Container } from "inversify";
import { UserController } from "./employee/user.controller";
import { UserService } from "./services/user.service";
import { UserRepository } from "./employee/repository/user.repository";
import { TYPES } from "./types";
import { AuthController } from "./sse/auth.controller";

import { DataSource } from "typeorm";
import { AppDataSource } from "./utils/data-source";

import { VendorService } from "./vendor/createVendor/service/vendor.service";
import { VendorRepository } from "./vendor/createVendor/repository/vendor.repository";
import { VendorController } from "./vendor/createVendor/vendor.controller";
import { VendorSubcategoryService } from "./services/vendorSubcategory.service";
import { VendorSubcategoryRepository } from "./vendor/vendorSubcategory/repository/vendorSubcategory.repository";
import { VendorSubcategoryController } from "./vendor/vendorSubcategory/vendorSubcategory.controller";

import { VendorCategoryRepository } from "./vendor/vendorCategory/vendorCategory.repository";
import { VendorCategoryController } from "./vendor/vendorCategory/vendorCategory.controller";
import { CustomerService } from "./customer/addcustomer/service/customer.service";

import { CustomerRepository } from "./customer/addcustomer/repository/customer.repository";
import { CustomerController } from "./sse/customer.controller";
import { CustomerTypeService } from "./customerType/customerType.service";
import { CustomerTypeRepository } from "./customerType/repository/customerType.repository";
import { CustomerTypeController } from "./sse/customerType.controller";
import { CustomerCategoryRepository } from "./customerCategory/repository/customerCategory.repository";
import { CustomerCategoryController } from "./sse/customerCategory.controller";
import { CustomerCategoryService } from "./customerCategory/service/customerCategory.service";
import { FarmerService } from "./farmer/service/farmer.service";
import { FarmerRepository } from "./farmer/repository/farmer.repository";
import { FarmerController } from "./farmer/controller/farmer.controller";
import { UOMRepository } from "./uom/repository/uom.repository";
import { UOMConversionMatrixRepository } from "./uomMatrix/repository/uomMatrix.repository";
import { UOMConversionMatrixController } from "./uomMatrix/UOMconversionMatrix.controller";
import { UOMConversionMatrixService } from "./services/UOMconversionMatrix.service";
import { UOMService } from "./uom/UOM.service";
import { UOMController } from "./uom/UOM.controller";
import { ProductCategoryService } from "./services/product_category.service";
import { ProductCategoryRepository } from "./product/productCategory/repository/product_category.repository";
import { ProductCategoryController } from "./product/productCategory/controller/productCategory.controller";
import { ProductSubcategoryService } from "./services/product_subcategory";
import { ProductSubcategoryRepository } from "./productSubcategory/product_subcategory.repository";
import { ProductSubcategoryController } from "./productSubcategory/controller/productSubcategory.controller";
import { ProductController } from "./product/createproduct/product.controller";

import { ProductService } from "./product/createproduct/service/product.service";

import { AddressRepository } from "./repositories/address.repository";
import { AddressService } from "./address/address.service";
import { VendorCategoryService } from "./services/vendorCategory.service";


import { DriverController } from "./driver/controller/drivers.controller";
import { DriverRepository } from "./repositories/driver.repository";
import { DriversService } from "./driver/service/driver.service";
import { ProductClassificationService } from "./services/product_classification.service";
import { ProductClassificationController } from "./product/productClassification/controller/productClassification.controller";
import { ProductRepository } from "./product/createproduct/repository/product.repository";

import { BankDetailsCustRepository } from "./customer/addcustomer/repository/bank-detailsCust.repository";

import { BankDetailsCust } from "./entities/bankDetailsCust.entity";

import { BillingDetailsCustRepository } from "./customer/addcustomer/repository/billingDetailsCust.repository";
import { BillingDetailsCust } from "./entities/billingdetailsCust.entity";

import { BranchessRepository } from "./repositories/branches.repository";
import { Branches } from "./entities/branches.entity";
import { BranchessService } from "./branch/service/branches.service";
import { BranchessController } from "./sse/branches.controller";
import { Address } from "./address/address.entity";
import { OfficesRepository } from "./office/repository/offices.repository";
import { OfficesData } from "./entities/offices.entity";
import { OfficesService } from "./office/office.service";
import { OfficesController } from "./sse/offices.controller";
import { Vendor } from "./vendor/createVendor/vendor.entity";

import { Crop } from "./farmer/crop.entity";
import { CropRepository } from "./repositories/crop.repository";
import { Farmer } from "./entities/farmer.entity";
import { DeliveryDetails } from "./entities/deliveryDetailsCust.entity";
import { DeliveryDetailsCustRepository } from "./customer/addcustomer/repository/deliveryDetailsCust.repository";

import { StatutoryDetails } from "./entities/statutoryCust.entity";
import { StatutoryDetailsCustRepository } from "./customer/addcustomer/repository/statutoryDetails.repository";

import { ProductSpecification} from "./entities/productSpecificationCust.entity";
import { ProductSpecificationCustRepository } from "./customer/addcustomer/repository/productspecification.repository";

import { BankDetailsvendRepository } from "./vendor/createVendor/repository/vendorBankDetails.repository";
import { BankDetailsvend } from "./entities/bankDetailsVend.entity";
import { VendorSaleInfo } from "./entities/vendorsaleinfo.entity";
import { VendorSaleInfoRepository } from "./vendor/createVendor/repository/vendorSaleInfo.repository";
import { BankDetailsvendService } from "./services/vendorBankDetails.service";
import { VendorSaleInfoService } from "./vendor/createVendor/vendorsaleinfo.service";
import { PaymentTermsRepository } from "./customer/addcustomer/repository/paymentTermsCust.repository";
import { PaymentTerms } from "./entities/paymentDetailsCust.entity";
import { PaymentTermsService } from "./customer/addcustomer/paymentTerms.service";
import { keyMobileNoData } from "./entities/keyMobileNoCust.entity";
import { KeyMobileNoDataRepository } from "./customer/addcustomer/repository/keyMobileNoDataCust.repository";
import { KeyMobileNoDataService } from "./services/keymobilenocust.service";
import { RFPA } from "./rfpa/rfpa.entity";
import { RfpaRepository } from "./repositories/rfpa.repository";
import { RfpaService } from "./rfpa/service/rfpa.service";
import { RfpaController } from "./rfpa/controller/rfpa.controller";
import { DealSlip } from "./entities/dealSlip.entity";
import { DealSlipRepository } from "./dealSlip/repository/dealSlip.repository";
import { DealSlipService } from "./dealSlip/service/dealSlip.service";
import { DealSlipController } from "./dealSlip/controller/dealSlip.controller";

import { UOM } from "./entities/uom.entity";
import { Product } from "./entities/product.entity";
import { GRN } from "./grn/grn.entity";
import { GrnRepository } from "./repositories/grn.repository";
import { GrnService } from "./services/grn.service";
import { GrnController } from "./grn/controller/grn.controller";
import { GrnReportService } from "./reports/grnReport.service";
import { GrnReportController } from "./reports/grnReport.controller";
import { DeliveryChallanReportService } from "./services/deliveryChallanReport.service";
import { DeliveryChallanReportController } from "./reports/deliveryChallanReport.controller";
import { GrnProduct } from "./grn/entity/grnProduct.entity";
import { GrnProductRepository } from "./repositories/grnProduct.repository";
import { GrnProductService } from "./grn/grnProduct.service";
import {  NotificationRepository } from "./notification/notification.repository";
import { Notification } from "./notification/notifications.entity";
import { NotificationService } from "./services/notification.service";
import { TPVoucher } from "./vouchers/tranportPaymentV/entity/transportPaymentvoucher.entity";
import { TPVoucherRepository } from "./vouchers/tranportPaymentV/transportPaymentV.repository";
import { TPVoucherService } from "./services/transportPaymentV.service";
import { TPVoucherController } from "./vouchers/tranportPaymentV/controller/transportPaymentV.controller";
import { PMPVoucherRepository } from "./repositories/pmpvoucher.repository";
import { PMPVoucher } from "./vouchers/paymentMaterialV/entity/packingMaterialVoucher.entity";
import { PMPVoucherService } from "./services/pmpvoucher.service";
import { PMPVoucherController } from "./vouchers/paymentMaterialV/controller/pmpVoucher.controller";
import { CashVoucher } from "./vouchers/multiCashV/entity/mCashVoucher.entity";
import { MultiCashVoucherService } from "./services/multiCashVoucher.service";
import { MultiCashVoucherController } from "./sse/multiCashVoucher.controller";
import { LPVoucher } from "./vouchers/labourPaymentV/entity/labourPaymentVoucher.entity";
import { LabourPaymentVoucherRepository } from "./repositories/labourPaymentVoucher.repository";
import { LabourPaymentVoucherService } from "./services/labourPaymentVoucher.service";
import { LabourPaymentVoucherController } from "./vouchers/labourPaymentV/controller/labourPaymentVoucher.controller";
import { MultiCashVoucherRepository } from "./vouchers/multiCashV/multicashVoucher.repository";
import { ApprovalLevel } from "./approvalFlow/entity/approvalLevel.entity";
import { ApprovalLevelRepository } from "./repositories/approvalLevel.repository";
import { ApprovalLevelService } from "./services/approvalLevel.service";
import { ApprovalLevelController } from "./approvalFlow/controller/approvalLevel.controller";
import { DeliveryChallanPurchase } from "./entities/deliveryChallan.entity";
import { DeliveryChallanRepository } from "./deliveryChallans/deliverychllan/repository/deliveryChallan.repository";
import { DeliveryChallanController } from "./sse/deliveryChallan.controller";
import { DeliveryChallanService } from "./deliveryChallans/deliverychllan/deliveryChallan.service";
import { ProductCategory } from "./product/productCategory/product_category.entity";
import { ProductClassificationRepository } from "./product/productClassification/product_classification.repository";
import { ProductClassification } from "./product/productClassification/entity/product_classification.entity";
import { PaymentRequestRepository } from "./paymentReq/repository/paymentRequest.repository";
import { PaymentRequestService } from "./paymentReq/paymentRequest.service";
import { PaymentRequest } from "./entities/paymentRequest.entity";
import { PaymentRequestController } from "./paymentReq/paymentRequest.controller";
import { VendorSubcategory } from "./entities/vendorSubcategory.entity";
import { VendorCategory } from "./vendor/vendorCategory/entity/vendorCategory.entity";
import { DitemRepository } from "./deliveryChallans/deliverychllan/repository/dItem.repository";
import { Item } from "./deliveryChallans/deliverychllan/dItem.entity";
import { AuditLog } from "./entities/auditLog.entity";
import { AuditLogRepository } from "./employeeActivity/repository/AuditLog.repository";
import { AuditLogService } from "./services/auditLog.service";
import { AuditLogController } from "./employeeActivity/auditLog.controller";
import { SystemLog} from "./entities/userSystemInfo.entity";
import { UserSystemInfoRepository } from "./employeeSystemInfo/repository/userSystemInfo.repository";

// import { Server } from "socket.io";
import { NotificationController } from "./notification/notification.controller";
import { RequestsRepository } from "./sse/requests.repository";
import { Requests } from "./entities/request.entity";

import { LevelsController } from "./levels/levels.controller";
import { LevelsRepository } from "./repositories/levels.repository";
import { Levels } from "./levels/levels.entity";
import { LevelsService } from "./levels/service/levels.service";
import { User } from "./entities/user.entity";
import { RequestsService } from "./sse/request.service";
import { InwardRegister } from "./entities/inwardRegister.entity";
import { InwardRepository } from "./inwardRegister/repository/inwardRegister.repository";
import { InwardRegisterService } from "./inwardRegister/service/inwardRegister.service";
import { InwardRegisterController } from "./sse/inwardRegister.controller";
import { DepartmentforApproveRepository } from "./repositories/departmentforapprove.repository";
import { Departments } from "./approvalFlow/entity/deparmentforapproval.entity";

import { LaborRegister } from "./entities/labourregister.entity";
import { LaborRegisterRepository } from "./labour/repository/labourRegister.repository";
import { LaborRegisterService } from "./labour/labourRegister.service";
import { LaborRegisterController } from "./labour/labourRegister.controller";
import { LaborAttendance } from "./labourAttendence/laborattendance.entity";
import { LaborAttendancesRepository } from "./repositories/labourAttendances.repository";
import { LaborAttendancesService } from "./labourAttendence/service/labourAttendence.service";
import { LaborAttendancesController } from "./labourAttendence/labourAttendances.controller";
import { LaborRepository } from "./repositories/labor.repository";
import { Labor } from "./labour/labor.entity";
import { LaborService } from "./labour/service/labor.service";
import { LaborController } from "./labour/labor.controller";
import { DumpRegisterRepository } from "./dumpRegister/repository/dumpRegister.repository";
import { DumpRegister } from "./entities/dumpRegister.entity";
import { DumpRegisterService } from "./dumpRegister/dumpRegister.service";
import { DumpRegisterController } from "./dumpRegister/controller/dumpRegister.controller";
import { SkuEodRepository } from "./eodStock/skuEod.repository";
import { SkuEodReport } from "./eodStock/skuStock.entity";
import { SKUEodStockService } from "./eodStock/service/skuEodStock.service";
import { EodRepository } from "./eodStock/repository/eodstockreport.repository";

import { EodStockService } from "./eodStock/eodStock.service";
import { SkuEodStockController } from "./sse/skuEodStock.controller";
import { EodStockController } from "./sse/eodStock.controller";
import { VehicleDispatch } from "./entities/vehicleDispatch.entity";
import { VehicleDispatchRepository } from "./vehicleDispatch/repository/vehicleDispatch.repository";
import { VehicleDispatchService } from "./vehicleDispatch/vehicleDispatch.service";
import { VehicleDispatchController } from "./vehicleDispatch/controller/vehicleDispatch.controller";
import { Aqr } from "./entities/aqr.entity";
import { AqrRepository } from "./repositories/aqr.repository";
import { AqrService } from "./aqr/service/aqr.service";
import { AqrController } from "./sse/aqr.contoller";
import { QualityParameter } from "./product/createproduct/entity/quantityParameter.entity";
import { QualityParameterRepository } from "./repositories/qualityParameter.repository";
import { SecondSale } from "./entities/secondSale.entity";
import { SecondSaleService } from "./services/secondSale.service";
import { SecondSaleRepository } from "./secondSale/repository/secondSale.repository";
import { SecondSaleController } from "./secondSale/controller/secondSale.controller";

import { DumpProductRepository } from "./dumpRegister/repository/dumpProduct.repository";
import { DumpProduct } from "./dumpRegister/dumpProduct.entity";


import { SecondSaleProduct } from "./secondSale/entity/secondSaleProduct.entity";
import { SecondSaleProductRepository } from "./secondSale/secondSaleProduct.repository";



import { SaleOrder } from "./saleOrder/saleOrder.entity";
import { SaleOrderRepository } from "./repositories/saleOrder.repository";
import { SaleOrderService } from "./services/saleOrder.service";
import { SaleOrderController } from "./saleOrder/saleOrder.controller";
import { Invoice } from "./entities/invoice.entity";
import { InvoiceProduct } from "./invoice/entity/invoiceProduct.entity";
import { InvoiceRepository } from "./invoice/repository/invoice.repository";
import { InvoiceProductRepository } from "./repositories/invoiceProduct.repository";

import { PostReturnByCustomer } from "./returnByCustomer/postReturnByCustomer.entity";
import { PostReturnByCustomerRepository } from "./repositories/postReturnByCustomer.repository";
import { PostReturnByCustomerService } from "./services/postReturnByCustomer.service";
import { PostReturnByCustomerController } from "./sse/postReturnByCustomer.controller";
import { PdfGeneratorService } from "./utils/pdfGenerator";
import { CompanyRepository } from "./company/repository/company.repository";
import { Company } from "./entities/company.entity";
import { CompanyController } from "./company/company.controller";
import { CompanyService } from "./services/company.service";
import { Customer } from "./entities/customer.entity";
import { ProcurmentDashController } from "./dashboard/procurmentDashboard.controller";
import { ProcurmentDashService } from "./dashboard/service/procurmentDashbord.service"
import { ManagementDashService } from "./dashboard/managementDashboard.service";
import { ManagementDashController } from "./dashboard/managementDashboard.controller";
import { ReturnedProducts } from "./entities/returnProduct.entity";
import { ReturnedProductsRepository } from "./returnByCustomer/repository/returnProduct.repository";

import { StockReportEod } from "./entities/eodReportforinvendtory.entity";
import { ProductVarientsRepository } from "./product/productVarient/repository/productVarients.repository";

import { ProductVarientService } from "./product/productVarient/productVarient.service";
import { ProductVarientController } from "./product/productVarient/productVarient.controller";
import { InventoryStockRepository } from "./inventoryStock/repository/inventoryStock.repository";
import { InventoryStock } from "./entities/inventoryStock.entity";
import { InventoryStockController } from "./inventoryStock/inventoryStock.controller";
import { InventoryStockService } from "./services/inventoryStock.service";
import { PackingMaterial } from "./entities/packingMaterial.entity";
import { PackingMaterialRepository } from "./packingMaterial/repository/packingMaterial.repository";
import { PackingMaterialService } from "./packingMaterial/packingMaterial.service";
import { PackingMaterialController } from "./sse/packingMaterial.controller";
import { DocumentDefinition } from "./documentDef/documentdef.entity";
import { DocumentDefinitionRepository } from "./repositories/documentDefination.repository";
import { DocumentDefinitionService } from "./documentDef/documentDefinition.service";
import { DocumentDefinitionController } from "./documentDef/documentDefination.controller";
import { DocumentPermission } from "./employee/permission.entity";
import { DocumentPermissionRepository } from "./repositories/documentPermission.repository";
import { DocumentPermissionService } from "./employee/documentPermission.service";
import { DocumentPermissionController } from "./employee/documentPermission.controller";

import { CustomerDeliveryChallan } from "./entities/customerDeliveryChallan.entity";
import { CustomerDeliveryChallanRepository } from "./deliveryChallans/customerDeliveryChllan/repository/customerDeliveryChallan.repository";
import { CustomerDeliveryChallanService } from "./deliveryChallans/customerDeliveryChllan/service/customerDeliveryChallan.service";
import { CustomerDeliveryChallanController } from "./sse/customerDeliveryChallan.controller";
import { FinalInvoiceService } from "./invoice/finalInvoice.service";
import { FinalInvoiceController } from "./invoice/controller/finalInvoice.controller";
import { StockTranferDeliveryChallanController } from "./deliveryChallans/stockTransferDC/controller/stockTransferDeliveryChallan.controllers";
import { StockTransferDeliveryChallan } from "./entities/stockTransferdeliveryChallan.entity";
import { StockTransferDeliveryChallanService } from "./deliveryChallans/stockTransferDC/service/stockTransferDeliveryChallan.service";
import { StockTransferDeliveryChallanRepository } from "./deliveryChallans/stockTransferDC/repository/stockTransferDeliveryChallan.repository";
import { OtherDeliveryChallan } from "./entities/otherDeliveryChallan.entity";
import { OtherDeliveryChallanRepository } from "./deliveryChallans/otherDeliveryChallan/repository/otherDeliveryChallan.repository";
import { OtherDeliveryChallanService } from "./deliveryChallans/otherDeliveryChallan/service/otherDeliveryChallan.service";
import { OtherDeliveryChallanController } from "./deliveryChallans/otherDeliveryChallan/controller/otherDeliveryChallan.controller";
import { ReportingManagersRepository } from "./employee/repository/reportingmanager.repository";

import { ApprovalFlowRepository } from "./approvalFlow/repository/approvalFlow.repository";
import { ApprovalFlow } from "./entities/approvalFlow.entity";
import { ApprovalFlowService } from "./services/approvalFlow.service";
import { ApprovalFlowController } from "./approvalFlow/controller/approvalFlow.controller";
import { FinalizerBlockRepository } from "./repositories/finalizerBlock.repository";
import { FinalizerBlock } from "./approvalFlow/finalizerBlock.entity";
import { ApproverBlock } from "./entities/approvalBlock.entity";
import { ApproverBlockRepository } from "./entities/approverBlock.entity";
import { DocumentbRepository } from "./repositories/documentb.repository";
import { Documentb } from "./approvalFlow/entity/docuemnt.entity";
import { DocumentbController } from "./approvalFlow/controller/documentb.controller";
import { DocumentbService } from "./services/documentb.service";
import { ApprovalStageInfo } from "./approvalFlow/entity/approvalname.entity";
import { ApprovalStageInfoRepository } from "./approvalFlow/repository/approvalStageInfoRepository";
import { DocumentApprovalFlowRepository } from "./approvalFlow/repository/DocumentApprovalFlowRepository.repository";
import { DocumentApprove } from "./entities/documentApproval.entity";
import { DocumentApprovalFlow } from "./entities/documentApproveBy.entity";
import { DocDoubleApproverService } from "./services/docDoubleApprover.service";
import { DocSingalApproverService } from "./services/DocSingalApproverService.service";

import { AdminDashboardController } from "./dashboard/adminDashboard.controller";
import { AdminDashboardService } from "./dashboard/dashboardService/admin/adminDashboardService.service";
import { InwardProduct } from "./inwardRegister/inwardProduct.entity";
import { InwardProductRepository } from "./inwardRegister/repository/inwardProduct.repository";
import { AddressController } from "./address/address.controller";
import { ProductVarientRepository } from "./product/productVarient/repository/varients.repository";
import { ProductVarient } from "./entities/productVarient.entity";
import { ProductVarientsService } from "./services/varients.service";
import { VarientsController } from "./product/productVarient/varient.controller";
import { ExcelController } from "./getExcel/getexcel.controller";
import { ActiveSession } from "./employee/activeSession.entity";
import { ActiveSessionRepository } from "./employee/repository/activeSession.repository";
import { UserReportController } from "./employeeReport/userReport.controller";
import { UserReportService } from "./employeeReport/userreport.service";
import { SuperAdminService } from "./sse/superadmin.service";
import { SuperAdminController } from "./sse/superAdmin.controller";

// Report imports
import { ReportController } from "./reports/report.controller";
import { ReportService } from "./services/report.service";
import { SalesReportService } from "./reports/salesReport.service";

import { RoleRepository } from "./sse/role.repository";
import { Role } from "./entities/role.entity";
import { StockCorrectionRepository } from "./stockCorrection/repository/stockCorrection.repository";
import { StockCorrectionService } from "./stockCorrection/service/stockCorrection.service";
import { StockCorrectionController } from "./stockCorrection/stockCorrection.controller";
import { StockCorrection } from "./stockCorrection/stockCorrection.entity";
// SSE Service and Controller
import { SSEService } from "./sse/sse.service";
import { SSEController } from "./sse/sse.controller";
import { SSEHelperService } from "./utils/SSE_HELPER_SERVICE";
// Performance optimization services
import { CacheService } from "./global/cache.service";
import { QueryOptimizerService } from "./global/queryOptimizer.service";
import { CrystalReportService } from "./services/crystalReport.service";
// Procurement Crystal Report
import { ProcurementCrystalReportService } from "./reports/service/procurementCrystalReport.service";
import { ProcurementCrystalReportController } from "./reports/procurementCrystalReport.controller";

// Sales Crystal Report
import { SalesCrystalReportService } from "./reports/salesCrystalReport.service";
import { SalesCrystalReportController } from "./reports/salesCrystalReport.controller";
// User Activity Logging
import { UserActivityLog } from "./employeeActivity/userActivityLog.entity";
import { UserActivityLogRepository } from "./repositories/userActivityLog.repository";
import { UserActivityLogService } from "./employeeActivity/service/userActivityLog.service";
import { UserActivityLogController } from "./employeeActivity/userActivityLog.controller";
//import { LogCleanupService } from "./services/lo";
import { WorkflowHierarchy } from "./entities/workflowClosure.entity";
import { WorkflowHierarchyRepository } from "./workFlow/repository/WorkflowHierarchy.repository";
import { WorkflowHierarchyService } from "./workFlow/workFlowHierarchy.service";
import { WorkflowHierarchyController } from "./workFlow/WorkflowHierarchy.controller";
import { ProcurementTargetRepository } from "./procurementTarget/repository/procurementTarget.repository";
import { ProcurementTarget } from "./entities/procurmentTarget.entity";
import { ProcurementTargetService } from "./services/procurementTarget.service";
import { ProcurementTargetController } from "./procurementTarget/procurementTarget.controller";
import { SalesTarget } from "./entities/salesTarget.entity";
import { SalesTargetRepository } from "./salesTarget/repository/salesTarget.repository";
import { SalesTargetService } from "./services/salesTarget.service";
import { SalesTargetController } from "./salesTarget/salesTarget.controller";
import { SalesTargetProduct } from "./salesTarget/entity/salesTargetProduct.entity";
import { SalesTargetWeekRepository } from "./salesTarget/repository/salesTargetWeek.repository";
import { SalesTargetProductRepository } from "./salesTarget/salesTargetProduct.repository";
import { SalesTargetWeek } from "./salesTarget/salesTargetWeek.entity";
import { SalesAchievementRepository } from "./salesTarget/repository/salesAchievement.repository";
import { SalesAchievement } from "./entities/salesachivement.entity";
//import { DashboardService } from "./services/dash;

import { ProcurementTargetProduct } from "./procurementTarget/procurementTargetProduct.entity";
import { ProcurementTargetProductRepository } from "./procurementTarget/repository/procurmentTargetProduct.repository";
import { ProcurementTargetWeek } from "./entities/procurementTargetWeek.entity";
import { ProcurementTargetWeekRepository } from "./procurementTarget/repository/procurmentTargetWeek.repository";
import { ProcurementTargetAchievementRepository } from "./procurementTarget/procurmentAchievement.repository";
import { ProcurementAchievement } from "./procurementTarget/entity/procurementAchievement.entity";
import { PaymentInfoForRFPA } from "./entities/rfpaPayementInfo.entity";
import { RfpaPaymentInfoRepository } from "./rfpa/repository/rfpaPaymentInfo.repository";
import { RegistrationReportsController } from "./reports/registrationReport.controller";
import { RegistrationReportService } from "./reports/registrationReport.service";
import { NewRegistrationController } from "./reports/newRegistration.controller";
import { NewRegistrationService } from "./reports/newRegistration.service";
import { ReturnToVendorService } from "./returnToVendor/service/retrunToVendor.service";
import { ReturnToVendorRepository } from "./returnToVendor/repository/returnToVendor.repository";
import { ReturnToVendor } from "./entities/returnToVendor.entity";
import { ReturnToVendorController } from "./returnToVendor/controller/returnToVendor.controller";
import { FinalInvoiceReportController } from "./reports/finalInvoiceReport.controller";
import { FinalInvoiceReportService } from "./reports/finalInvoiceReport.service";
// Test Controller
import { TestController } from "./sse/test.controller";
import { DashboardService } from "./dashboard/dashboard.service";
import { DashboardController } from "./dashboard/dashboard.controller";

import { GrnProductHistoryService } from "./services/grnProductHistory.service";
import { GrnProductHistory } from "./grn/entity/grnProductHistory.entity";
import { GrnProductHistoryRepository } from "./repositories/grnProductHistory.repository";
const container = new Container();
//socket server
// Initialize Socket.IO server
//const io = new Server();
// Bind to the container
//container.bind<Server>(TYPES.SocketIoServer).toConstantValue(io);
// Define a helper function for repository binding
// // Initialize Socket.IO server
// const io = new SocketIOServer();
// // Bind to the container
// container.bind<SocketIOServer>(TYPES.SocketIoServerOne).toConstantValue(io);

container.bind<DataSource>(TYPES.DataSource).toConstantValue(AppDataSource);

// ----- User-related bindings -----


container
  .bind<UserController>(TYPES.UserController)
  .to(UserController)
  .inSingletonScope();
container
  .bind<UserService>(TYPES.UserService)
  .to(UserService)
  .inSingletonScope();

    // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<UserRepository>(TYPES.UserRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(User).extend(UserRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<AuthController>(TYPES.AuthController)
  .to(AuthController)
  .inSingletonScope();
 
//-------------------------------------------vendor-Category-----------------------------//
// Bind your services and repositories
// Bind DataSource (make sure to initialize it somewhere in your code)
//container.bind<DataSource>(TYPES.DataSource).toConstantValue(AppDataSource);
//address
// container
//   .bind<AddressRepository>(TYPES.AddressRepository)
//   .to(AddressRepository)
//   .inSingletonScope();
// Assuming TYPES.BankDetailsCustRepository is a symbol or string used to identify the repository
container.bind<AddressRepository>(TYPES.AddressRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Address).extend(AddressRepository);
}).inRequestScope()
  container
  .bind<AddressController>(TYPES.AddressController)
  .to(AddressController)
  .inSingletonScope();
  container
  .bind<AddressService>(TYPES.AddressService)
  .to(AddressService)
  .inSingletonScope();

  //vendor category
 // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
 container.bind<VendorCategoryRepository>(TYPES.VendorCategoryRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorCategory).extend(VendorCategoryRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<VendorCategoryController>(TYPES.VendorCategoryController)
  .to(VendorCategoryController)
  .inSingletonScope();
  container
  .bind<VendorCategoryService>(TYPES.VendorCategoryService)
  .to(VendorCategoryService)
  .inSingletonScope();

//---------------vendorSubcategory-------------------------------
container
  .bind<VendorSubcategoryService>(TYPES.VendorSubcategoryService)
  .to(VendorSubcategoryService)
  .inSingletonScope();
   // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<VendorSubcategoryRepository>(TYPES.VendorSubcategoryRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorSubcategory).extend(VendorSubcategoryRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<VendorSubcategoryController>(TYPES.VendorSubcategoryController)
  .to(VendorSubcategoryController)
  .inSingletonScope();

//------------------Vendor------------------------------------------
container
  .bind<VendorService>(TYPES.VendorService)
  .to(VendorService)
  .inSingletonScope();
// container
//   .bind<VendorRepository>(TYPES.VendorRepository)
//   .to(VendorRepository)
//   .inSingletonScope();
  // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<VendorRepository>(TYPES.VendorRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Vendor).extend(VendorRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<VendorController>(TYPES.VendorController)
  .to(VendorController)
  .inSingletonScope();

//---------------------------Customer------------------------
container
  .bind<CustomerService>(TYPES.CustomerService)
  .to(CustomerService)
  .inSingletonScope();
// container
//   .bind<CustomerRepository>(TYPES.CustomerRepository)
//   .to(CustomerRepository)
//   .inSingletonScope();

  container.bind<CustomerRepository>(TYPES.CustomerRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Customer).extend(CustomerRepository);
  }).inRequestScope();
container
  .bind<CustomerController>(TYPES.CustomerController)
  .to(CustomerController)
  .inSingletonScope();

//---------------------------CustomerType------------------------
container
  .bind<CustomerTypeService>(TYPES.CustomerTypeService)
  .to(CustomerTypeService)
  .inSingletonScope();
container
  .bind<CustomerTypeRepository>(TYPES.CustomerTypeRepository)
  .to(CustomerTypeRepository)
  .inSingletonScope();
container
  .bind<CustomerTypeController>(TYPES.CustomerTypeController)
  .to(CustomerTypeController)
  .inSingletonScope();

//-----------------CustomerCategory-----------------

container
  .bind<CustomerCategoryService>(TYPES.CustomerCategoryService)
  .to(CustomerCategoryService)
  .inSingletonScope();
container
  .bind<CustomerCategoryRepository>(TYPES.CustomerCategoryRepository)
  .to(CustomerCategoryRepository)
  .inSingletonScope();
container
  .bind<CustomerCategoryController>(TYPES.CustomerCategoryController)
  .to(CustomerCategoryController)
  .inSingletonScope();

//----------------------Farmer-----------------------------

container
  .bind<FarmerService>(TYPES.FarmerService)
  .to(FarmerService)
  .inSingletonScope();

  container.bind<FarmerRepository>(TYPES.FarmerRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Farmer).extend(FarmerRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<FarmerController>(TYPES.FarmerController)
  .to(FarmerController)
  .inSingletonScope();
//----------------------Crop-----------------------------




  container.bind<CropRepository>(TYPES.CropRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Crop).extend(CropRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
  


//------------------------UOMconversionMatrix-----------------------------
container
  .bind<UOMConversionMatrixService>(TYPES.UOMConversionMatrixService)
  .to(UOMConversionMatrixService)
  .inSingletonScope();
container
  .bind<UOMConversionMatrixRepository>(TYPES.UOMConversionMatrixRepository)
  .to(UOMConversionMatrixRepository)
  .inSingletonScope();
container
  .bind<UOMConversionMatrixController>(TYPES.UOMConversionMatrixController)
  .to(UOMConversionMatrixController)
  .inSingletonScope();

//------------------------UOM-----------------------------------

container.bind<UOMRepository>(TYPES.UOMRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(UOM).extend(UOMRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<UOMService>(TYPES.UOMService).to(UOMService);
container.bind<UOMController>(TYPES.UOMController).to(UOMController);

//----------------------Product_Category-------------------------
container
  .bind<ProductCategoryService>(TYPES.ProductCategoryService)
  .to(ProductCategoryService)
  .inSingletonScope();

  container.bind<ProductCategoryRepository>(TYPES.ProductCategoryRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(ProductCategory).extend(ProductCategoryRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<ProductCategoryController>(TYPES.ProductCategoryController)
  .to(ProductCategoryController)
  .inSingletonScope();

//----------------------------Product_Subcategory------------
container
  .bind<ProductSubcategoryService>(TYPES.ProductSubcategoryService)
  .to(ProductSubcategoryService)
  .inSingletonScope();
container
  .bind<ProductSubcategoryRepository>(TYPES.ProductSubcategoryRepository)
  .to(ProductSubcategoryRepository)
  .inSingletonScope();
container
  .bind<ProductSubcategoryController>(TYPES.ProductSubcategoryController)
  .to(ProductSubcategoryController);

//----------------------------Product---------------------------------------

container.bind<ProductService>(TYPES.ProductService).to(ProductService);



  container.bind<ProductRepository>(TYPES.ProductRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Product).extend(ProductRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<ProductController>(TYPES.ProductController)
  .to(ProductController);


 

//-------------------------driver------------------------------
container.bind<DriversService>(TYPES.DriversService).to(DriversService);
container.bind<DriverRepository>(TYPES.DriverRepository).to(DriverRepository).inSingletonScope();
container.bind<DriverController>(TYPES.DriverController).to(DriverController).inSingletonScope();
//-------------------------------productclassfication------------------------------
container.bind<ProductClassificationService>(TYPES.ProductClassificationService).to(ProductClassificationService);
container.bind<ProductClassificationController>(TYPES.ProductClassificationController).to(ProductClassificationController);

container.bind<ProductClassificationRepository>(TYPES.ProductClassificationRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductClassification).extend(ProductClassificationRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//--------------------------bank-detailscust-----------
// container.bind(TYPES.BankDetailsCustRepository).toDynamicValue((context) => {
//   const dataSource = context.container.get<DataSource>(TYPES.DataSource);
//   return dataSource.getRepository(BankDetailsCustRepository);
// });
// Assuming TYPES.BankDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BankDetailsCustRepository>(TYPES.BankDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BankDetailsCust).extend(BankDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//container.bind<BankDetailsCustRepository>(TYPES.BankDetailsCustRepository).to(BankDetailsCustRepository);


//-----------------------------------billingDetailsCust----------------------------
// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BillingDetailsCustRepository>(TYPES.BillingDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BillingDetailsCust).extend(BillingDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements



// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BranchessRepository>(TYPES.BranchessRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Branches).extend(BranchessRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<BranchessService>(TYPES.BranchessService).to(BranchessService);
container.bind<BranchessController>(TYPES.BranchessController).to(BranchessController);

// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<OfficesRepository>(TYPES.OfficesRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(OfficesData).extend(OfficesRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<OfficesService>(TYPES.OfficesService).to(OfficesService);
container.bind<OfficesController>(TYPES.OfficesController).to(OfficesController);
//----------------------------deliveryDetailsCust---------------
container.bind<DeliveryDetailsCustRepository>(TYPES.DeliveryDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DeliveryDetails).extend(DeliveryDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements



//----------------------------statutorydetailsCust---------------
container.bind<StatutoryDetailsCustRepository>(TYPES.StatutoryDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StatutoryDetails).extend(StatutoryDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements



//---------------------------payment_terms_customer---------------------------------
// Assuming TYPES.paymentTermsRepository is a symbol or string used to identify the repository
container.bind<PaymentTermsRepository>(TYPES.PaymentTermsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentTerms).extend(PaymentTermsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<PaymentTermsService>(TYPES.PaymentTermsService).to(PaymentTermsService)
//----------------------------productSpecificationCust---------------
container.bind<ProductSpecificationCustRepository>(TYPES.ProductSpecificationCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductSpecification).extend(ProductSpecificationCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//--------------------------------keyMobileNumber-----------------------------------------
container.bind<KeyMobileNoDataRepository>(TYPES.KeyMobileNoDataRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(keyMobileNoData).extend(KeyMobileNoDataRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<KeyMobileNoDataService>(TYPES.KeyMobileNoDataService).to(KeyMobileNoDataService);
//---------------------------bankdetailsvend---------------------------------
// Assuming TYPES.BankDetailsvendRepository is a symbol or string used to identify the repository
container.bind<BankDetailsvendRepository>(TYPES.BankDetailsvendRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BankDetailsvend).extend(BankDetailsvendRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<BankDetailsvendService>(TYPES.BankDetailsvendService).to(BankDetailsvendService)
//-------------------------------------vendor_sale_info----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<VendorSaleInfoRepository>(TYPES.VendorSaleInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorSaleInfo).extend(VendorSaleInfoRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<VendorSaleInfoService>(TYPES.VendorSaleInfoService).to(VendorSaleInfoService)

//-------------------------------------rfpa----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<RfpaRepository>(TYPES.RfpaRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(RFPA).extend(RfpaRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<RfpaService>(TYPES.RfpaService).to(RfpaService);
container.bind< RfpaController>(TYPES.RfpaController).to( RfpaController);

//-------------------------------------deal-slip----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<DealSlipRepository>(TYPES.DealSlipRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DealSlip).extend(DealSlipRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DealSlipService>(TYPES.DealSlipService).to(DealSlipService);
container.bind<DealSlipController>(TYPES.DealSlipController).to( DealSlipController);

//----------------------------------Grn---------------------------------
container.bind<GrnRepository>(TYPES.GrnRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(GRN).extend(GrnRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<GrnService>(TYPES.GrnService).to(GrnService);
container.bind<GrnController>(TYPES.GrnController).to(GrnController);
container.bind<GrnReportService>(TYPES.GrnReportService).to(GrnReportService);
container.bind<GrnReportController>(TYPES.GrnReportController).to(GrnReportController);

//----------------------------------Delivery Challan Report---------------------------------
container.bind<DeliveryChallanReportService>(TYPES.DeliveryChallanReportService).to(DeliveryChallanReportService);
container.bind<DeliveryChallanReportController>(TYPES.DeliveryChallanReportController).to(DeliveryChallanReportController);
//------------------------------GrnProduct---------------------------
container.bind<GrnProductRepository>(TYPES.GrnProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(GrnProduct).extend(GrnProductRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<GrnProductService>(TYPES.GrnProductService).to(GrnProductService);


//-----------------------------nofication-----------------------------------------
container.bind<NotificationRepository>(TYPES.NotificationRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Notification).extend(NotificationRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<NotificationService>(TYPES.NotificationService).to(NotificationService);
container.bind<NotificationController>(TYPES.NotificationController).to(NotificationController);

//-------------------------------transport_Payment_Voucher-------------------------------
container.bind<TPVoucherRepository>(TYPES.TPVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(TPVoucher).extend(TPVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<TPVoucherService>(TYPES.TPVoucherService).to(TPVoucherService).inSingletonScope();
container.bind<TPVoucherController>(TYPES.TPVoucherController).to(TPVoucherController).inSingletonScope();


//-------------------------------packing_material_Payment_Voucher-------------------------------
container.bind<PMPVoucherRepository>(TYPES.PMPVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PMPVoucher).extend(PMPVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<PMPVoucherService>(TYPES.PMPVoucherService).to(PMPVoucherService).inSingletonScope();
container.bind<PMPVoucherController>(TYPES.PMPVoucherController).to(PMPVoucherController).inSingletonScope();

//-------------------------------multiCash_Payment_Voucher-------------------------------
container.bind<MultiCashVoucherRepository>(TYPES.MultiCashVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(CashVoucher).extend(MultiCashVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<MultiCashVoucherService>(TYPES.MultiCashVoucherService).to(MultiCashVoucherService);
container.bind<MultiCashVoucherController>(TYPES.MultiCashVoucherController).to(MultiCashVoucherController);


//--------------------------------------labour payment voucher--------------------
container.bind<LabourPaymentVoucherRepository>(TYPES.LabourPaymentVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LPVoucher).extend(LabourPaymentVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LabourPaymentVoucherService>(TYPES.LabourPaymentVoucherService).to(LabourPaymentVoucherService);
container.bind<LabourPaymentVoucherController>(TYPES.LabourPaymentVoucherController).to(LabourPaymentVoucherController);


//--------------------------------------Approval level --------------------
container.bind<ApprovalLevelRepository>(TYPES.ApprovalLevelRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalLevel).extend(ApprovalLevelRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<ApprovalLevelService>(TYPES.ApprovalLevelService).to(ApprovalLevelService);
container.bind<ApprovalLevelController>(TYPES.ApprovalLevelController).to(ApprovalLevelController);

//--------------------------------------delivery challan --------------------
container.bind<DeliveryChallanRepository>(TYPES.DeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( DeliveryChallanPurchase).extend(DeliveryChallanRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DeliveryChallanService>(TYPES.DeliveryChallanService).to(DeliveryChallanService);
container.bind< DeliveryChallanController>(TYPES. DeliveryChallanController).to( DeliveryChallanController);
container.bind<DitemRepository>(TYPES.DitemRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( Item).extend(DitemRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

//------------------customer delivery challan-------------------------
container.bind<CustomerDeliveryChallanRepository>(TYPES.CustomerDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(CustomerDeliveryChallan).extend(CustomerDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<CustomerDeliveryChallanService>(TYPES.CustomerDeliveryChallanService).to(CustomerDeliveryChallanService);
container.bind<CustomerDeliveryChallanController>(TYPES.CustomerDeliveryChallanController).to( CustomerDeliveryChallanController);
//-----------------------tranfer delivery challan-----------------------
container.bind< StockTransferDeliveryChallanRepository>(TYPES. StockTransferDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockTransferDeliveryChallan).extend( StockTransferDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<StockTransferDeliveryChallanService>(TYPES.StockTransferDeliveryChallanService).to(StockTransferDeliveryChallanService);
container.bind<StockTranferDeliveryChallanController>(TYPES.StockTranferDeliveryChallanController).to(StockTranferDeliveryChallanController);
//----------------------------other  delivery challan-------
container.bind< OtherDeliveryChallanRepository>(TYPES.OtherDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(OtherDeliveryChallan).extend(OtherDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<OtherDeliveryChallanService>(TYPES.OtherDeliveryChallanService).to(OtherDeliveryChallanService);
container.bind<OtherDeliveryChallanController>(TYPES.OtherDeliveryChallanController).to(OtherDeliveryChallanController);
//--------------------------------------payment request----------------------------------------
container.bind<PaymentRequestRepository>(TYPES.PaymentRequestRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentRequest).extend(PaymentRequestRepository);
}).inRequestScope(); 
container.bind<PaymentRequestService>(TYPES.PaymentRequestService).to(PaymentRequestService).inSingletonScope();
container.bind<PaymentRequestController>(TYPES.PaymentRequestController ).to(PaymentRequestController ).inSingletonScope();
//-----------------------------auditlog---------------------------------------
container.bind<AuditLogRepository>(TYPES.AuditLogRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(AuditLog).extend(AuditLogRepository);
}).inRequestScope(); 
container.bind< AuditLogService>(TYPES. AuditLogService).to(AuditLogService).inSingletonScope();
container.bind< AuditLogController>(TYPES.AuditLogController ).to(AuditLogController).inSingletonScope();

//-----------------------------userSystemInfo---------------------------------------
container.bind<UserSystemInfoRepository>(TYPES.UserSystemInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( SystemLog).extend(UserSystemInfoRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//container.bind<UserSystemInfoService>(TYPES.UserSystemInfoService).to(UserSystemInfoService);

//-----------------------------RequestForApprove---------------------------------------
container.bind<RequestsRepository>(TYPES.RequestsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Requests).extend(RequestsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<RequestsService>(TYPES.RequestsService).to(RequestsService).inSingletonScope();

//--------------------------------levels -----------------------------------------

container.bind<LevelsRepository>(TYPES.LevelsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Levels).extend(LevelsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LevelsService>(TYPES.LevelsService).to(LevelsService).inSingletonScope();
container.bind<LevelsController>(TYPES.LevelsController ).to(LevelsController ).inSingletonScope();
//------------------------------InwardRegister--------------------------------
container.bind<InwardRepository>(TYPES.InwardRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InwardRegister).extend(InwardRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<InwardRegisterService>(TYPES.InwardRegisterService).to(InwardRegisterService).inSingletonScope();
container.bind<InwardRegisterController>(TYPES.InwardRegisterController).to(InwardRegisterController).inSingletonScope();
//-----------------------------department for approve -------------------------------
container.bind<DepartmentforApproveRepository>(TYPES.DepartmentforApproveRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Departments).extend(DepartmentforApproveRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//------------------------------------labour-register-----------------------------------------
container.bind<LaborRegisterRepository>(TYPES.LaborRegisterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LaborRegister).extend(LaborRegisterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborRegisterService>(TYPES.LaborRegisterService).to(LaborRegisterService).inSingletonScope();
container.bind<LaborRegisterController>(TYPES.LaborRegisterController).to(LaborRegisterController).inSingletonScope();


//------------------------------------labour-Attendances-----------------------------------------
container.bind<LaborAttendancesRepository>(TYPES.LaborAttendancesRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LaborAttendance).extend(LaborAttendancesRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborAttendancesService>(TYPES.LaborAttendancesService).to(LaborAttendancesService).inSingletonScope();
container.bind<LaborAttendancesController>(TYPES.LaborAttendancesController).to(LaborAttendancesController).inSingletonScope();

///-------------------------------------------------labor main----------------
container.bind<LaborRepository>(TYPES. LaborRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Labor).extend(LaborRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborService>(TYPES.LaborService).to(LaborService).inSingletonScope();
container.bind< LaborController>(TYPES. LaborController).to( LaborController).inSingletonScope();


//dump register
container.bind<DumpRegisterRepository>(TYPES.DumpRegisterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DumpRegister).extend(DumpRegisterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DumpRegisterService>(TYPES.DumpRegisterService).to(DumpRegisterService).inSingletonScope();
container.bind< DumpRegisterController>(TYPES.DumpRegisterController).to( DumpRegisterController).inSingletonScope();
//dump product
container.bind<DumpProductRepository>(TYPES.DumpProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DumpProduct).extend(DumpProductRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
// //dump summary
// container.bind<DumpSummaryRepository>(TYPES.DumpSummaryRepository).toDynamicValue((context) => {
//   const dataSource = context.container.get<DataSource>(TYPES.DataSource);
//   return dataSource.getRepository(DumpSummary).extend(DumpSummaryRepository);
// }).inRequestScope(); // or .singletonScope() depending on your scope requirements

//SKU Eod Stock
container.bind<SkuEodRepository>(TYPES.SkuEodRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SkuEodReport).extend( SkuEodRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<SKUEodStockService>(TYPES.SKUEodStockService).to(SKUEodStockService).inSingletonScope();
container.bind<SkuEodStockController>(TYPES.SkuEodStockController).to(SkuEodStockController).inSingletonScope();


//Eod Stock
container.bind<EodRepository>(TYPES.EodRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockReportEod).extend(EodRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<EodStockService>(TYPES.EodStockService).to(EodStockService).inSingletonScope();
container.bind<EodStockController>(TYPES.EodStockController).to(EodStockController).inSingletonScope();
//reportingManager

//vehicle dispatch 
container.bind<VehicleDispatchRepository>(TYPES.VehicleDispatchRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VehicleDispatch).extend(VehicleDispatchRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<VehicleDispatchService>(TYPES.VehicleDispatchService).to(VehicleDispatchService).inSingletonScope();
container.bind< VehicleDispatchController>(TYPES.VehicleDispatchController).to( VehicleDispatchController).inSingletonScope();

//Aqr
container.bind<AqrRepository>(TYPES. AqrRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Aqr).extend( AqrRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<AqrService>(TYPES.AqrService).to(AqrService).inSingletonScope();
container.bind<AqrController>(TYPES.AqrController).to( AqrController).inSingletonScope();

//quality parameter
container.bind<QualityParameterRepository>(TYPES.QualityParameterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(QualityParameter).extend(QualityParameterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//secondSale
container.bind<SecondSaleRepository>(TYPES.SecondSaleRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SecondSale).extend(SecondSaleRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<SecondSaleService>(TYPES.SecondSaleService).to(SecondSaleService).inSingletonScope();
container.bind<SecondSaleController>(TYPES.SecondSaleController).to(SecondSaleController).inSingletonScope();
//secondsale product
container.bind<SecondSaleProductRepository >(TYPES.SecondSaleProductRepository ).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SecondSaleProduct).extend(SecondSaleProductRepository );
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//dailyInwardSummary







//sale order
container.bind<SaleOrderRepository>(TYPES.SaleOrderRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SaleOrder).extend(SaleOrderRepository);
}).inRequestScope(); 
container.bind<SaleOrderService>(TYPES.SaleOrderService).to(SaleOrderService).inSingletonScope();
container.bind<SaleOrderController>(TYPES.SaleOrderController).to(SaleOrderController).inSingletonScope()

//invoice
container.bind<InvoiceRepository>(TYPES.InvoiceRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Invoice).extend(InvoiceRepository);
}).inRequestScope(); 
container.bind<InvoiceProductRepository>(TYPES.InvoiceProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InvoiceProduct).extend(InvoiceProductRepository);
}).inRequestScope(); 


//returnByCustomer
container.bind<PostReturnByCustomerRepository>(TYPES.PostReturnByCustomerRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PostReturnByCustomer).extend(PostReturnByCustomerRepository);
}).inRequestScope(); 
container.bind<PostReturnByCustomerService>(TYPES.PostReturnByCustomerService).to(PostReturnByCustomerService).inSingletonScope();
container.bind<PostReturnByCustomerController>(TYPES.ReturnByCustomerController).to(PostReturnByCustomerController).inSingletonScope();
//return product by customer
container.bind<ReturnedProductsRepository>(TYPES.ReturnedProductsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ReturnedProducts).extend(ReturnedProductsRepository);
}).inRequestScope();
//pdfgebnerator
container.bind<PdfGeneratorService>(TYPES.PdfGeneratorService).to(PdfGeneratorService).inSingletonScope();
//company
container.bind<CompanyRepository>(TYPES.CompanyRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Company).extend(CompanyRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<CompanyService>(TYPES.CompanyService).to(CompanyService).inSingletonScope();
container.bind<CompanyController>(TYPES.CompanyController).to(CompanyController).inSingletonScope();
//procurmentDashboard
container.bind<ProcurmentDashService>(TYPES.ProcurmentDashService).to(ProcurmentDashService).inSingletonScope();
container.bind< ProcurmentDashController >(TYPES. ProcurmentDashController ).to( ProcurmentDashController ).inSingletonScope();

//managementDashboard
container.bind<ManagementDashService>(TYPES.ManagementDashService).to(ManagementDashService).inSingletonScope();
container.bind< ManagementDashController >(TYPES.ManagementDashController ).to( ManagementDashController ).inSingletonScope();
//inventoryStock
container.bind<InventoryStockRepository>(TYPES.InventoryStockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InventoryStock).extend(InventoryStockRepository);
}).inRequestScope();


container.bind<InventoryStockController>(TYPES.InventoryStockController).to(InventoryStockController).inSingletonScope();
container.bind<InventoryStockService>(TYPES.InventoryStockService).to(InventoryStockService)


//product varient
container.bind<ProductVarientsRepository>(TYPES.ProductVarientsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductVarient).extend(ProductVarientsRepository);
}).inRequestScope(); 
container.bind<ProductVarientService>(TYPES.ProductVarientService).to(ProductVarientService).inSingletonScope();
container.bind<ProductVarientController>(TYPES.ProductVarientsController).to(ProductVarientController).inSingletonScope();
//packingmaterial
container.bind<PackingMaterialRepository>(TYPES.PackingMaterialRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PackingMaterial).extend(PackingMaterialRepository);
}).inRequestScope(); 
container.bind< PackingMaterialService >(TYPES.PackingMaterialService ).to( PackingMaterialService ).inSingletonScope();
container.bind<PackingMaterialController>(TYPES.PackingMaterialController).to(PackingMaterialController).inSingletonScope();


//docuemntType
container.bind<DocumentDefinitionRepository>(TYPES.DocumentDefinitionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentDefinition).extend(DocumentDefinitionRepository);
}).inRequestScope(); 
container.bind< DocumentDefinitionService >(TYPES.DocumentDefinitionService ).to( DocumentDefinitionService ).inSingletonScope();
container.bind<DocumentDefinitionController>(TYPES.DocumentDefinitionController).to(DocumentDefinitionController).inSingletonScope();

//documentPermission
container.bind<DocumentPermissionRepository>(TYPES.DocumentPermissionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentPermission).extend(DocumentPermissionRepository);
}).inRequestScope(); 
container.bind<DocumentPermissionService>(TYPES.DocumentPermissionService ).to( DocumentPermissionService ).inSingletonScope();
container.bind<DocumentPermissionController>(TYPES.DocumentPermissionController).to(DocumentPermissionController).inSingletonScope();
//docuemnt
container.bind< DocumentbRepository>(TYPES. DocumentbRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( Documentb ).extend( DocumentbRepository);
}).inRequestScope(); 
container.bind<DocumentbService>(TYPES.DocumentbService ).to(DocumentbService ).inSingletonScope();
container.bind<DocumentbController>(TYPES.DocumentbController).to(DocumentbController).inSingletonScope();


//APProvalFlow
container.bind<ApprovalFlowRepository>(TYPES.ApprovalFlowRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalFlow ).extend(ApprovalFlowRepository);
}).inRequestScope(); 
container.bind<ApprovalFlowService>(TYPES.ApprovalFlowService ).to(ApprovalFlowService ).inSingletonScope();
container.bind<ApprovalFlowController>(TYPES.ApprovalFlowController).to(ApprovalFlowController).inSingletonScope();

//FinalizerBlock
container.bind<FinalizerBlockRepository>(TYPES.FinalizerBlockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(FinalizerBlock ).extend(FinalizerBlockRepository);
}).inRequestScope(); 

//ApproverBlockRepository
container.bind<ApproverBlockRepository>(TYPES.ApproverBlockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApproverBlock ).extend(ApproverBlockRepository);
}).inRequestScope(); 

//ApprovalStageInfoRepository
container.bind<ApprovalStageInfoRepository>(TYPES.ApprovalStageInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalStageInfo).extend(ApprovalStageInfoRepository);
}).inRequestScope();

//TODO: DocumentApproval
container.bind<DocumentApprovalFlowRepository>(TYPES.DocumentApprovalFlowRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentApprovalFlow).extend(DocumentApprovalFlowRepository);
}).inRequestScope();
//TODO: inwardProduct
container.bind<InwardProductRepository>(TYPES.InwardProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InwardProduct).extend(InwardProductRepository);
}).inRequestScope();
//TODO: DocDoubleApproverService
container.bind<DocDoubleApproverService>(TYPES.DocDoubleApproverService).to(DocDoubleApproverService).inSingletonScope();

container.bind<DocSingalApproverService>(TYPES.DocSingalApproverService).to(DocSingalApproverService).inSingletonScope();
container.bind<AdminDashboardService>(TYPES.AdminDashboardService ).to( AdminDashboardService ).inSingletonScope();
container.bind<AdminDashboardController>(TYPES.AdminDashboardController).to(AdminDashboardController).inSingletonScope();

//productVarient

container.bind<ProductVarientRepository>(TYPES.ProductVarientRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductVarient).extend(ProductVarientRepository);
}).inRequestScope();
container.bind<ProductVarientsService>(TYPES.ProductVarientsService).to(ProductVarientsService).inSingletonScope();
container.bind<VarientsController>(TYPES.VarientsController).to(VarientsController).inSingletonScope();
container.bind<ExcelController>(TYPES.ExcelController).to(ExcelController).inSingletonScope();
container.bind<ActiveSessionRepository>(TYPES.ActiveSessionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ActiveSession).extend(ActiveSessionRepository);
}).inRequestScope();

container.bind<UserReportService>(TYPES.UserReportService).to(UserReportService).inSingletonScope();
container.bind<UserReportController>(TYPES.UserReportController).to(UserReportController).inSingletonScope();
container.bind<SuperAdminController>(TYPES.SuperAdminController).to(SuperAdminController).inSingletonScope();
container.bind<SuperAdminService>(TYPES.SuperAdminService).to(SuperAdminService).inSingletonScope();


// Bind performance optimization services
container
  .bind<CacheService>(TYPES.CacheService)
  .to(CacheService)
  .inSingletonScope();

container
  .bind<QueryOptimizerService>(TYPES.QueryOptimizerService)
  .to(QueryOptimizerService)
  .inSingletonScope();

// Bind Crystal Report service
container
  .bind<CrystalReportService>(TYPES.CrystalReportService)
  .to(CrystalReportService)
  .inSingletonScope();



container
  .bind<ProcurementCrystalReportService>(TYPES.ProcurementCrystalReportService)
  .to(ProcurementCrystalReportService)
  .inSingletonScope();

container
  .bind<ProcurementCrystalReportController>(TYPES.ProcurementCrystalReportController)
  .to(ProcurementCrystalReportController)
  .inSingletonScope();



container
  .bind<SalesCrystalReportService>(TYPES.SalesCrystalReportService)
  .to(SalesCrystalReportService)
  .inSingletonScope();

container
  .bind<SalesCrystalReportController>(TYPES.SalesCrystalReportController)
  .to(SalesCrystalReportController)
  .inSingletonScope();



container
  .bind<SSEService>(TYPES.SSEService)
  .to(SSEService)
  .inSingletonScope();

container
  .bind<SSEController>(TYPES.SSEController)
  .to(SSEController)
  .inSingletonScope();

container
  .bind<SSEHelperService>(TYPES.SSEHelperService)
  .to(SSEHelperService)
  .inSingletonScope();



container
  .bind<TestController>(TYPES.TestController)
  .to(TestController)
  .inSingletonScope();



// import { RegistrationReportService } from "./services/registrationReport.service";
// import { RegistrationReportController } from "./controllers/registrationReport.controller";

container
  .bind<UserActivityLogRepository>(TYPES.UserActivityLogRepository)
  .toDynamicValue((context) => {
    return AppDataSource.getRepository(UserActivityLog).extend(
      UserActivityLogRepository.prototype
    );
  })
  .inRequestScope();

container
  .bind<UserActivityLogService>(TYPES.UserActivityLogService)
  .to(UserActivityLogService)
  .inSingletonScope();

// container
//   .bind<LogCleanupService>(TYPES.LogCleanupService)
//   .to(LogCleanupService)
//   .inSingletonScope();

container
  .bind<UserActivityLogController>(TYPES.UserActivityLogController)
  .to(UserActivityLogController)
  .inSingletonScope();

//workflow hirachy
  container.bind<WorkflowHierarchyRepository>(TYPES.WorkflowHierarchyRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(WorkflowHierarchy).extend(WorkflowHierarchyRepository);
}).inRequestScope(); 
container.bind< WorkflowHierarchyService>(TYPES.WorkflowHierarchyService ).to( WorkflowHierarchyService ).inSingletonScope();
container.bind<WorkflowHierarchyController>(TYPES.WorkflowHierarchyController).to(WorkflowHierarchyController).inSingletonScope();

//procurmentTarget
  container.bind<ProcurementTargetRepository>(TYPES.ProcurementTargetRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTarget).extend(ProcurementTargetRepository);
}).inRequestScope(); 
container.bind<ProcurementTargetService>(TYPES.ProcurementTargetService).to(ProcurementTargetService).inSingletonScope();
container.bind<ProcurementTargetController>(TYPES.ProcurementTargetController).to(ProcurementTargetController).inSingletonScope();
container.bind<ProcurementTargetProductRepository>(TYPES.ProcurementTargetProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTargetProduct).extend(ProcurementTargetProductRepository);
}).inRequestScope();
container.bind<ProcurementTargetWeekRepository>(TYPES.ProcurementTargetWeekRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTargetWeek).extend(ProcurementTargetWeekRepository);
}).inRequestScope();
container.bind<ProcurementTargetAchievementRepository>(TYPES.ProcurementTargetAchievementRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementAchievement).extend(ProcurementTargetAchievementRepository);
}).inRequestScope();
//salesTarget
  container.bind<SalesTargetRepository>(TYPES.SalesTargetRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTarget).extend(SalesTargetRepository);
}).inRequestScope(); 
container.bind<SalesTargetService>(TYPES.SalesTargetService).to(SalesTargetService).inSingletonScope();
container.bind<SalesTargetController>(TYPES.SalesTargetController).to(SalesTargetController).inSingletonScope();
  container.bind<SalesTargetProductRepository>(TYPES.SalesTargetProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTargetProduct).extend(SalesTargetProductRepository);
}).inRequestScope(); 
 container.bind<SalesTargetWeekRepository>(TYPES.SalesTargetWeekRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTargetWeek).extend(SalesTargetWeekRepository);
}).inRequestScope();
 container.bind<SalesAchievementRepository>(TYPES.SalesAchievementRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesAchievement).extend(SalesAchievementRepository);
}).inRequestScope();

// //dashboard
 container.bind<DashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope();
container.bind<DashboardController>(TYPES.DashboardController).to(DashboardController).inSingletonScope();
// //registration report
container.bind<NewRegistrationService>(TYPES.NewRegistrationService).to(NewRegistrationService).inSingletonScope();
 container.bind<NewRegistrationController>(TYPES.NewRegistrationController).to(NewRegistrationController).inSingletonScope();

//report
container.bind<ReportService>(TYPES.ReportService).to(ReportService).inSingletonScope();
container.bind<SalesReportService>(TYPES.SalesReportService).to(SalesReportService).inSingletonScope();
container.bind<ReportController>(TYPES.ReportController).to(ReportController).inSingletonScope();
//paymentinfoforrfpa
container.bind<RfpaPaymentInfoRepository>(TYPES.RfpaPaymentInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentInfoForRFPA).extend(RfpaPaymentInfoRepository);
}).inRequestScope();
  container.bind<ReturnToVendorService>(TYPES.ReturnToVendorService).to(ReturnToVendorService).inSingletonScope();
  container.bind<ReturnToVendorRepository>(TYPES.ReturnToVendorRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ReturnToVendor).extend(ReturnToVendorRepository);
}).inRequestScope();
container.bind<ReturnToVendorController>(TYPES.ReturnToVendorController).to(ReturnToVendorController).inSingletonScope();
container.bind<FinalInvoiceService>(TYPES.FinalInvoiceService).to(FinalInvoiceService).inSingletonScope();
container.bind<FinalInvoiceController>(TYPES.FinalInvoiceController).to(FinalInvoiceController).inSingletonScope();
container.bind<FinalInvoiceReportService>(TYPES.FinalInvoiceReportService).to(FinalInvoiceReportService).inSingletonScope();
container.bind<FinalInvoiceReportController>(TYPES.FinalInvoiceReportController).to(FinalInvoiceReportController).inSingletonScope()

// role
container.bind<RoleRepository>(TYPES.RoleRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Role).extend(RoleRepository);
}).inRequestScope();


// stockCorrection
container.bind<StockCorrectionRepository>(TYPES.StockCorrectionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockCorrection).extend(StockCorrectionRepository);
}).inRequestScope();
container.bind<StockCorrectionService>(TYPES.StockCorrectionService).to(StockCorrectionService).inSingletonScope();
container.bind<StockCorrectionController>(TYPES.StockCorrectionController).to(StockCorrectionController).inSingletonScope();

//grnhistory
container.bind<GrnProductHistoryRepository>(TYPES.GrnProductHistoryRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(GrnProductHistory).extend(GrnProductHistoryRepository);
}).inRequestScope();
container.bind<GrnProductHistoryService>(TYPES.GrnProductHistoryService).to(GrnProductHistoryService).inSingletonScope();
export { container };
