import cron from 'node-cron';
import { LessThan } from 'typeorm';
import { DealSlip } from '../entities/dealSlip.entity';
import { AppDataSource } from './data-source';
import { GRN } from '../grn/grn.entity';
import { RFPA } from '../rfpa/rfpa.entity';
import { InwardRegister } from '../entities/inwardRegister.entity';
import { VehicleDispatch } from '../entities/vehicleDispatch.entity';
import { Aqr } from '../entities/aqr.entity';
import { PackingMaterial } from '../entities/packingMaterial.entity';
import { CashVoucher } from '../vouchers/multiCashV/entity/mCashVoucher.entity';

import { TPVoucher } from '../vouchers/tranportPaymentV/entity/transportPaymentvoucher.entity';
import { DumpRegister } from '../entities/dumpRegister.entity';
import { StockReportEod } from '../entities/eodReportforinvendtory.entity';
import { PostReturnByCustomer } from '../returnByCustomer/postReturnByCustomer.entity';
import { SecondSale } from '../entities/secondSale.entity';

import {Invoice} from '../entities/invoice.entity';
import logger from './logger';


export const startAutoDeleteJob = () => {
  cron.schedule('*/5 * * * *', async () => {  // runs every 5 minutes
    logger.info('Running auto-delete job...');

    const repositories = [
      AppDataSource.getRepository(GRN),
      AppDataSource.getRepository(RFPA),
      AppDataSource.getRepository(DealSlip),
      AppDataSource.getRepository(InwardRegister),
      AppDataSource.getRepository(VehicleDispatch), 
      AppDataSource.getRepository(Aqr), 
      AppDataSource.getRepository(PackingMaterial), 
      AppDataSource.getRepository(CashVoucher), 
      AppDataSource.getRepository(TPVoucher), 
      AppDataSource.getRepository(TPVoucher), 
      AppDataSource.getRepository(DumpRegister), 
      AppDataSource.getRepository(StockReportEod), 
      AppDataSource.getRepository(PostReturnByCustomer), 
      AppDataSource.getRepository(SecondSale), 
      AppDataSource.getRepository(Invoice), 

    ];

    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - 5);

    for (const repo of repositories as any[]) {
      const oldRecords = await repo.find({
        where: {
          isDeleted: true,
          deletedAt: LessThan(cutoffDate),
        },
      });

      if (oldRecords.length > 0) {
        if (oldRecords.length > 0) {
          await repo.remove(oldRecords);
          logger.info(`Deleted ${oldRecords.length} old records from ${repo.metadata.name}`);
        }
      }
    }
  });
};
