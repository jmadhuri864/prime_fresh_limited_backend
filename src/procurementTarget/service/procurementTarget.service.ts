import "reflect-metadata";
import { inject, injectable } from "inversify";
import { ProcurementTargetRepository } from "../repository/procurementTarget.repository";
import { TYPES } from "../../types";
import { UserRepository } from "../../employee/repository/user.repository";
import { ProductRepository } from "../../product/createproduct/repository/product.repository";
import { ProcurementTargetProductRepository } from "../repository/procurmentTargetProduct.repository";
import { ProcurementTargetWeekRepository } from "../repository/procurmentTargetWeek.repository";
import { DepartmentEnum } from "../entities/workflowClosure.entity";
import { ProcurementTargetAchievementRepository } from "../procurementTarget/procurmentAchievement.repository";
import { WorkflowHierarchyRepository } from "../../workFlow/repository/WorkflowHierarchy.repository";
import * as ExcelJS from 'exceljs';
import { AppDataSource } from "../../utils/data-source";
import { ProcurementStatus, ProcurementTarget } from "../entities/procurmentTarget.entity";
import * as path from 'path';
import * as fs from 'fs';
import { User } from "../entities/user.entity";
import { ProcurementTargetWeek } from "../entities/procurementTargetWeek.entity";
import { ProcurementTargetProduct } from "../procurementTarget/procurementTargetProduct.entity";
import { Product } from "../entities/product.entity";

@injectable()
export class ProcurementTargetService {
    constructor(
        @inject(TYPES.ProcurementTargetRepository)
        private procurementTargetRepository: ProcurementTargetRepository,
        @inject(TYPES.UserRepository)
        private userRepository: UserRepository,
        @inject(TYPES.ProductRepository)
        private productRepository: ProductRepository,
        @inject(TYPES.ProcurementTargetProductRepository)
        private procurementTargetProduct: ProcurementTargetProductRepository,
        @inject(TYPES.ProcurementTargetWeekRepository)
        private weeklyProcurementRepo: ProcurementTargetWeekRepository,
        @inject(TYPES.ProcurementTargetAchievementRepository)
        private procurementAchievementRepo: ProcurementTargetAchievementRepository,
        @inject(TYPES.WorkflowHierarchyRepository)
        private workflowHierarchyRepo: WorkflowHierarchyRepository
    ) {}

    async create(payload: any) {

   // console.log("status",payload.status);
    const targetRepo = AppDataSource.getRepository(ProcurementTarget);

   
   

    // Week-wise totals (ALL PRODUCTS)
    const weekTotals: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6:0
    };

    // Handle both field names for backward compatibility
    const planData = payload.procurementTargetPlan || payload.procurementTargetPlane;

    if (!planData || !Array.isArray(planData)) {
      throw new Error('procurementTargetPlan is required and must be an array');
    }

    const products: ProcurementTargetProduct[] = planData.map(
      (p: any) => {
        // ✅ Validate weekly total per product
        const calculatedTotal = p.weeklyTargets.reduce(
          (sum: number, w: any) => sum + Number(w.qty),
          0,
        );

        if (calculatedTotal !== Number(p.weeklyTargetsTotalQty)) {
          throw new Error(
            `Weekly total mismatch for product ${p.product}`,
          );
        }

        const productEntity = new ProcurementTargetProduct();
        productEntity.product = { id: p.product } as Product;
        productEntity.weeklyTotalQtyPerProduct = p.weeklyTargetsTotalQty;
        productEntity.remark = p.remark;

        productEntity.weeklyProcurement = p.weeklyTargets.map((w: any) => {
          weekTotals[w.weekNo] += Number(w.qty);

          const weekEntity = new ProcurementTargetWeek();
          weekEntity.weekNo = w.weekNo;
          weekEntity.qty = w.qty;
          weekEntity.weekStartDate = w.startDate;
          weekEntity.weekEndDate = w.endDate;

          return weekEntity;
        });

        return productEntity;
      },
    );

