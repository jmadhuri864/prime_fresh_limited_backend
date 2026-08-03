import { Address } from "../address/address.entity";

export function formatAddress(address?: Address): string {
  if (!address) return '';

  const parts = [
    address.address1,
    address.address2,
    address.location,
    address.city,
    address.state,
    address.pincode, 
  ];

  return parts.filter(Boolean).join(', ');
}