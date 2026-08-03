import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { ApprovalFlowRepository } from '../repository/approvalFlow.repository';
import { UserRepository } from '../../employee/repository/user.repository';

import { In } from 'typeorm';

import { AppDataSource } from '../../utils/data-source';

import logger from '../../utils/logger';
import { FinalizerBlockRepository } from '../repository/finalizerBlock.repository';
import { ApprovalLevelRepository } from '../repository/approvalLevel.repository';
import { ApproverBlockRepository } from '../repository/approverBlock.repository';
import { ApprovalFlow } from '../entity/approvalFlow.entity';
import { User } from '../../employee/entity/user.entity';
type ApproverBlockInput = {
  hierarchy: number;
  minAmtCanApprove: number;
  maxAmtCanApprove: number;
  users: string[];
};

@injectable()
export class ApprovalFlowService {
  constructor(
    @inject(TYPES.ApprovalFlowRepository)
    private approvalFlowRepository: ApprovalFlowRepository,
    @inject(TYPES.UserRepository)
    private userRepository: UserRepository,
    @inject(TYPES.FinalizerBlockRepository)
    private finalizerBlockRepository: FinalizerBlockRepository,
    @inject(TYPES.ApprovalLevelRepository)
    private approvalLevelRepository: ApprovalLevelRepository,
    @inject(TYPES.ApproverBlockRepository)
    private approverBlockRepository: ApproverBlockRepository,
  ) {}

  async create(data: {
    creator: string;
    type: string;
    verifiers: string[];
    approvers: {
      firstApprover: ApproverBlockInput | null;
      secondApprover: ApproverBlockInput | null;
      thirdApprover: ApproverBlockInput | null;
      fourthApprover: ApproverBlockInput | null;
      fifthApprover: ApproverBlockInput | null;
      sixthApprover: ApproverBlockInput | null;
    };
    finalizers: {
      firstFinalizers: string[];
      secondFinalizers: string[];
    };
  }): Promise<any> {
    logger.info('Service data', data);
    logger.info('Creator ID:', data.approvers.firstApprover?.users);
    logger.info('Creator ID:', data.approvers.secondApprover?.users);
    
    
    
    const creator = await this.userRepository.findOneBy({ id: data.creator });
    if (!creator) throw new Error('Creator not found');
    const type = data.type;
    const verifiers = await this.userRepository.findBy({
      id: In(data.verifiers || []),
    });

    const createApproverBlock = async (
      blockData: ApproverBlockInput | null,
    ) => {
      if (!blockData) return null;
      const users = await this.userRepository.findBy({
        id: In(blockData.users || []),
      });

      logger.info("Users: ", users);
      
      return this.approverBlockRepository.save({
        hierarchy: blockData.hierarchy,
        minAmtCanApprove: blockData.minAmtCanApprove,
        maxAmtCanApprove: blockData.maxAmtCanApprove,
        users,
      });
    };

    const [
      firstApprover,
      secondApprover,
      thirdApprover,
      fourthApprover,
      fifthApprover,
      sixthApprover,
    ] = await Promise.all([
      createApproverBlock(data.approvers.firstApprover),
      createApproverBlock(data.approvers.secondApprover),
      createApproverBlock(data.approvers.thirdApprover),
      createApproverBlock(data.approvers.fourthApprover),
      createApproverBlock(data.approvers.fifthApprover),
      createApproverBlock(data.approvers.sixthApprover),
    ]);
    logger.log('Approval level', createApproverBlock);
    logger.log('First approver', firstApprover);
    logger.log('Second approver', secondApprover);
    

    // const approvalLevel: any = await this.approvalLevelRepository.save({
    //   ...firstApprover,
    //   ...secondApprover,
    //   ...thirdApprover,
    //   ...fourthApprover,
    //   ...fifthApprover,
    //   ...sixthApprover,
    // });

    const approvalLevel = this.approvalLevelRepository.create();
    if (firstApprover) approvalLevel.firstApprover = firstApprover;
    if (secondApprover) approvalLevel.secondApprover = secondApprover;
    if (thirdApprover) approvalLevel.thirdApprover = thirdApprover;
    if (fourthApprover) approvalLevel.fourthApprover = fourthApprover;
    if (fifthApprover) approvalLevel.fifthApprover = fifthApprover;
    if (sixthApprover) approvalLevel.sixthApprover = sixthApprover;
    
    const savedApprovalLevel = await this.approvalLevelRepository.save(approvalLevel);


    // console.log('Approval level', approvalLevel.firstApprover);
    // console.log('Approval level', approvalLevel.secondApprover?.users);

    const firstFinalizers = await this.userRepository.findBy({
      id: In(data.finalizers.firstFinalizers || []),
    });
    const secondFinalizers = await this.userRepository.findBy({
      id: In(data.finalizers.secondFinalizers || []),
    });

    const finalizerBlock = await this.finalizerBlockRepository.save({
      firstFinalizers,
      secondFinalizers,
    });
    logger.log("Finalizers: ",finalizerBlock);
    
    const approvalFlow = this.approvalFlowRepository.create();
    approvalFlow.creator = creator;
    approvalFlow.type = type as any;
    approvalFlow.verifiers = verifiers;
    approvalFlow.approvers = savedApprovalLevel;
    approvalFlow.finalizers = finalizerBlock;
    
    logger.log('Approval flow', approvalFlow);

    return await this.approvalFlowRepository.save(approvalFlow);
  }