    let status:ProcurementStatus;
    if(payload.createdBy == payload.employee)
    {
        status=ProcurementStatus.DRAFT;
    }
    else{
        status=ProcurementStatus.APPROVED;
    }

    // ✅ Create target entity
    const target = targetRepo.create({
      employee: { id: payload.employee } as User,
      month: payload.month,
      year: payload.year,
      monthlyTotalQty: payload.procurementMonthlyTotalTargetQty,
      week1TotalQty: weekTotals[1],
      week2TotalQty: weekTotals[2],
      week3TotalQty: weekTotals[3],
      week4TotalQty: weekTotals[4],
      week5TotalQty: weekTotals[5],
      creatdeBy: { id: payload.createdBy } as User,
      status: status,
      products,
    });

    return targetRepo.save(target);
  }
 

    // Get all targets with pagination
    async getalltargets(employeeId: string, page: number = 1, limit: number = 10) {
        try {
            const skip = (page - 1) * limit;

            // Get all subordinates including self (depth >= 0)
            const subordinates = await this.workflowHierarchyRepo
                .createQueryBuilder('wh')
                .select('wh.descendant_id')
                .where('wh.ancestor_id = :employeeId', { employeeId })
                .andWhere('wh.depth >= 0')
                .getRawMany();

            const employeeIds = subordinates.map(s => s.descendant_id);

            if (employeeIds.length === 0) {
                return {
                    targets: [],
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: page
                };
            }

            const [targets, totalItems] = await this.procurementTargetRepository
                .createQueryBuilder('target')
                .leftJoinAndSelect('target.employee', 'employee')
                .where('target.employee.id IN (:...employeeIds)', { employeeIds })
                .orderBy('target.createdAt', 'DESC')
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const totalPages = Math.ceil(totalItems / limit);

            // Month names array (0-11 index)
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            // Format the targets with weekly totals
            const formattedTargets = targets.map(target => {
                const monthName = target.month !== null && target.month >= 0 && target.month <= 11
                    ? monthNames[target.month]
                    : null;

                const monthYear = monthName && target.year 
                    ? `${monthName} ${target.year}`
                    : null;

                return {
                    id: target.id,
                    employeeName: target.employee 
                        ? `${target.employee.firstName} ${target.employee.lastName}` 
                        : null,
                    month: target.month,
                    monthName: monthName,
                    year: target.year,
                    monthYear: monthYear,
                    week1Total: target.week1TotalQty || 0,
                    week2Total: target.week2TotalQty || 0,
                    week3Total: target.week3TotalQty || 0,
                    week4Total: target.week4TotalQty || 0,
                    week5Total: target.week5TotalQty || 0,
                    totalTarget: target.monthlyTotalQty || 0,
                    status: target.status
                };
            });

            return {
                targets: formattedTargets,
                totalItems,
                totalPages,
                currentPage: page
            };
        } catch (error) {
            throw error;
        }
    }





    // Get monthly plan view
    async getMonthlyPlanView(employeeId: string, month: number, year: number) {
        try {
            const target = await this.procurementTargetRepository
                .createQueryBuilder('target')
                .leftJoinAndSelect('target.employee', 'employee')
                .leftJoinAndSelect('target.products', 'products')
                .leftJoinAndSelect('products.product', 'product')
                .leftJoinAndSelect('products.weeklyProcurement', 'weeklyProcurement')
                .where('target.employee.id = :employeeId', { employeeId })
                .andWhere('target.month = :month', { month })
                .andWhere('target.year = :year', { year })
                .getOne();

            if (!target) {
                return {
                    employee: null,
                    month: null,
                    year: null,
                    monthlyTotalQty: 0,
                    plan: []
                };
            }

            return {
                employee: `${target.employee.firstName} ${target.employee.lastName}`,
                month: target.month,
                year: target.year,
                monthlyTotalQty: target.monthlyTotalQty,
                procurementTargetPlan: target.products.map(p => ({
                    product: p.product.name,
                    weeklyTotalQtyPerProduct: p.weeklyTotalQtyPerProduct,
                    remark: p.remark,
                    weeklyProcurement: p.weeklyProcurement.map(w => ({
                        weekNo: w.weekNo,
                        startDate: w.weekStartDate,
                        endDate: w.weekEndDate,
                        qty: w.qty
                    }))
                }))
            };
        } catch (error) {
            throw error;
        }
    }

    // Get monthly plan view structured
    async getMonthlyPlanViewStructured(targetId: string) {
        try {
            const target = await this.procurementTargetRepository
                .createQueryBuilder('target')
                .leftJoinAndSelect('target.employee', 'employee')
                .leftJoinAndSelect('target.products', 'products')
                .leftJoinAndSelect('products.product', 'product')
                .leftJoinAndSelect('products.weeklyProcurement', 'weeklyProcurement')
                .where('target.id = :targetId', { targetId })
                .getOne();

            if (!target) {
                return {
                    employee: null,
                    month: 0,
                    year: 0,
                    procurementMonthlyTotalTargetQty: null,
                    procurementTargetPlan: [],
                    summary: {
                        weeklyTotals: [],
                        monthlyTotal: null
                    }
                };
            }

            // Calculate weekly totals across all products
            const weeklyTotalsMap = new Map<number, number>();

            const procurementTargetPlan = target.products.map(p => {
                const weeklyTargets = p.weeklyProcurement.map(w => {
                    const qty = Number(w.qty || 0);
                    
                    // Accumulate weekly totals
                    if (!weeklyTotalsMap.has(w.weekNo)) {
                        weeklyTotalsMap.set(w.weekNo, 0);
                    }
                    weeklyTotalsMap.set(w.weekNo, weeklyTotalsMap.get(w.weekNo)! + qty);

                    return {
                        weekNo: w.weekNo,
                        startDate: w.weekStartDate ? (typeof w.weekStartDate === 'string' ? w.weekStartDate : new Date(w.weekStartDate).toISOString().split('T')[0]) : null,
                        endDate: w.weekEndDate ? (typeof w.weekEndDate === 'string' ? w.weekEndDate : new Date(w.weekEndDate).toISOString().split('T')[0]) : null,
                        qty: qty
                    };
                });

                return {
                    product: p.product?.name|| null,
                    weeklyTargetsTotalQty: p.weeklyTotalQtyPerProduct || null,
                    weeklyTargets: weeklyTargets,
                    remark: p.remark || null
                };
            });

            // Build summary
            const weeklyTotals = Array.from(weeklyTotalsMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([weekNo, total]) => ({
                    weekNo: weekNo,
                    total: Number(total.toFixed(2))
                }));

            const monthlyTotal = weeklyTotals.reduce((sum, week) => sum + week.total, 0);

            return {
                employee: target.employee?.firstName+' '+target.employee.lastName|| null,
                month: target.month || 0,
                year: target.year || 0,
                procurementMonthlyTotalTargetQty: target.monthlyTotalQty || null,
                procurementTargetPlan: procurementTargetPlan,
                summary: {
                    weeklyTotals: weeklyTotals,
                    monthlyTotal: Number(monthlyTotal.toFixed(2))
                }
            };
        } catch (error) {
            throw error;
        }
    }

