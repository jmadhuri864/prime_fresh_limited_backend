import { Repository } from 'typeorm';
import { UserActivityLog } from '../employeeActivity/userActivityLog.entity';

export class UserActivityLogRepository extends Repository<UserActivityLog> {}