 async getAll(type?: string, page?: number, limit?: number): Promise<any> {
    const query = this.approvalFlowRepository
      .createQueryBuilder('approvalflows')
      .leftJoinAndSelect('approvalflows.creator', 'creator')
      .leftJoinAndSelect('approvalflows.verifiers', 'verifiers')
      .leftJoinAndSelect('approvalflows.approvers', 'approvers')
      .leftJoinAndSelect('approvers.firstApprover', 'firstApprover')
      .leftJoinAndSelect('firstApprover.users', 'firstApproverUsers')
      .leftJoinAndSelect('approvers.secondApprover', 'secondApprover')
      .leftJoinAndSelect('secondApprover.users', 'secondApproverUsers')
      .leftJoinAndSelect('approvers.thirdApprover', 'thirdApprover')
      .leftJoinAndSelect('thirdApprover.users', 'thirdApproverUsers')
      .leftJoinAndSelect('approvers.fourthApprover', 'fourthApprover')
      .leftJoinAndSelect('fourthApprover.users', 'fourthApproverUsers')
      .leftJoinAndSelect('approvers.fifthApprover', 'fifthApprover')
      .leftJoinAndSelect('fifthApprover.users', 'fifthApproverUsers')
      // .leftJoinAndSelect('approvers.sixthApprover', 'sixthApprover')
      // .leftJoinAndSelect('sixthApprover.users', 'sixthApproverUsers')
      .leftJoinAndSelect('approvalflows.finalizers', 'finalizers')
      .leftJoinAndSelect('finalizers.firstFinalizers', 'firstFinalizers')
      .leftJoinAndSelect('finalizers.secondFinalizers', 'secondFinalizers');

    //console.log(type);
    if (type) {
      query.where('approvalflows.type = :type', { type });
    }

    const isPaginated = page !== undefined && limit !== undefined;

    if (isPaginated) {
      query.skip((page! - 1) * limit!).take(limit!);
    }

    const [data, total] = await query.getManyAndCount();

    //console.log('getall', data);
    //     const mapApprover = (approver:any) =>
    // approver
    //   ? {
    //       id: approver.id || null,
    //       hierarchy: approver.hierarchy || null,
    //       minAmtCanApprove: approver.minAmtCanApprove,
    //       maxAmtCanApprove: approver.maxAmtCanApprove,
    //       users: approver.users?.map((user:any) => ({
    //         id: user?.id || null,
    //         firstName: user.firstName,
    //         middleName: user.middleName,
    //         lastName: user.lastName,
    //       })),
    //     }
    //   : null;
    const mapApprover = (approver: any) =>
      approver
        ? {
            id: approver.id || null,
            hierarchy: approver.hierarchy || null,
            minAmtCanApprove: approver.minAmtCanApprove,
            maxAmtCanApprove: approver.maxAmtCanApprove,
            users: approver.users?.map(
              (user: any) => `${user.firstName} ${user.lastName}`,
            ),
          }
        : null;

    const formattedResponse = data.map((result) => {
      return {
        id: result.id,
        type: result.type,
        // creator: result.creator
        //   ? {
        //       id: result.creator?.id || null,
        //       firstName: result.creator.firstName,
        //       middleName: result.creator.middleName,
        //       lastName: result.creator.lastName,
        //     }
        //   : null,
        creator: result.creator
          ? `${result.creator.firstName} ${result.creator.lastName}`
          : null,

        // verifiers: result.verifiers.map((verifier) => {
        //   return {
        //     id: verifier?.id || null,
        //     firstName: verifier.firstName,
        //     middleName: verifier.middleName,
        //     lastName: verifier.lastName,
        //   };
        // }),
        verifiers: result.verifiers.map((verifier) => {
          return `${verifier.firstName} ${verifier.lastName}`;
        }),
        approvers:
          result.approvers !== null
            ? {
                firstApprover: result.approvers.firstApprover
                  ? mapApprover(result.approvers.firstApprover)
                  : null,
                secondApprover: result.approvers.secondApprover
                  ? mapApprover(result.approvers.secondApprover)
                  : null,
                thirdApprover: result.approvers.thirdApprover
                  ? mapApprover(result.approvers.thirdApprover)
                  : null,
                fourthApprover: result.approvers.fourthApprover
                  ? mapApprover(result.approvers.fourthApprover)
                  : null,
                fifthApprover: result.approvers.fifthApprover
                  ? mapApprover(result.approvers.fifthApprover)
                  : null,
                // sixthApprover: result.approvers.sixthApprover
                //   ? mapApprover(result.approvers.sixthApprover)
                //   : null,
              }
            : null,

        finalizers: {
          firstFinalizers: result.finalizers.firstFinalizers
            ? result.finalizers?.firstFinalizers.map(
                (firstFinalizer) =>
                  `${firstFinalizer.firstName} ${firstFinalizer.lastName}`,
              )
            : [],
          secondFinalizers: result.finalizers.secondFinalizers
            ? result.finalizers?.secondFinalizers.map(
                (secondFinalizers) =>
                  `${secondFinalizers.firstName} ${secondFinalizers.lastName}`,
              )
            : [],
        },
      };
      return result;
    });
    const effectivePage = isPaginated ? page! : 1;
    const effectiveLimit = isPaginated ? limit! : total;

    return {
      data: formattedResponse,
      total,
      page: effectivePage,
      limit: effectiveLimit,
      totalPages: isPaginated ? Math.ceil(total / limit!) : 1,
    };
  }

