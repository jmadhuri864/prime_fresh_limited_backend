//TODO: This service is replica of documentb.service.ts. 'documentb.service.ts' will be used for multiple level approval like grns and voucher.
//TODO: This service will be used for single level approval like deal slips, rfpa, etc.

import { inject, injectable } from "inversify";

import { TYPES } from "../../types";
import { UserRepository } from "../../employee/repository/user.repository";

import { ApprovalStageInfoRepository } from "../repository/approvalStageInfoRepository";
import { DocumentApprovalFlowRepository } from "../repository/DocumentApprovalFlowRepository.repository";
import { ApproverStatus } from "../entity/approvalname.entity";
import { DocumentStatus, DocumentTypeEnum } from "../entity/docuemnt.entity";
import { PaginationOptions } from "../../utils/pagination";
import { Brackets } from "typeorm";
import { DocumentbService } from "./documentb.service";
import { getReadableDocumentType } from "../../utils/documentTypeLabel";
import { CacheService } from "../../global/cache.service";
import { NotificationService } from "../../notification/service/notification.service";
import { DocumentbRepository } from "../repository/documentb.repository";

@injectable()
export class DocDoubleApproverService {

  constructor(
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.NotificationService) private notificationService: NotificationService,
    @inject(TYPES.ApprovalStageInfoRepository) private approvalStageInfoRepository: ApprovalStageInfoRepository,
    @inject(TYPES.DocumentApprovalFlowRepository) private documentApprovalFlowRepository: DocumentApprovalFlowRepository,
    @inject(TYPES.DocumentbService) private documentBService: DocumentbService,
    @inject(TYPES.CacheService) private cacheService: CacheService,
  ) {
  }

  // Invalidate all caches that depend on a document's status
  private async invalidateDocumentCache(documentId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(`finv:view:${documentId}`),
      this.cacheService.invalidatePattern('finv:all:*'),
    ]);
  }

  // Convert document type to readable format — moved to src/utils/documentTypeLabel.ts

  async approveDocumentStepForDoubleLevel(
  documentId: string,
  userId: string,
  action: ApproverStatus,
  reason?: string,
): Promise<void> {
  const document = await this.documentbRepository.findOne({
    where: { id: documentId },
    relations: [
      'approvalFlow',
      'approvalFlow.approvers',
      'approvalFlow.approvers.firstApprover',
      'approvalFlow.approvers.firstApprover.users',
      'approvalFlow.approvers.secondApprover',
      'approvalFlow.approvers.secondApprover.users',
       'approvalInfo',
       'approvalInfo.firstApproved',
        'approvalInfo.secondApproved',
      'lastActionBy',
    ],
  });

  if (!document || !document.approvalFlow) {
    throw new Error('Document or its approval flow not found');
  }

  const now = new Date();
  const user = await this.userRepository.findOne({ where: { id: userId } });
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

  // Ensure approvalInfo exists
  if (!document.approvalInfo) {
    document.approvalInfo = await this.documentApprovalFlowRepository.save(
      this.documentApprovalFlowRepository.create()
    );
    await this.documentbRepository.save(document);
  }

  const info = document.approvalInfo;
  const flow = document.approvalFlow;
  const firstBlock = flow.approvers.firstApprover;
  const secondBlock = flow.approvers.secondApprover;

  const isFirstApprover = firstBlock?.users?.some(u => u.id === userId);
  const isSecondApprover = secondBlock?.users?.some(u => u.id === userId);

  if (!isFirstApprover && !isSecondApprover) {
    throw new Error('User is not authorized to act on this document');
  }

  // REJECTED handling (immediate)
  if (action === ApproverStatus.REJECTED) {
    const stage = await this.approvalStageInfoRepository.save({
      userId,
      userName,
      status: action,
      reason: reason ?? '',
      statusChangedAt: now,
    });

    if (isFirstApprover) {
      if (info.firstApproved) throw new Error('First approver already acted');
      info.firstApproved = stage;
      document.remarks = `${document.type} Rejected at Approver Level 1`;
    } else if (isSecondApprover) {
      if (info.secondApproved) throw new Error('Second approver already acted');
      info.secondApproved = stage;
      document.remarks = `${document.type} Rejected at Approver Level 2`;
    }

    document.status = DocumentStatus.REJECT;
    await this.documentApprovalFlowRepository.save(info);
    await this.documentbRepository.save(document);
    await this.invalidateDocumentCache(documentId);

    const docNo = await this.documentBService.resolveDocumentTypeNo(document);
    const readableType = getReadableDocumentType(document.type);
    const docLabel = docNo ? `${readableType} #${docNo}` : readableType;
    const rejectedLevel = isFirstApprover ? 'Approver Level 1' : 'Approver Level 2';
    const rejectedLevelUsers = isFirstApprover ? firstBlock?.users ?? [] : secondBlock?.users ?? [];
    const otherLevelUsersOnReject = isFirstApprover ? secondBlock?.users ?? [] : firstBlock?.users ?? [];

    // 🔔 Actor
    await this.notificationService.createNoti(`You rejected ${docLabel} at ${rejectedLevel}`, userId);
    // 🔔 Creator
    if (document.lastActionBy?.id) {
      await this.notificationService.createNoti(
        `Your ${docLabel} was rejected at ${rejectedLevel} by ${userName}`,
        document.lastActionBy.id,
      );
    }
    // 🔔 Same-stage peers + Other level approvers — batch notification
    const rejectNotifyUserIds = [
      ...rejectedLevelUsers.filter(u => u.id !== userId).map(u => u.id),
      ...otherLevelUsersOnReject.map(u => u.id),
    ];
    if (rejectNotifyUserIds.length > 0) {
      await this.notificationService.createBatchNoti(
        `${docLabel} was rejected at ${rejectedLevel} by ${userName}. No action needed from you`,
        rejectNotifyUserIds
      );
    }
    return;
  }

  // APPROVED handling
  if (action === ApproverStatus.APPROVED) {
    const stage = await this.approvalStageInfoRepository.save({
      userId,
      userName,
      status: action,
      reason: reason ?? '',
      statusChangedAt: now,
    });

    if (isFirstApprover) {
      if (info.firstApproved) throw new Error('First approver already acted');
      info.firstApproved = stage;
    } else if (isSecondApprover) {
      if (info.secondApproved) throw new Error('Second approver already acted');
      info.secondApproved = stage;
    }

    await this.documentApprovalFlowRepository.save(info);

    const docNo2 = await this.documentBService.resolveDocumentTypeNo(document);
    const readableType2 = getReadableDocumentType(document.type);
    const docLabel2 = docNo2 ? `${readableType2} #${docNo2}` : readableType2;
    const approvedLevel = isFirstApprover ? 'Approver Level 1' : 'Approver Level 2';
    const approvedLevelUsers = isFirstApprover ? firstBlock?.users ?? [] : secondBlock?.users ?? [];
    const otherLevelUsers = isFirstApprover ? secondBlock?.users ?? [] : firstBlock?.users ?? [];

    // Invalidate cache on every approval action (approvalSummary changes)
    await this.invalidateDocumentCache(documentId);

    // Check if both levels approved
    const firstApproved = info.firstApproved?.status === ApproverStatus.APPROVED;
    const secondApproved = info.secondApproved?.status === ApproverStatus.APPROVED;

    if (firstApproved && secondApproved) {
      document.status = DocumentStatus.COMPLETE;
      document.remarks = `${document.type} Approved by Required Approvers`;
      await this.documentbRepository.save(document);
      await this.invalidateDocumentCache(documentId);

      // 🔔 Actor
      await this.notificationService.createNoti(`You approved ${docLabel2} at ${approvedLevel}`, userId);
      // 🔔 Creator
      if (document.lastActionBy?.id) {
        await this.notificationService.createNoti(
          `Your ${docLabel2} was approved at ${approvedLevel} by ${userName}. Document is now Complete`,
          document.lastActionBy.id,
        );
      }
      // 🔔 Same-stage peers + Other level approvers — batch notification
      const approveCompleteUserIds = [
        ...approvedLevelUsers.filter(u => u.id !== userId).map(u => u.id),
        ...otherLevelUsers.map(u => u.id),
      ];
      if (approveCompleteUserIds.length > 0) {
        await this.notificationService.createBatchNoti(
          `${docLabel2} has been fully approved by ${userName}. Document is now Complete`,
          approveCompleteUserIds
        );
      }
    } else {
      const nextStage = isFirstApprover ? 'Approver Level 2' : 'Approver Level 1';
      // 🔔 Actor
      await this.notificationService.createNoti(`You approved ${docLabel2} at ${approvedLevel}`, userId);
      // 🔔 Creator
      if (document.lastActionBy?.id) {
        await this.notificationService.createNoti(
          `Your ${docLabel2} was approved at ${approvedLevel} by ${userName}. Now waiting for ${nextStage}`,
          document.lastActionBy.id,
        );
      }
      // 🔔 Same-stage peers — batch notification
      const sameStagePeerIds = approvedLevelUsers.filter(u => u.id !== userId).map(u => u.id);
      if (sameStagePeerIds.length > 0) {
        await this.notificationService.createBatchNoti(
          `${docLabel2} has already been approved at ${approvedLevel} by ${userName}. No action needed from you`,
          sameStagePeerIds
        );
      }
      // 🔔 Next level approvers — batch notification
      const nextLevelUserIds = otherLevelUsers.map(u => u.id);
      if (nextLevelUserIds.length > 0) {
        await this.notificationService.createBatchNoti(
          `${docLabel2} has been approved at ${approvedLevel} by ${userName}. Your approval is now required at ${nextStage}`,
          nextLevelUserIds
        );
      }
    }

    return;
  }

  throw new Error('Invalid approval action');
}



  //TODO: Get Document with Data
  public async getAllDocumentByUserIdForDoubleApprover(userId: string, documentType: string, queryOptions: PaginationOptions, includeDeleted: boolean = false): Promise<any> {
    if (!Object.values(DocumentTypeEnum).includes(documentType as DocumentTypeEnum)) {
      throw new Error(`Invalid document type: ${documentType}`);
    }

    const queryBuilder = this.documentbRepository
      .createQueryBuilder('document')
      .leftJoin('document.approvalFlow', 'approvalFlow')
      .leftJoin('approvalFlow.approvers', 'approvalLevel')
      .leftJoin('approvalLevel.firstApprover', 'firstApproverBlock')
      .leftJoin('firstApproverBlock.users', 'firstApproverUser')
      .leftJoin('approvalLevel.secondApprover', 'secondApproverBlock')
      .leftJoin('secondApproverBlock.users', 'secondApproverUser')
      .leftJoin('document.lastActionBy', 'lastActionBy')
      .select([
        'document.id', 'document.document_type_id', 'document.type',
        'document.status', 'document.isDeleted', 'document.deletedAt', 'document.createdAt',
        'lastActionBy.id', 'lastActionBy.firstName', 'lastActionBy.lastName',
      ])
      .where(
        new Brackets((qb) => {
          qb.orWhere('firstApproverUser.id = :userId', { userId })
            .orWhere('secondApproverUser.id = :userId', { userId })
            .orWhere('lastActionBy.id = :userId', { userId });
        }),
      )
      .andWhere('document.document_type_id IS NOT NULL')
      .andWhere('document.type = :documentType', { documentType })
      .andWhere('document.isDeleted = :isDeleted', { isDeleted: includeDeleted })
      .andWhere(includeDeleted ? 'document.deletedAt IS NOT NULL' : 'document.deletedAt IS NULL');

    const sort = queryOptions?.sort || 'document.createdAt:DESC';
    const [sortField, sortOrderRaw] = sort.split(':');
    const sortOrder = (sortOrderRaw || 'DESC').toUpperCase() as 'ASC' | 'DESC';
    queryBuilder.orderBy(sortField, sortOrder);

    const page = queryOptions?.page || 1;
    const limit = queryOptions?.limit || 10;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: { total, page, pages: Math.ceil(total / limit) },
    };
  }

  //TODO: For View
   async getDocumentById(id: string): Promise<any> {
    const document = await this.documentbRepository
      .createQueryBuilder('document')
      .leftJoin('document.lastActionBy', 'lastActionBy')
      .leftJoin('document.approvalFlow', 'approvalFlow')
      .leftJoin('approvalFlow.creator', 'creator')
      .leftJoin('document.approvalInfo', 'approvalInfo')
      .leftJoin('approvalInfo.verified', 'verified')
      .leftJoin('approvalInfo.firstApproved', 'firstApproved')
      .leftJoin('approvalInfo.secondApproved', 'secondApproved')
      .leftJoin('approvalInfo.thirdApproved', 'thirdApproved')
      .leftJoin('approvalInfo.firstFinalized', 'firstFinalized')
      .leftJoin('approvalInfo.secondFinalized', 'secondFinalized')
      .select([
        'document.id', 'document.document_type_id', 'document.status',
        'lastActionBy.firstName',
        'approvalFlow.id',
        'creator.id', 'creator.firstName', 'creator.lastName',
        'approvalInfo.id',
        'verified.userId', 'verified.userName', 'verified.status',
        'firstApproved.userId', 'firstApproved.userName', 'firstApproved.status',
        'secondApproved.userId', 'secondApproved.userName', 'secondApproved.status',
        'thirdApproved.userId', 'thirdApproved.userName', 'thirdApproved.status',
        'firstFinalized.userId', 'firstFinalized.userName', 'firstFinalized.status',
        'secondFinalized.userId', 'secondFinalized.userName', 'secondFinalized.status',
      ])
      .where('document.id = :id', { id })
      .getOne();

    if (!document) throw new Error(`Document with ID ${id} not found`);

    const a = document.approvalInfo;
    const creator = document.approvalFlow?.creator ?? null;
    const mapStage = (stage: any) => stage ? { userId: stage.userId, name: stage.userName, status: stage.status } : null;

    return {
      documentId: document.id,
      documentTypeId: document.document_type_id,
      status: document.status,
      overAllStatus: document.status,
      createdBy: document.lastActionBy?.firstName ?? null,
      approvalSummary: a ? {
        createdBy: document.lastActionBy
          ? { userId: document.lastActionBy.id, name: `${document.lastActionBy.firstName} ${document.lastActionBy.lastName}`.trim() }
          : null,
        verified: mapStage(a.verified),
        firstApproved: mapStage(a.firstApproved),
        secondApproved: mapStage(a.secondApproved),
        thirdApproved: mapStage(a.thirdApproved),
        firstFinalized: mapStage(a.firstFinalized),
        secondFinalized: mapStage(a.secondFinalized),
      } : null,
    };
  }


}