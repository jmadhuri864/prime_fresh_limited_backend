import {
  controller,
  httpPost,
  httpGet,
  httpPatch,
  request,
  requestParam,
  response,
  next,
  httpDelete,
} from 'inversify-express-utils';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { FinalInvoiceService } from '../services/finalInvoice.service';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import { ControllerLogger } from '../utils/controllerLogger';
import {
  deserializeUser,
  requireUser,
  captureUser,
} from '../middleware/deserializeUser';
import { PaginationOptions } from '../utils/pagination';
import { NotificationService } from '../services/notification.service';
import { PdfGeneratorService } from '../utils/pdfGenerator';
import { CreateInvoiceDto } from '../dtos/invoice.dto';
import { UserActivityLogService } from '../services/userActivityLog.service';
import { ActivityAction, ActivityModule } from '../entities/userActivityLog.entity';

@controller('/final-invoice', deserializeUser, requireUser)
export class FinalInvoiceController {
  constructor(
    @inject(TYPES.FinalInvoiceService)
    private finalInvoiceService: FinalInvoiceService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.PdfGeneratorService)
    private pdfGeneratorService: PdfGeneratorService,
    @inject(TYPES.UserActivityLogService) private activityLogService: UserActivityLogService,
  ) {}

  @httpGet('/')
  public async getAllInvoices(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log("in controller")
      const { page, limit, search, sort } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const userId = res.locals.user.id;

      const invoices = await this.finalInvoiceService.getAll(
        queryOptions,
        userId
      );

      if (!invoices || invoices.data.length === 0) {
        ControllerLogger.logOperationFailed('Get All', 'Final Invoices', 'No records found', req, res);
        return next(new AppError(404, 'No final invoices found'));
      }

      // 🔔 Send notification for get all invoices
      // try {
      //   const userId = res.locals.user?.id;
      //   if (userId) {
      //     await this.notificationService.createNoti(
      //       `Retrieved ${invoices.meta.total} final invoices`,
      //       userId
      //     );
      //   }
      // } catch (notifError) {
      //   console.log('Get all final invoices notification error:', notifError);
      // }

      ControllerLogger.logGetAllRecords('Final Invoices', req, res);
      res.status(200).json({
        status: 'success',
        data: invoices.data,
        allRecords: invoices.meta.total,
        totalPages: invoices.meta.pages,
        page: invoices.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Final Invoices', err, req, res);
      next(err);
    }
  }


  @httpPost('/:deliveryChallanId')
  public async createInvoice(
    @requestParam('deliveryChallanId') deliveryChallanId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const createdBy = res.locals.user.id;
      const invoiceData: CreateInvoiceDto = req.body;

      const invoice = await this.finalInvoiceService.create(
        deliveryChallanId,
        invoiceData,
        createdBy
      );

      if (!invoice) {
        ControllerLogger.logOperationFailed('Create', 'Final Invoice', 'Creation failed', req, res);
        return next(
          new AppError(400, 'Final invoice could not be created'),
        );
      }

      // 🔔 Send notification for invoice creation
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Final invoice "${invoice.invoiceNo}" created successfully`,
            userId
          );
        }
      } catch (notifError) {
      }

      ControllerLogger.logSuccess('Final Invoice created', invoice.id, req, res);
      const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      // Single activity log
          this.activityLogService.logActivity({
            userId: res.locals.user.id,
            userName,
            action: ActivityAction.CREATE,
            module: ActivityModule.INVOICE,
            entityName: 'INVOICE',
            entityId: invoice.id,
            description: `${userName} has created Final Invoice ${invoice.invoiceNo || invoice.id}`,
            ipAddress: req.ip || '',
            userAgent: req.get('user-agent'),
            endpoint: req.originalUrl,
            httpMethod: req.method,
            statusCode: 201,
          }).catch(() => {});
      
      res.status(201).json({
        status: 'success',
        message: 'Final invoice created successfully',
        data: invoice,
      });
    } catch (err) {
      ControllerLogger.logError('Create Final Invoice', err, req, res);
      next(err);
    }
  }

  @httpGet('/view/:id')
  public async getInvoiceByIdForView(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const invoice = await this.finalInvoiceService.getByIdForView(id);

      if (!invoice) {
        ControllerLogger.logNotFound('Final Invoice', id, req, res);
        return next(new AppError(404, 'Final invoice not found'));
      }

      // 🔔 Send notification for invoice view
      // try {
      //   const userId = res.locals.user?.id;
      //   if (userId) {
      //     const invoiceNo = invoice.data?.invoiceNo || 'Invoice';
      //     await this.notificationService.createNoti(
      //       `Viewed final invoice "${invoiceNo}" details`,
      //       userId
      //     );
      //   }
      // } catch (notifError) {
      //   console.log('Final invoice view notification error:', notifError);
      // }

      ControllerLogger.logView('Final Invoice', id, req, res);
      res.status(200).json({
        status: 'success',
        data: invoice,
      });
    } catch (err) {
      ControllerLogger.logError('Get Final Invoice for view', err, req, res);
      next(err);
    }
  }

  @httpPost('/pdf/download')
  public async downloadInvoicePdf(
    
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const invoiceId=req.body.id;

      // Fetch invoice data with all relations
      const invoiceData = await this.finalInvoiceService.getByIdForPdf(invoiceId);

      if (!invoiceData) {
        ControllerLogger.logNotFound('Final Invoice', invoiceId, req, res);
        return next(new AppError(404, 'Final invoice not found'));
      }

      // Generate invoice PDF
      const pdfUrl = await this.pdfGeneratorService.generateInvoicePdf(invoiceData);

      if (!pdfUrl) {
        ControllerLogger.logOperationFailed('Download PDF', 'Final Invoice', 'PDF generation failed', req, res);
        return next(new AppError(500, 'Failed to generate invoice PDF'));
      }

      // 🔔 Send notification for PDF download
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          const invoiceNo = invoiceData.invoiceNo || 'Invoice';
          await this.notificationService.createNoti(
            `Invoice PDF "${invoiceNo}" generated successfully`,
            userId
          );
        }
      } catch (notifError) {
      }

      ControllerLogger.logSuccess('Invoice PDF generated', invoiceId, req, res);
      
      res.status(200).json({
        status: 'success',
        message: 'Invoice PDF generated successfully',
        data: {
          pdfUrl,
          invoiceNo: invoiceData.invoiceNo,
        },
      });
    } catch (err) {
      ControllerLogger.logError('Download Invoice PDF', err, req, res);
      next(err);
    }
  }
   //TODO:Delete Multiple
@httpDelete('/delete/multiple')
  public async deleteMultipleFinalInvoices(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, 'An array of FinalInvoice IDs is required'));
      }
      const result = await this.finalInvoiceService.deleteMultipleFinalInvoices(ids);
      const deletedNos = result.success.map(s => s.No || s.id).join(', ');

      // 🔔 Send notification for bulk AQR deletion
      // try {
      //   const userId = res.locals.user.id;
      //   await this.notificationService.createNoti(
      //     `Final Invoices deleted successfully`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }

       // Activity log
       const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.DELETE,
        module: ActivityModule.INVOICE,
        entityName: 'INVOICE',
        description: `${userName} has bulk deleted ${result.success.length} Final Invoice(s): ${deletedNos}`,
        metadata: { ids, count: ids.length },
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});


      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    }
      catch (error) {
       ControllerLogger.logError('Final Invoices deleteed', error, req, res);
      next(error);
    }
  }
}


  // @httpPatch('/:id', captureUser)
  // public async updateInvoice(
  //   @requestParam('id') id: string,
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction,
  // ) {
  //   try {
  //     const updatedBy = res.locals.updatedBy;

  //     const invoice = await this.finalInvoiceService.update(id, {
  //       ...req.body,
  //       updatedBy,
  //     });

  //     if (!invoice) {
  //       ControllerLogger.logNotFound('Final Invoice', id, req, res);
  //       return next(
  //         new AppError(404, 'Invoice not found or could not be updated'),
  //       );
  //     }

  //     // 🔔 Send notification for invoice update
  //     try {
  //       const userId = res.locals.user?.id;
  //       if (userId) {
  //         await this.notificationService.createNoti(
  //           `Final invoice updated successfully`,
  //           userId
  //         );
  //       }
  //     } catch (notifError) {
  //     }

  //     ControllerLogger.logSuccess('Final Invoice updated', id, req, res);
  //     res.status(200).json({
  //       status: 'success',
  //       message: 'Final invoice updated successfully',
  //     });
  //   } catch (err) {
  //     ControllerLogger.logError('Update Final Invoice', err, req, res);
  //     next(err);
  //   }
  // }