  async getbyidforview(id: string): Promise<any> {
    const result = await this.approvalFlowRepository
      .createQueryBuilder('approvalflows')
      .leftJoinAndSelect('approvalflows.creator', 'creator')
      .leftJoinAndSelect('approvalflows.verifiers', 'verifiers')
      .leftJoinAndSelect('approvalflows.approvers', 'approvers')
      .leftJoinAndSelect('approvers.firstApprover', 'firstApprover')
      .leftJoinAndSelect('firstApprover.users', 'firstApproverUsers')
      .leftJoinAndSelect('approvers.secondApprover', 'secondApprover')
      .leftJoinAndSelect('secondApprover.users', 'secondApproverUsers')
      .leftJoinAndSelect('approvers.thirdApprover', 'thirdApprover')
      .leftJoinAndSelect('thirdApprover.users', 'thirdApproverUsers')
      .leftJoinAndSelect('approvers.fourthApprover', 'fourthApprover')
      .leftJoinAndSelect('fourthApprover.users', 'fourthApproverUsers')
      .leftJoinAndSelect('approvers.fifthApprover', 'fifthApprover')
      .leftJoinAndSelect('fifthApprover.users', 'fifthApproverUsers')
      .leftJoinAndSelect('approvers.sixthApprover', 'sixthApprover')
      .leftJoinAndSelect('sixthApprover.users', 'sixthApproverUsers')
      .leftJoinAndSelect('approvalflows.finalizers', 'finalizers')
      .leftJoinAndSelect('finalizers.firstFinalizers', 'firstFinalizers')
      .leftJoinAndSelect('finalizers.secondFinalizers', 'secondFinalizers')
      .where('approvalflows.id = :id', { id })
      .getOne();

    if (!result) {
      return null;
    }

    const mapApprover = (approver: any) =>
      approver
        ? {
            id: approver.id || null,
            hierarchy: approver.hierarchy || null,
            minAmtCanApprove: approver.minAmtCanApprove,
            maxAmtCanApprove: approver.maxAmtCanApprove,
            users: approver.users?.map(
              (user: any) => `${user.firstName} ${user.lastName}`,
            ),
          }
        : null;

    const formattedResponse = {
      id: result.id,
      creator: result.creator
        ? `${result.creator.firstName} ${result.creator.lastName}`
        : null,
      verifiers: result.verifiers?.map(
        (verifier: any) => `${verifier.firstName} ${verifier.lastName}`,
      ),
      approvers: result.approvers
        ? {
            firstApprover: mapApprover(result.approvers.firstApprover),
            secondApprover: mapApprover(result.approvers.secondApprover),
            thirdApprover: mapApprover(result.approvers.thirdApprover),
            fourthApprover: mapApprover(result.approvers.fourthApprover),
            fifthApprover: mapApprover(result.approvers.fifthApprover),
            sixthApprover: mapApprover(result.approvers.sixthApprover),
          }
        : null,
      finalizers: {
        firstFinalizers:
          result.finalizers?.firstFinalizers?.map(
            (f: any) => `${f.firstName} ${f.lastName}`,
          ) || [],
        secondFinalizers:
          result.finalizers?.secondFinalizers?.map(
            (f: any) => `${f.firstName} ${f.lastName}`,
          ) || [],
      },
    };

    return formattedResponse;
  }

