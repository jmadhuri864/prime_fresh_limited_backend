
import { inject, injectable } from "inversify";
import { ApprovalLevel } from "../entity/approvalLevel.entity";

import { TYPES } from "../../types";
import { UserRepository } from "../../employee/repository/user.repository";
import { Department } from "../../utils/status.enum";
import logger from "../../utils/logger";
import { ApprovalLevelRepository } from "../repository/approvalLevel.repository";

@injectable()
export class ApprovalLevelService {
 

  constructor(
    @inject(TYPES.ApprovalLevelRepository) private approvalLevelRepository: ApprovalLevelRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
  ) {}

  // Method to create a single approval level for one employee in a department
  async createApprovalLevelForEmployee(employeeId: string, department: Department,level:number): Promise<void> {
    try {
      // Fetch the employee from the database
      const employee = await this.userRepository.findOne({ where: { id: employeeId } });

      if (!employee) {
        throw new Error(`Employee not found for ID: ${employeeId} in department: ${department}`);
      }

      // Check if an approval level already exists for this employee and department
      // const existingApprovalLevel = await this.approvalLevelRepository.findOne({
      //   where: { employee: employee, department: department },
      // });
const existingApprovalLevel = await this.approvalLevelRepository.findOne({
  where: { id: (employee as any).id }, // TODO: ApprovalLevel no longer has employee field
});

      if (existingApprovalLevel) {
        logger.info(`Approval level already exists for employee: ${employee.firstName}, department: ${department}`);
        return; // Skip if approval level already exists
      }

      // Create approval level for employee
      const approvalLevel = new ApprovalLevel();
      approvalLevel.level = level;  // You can customize this to match the level system you have
      approvalLevel.department = department;
      approvalLevel.employee = employee;
      approvalLevel.isCompleted = false;
     
      // Save the new approval level
      await this.approvalLevelRepository.save(approvalLevel);
      logger.info(`Created approval level for employee: ${employee.firstName}, department: ${department}`);

    } catch (error) {
      logger.error("Error creating approval level: ", error);
      throw new Error("Failed to create approval level");
    }
  }
}
