// ─────────────────────────────────────────────────────────────────────────────
// Vendor Category DTOs
// ─────────────────────────────────────────────────────────────────────────────

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateVendorCategoryDto {
  name: string;
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface UpdateVendorCategoryDto {
  name?: string;
}

// ── Response (single record) ──────────────────────────────────────────────────

export interface VendorCategoryResponseDto {
  id: string;
  name: string;
}

// ── List response (paginated) ─────────────────────────────────────────────────

export interface VendorCategoryListResponseDto {
  data: VendorCategoryResponseDto[];
  meta: {
    total: number;
    page: number | undefined;
    pages: number;
  };
}

// ── Bulk delete ───────────────────────────────────────────────────────────────

export interface BulkDeleteVendorCategoryDto {
  ids: string[];
}