  async getByIdForUpdate(id: string): Promise<any> {
    const result = await this.approvalFlowRepository
      .createQueryBuilder('approvalflows')
      .leftJoinAndSelect('approvalflows.creator', 'creator')
      .leftJoinAndSelect('approvalflows.verifiers', 'verifiers')
      .leftJoinAndSelect('approvalflows.approvers', 'approvers')
      .leftJoinAndSelect('approvers.firstApprover', 'firstApprover')
      .leftJoinAndSelect('firstApprover.users', 'firstApproverUsers')
      .leftJoinAndSelect('approvers.secondApprover', 'secondApprover')
      .leftJoinAndSelect('secondApprover.users', 'secondApproverUsers')
      .leftJoinAndSelect('approvers.thirdApprover', 'thirdApprover')
      .leftJoinAndSelect('thirdApprover.users', 'thirdApproverUsers')
      .leftJoinAndSelect('approvers.fourthApprover', 'fourthApprover')
      .leftJoinAndSelect('fourthApprover.users', 'fourthApproverUsers')
      .leftJoinAndSelect('approvers.fifthApprover', 'fifthApprover')
      .leftJoinAndSelect('fifthApprover.users', 'fifthApproverUsers')
      .leftJoinAndSelect('approvers.sixthApprover', 'sixthApprover')
      .leftJoinAndSelect('sixthApprover.users', 'sixthApproverUsers')
      .leftJoinAndSelect('approvalflows.finalizers', 'finalizers')
      .leftJoinAndSelect('finalizers.firstFinalizers', 'firstFinalizers')
      .leftJoinAndSelect('finalizers.secondFinalizers', 'secondFinalizers')
      .where('approvalflows.id = :id', { id })
      .getOne();

    if (!result) {
      return null;
    }

    const mapApprover = (approver: any) =>
      approver
        ? {
            id: approver.id || null,
            hierarchy: approver.hierarchy || null,
            minAmtCanApprove: approver.minAmtCanApprove,
            maxAmtCanApprove: approver.maxAmtCanApprove,
            users: approver.users?.map((user: any) => user.id),
          }
        : null;

    const formattedResponse = {
      id: result.id,
      creator: result.creator ? result.creator.id : null,
      verifiers: result.verifiers?.map((verifier: any) => verifier.id),
      approvers: result.approvers
        ? {
            firstApprover: mapApprover(result.approvers.firstApprover),
            secondApprover: mapApprover(result.approvers.secondApprover),
            thirdApprover: mapApprover(result.approvers.thirdApprover),
            fourthApprover: mapApprover(result.approvers.fourthApprover),
            fifthApprover: mapApprover(result.approvers.fifthApprover),
            sixthApprover: mapApprover(result.approvers.sixthApprover),
          }
        : null,
      finalizers: {
        firstFinalizers:
          result.finalizers?.firstFinalizers?.map((f: any) => f.id) || [],
        secondFinalizers:
          result.finalizers?.secondFinalizers?.map((f: any) => f.id) || [],
      },
    };

    return formattedResponse;
  }

  

