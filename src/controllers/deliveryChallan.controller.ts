import { Request, Response, NextFunction } from 'express';
import {
  controller,
  httpGet,
  httpPost,
  request,
  response,
  httpPatch,
  httpDelete,
  requestParam,
  next,
  requestBody,
} from 'inversify-express-utils';
import { inject } from 'inversify';

import { TYPES } from '../types';
import { DeliveryChallanService } from '../services/deliveryChallan.service';

import { captureUser, deserializeUser, requireUser } from '../middleware/deserializeUser';
import AppError from '../utils/appError';
import logger from '../utils/logger';

import ExcelJS from "exceljs";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PaginationOptions } from '../utils/pagination';
import { NotificationService } from '../services/notification.service';
import { uploadSingle } from '../middleware/uploadsingle.middleware';
import { upload, uploadAttachments } from '../middleware/upload.middleware';
import { setAttachmentUrls } from '../utils/fileUploadHelper';
import { UserActivityLogService } from '../services/userActivityLog.service';
import { ActivityAction, ActivityModule } from '../entities/userActivityLog.entity';

@controller('/deliveryChallan', deserializeUser, requireUser)
export class DeliveryChallanController {
  private s3Client: S3Client;
  private bucketName: string;
  constructor(
    @inject(TYPES.DeliveryChallanService) private deliveryChallanService: DeliveryChallanService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService,
    @inject(TYPES.UserActivityLogService) private activityLogService: UserActivityLogService,
  ) {this.s3Client = new S3Client({
    credentials: {
      accessKeyId: process.env.ACCESS_KEY!,
      secretAccessKey: process.env.ACCESS_SECRET!,
    },
    region: process.env.REGION!,
  });
  this.bucketName = process.env.BUCKET_NAME!;}

 
   @httpPost('/', uploadAttachments)
public async createDeliveryChallan(
    @requestBody() Data: any,
    @request() req: Request<{}, {}>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Starting to create a new Delivery Challan');
      
      // Use helper function to handle file URL extraction
      setAttachmentUrls(Data, req.files as any[]);

      
      Data.requestedBy=res.locals.user.id;
      const deliveryChallan = await this.deliveryChallanService.createDeliveryChallan(Data);
      if(!deliveryChallan)
      {
        return next(new Error('Delivery Challan not found'))
      }
      
      // 🔔 Send notification for delivery challan creation
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Delivery Challan "${deliveryChallan.challanNo}" created successfully`,
            userId
          );
        }
      } catch (notifError) {
      }

       // Single activity log
         const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';     
          this.activityLogService.logActivity({
            userId: res.locals.user.id,
            userName,
            action: ActivityAction.CREATE,
            module: ActivityModule.CUSTOMER_DELIVERY_CHALLAN,
            entityName: 'Customer Delivery Challan',
            entityId: deliveryChallan.id,
            description: `${userName} has created Customer Delivery Challan ${deliveryChallan.challanNo || deliveryChallan.id}`,
            ipAddress: req.ip || '',
            userAgent: req.get('user-agent'),
            endpoint: req.originalUrl,
            httpMethod: req.method,
            statusCode: 201,
          }).catch(() => {});
      
      logger.info(`Delivery Challan created successfully`);

      res.status(201).json({
        status: 'success',
        message:"Delivery Challan Successfully Created",
        data:deliveryChallan.id
        
      });
    } catch (err) {
      logger.error(`Error creating delivery challan: ${err}`);
      if (err instanceof AppError) {
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
}
next(err); // Unhandled errors
      
    }
  }

  @httpGet('/')
  public async getAllDeliveryChallans(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Fetching all delivery challans');
       const { page, limit, search, sort,deliveryChallanId} = req.query
            const queryOptions: PaginationOptions = {
              page: page ? Number(page) : undefined,  
              limit: limit ? Number(limit) : undefined,
              //searchFields: ['deliveryChallanId'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const deliveryChallans = await this.deliveryChallanService.getAllDeliveryChallans(queryOptions);
      
      // 🔔 Send notification for get all delivery challans
      // try {
      //   const userId = res.locals.user?.id;
      //   if (userId) {
      //     await this.notificationService.createNoti(
      //       `Retrieved ${deliveryChallans.meta.total} delivery challans`,
      //       userId
      //     );
      //   }
      // } catch (notifError) {
      //   console.log('Get all delivery challans notification error:', notifError);
      // }
      
      logger.info('Successfully fetched all Delivery Challans');
      res.status(200).json({
        status: 'success',
        data: deliveryChallans.data,
        allRecords: deliveryChallans.meta.total,
        totalPages: deliveryChallans.meta.pages,
        page: deliveryChallans.meta.page,
      });
    } catch (err) {
      logger.error(`Failed to fetch Delivery Challans: ${err}`);
      next(err);
    }
  }

  @httpGet('/getall/deliveryChallan')
  public async getAll(
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Fetching all delivery challans');
      const deliveryChallans = await this.deliveryChallanService.getAll()
      logger.info('Successfully fetched all Delivery Challans');
      res.status(200).json({
        status: 'success',
        data: deliveryChallans,
      });
    } catch (err) {
      logger.error(`Failed to fetch Delivery Challans: ${err}`);
      next(err);
    }
  }
  @httpGet('/:id')
  public async getDeliveryChallanById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Fetching delivery challan with ID`);
      const deliveryChallan = await this.deliveryChallanService.getByIdDeliveryChallan(id);
      if (!deliveryChallan) {
        logger.warn(`Delivery Challan with ID  not found`);
        return next(new Error('Delivery Challan not found'));
      }
      