async getMonthlyPlanUpdateStructured(
  targetId: string
): Promise<{
  employee: string | null;
  month: number;
  year: number;
  procurementMonthlyTotalTargetQty: number | null;
  procurementTargetPlan: any[];
  summary: {
    weeklyTotals: Array<{
      weekNo: number | null;
      total: number | null;
    }>;
    monthlyTotal: number | null;
  };
}> {
  //console.log("getMonthlyPlanUpdateStructured params:", { targetId });

  const target = await this.procurementTargetRepository
    .createQueryBuilder("target")
    .leftJoinAndSelect("target.employee", "employee")
    .where("target.id = :targetId", { targetId })
    .getOne();

  if (!target) {
    return {
      employee: null,
      month: 0,
      year: 0,
      procurementMonthlyTotalTargetQty: null,
      procurementTargetPlan: [],
      summary: {
        weeklyTotals: [],
        monthlyTotal: null
      }
    };
  }

  const targetProducts = await this.procurementTargetProduct.find({
    where: { target: { id: target.id } },
    relations: ["product"]
  });

  const productMap = new Map<string, any>();
  let monthlyTotalQty = 0;
  const weeklyTotalsMap = new Map<number, number>();

  for (const targetProduct of targetProducts) {
    if (!targetProduct.product) {
      continue;
    }

    const productId = targetProduct.product.id;
    
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        product: productId,
        weeklyTargetsTotalQty: 0,
        remark: targetProduct.remark || null,
        weeklyTargets: []
      });
    }

    const weeklyProcurement = await this.weeklyProcurementRepo.find({
      where: { productTarget: { id: targetProduct.id } },
      order: { weekNo: "ASC" }
    });

    const weeklyTargets = weeklyProcurement.map(week => {
      const qty = Number(week.qty || 0);
      
      if (!weeklyTotalsMap.has(week.weekNo)) {
        weeklyTotalsMap.set(week.weekNo, 0);
      }
      weeklyTotalsMap.set(week.weekNo, weeklyTotalsMap.get(week.weekNo)! + qty);
      
      return {
        weekNo: week.weekNo,
        startDate: week.weekStartDate ? (typeof week.weekStartDate === 'string' ? week.weekStartDate : new Date(week.weekStartDate).toISOString().split('T')[0]) : null,
        endDate: week.weekEndDate ? (typeof week.weekEndDate === 'string' ? week.weekEndDate : new Date(week.weekEndDate).toISOString().split('T')[0]) : null,
        qty: qty
      };
    });

    const weeklyTotal = weeklyProcurement.reduce(
      (sum, week) => sum + Number(week.qty || 0),
      0
    );

    monthlyTotalQty += weeklyTotal;

    productMap.get(productId).weeklyTargetsTotalQty = weeklyTotal;
    productMap.get(productId).weeklyTargets = weeklyTargets;
  }

  const procurementTargetPlan = Array.from(productMap.values());

  // Build summary with weeklyTotals array
  const weeklyTotals = Array.from(weeklyTotalsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNo, total]) => ({
      weekNo: weekNo,
      total: Number(total.toFixed(2))
    }));

  const monthlyTotal = weeklyTotals.reduce((sum, week) => sum + week.total, 0);

  return {
    employee: target.employee?.id || null,
    month: target.month || 0,
    year: target.year || 0,
    procurementMonthlyTotalTargetQty: Number(monthlyTotalQty.toFixed(2)),
    procurementTargetPlan,
    summary: {
      weeklyTotals: weeklyTotals,
      monthlyTotal: Number(monthlyTotal.toFixed(2))
    }
  };
}



    // Generate plan in brief Excel
    async generatePlanInBriefExcel(filters: any) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Plan in Brief');

            worksheet.columns = [
                { header: 'Employee', key: 'employee', width: 20 },
                { header: 'Month', key: 'month', width: 10 },
                { header: 'Year', key: 'year', width: 10 },
                { header: 'Total Qty', key: 'totalQty', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            const targets = await this.procurementTargetRepository
                .createQueryBuilder('target')
                .leftJoinAndSelect('target.employee', 'employee')
                .getMany();

            targets.forEach(target => {
                worksheet.addRow({
                    employee: `${target.employee.firstName} ${target.employee.lastName}`,
                    month: target.month,
                    year: target.year,
                    totalQty: target.monthlyTotalQty,
                    status: target.status
                });
            });

            const exportDir = path.join(process.cwd(), 'exports', 'procurement-plans');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            const fileName = `Procurement_Plan_Brief_${new Date().toISOString().split('T')[0]}.xlsx`;
            const filePath = path.join(exportDir, fileName);

            await workbook.xlsx.writeFile(filePath);

            return { fileName, filePath };
        } catch (error) {
            throw error;
        }
    }

    // Generate monthly business plan Excel
    async generateMonthlyBusinessPlanExcel(targetId: string) {
        try {
            const data = await this.getMonthlyPlanViewStructured(targetId);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Monthly Business Plan');

            worksheet.columns = [
                { header: 'Product', key: 'product', width: 25 },
                { header: 'Week 1', key: 'week1', width: 12 },
                { header: 'Week 2', key: 'week2', width: 12 },
                { header: 'Week 3', key: 'week3', width: 12 },
                { header: 'Week 4', key: 'week4', width: 12 },
                { header: 'Week 5', key: 'week5', width: 12 },
                { header: 'Total', key: 'total', width: 12 },
                { header: 'Remark', key: 'remark', width: 30 }
            ];

            data.plan.forEach((product: any) => {
                const weekData: any = { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0 };
                
                product.weeklyProcurement.forEach((week: any) => {
                    weekData[`week${week.weekNo}`] = week.qty;
                });

                worksheet.addRow({
                    product: product.product,
                    week1: weekData.week1,
                    week2: weekData.week2,
                    week3: weekData.week3,
                    week4: weekData.week4,
                    week5: weekData.week5,
                    total: product.weeklyTotalQtyPerProduct,
                    remark: product.remark
                });
            });

            const exportDir = path.join(process.cwd(), 'exports', 'monthly-plans');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            const fileName = `Procurement_Target_${targetId}_${new Date().toISOString().split('T')[0]}.xlsx`;
            const filePath = path.join(exportDir, fileName);

            await workbook.xlsx.writeFile(filePath);

            return { fileName, filePath };
        } catch (error) {
            throw error;
        }
    }

    // Get target performance
    async getTargetPerformance(
        employeeId: string,
        month: number,
        year: number,
        productId?: string
    ) {
        try {
            const target = await this.procurementTargetRepository.findOne({
                where: {
                    employee: { id: employeeId },
                    month: month,
                    year: year
                },
                relations: ['employee']
            });

            if (!target) {
                return [];
            }

            let targetProductsQuery = this.procurementTargetProduct
                .createQueryBuilder("ptp")
                .leftJoinAndSelect("ptp.product", "product")
                .where("ptp.target.id = :targetId", { targetId: target.id });

            if (productId) {
                targetProductsQuery.andWhere("ptp.product.id = :productId", { productId });
            }

            const targetProducts = await targetProductsQuery.getMany();

            if (targetProducts.length === 0) {
                return [];
            }

            const weeklyDataMap = new Map<number, {
                weekNo: number;
                period: string;
                targetAssigned: number;
                targetAchieved: number;
            }>();

            for (const targetProduct of targetProducts) {
                const weeklyTargets = await this.weeklyProcurementRepo.find({
                    where: { productTarget: { id: targetProduct.id } },
                    order: { weekNo: "ASC" }
                });

                for (const week of weeklyTargets) {
                    const weekTarget = Number(week.qty || 0);

                    const achievements = await this.procurementAchievementRepo.find({
                        where: { weeklyProcurement: { id: week.id } }
                    });

                    const weekAchieved = achievements.reduce((sum, ach) => sum + Number(ach.achievedQty || 0), 0);

                    if (!weeklyDataMap.has(week.weekNo)) {
                        const startDate = week.weekStartDate ? new Date(week.weekStartDate) : null;
                        const endDate = week.weekEndDate ? new Date(week.weekEndDate) : null;

                        weeklyDataMap.set(week.weekNo, {
                            weekNo: week.weekNo,
                            period: `${startDate?.toISOString().split('T')[0] || ''} to ${endDate?.toISOString().split('T')[0] || ''}`,
                            targetAssigned: 0,
                            targetAchieved: 0
                        });
                    }

                    const weekData = weeklyDataMap.get(week.weekNo)!;
                    weekData.targetAssigned += weekTarget;
                    weekData.targetAchieved += weekAchieved;
                }
            }

            const weeklyBreakdown = Array.from(weeklyDataMap.values())
                .sort((a, b) => a.weekNo - b.weekNo)
                .map(week => {
                    const percentage = week.targetAssigned > 0
                        ? Number(((week.targetAchieved / week.targetAssigned) * 100).toFixed(2))
                        : 0;
                    
                    // Variance as percentage
                    const variance = week.targetAssigned > 0
                        ? Number((((week.targetAchieved - week.targetAssigned) / week.targetAssigned) * 100).toFixed(2))
                        : 0;

                    return {
                        Period: week.weekNo,
                        targetAssigned: Number(week.targetAssigned.toFixed(2)),
                        targetAchieved: Number(week.targetAchieved.toFixed(2)),
                        percentage: percentage,
                        variance: variance
                    };
                });

            return weeklyBreakdown;

        } catch (error) {
            console.error('Error in getTargetPerformance:', error);
            throw error;
        }
    }

    // Get procurement per product
    async getProcurementPerProduct(
        employeeId: string,
        month: number,
        year: number
    ) {
        try {
            const target = await this.procurementTargetRepository.findOne({
                where: {
                    employee: { id: employeeId },
                    month: month,
                    year: year
                },
                relations: ['employee']
            });

            if (!target) {
                return [];
            }

            const targetProducts = await this.procurementTargetProduct
                .createQueryBuilder("ptp")
                .leftJoinAndSelect("ptp.product", "product")
                .where("ptp.target.id = :targetId", { targetId: target.id })
                .getMany();

            if (targetProducts.length === 0) {
                return [];
            }

            const productDataMap = new Map<string, {
                productId: string;
                productName: string;
                targetAssigned: number;
                targetAchieved: number;
            }>();

            for (const targetProduct of targetProducts) {
                const productId = targetProduct.product?.id || 'unknown';
                const productName = targetProduct.product?.name || 'Unknown Product';

                const weeklyTargets = await this.weeklyProcurementRepo.find({
                    where: { productTarget: { id: targetProduct.id } },
                    order: { weekNo: "ASC" }
                });

                let productTargetTotal = 0;
                let productAchievedTotal = 0;

                for (const week of weeklyTargets) {
                    const weekTarget = Number(week.qty || 0);
                    productTargetTotal += weekTarget;

                    const achievements = await this.procurementAchievementRepo.find({
                        where: { weeklyProcurement: { id: week.id } }
                    });

                    const weekAchieved = achievements.reduce((sum, ach) => sum + Number(ach.achievedQty || 0), 0);
                    productAchievedTotal += weekAchieved;
                }

                if (!productDataMap.has(productId)) {
                    productDataMap.set(productId, {
                        productId: productId,
                        productName: productName,
                        targetAssigned: 0,
                        targetAchieved: 0
                    });
                }

                const productData = productDataMap.get(productId)!;
                productData.targetAssigned += productTargetTotal;
                productData.targetAchieved += productAchievedTotal;
            }

            const productBreakdown = Array.from(productDataMap.values())
                .map(product => {
                    const percentage = product.targetAssigned > 0
                        ? Number(((product.targetAchieved / product.targetAssigned) * 100).toFixed(2))
                        : 0;
                    
                    // Variance as percentage
                    const variance = product.targetAssigned > 0
                        ? Number((((product.targetAchieved - product.targetAssigned) / product.targetAssigned) * 100).toFixed(2))
                        : 0;

                    return {
                        productName: product.productName,
                        targetAssigned: Number(product.targetAssigned.toFixed(2)),
                        targetAchieved: Number(product.targetAchieved.toFixed(2)),
                        percentage: percentage,
                        variance: variance
                    };
                });

            return productBreakdown;

        } catch (error) {
            console.error('Error in getProcurementPerProduct:', error);
            throw error;
        }
    }

    // Get procurement summary
    async getProcurementSummary(
        employeeId: string,
        month: number,
        year: number
    ) {
        try {
            const target = await this.procurementTargetRepository.findOne({
                where: {
                    employee: { id: employeeId },
                    month: month,
                    year: year
                },
                relations: ['employee']
            });

            if (!target) {
                return {
                    achievementRate: 0,
                    totalAssignedQuantity: 0,
                    totalAchievedQuantity: 0,
                    'productsExceededTarget': 0,
                    'productsOnTrack': 0,
                    'productsBelowTarget': 0,
                    'productsCritical': 0,
                    bestPerformingProduct: null,
                    needsAttention: null,
                    bestPerformingWeek: null
                };
            }

            const targetProducts = await this.procurementTargetProduct
                .createQueryBuilder("ptp")
                .leftJoinAndSelect("ptp.product", "product")
                .where("ptp.target.id = :targetId", { targetId: target.id })
                .getMany();

            let totalAssignedQuantity = 0;
            let totalAchievedQuantity = 0;

            // Product performance tracking
            const productPerformance = new Map<string, {
                name: string;
                assigned: number;
                achieved: number;
                rate: number;
            }>();

            // Week performance tracking
            const weekPerformance = new Map<number, number>();

            for (const targetProduct of targetProducts) {
                const productName = targetProduct.product?.name || 'Unknown';

                const weeklyTargets = await this.weeklyProcurementRepo.find({
                    where: { productTarget: { id: targetProduct.id } }
                });

                let productAssigned = 0;
                let productAchieved = 0;

                for (const week of weeklyTargets) {
                    const weekTarget = Number(week.qty || 0);
                    productAssigned += weekTarget;
                    totalAssignedQuantity += weekTarget;

                    const achievements = await this.procurementAchievementRepo.find({
                        where: { weeklyProcurement: { id: week.id } }
                    });

                    const weekAchieved = achievements.reduce((sum, ach) => sum + Number(ach.achievedQty || 0), 0);
                    productAchieved += weekAchieved;
                    totalAchievedQuantity += weekAchieved;

                    // Track week performance
                    if (!weekPerformance.has(week.weekNo)) {
                        weekPerformance.set(week.weekNo, 0);
                    }
                    weekPerformance.set(week.weekNo, weekPerformance.get(week.weekNo)! + weekAchieved);
                }

                // Calculate product achievement rate
                const productRate = productAssigned > 0 
                    ? (productAchieved / productAssigned) * 100 
                    : 0;

                productPerformance.set(productName, {
                    name: productName,
                    assigned: productAssigned,
                    achieved: productAchieved,
                    rate: productRate
                });
            }

            // Calculate achievement rate
            const achievementRate = totalAssignedQuantity > 0
                ? Number(((totalAchievedQuantity / totalAssignedQuantity) * 100).toFixed(2))
                : 0;

            // Categorize products by performance
            let productsExceeded = 0;
            let productsOnTrack = 0;
            let productsBelowTarget = 0;
            let productsCritical = 0;

            let bestProduct = { name: '', rate: -1 };
            let worstProduct = { name: '', rate: 101 };

            productPerformance.forEach((perf) => {
                if (perf.rate >= 100) productsExceeded++;
                else if (perf.rate >= 80) productsOnTrack++;
                else if (perf.rate >= 50) productsBelowTarget++;
                else productsCritical++;

                if (perf.rate > bestProduct.rate) {
                    bestProduct = { name: perf.name, rate: perf.rate };
                }
                if (perf.rate < worstProduct.rate) {
                    worstProduct = { name: perf.name, rate: perf.rate };
                }
            });

            // Find best performing week
            let bestWeek = { weekNo: 0, total: -1 };
            weekPerformance.forEach((total, weekNo) => {
                if (total > bestWeek.total) {
                    bestWeek = { weekNo, total };
                }
            });

            return {
                achievementRate: achievementRate,
                totalAssignedQuantity: Number(totalAssignedQuantity.toFixed(2)),
                totalAchievedQuantity: Number(totalAchievedQuantity.toFixed(2)),
                'productsExceededTarget': productsExceeded,
                'productsOnTrack': productsOnTrack,
                'productsBelowTarget': productsBelowTarget,
                'productsCritical': productsCritical,
                bestPerformingProduct: bestProduct.name || null,
                needsAttention: worstProduct.name || null,
                bestPerformingWeek: bestWeek.weekNo > 0 ? `Week ${bestWeek.weekNo}` : null
            };

        } catch (error) {
            console.error('Error in getProcurementSummary:', error);
            throw error;
        }
    }
}


    // // Update status
    // async updateStatus(id: string, payload: any) {
    //     try {
    //         const target = await this.procurementTargetRepository.findOne({
    //             where: { id }
    //         });

    //         if (!target) {
    //             throw new Error("Procurement target not found");
    //         }

    //         if (payload.status) {
    //             target.status = payload.status;
    //         }

    //         await this.procurementTargetRepository.save(target);

    //         return target;
    //     } catch (error) {
    //         throw error;
    //     }
    // }


    // // Debug endpoint - get all targets
    // async getAllTargetsDebug() {
    //     try {
    //         const targets = await this.procurementTargetRepository
    //             .createQueryBuilder('target')
    //             .leftJoinAndSelect('target.employee', 'employee')
    //             .orderBy('target.createdAt', 'DESC')
    //             .getMany();

    //         return targets;
    //     } catch (error) {
    //         throw error;
    //     }
    // }


    // // Get all targets simple (no pagination)
    // async getAllTargetsSimple(employeeId: string) {
    //     try {
    //         const targets = await this.procurementTargetRepository
    //             .createQueryBuilder('target')
    //             .leftJoinAndSelect('target.employee', 'employee')
    //             .where('target.employee.id = :employeeId', { employeeId })
    //             .orderBy('target.createdAt', 'DESC')
    //             .getMany();

    //         return { targets };
    //     } catch (error) {
    //         throw error;
    //     }
    // }


   // // Get targets for manager approval
    // async getTargetsForManagerApproval(managerId: string, department: DepartmentEnum) {
    //     try {
    //         // Get all subordinates for this manager
    //         const subordinates = await this.workflowHierarchyRepo
    //             .createQueryBuilder('wh')
    //             .select('wh.descendant_id')
    //             .where('wh.ancestor_id = :managerId', { managerId })
    //             .andWhere('wh.department = :department', { department })
    //             .andWhere('wh.depth > 0')
    //             .getRawMany();

    //         const subordinateIds = subordinates.map(s => s.descendant_id);

    //         if (subordinateIds.length === 0) {
    //             return [];
    //         }

    //         // Get pending targets for these subordinates
    //         const targets = await this.procurementTargetRepository
    //             .createQueryBuilder('target')
    //             .leftJoinAndSelect('target.employee', 'employee')
    //             .leftJoinAndSelect('target.products', 'products')
    //             .leftJoinAndSelect('products.product', 'product')
    //             .where('target.employee.id IN (:...subordinateIds)', { subordinateIds })
    //             .andWhere('target.status = :status', { status: ProcurementStatus.SUBMITTED })
    //             .orderBy('target.createdAt', 'DESC')
    //             .getMany();

    //         return targets;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

