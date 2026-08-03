// address.repository.ts
import { Repository } from "typeorm";
import { Address } from "../address/address.entity";


export class AddressRepository extends Repository<Address> {
  // Add custom methods for the Address entity if needed
}
