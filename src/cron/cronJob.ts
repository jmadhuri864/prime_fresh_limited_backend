import cron from 'node-cron';
import { AppDataSource } from '../utils/data-source';
import { OverdueDeletionService } from '../global/overdueDeletion.service';
import { InwardRegister } from '../entities/inwardRegister.entity';
import { Farmer } from '../entities/farmer.entity';
import { Product } from '../entities/product.entity';
import logger from '../utils/logger';

const entitiesToCheck = [InwardRegister, Farmer, Product];

cron.schedule('0 0 1 * *', async () => {
  //console.log('Starting overdue deletion checks...');
  try {
    logger.info(`Cron job triggered at: ${new Date().toISOString()}`);

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
  //  console.log('DataSource initialized');
    }

    const overdueDeletionService = new OverdueDeletionService();

    for (const entity of entitiesToCheck) {
      await overdueDeletionService.deleteOverdueRecordsForEntity(entity as any);
    }
  } catch (error) {
    //console.error('Error in cron job:', error);
    logger.error('Error in cron job:', error);
  }
});
