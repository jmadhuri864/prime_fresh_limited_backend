import { controller, httpPost, httpGet, httpPut, next, requestBody, request, response, httpDelete } from "inversify-express-utils";

import { inject } from "inversify";
import { TYPES } from "../types";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { NextFunction, Request, Response } from "express";
import { ControllerLogger } from "../utils/controllerLogger";
import { NotificationService } from "../services/notification.service";
import { ReturnToVendorService } from "../services/retrunToVendor.service";
import { ActivityAction, ActivityModule } from "../entities/userActivityLog.entity";
import { UserActivityLogService } from "../services/userActivityLog.service";

@controller("/return-to-vendor", deserializeUser, requireUser)
export class ReturnToVendorController {

  constructor(@inject(TYPES.ReturnToVendorService) private returnToVendorService: ReturnToVendorService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService,
    @inject(TYPES.UserActivityLogService) private activityLogService: UserActivityLogService,
    
  ) 
    {

  }

  @httpPost("/")
  public async createReturnToVendor(@requestBody() postReturnData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {

      const requestedBy = res.locals.user.id; // Pass full user object
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';

      const newPostReturn = await this.returnToVendorService.createReturn(postReturnData, requestedBy, clientIp);

      ControllerLogger.logSuccess('Post Return By Vendor created', newPostReturn.id, req, res);

      //Send notification for post return creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Return By Vendor created successfully`,
          userId
        );
      }

      // Single activity log
      const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
          this.activityLogService.logActivity({
            userId: res.locals.user.id,
            userName,
            action: ActivityAction.CREATE,
            module: ActivityModule.RETURN_TO_VENDOR,
            entityName: 'ReturnToVendor',
            entityId: newPostReturn.id,
            description: `${userName} has created ReturnToVendor ${newPostReturn.rtvNo || newPostReturn.id}`,
            ipAddress: req.ip || '',
            userAgent: req.get('user-agent'),
            endpoint: req.originalUrl,
            httpMethod: req.method,
            statusCode: 201,
          }).catch(() => {});


      res.status(201).json({
        status: "success",
        data: newPostReturn.id,
        message: "Return By Vendor created successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Post Return By Customer creation', error, req, res);
      next(error);
    }
  }

  @httpGet("/")
  public async getAllReturnToVendor(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const page = req.query.page !== undefined ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;
      const queryOptions = { page: page ?? 1, limit: limit ?? 10, search };
      const userId = res.locals.user.id;

      const result = await this.returnToVendorService.getAll(queryOptions, userId);

      ControllerLogger.logSuccess('Get all return to vendor records', '', req, res);

      res.status(200).json({
        status: "success",
        data: result.data,
        totalRecords: result.meta.total,
        totalPages: result.meta.pages,
        page: result.meta.page,
        message: "Return to vendor records fetched successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Get all return to vendor records', error, req, res);
      next(error);
    }
  }

  @httpGet("/:id")
  public async getReturnToVendorById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getById(id);

      ControllerLogger.logSuccess('Get return to vendor by ID', id, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }
  @httpGet("/view/:docid")
  public async getReturnToVendorByIdForView(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { docid } = req.params;

      if (!docid) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor document ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getByIdForView(docid);

      ControllerLogger.logSuccess('Get return to vendor by ID for viewed', docid, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }
  @httpGet("/update/:id")
  public async getReturnToVendorByIdForUpdate(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getByIdForUpdate(id);

      ControllerLogger.logSuccess('Get return to vendor by ID', id, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }

  @httpPut("/:id")
  public async updateReturnToVendor(
    @request() req: Request,
    @response() res: Response,
    @requestBody() updateData: any,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const updatedReturn = await this.returnToVendorService.updateReturn(id, updateData);

      ControllerLogger.logSuccess('Return to vendor updated', id, req, res);

      // 🔔 Send notification for return to vendor update
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Return to vendor updated successfully`,
            userId
          );
        }
      } catch (notifError) {
      }

       // Activity log
       const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.UPDATE,
        module: ActivityModule.RETURN_TO_VENDOR,
        entityName: 'ReturnToVendor',
        entityId: id,
        description: `${userName} has updated ReturnToVendor ${updatedReturn.rtvNo || id}`,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});


      res.status(200).json({
        status: "success",
        data: updatedReturn.id,
        message: "Return to vendor updated successfully",
      });
    } catch (error) {
      ControllerLogger.logError('Return to vendor update', error, req, res);
      next(error);
    }
  }

  @httpDelete("/:id")
  public async deleteReturn(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const result = await this.returnToVendorService.softDeleteReturn(id);
      
       // Activity log
       const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.DELETE,
        module: ActivityModule.RETURN_TO_VENDOR,
        entityName: 'ReturnToVendor',
        entityId: id,
        description: `${userName} has deleted ReturnToVendor ${result.id || id}`,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});
      
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      ControllerLogger.logError('Return to vendor delete', error, req, res);
      next(error);
    }
  }

  @httpDelete("/delete/multiple")
  public async deleteMultipleReturnToVendor(
    @request() req: Request<{}, {}, { ids: string[] }>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new Error('An array of return to vendor IDs is required'));
      }

      const result = await this.returnToVendorService.deleteMultipleReturnToVendor(ids);
      const deletedNos = result.success.map(s => s.No || s.id).join(', ');

      ControllerLogger.logSuccess('Return to vendor multiple deletion', `${ids.length} records`, req, res);
      
       // Activity log
       const userName = `${res.locals.user.firstName || ''} ${res.locals.user.lastName || ''}`.trim() || res.locals.user.username || 'Unknown User';
      this.activityLogService.logActivity({
        userId: res.locals.user.id,
        userName,
        action: ActivityAction.DELETE,
        module: ActivityModule.RETURN_TO_VENDOR,
        entityName: 'ReturnToVendor',
        description: `${userName} has bulk deleted ${result.success.length} ReturnToVendor(s): ${deletedNos}`,
        metadata: { ids, count: ids.length },
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: 200,
      }).catch(() => {});


      return res.status(200).json({
        status: 'success',
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    } catch (error) {
      ControllerLogger.logError('Return to vendor multiple deletion', error, req, res);
      next(error);
    }
  }
}