  //TODO: Approval Flow Update
  async update(id: string, data: any): Promise<any> {
    const result = await this.approvalFlowRepository
      .createQueryBuilder('approvalflows')
      .leftJoinAndSelect('approvalflows.creator', 'creator')
      .leftJoinAndSelect('approvalflows.verifiers', 'verifiers')
      .leftJoinAndSelect('approvalflows.approvers', 'approvers')
      .leftJoinAndSelect('approvers.firstApprover', 'firstApprover')
      .leftJoinAndSelect('firstApprover.users', 'firstApproverUsers')
      .leftJoinAndSelect('approvers.secondApprover', 'secondApprover')
      .leftJoinAndSelect('secondApprover.users', 'secondApproverUsers')
      .leftJoinAndSelect('approvers.thirdApprover', 'thirdApprover')
      .leftJoinAndSelect('thirdApprover.users', 'thirdApproverUsers')
      .leftJoinAndSelect('approvers.fourthApprover', 'fourthApprover')
      .leftJoinAndSelect('fourthApprover.users', 'fourthApproverUsers')
      .leftJoinAndSelect('approvers.fifthApprover', 'fifthApprover')
      .leftJoinAndSelect('fifthApprover.users', 'fifthApproverUsers')
      .leftJoinAndSelect('approvers.sixthApprover', 'sixthApprover')
      .leftJoinAndSelect('sixthApprover.users', 'sixthApproverUsers')
      .leftJoinAndSelect('approvalflows.finalizers', 'finalizers')
      .leftJoinAndSelect('finalizers.firstFinalizers', 'firstFinalizers')
      .leftJoinAndSelect('finalizers.secondFinalizers', 'secondFinalizers')
      .where('approvalflows.id = :id', { id })
      .getOne();

    if (!result) {
      throw new Error(`ApprovalFlow with ID ${id} not found`);
    }

    if (data.verifiers) {
      const verifiers = await this.userRepository.findBy({
        id: In(data.verifiers),
      });
      logger.log(
        'Fetched verifiers:',
        verifiers.map((v) => v.id),
      );
      result.verifiers = verifiers;
    }

    if (data.approvers) {
      const approverData = data.approvers;

      const approverBlockMap = {
        ...(approverData.firstApprover && {
          firstApprover: approverData.firstApprover,
        }),
        ...(approverData.secondApprover && {
          secondApprover: approverData.secondApprover,
        }),
        ...(approverData.thirdApprover && {
          thirdApprover: approverData.thirdApprover,
        }),
        ...(approverData.fourthApprover && {
          fourthApprover: approverData.fourthApprover,
        }),
        ...(approverData.fifthApprover && {
          fifthApprover: approverData.fifthApprover,
        }),
        ...(approverData.sixthApprover && {
          sixthApprover: approverData.sixthApprover,
        }),
      };

      const approversEntity = result.approvers;

      for (const [key, approverInputRaw] of Object.entries(approverBlockMap)) {
        const approverInput = approverInputRaw as ApproverBlockInput & {
          id?: string;
        };
        if (!approverInput?.id) continue;

        const approverEntity = await this.approverBlockRepository.findOne({
          where: { id: approverInput.id },
          relations: ['users'],
        });

        if (!approverEntity)
          throw new Error(
            `Approver block with id ${approverInput.id} not found`,
          );

        if (
          approverInput.hierarchy !== undefined &&
          approverInput.hierarchy !== null
        ) {
          approverEntity.hierarchy = approverInput.hierarchy;
        }

        if (
          approverInput.minAmtCanApprove !== undefined &&
          approverInput.minAmtCanApprove !== null
        ) {
          approverEntity.minAmtCanApprove = Number(
            approverInput.minAmtCanApprove,
          );
        }

        if (
          approverInput.maxAmtCanApprove !== undefined &&
          approverInput.maxAmtCanApprove !== null
        ) {
          approverEntity.maxAmtCanApprove = Number(
            approverInput.maxAmtCanApprove,
          );
        }

        if (approverInput.users && approverInput.users.length > 0) {
          const userEntities = await this.userRepository.findByIds(
            approverInput.users,
          );
          approverEntity.users = userEntities;
        }

        await this.approverBlockRepository.save(approverEntity);
        (approversEntity as any)[key] = approverEntity;
      }

      await this.approvalLevelRepository.save(approversEntity);
    }

    if (data.finalizers) {
      const firstFinalizers = await this.userRepository.findBy({
        id: In(data.finalizers.firstFinalizers || []),
      });

      const secondFinalizers = await this.userRepository.findBy({
        id: In(data.finalizers.secondFinalizers || []),
      });

      const finalizerBlock = await this.finalizerBlockRepository.findOne({
        where: { id: result.finalizers?.id },
        relations: ['firstFinalizers', 'secondFinalizers'],
      });

      if (finalizerBlock) {
        finalizerBlock.firstFinalizers = firstFinalizers;
        finalizerBlock.secondFinalizers = secondFinalizers;

        await this.finalizerBlockRepository.save(finalizerBlock);
        result.finalizers = finalizerBlock;
      }
    }

    const { verifiers, approvers, finalizers, ...rest } = data;
    Object.assign(result, rest);

    const updated = await this.approvalFlowRepository.save(result);
    return updated;
  }