      // 🔔 Send notification for delivery challan view
      // try {
      //   const userId = res.locals.user?.id;
      //   if (userId) {
      //     await this.notificationService.createNoti(
      //       `Viewed delivery challan "${deliveryChallan.challanNo}" details`,
      //       userId
      //     );
      //   }
      // } catch (notifError) {
      //   console.log('Delivery challan view notification error:', notifError);
      // }
      
      logger.info(`Delivery Challan retrieved successfully`);
      res.status(200).json({
        status: 'success',
        data: deliveryChallan,
      });
    } catch (err) {
      logger.error(`Error fetching delivery challan with ID ${id}: ${err}`);
      next(err);
    }
  }

  @httpPatch('/:id', uploadAttachments, captureUser)
  public async updateDeliveryChallan(
    @requestParam('id') id: string,
    @request() req: Request<{}, {}>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Starting update for Delivery Challan with ID`);
      const updatedBy = res.locals.updatedBy;
      
      const Data=req.body
      
      // Use helper function to handle file URL extraction
      setAttachmentUrls(Data, req.files as any[]);
     
      const updatedChallan = await this.deliveryChallanService.updateDeliveryChallan(id, Data,updatedBy);
      if (!updatedChallan) {
        return next(new Error('Delivery Challan not found or could not be updated'));
      }
      
      // 🔔 Send notification for delivery challan update
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Delivery challan "${updatedChallan.challanNo}" updated successfully`,
            userId
          );
        }
      } catch (notifError) {
      }
      const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';      // Activity log
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.UPDATE,
        module: ActivityModule.CUSTOMER_DELIVERY_CHALLAN,
        entityName: 'Customer Delivery Challan',
        entityId: id,
        description: `${userName} has updated Customer Delivery Challan ${updatedChallan.challanNo || id}`,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});

      logger.info(`Delivery Challan updated successfully`);

      res.status(200).json({
        status: 'success',
        data: updatedChallan,
      });
    } catch (err) {
      logger.error(`Error updating delivery challan with ID ${id}: ${err}`);
      next(err);
    }
  }

  @httpDelete('/:id')
  public async deleteDeliveryChallan(
    @requestParam('id') id: string,
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Deleting delivery challan with ID: ${id}`);
     const success= await this.deliveryChallanService.deleteDeliveryChallan(id);

     if (!success) {
      logger.warn("Delivery Challan not found for delete", { id });
      return res.status(404).json({ message: 'Delivery Challan not found' });
    }
    
      // 🔔 Send notification for delivery challan deletion
      // try {
      //   const userId = res.locals.user?.id;
      //   if (userId) {
      //     await this.notificationService.createNoti(
      //       `Delivery challan with ID ${id} deleted successfully`,
      //       userId
      //     );
      //   }
      // } catch (notifError) {
      //   console.log('Delivery challan deletion notification error:', notifError);
      // }
    
      logger.info(`Delivery Challan deleted successfully`);
       // Activity log
       const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.DELETE,
        module: ActivityModule.CUSTOMER_DELIVERY_CHALLAN,
        entityName: 'Customer Delivery Challan',
        entityId: id,
        description: `${userName} has deleted Customer Delivery Challan ${success.No||id}`,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});
      res.status(204).json({
        status: 'success',
        message: 'Delivery Challan deleted successfully',
      });
    } catch (err) {
      logger.error(`Error deleting delivery challan with ID ${id}: ${err}`);
      next(err);
    }
  }
  @httpGet("/challanNos/getAllChallanNo")
  public async getAllChallanNoNumbers(
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Fetching all Delivery Challan numbers');
      const challans = await this.deliveryChallanService.getAllDealSlipNumbers(); // Call the service method
      if (!challans || challans.length === 0) {
        logger.warn(`No Challans found`);
        return next(new AppError(404, "No Challans found"));
      }
//console.log(challans)
logger.info('Successfully fetched all Delivery Challan numbers');
      res.status(200).json({
        status: "success",
        data: challans, // Respond with the fetched GRN data
      });
    } catch (error) {
      logger.error(`Failed to fetch Delivery Challan numbers: ${error}`);
      next(error); // Pass any errors to the error-handling middleware
    }
  }

  @httpGet("/dc-type/numbers")
  public async getDcTypeNumbers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const dcType = (req.query.dcType as string)?.split('?')[0]?.trim();
      if (!dcType) return next(new AppError(400, "dcType query param is required"));

      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;

      const result = await this.deliveryChallanService.getDcTypeNumbers(dcType, page, limit, search);
      res.status(200).json({
        status: 'success',
        data: result.data,
        allRecords: result.total,
        totalPages: result.totalPages,
        page: result.page,
      });
    } catch (error) {
      next(error);
    }
  }

  @httpGet("/calculation/tilldate")
  public async getDeliveryChallanTillDate(
    @request() req: Request,
    @response() res:Response,
    @next() next:NextFunction
  ){
    try{

const { filterType, filterValue } = req.query; // Get filter type and value from query params
    const dchallan = await this.deliveryChallanService.getDataForTillDate(
      filterType as string,
      filterValue as string
    );
    
if(!dchallan){
}
const overallTotal =  dchallan.reduce(
(acc, row) => {
  acc.quantity += Number(row.quantity);
  acc.amount += Number(row.amount);
  return acc;
},
{  quantity: 0, amount: 0 }
);
res.status(200).json({
message: "Delivery Challan calculations fetched successfully.",
data:{
  totalQuantityInKg:overallTotal.quantity,
  totalAmount:overallTotal.amount,
  dateWise:dchallan
}
    })
    }
    catch(error){
next(error)
    }

  }


  @httpGet("/calculations/dates")
public async getDataForDates(
    @request() req: Request,
    @response() res:Response,
    @next() next:NextFunction
) {
  try {
    
const { filterType, startDate, endDate} = req.query;
    const data = await this.deliveryChallanService.getDataForDates(
      filterType as string|undefined,
      startDate as string|undefined,
      endDate as string|undefined
    );

    const overallTotal =data.reduce(
      (acc, row) => {
        acc.quantity += Number(row.quantity);
        acc.amount += Number(row.amount);
        return acc;
      },
      {  quantity: 0, amount: 0 }
    );
    res.status(200).json({
      message: "deliveryChallan calculations fetched successfully.",
      data:overallTotal,
    }) 
  }catch (error) {
    console.error("Error fetching data:", error);
   next(error)
  }
}


@httpGet("/all/getDeliveryChallanReports")
public async getDrillDownDeliveryChallanReport(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    logger.info("Fetching Drill-Down Delivery Challan Report...");
    
    // Extract filters from query params
    const filters: any = {
      challanNo: req.query.challanNo as string | undefined,
      grnNo:req.query.grnNo as string|undefined,
      driverName:req.query.driverName as string | undefined,
      contactNo:req.query.contactNo as string | undefined,
      altContactNo:req.query.altContactNo as string | undefined,
      vehicleNo:req.query.vehicleNo as string |undefined,
      licenseNo:req.query.licenseNo as string | undefined,
      rmn:req.query.rmn as string | undefined,
      companyName: req.query.companyName as string | undefined,
      customerId: req.query.customerId as string | undefined,
      toLocation:req.query.toLocation as string | undefined,
      partyName:req.query.partyName as string |undefined,
      fromLocation:req.query.fromLocation as string | undefined,
      productId: req.query.productId as string | undefined,
      productCategoryId: req.query.productCategoryId as string | undefined,
      productSubCategoryId: req.query.productSubCategoryId as string | undefined,
      receiverName:req.query.receiverName as string | undefined,
      approvalStatus: req.query.approvalStatus as string | undefined,
      //totalAmtFrom=req.query.totalAmtFrom as string |undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    // Fetch Delivery Challan report based on filters
    const deliveryChallanRecords = await this.deliveryChallanService.getFilteredSales(filters);

    if(deliveryChallanRecords.length===0)
    {
      return 
    }
    // Create Excel workbook & worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Delivery Challan Report");

    // Add headers
    worksheet.columns = [
      { header: "PO No", key: "poNumber", width: 20 },
      { header: "Challan No", key: "challanNo", width: 15 },
      { header: "Company Name", key: "companyName", width: 20 },
      { header: "Customer Name", key: "customerName", width: 20 },
      
      { header: "GRN No", key: "grnNo", width: 20 },
      { header: "Relationship Manager Name", key: "rmn", width: 20 },
      { header: "Driver Name", key: "driverName", width: 20 },
      { header: "License No", key: "licenseNo", width: 20 },
      { header: "Vehicle No", key: "vehicleNo", width: 15 },
      { header: "Contact No", key: "contactNo", width: 15 },
      { header: "Alternate Contact No", key: "altContactNo", width: 15 },
      { header: "Total Amount", key: "totalAmt", width: 15 },
      { header: "Amount in Words", key: "amtWords", width: 30 },
      { header: "Receiver Name", key: "receiverName", width: 15 },
      { header: "Approval Status", key: "approvalStatus", width: 15 },
      { header: "Created Date", key: "createdDate", width: 20 },
    ];

  
worksheet.getRow(1).eachCell((cell) => {
  cell.font = { bold: true, color: { argb: "FFFFFF" } }; 
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "0073e6" }, 
  };
});

   
    deliveryChallanRecords.forEach((dc) => {
      worksheet.addRow({
        challanNo: dc.challanNo,
        companyName: dc.companyName,
        poNumber:dc.poNumber,
        customerName: dc.customerName,
        rmn:dc.rmn,
        driverName:dc.driverName,
        licenseNo:dc.licenseNo,
        vehicleNo: dc.vehicleNo,
        contactNo:dc.contactNo,
        altContactNo:dc.altContactNo,
        receiverName:dc.receiverName,
        totalAmt: dc.totalAmt,
        amtWords: dc.amtWords,
        approvalStatus: dc.approvalStatus,
        createdDate: dc.createdDate,
      });
    });

   
    const buffer = await workbook.xlsx.writeBuffer();

  
    const fileKey = `reports/Delivery_Challan_Report_${Date.now()}.xlsx`;
    const uploadParams = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    await this.s3Client.send(new PutObjectCommand({
      ...uploadParams,
      Body: new Uint8Array(buffer),
    }));

    const fileUrl = `https://${this.bucketName}.s3.${process.env.REGION}.amazonaws.com/${fileKey}`;

    return res.status(200).json({
      success: true,
      data: deliveryChallanRecords, // JSON response
      excelFileUrl: fileUrl, // S3 file URL
    });
  } catch (error) {
    console.error("Error generating Delivery Challan report:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}


@httpGet("/filtered-sales/all/deliverychallan")
  public async getFilteredSalesByCustomer(req: Request, res: Response): Promise<Response> {
    try {
      const filters = req.query;
      const salesData = await this.deliveryChallanService.getFilteredSalesbyCustomer(filters);
      return res.status(200).json({ success: true, data: salesData });
    } catch (error) {
      console.error("Error fetching filtered sales:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error", error});
    }
  }

 
  @httpGet("/:id/pdf")
    public async getDeliveryChallanPdf(req: Request, res: Response): Promise<any> {
    try {
      const pdfBuffer = await this.deliveryChallanService.generateDeliveryChallanPdf(req.params.id);
  
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="delivery-challan-${req.params.id}.pdf"`,
      });
  
      res.send(pdfBuffer);
    } catch (err) {
      console.error('PDF error:', err);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  };
}