  async replaceUserInApprovalSystem(
    oldUserId: string,
    newUserId: string,
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const approvalFlowRepo = manager.getRepository(ApprovalFlow);

      const oldUser = await userRepo.findOneOrFail({
        where: { id: oldUserId },
      });
      const newUser = await userRepo.findOneOrFail({
        where: { id: newUserId },
      });

      const allFlows = await approvalFlowRepo.find({
        relations: [
          'creator',
          'verifiers',
          'finalizers',
          'finalizers.firstFinalizers',
          'finalizers.secondFinalizers',
          'approvers',
          'approvers.firstApprover',
          'approvers.firstApprover.users',
          'approvers.secondApprover',
          'approvers.secondApprover.users',
          'approvers.thirdApprover',
          'approvers.thirdApprover.users',
          'approvers.fourthApprover',
          'approvers.fourthApprover.users',
          'approvers.fifthApprover',
          'approvers.fifthApprover.users',
          'approvers.sixthApprover',
          'approvers.sixthApprover.users',
        ],
      });

      for (const flow of allFlows) {
        // Replace creator
        if (flow.creator?.id === oldUserId) {
          flow.creator = newUser;
        }
        // Replace in verifiers
        flow.verifiers = this.replaceUserInArray(
          flow.verifiers,
          oldUserId,
          newUser,
        );

        // Replace in finalizers
        if (flow.finalizers) {
          flow.finalizers.firstFinalizers = this.replaceUserInArray(
            flow.finalizers.firstFinalizers,
            oldUserId,
            newUser,
          );
          flow.finalizers.secondFinalizers = this.replaceUserInArray(
            flow.finalizers.secondFinalizers,
            oldUserId,
            newUser,
          );
          await manager.save(flow.finalizers);
        }

        // Replace in each approver block
        const level = flow.approvers;
        if (level) {
          const blocks = [
            level.firstApprover,
            level.secondApprover,
            level.thirdApprover,
            level.fourthApprover,
            level.fifthApprover,
            level.sixthApprover,
          ];
          for (const block of blocks) {
            if (block) {
              block.users = this.replaceUserInArray(
                block.users,
                oldUserId,
                newUser,
              );
              await manager.save(block);
            }
          }
        }

        await manager.save(flow); // Save main ApprovalFlow if needed
      }
    });
  }

  private replaceUserInArray(
    users: User[],
    oldUserId: string,
    newUser: User,
  ): User[] {
    const hasOldUser = users.some((u) => u.id === oldUserId);
    if (!hasOldUser) return users;

    const filtered = users.filter((u) => u.id !== oldUserId);
    const alreadyExists = filtered.some((u) => u.id === newUser.id);
    if (!alreadyExists) filtered.push(newUser);
    return filtered;
  }

  //TODO: Here we check approval flow for logged user
  async findApprovalFlowForLoggedUser(userId: any, docDef: any){
    try {
      console.log(userId, docDef);

      const approvalFlow = await this.approvalFlowRepository.findOne({
        where: {
          creator: { id: userId },
          type:  docDef,
        },
        relations: [
          'verifiers',
          'approvers',
          'approvers.firstApprover',
          'approvers.secondApprover',
          'approvers.thirdApprover',
          'approvers.fourthApprover',
          'approvers.fifthApprover',
          'approvers.sixthApprover',
        ],
      });
        //console.log("Approval flow: ", approvalFlow);

      return approvalFlow;

    } catch (error: any) {
      console.error('Approval flow service error:', { userId, docDef, originalError: error?.message });
      throw new Error(
          `Something went wrong In Approval flow service: ${error?.message || 'Unknown error'}`,
        );
    }
  }

}


// async getById(id: String): Promise<any> {
  //   const data = await this.approvalFlowRepository
  //     .createQueryBuilder('approvalflows')
  //     .leftJoinAndSelect('approvalflows.creator', 'creator')
  //     .leftJoinAndSelect('approvalflows.verifiers', 'verifiers')
  //     .leftJoinAndSelect('approvalflows.approvers', 'approvers')
  //     .leftJoinAndSelect('approvers.firstApprover', 'firstApprover')
  //     .leftJoinAndSelect('firstApprover.users', 'firstApproverUsers')
  //     .leftJoinAndSelect('approvers.secondApprover', 'secondApprover')
  //     .leftJoinAndSelect('secondApprover.users', 'secondApproverUsers')
  //     .leftJoinAndSelect('approvers.thirdApprover', 'thirdApprover')
  //     .leftJoinAndSelect('thirdApprover.users', 'thirdApproverUsers')
  //     .leftJoinAndSelect('approvers.fourthApprover', 'fourthApprover')
  //     .leftJoinAndSelect('fourthApprover.users', 'fourthApproverUsers')
  //     .leftJoinAndSelect('approvers.fifthApprover', 'fifthApprover')
  //     .leftJoinAndSelect('fifthApprover.users', 'fifthApproverUsers')
  //     .leftJoinAndSelect('approvers.sixthApprover', 'sixthApprover')
  //     .leftJoinAndSelect('sixthApprover.users', 'sixthApproverUsers')
  //     .leftJoinAndSelect('approvalflows.finalizers', 'finalizers')
  //     .leftJoinAndSelect('finalizers.firstFinalizers', 'firstFinalizers')
  //     .leftJoinAndSelect('finalizers.secondFinalizers', 'secondFinalizers')
  //     .getOne();

  //   // return data;
  //   const mapApprover = (approver:any) =>
  // approver
  //   ? {
  //       id: approver.id || null,
  //       hierarchy: approver.hierarchy || null,
  //       minAmtCanApprove: approver.minAmtCanApprove,
  //       maxAmtCanApprove: approver.maxAmtCanApprove,
  //       users: approver.users?.map((user:any) => user.id),
  //     }
  //   : null;

  //   const formattedResponse =  {
  //       id: data?.id,
  //       creator: data?.creator.id,
  //       verifiers: data?.verifiers.map((verifier) => verifier.id),
  //      approvers: data?.approvers !== null
  // ? {
  //     firstApprover: data?.approvers.firstApprover
  //       ? mapApprover(data?.approvers.firstApprover)
  //       : null,
  //     secondApprover: data?.approvers.secondApprover
  //       ? mapApprover(data?.approvers.secondApprover)
  //       : null,
  //     thirdApprover: data?.approvers.thirdApprover
  //       ? mapApprover(data?.approvers.thirdApprover)
  //       : null,
  //     fourthApprover: data?.approvers.fourthApprover
  //       ? mapApprover(data?.approvers.fourthApprover)
  //       : null,
  //     fifthApprover: data?.approvers.fifthApprover
  //       ? mapApprover(data?.approvers.fifthApprover)
  //       : null,
  //     sixthApprover: data?.approvers.sixthApprover
  //       ? mapApprover(data?.approvers.sixthApprover)
  //       : null,
  //   }
  // : null,

  //       finalizers:
  //       {
  //        firstFinalizers: data?.finalizers.firstFinalizers
  //          ? data?.finalizers?.firstFinalizers.map((firstFinalizer) => firstFinalizer.id) : [],
  //          secondFinalizers: data?.finalizers.secondFinalizers
  //          ? data?.finalizers?.secondFinalizers.map((secondFinalizers) => secondFinalizers.id) : [],
  //       }
  //     };
  //   return formattedResponse;

  // }

