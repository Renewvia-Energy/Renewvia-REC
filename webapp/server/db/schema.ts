import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  doublePrecision,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Users ───────────────────────────────────────────────────────────────────
// Accounts are admin-created only. One user maps to one company wallet.
// A company can be both generator and buyer — flags are independent.

export const users = pgTable('users', {
  id:            serial('id').primaryKey(),
  username:      varchar('username', { length: 50 }).notNull().unique(),
  email:         varchar('email', { length: 255 }).notNull(),
  passwordHash:  varchar('password_hash', { length: 255 }).notNull(),

  // Role flags — a user can hold multiple non-admin roles
  isGenerator:   boolean('is_generator').default(false).notNull(),
  isBuyer:       boolean('is_buyer').default(false).notNull(),
  isAdmin:       boolean('is_admin').default(false).notNull(),

  // Links this user to their company entry in companies.json (lowercase)
  companyWallet: varchar('company_wallet', { length: 42 }),

  createdAt:     timestamp('created_at').defaultNow().notNull(),
  createdBy:     integer('created_by'), // admin user id who created this account
})

// ── Orders ──────────────────────────────────────────────────────────────────
// No prices shown in UI. Orders queue for REX staff to execute via paper contract.

export const orders = pgTable('orders', {
  id:              serial('id').primaryKey(),
  uuid:            uuid('uuid').defaultRandom().notNull().unique(),
  userId:          integer('user_id').notNull().references(() => users.id),
  companyWallet:   varchar('company_wallet', { length: 42 }).notNull(),

  // Asset details
  contractAddress: varchar('contract_address', { length: 42 }),
  contractName:    varchar('contract_name', { length: 100 }),
  abbreviation:    varchar('abbreviation', { length: 20 }),

  side:            varchar('side', { length: 6 }).notNull(),        // 'buy' | 'sell' | 'retire'
  orderType:       varchar('order_type', { length: 20 }).notNull(), // 'market' | 'limit' | 'stop' | 'stop-limit'
  amount:          integer('amount').notNull(),

  // Price fields — these are not the market price; rather, these are the stop and limit prices set by the user making the order
  limitPrice:      numeric('limit_price', { precision: 12, scale: 4 }),
  stopPrice:       numeric('stop_price', { precision: 12, scale: 4 }),

  notes:           text('notes'),
  status:          varchar('status', { length: 20 }).default('pending').notNull(),
  // 'pending' | 'executed' | 'cancelled'

  createdAt:       timestamp('created_at').defaultNow().notNull(),
  processedAt:     timestamp('processed_at'),
  processedBy:     integer('processed_by').references(() => users.id),
  processingNotes: text('processing_notes'),
})

// ── Goals ───────────────────────────────────────────────────────────────────
// Buyer scope 1/2/3 emission-reduction goals with progress tracked against holdings.

export const goals = pgTable('goals', {
  id:            serial('id').primaryKey(),
  uuid:          uuid('uuid').defaultRandom().notNull().unique(),
  companyWallet: varchar('company_wallet', { length: 42 }).notNull(),
  scope:         integer('scope').notNull(), // 1, 2, or 3

  targetMwh:     numeric('target_mwh', { precision: 14, scale: 3 }),
  targetTco2e:   numeric('target_tco2e', { precision: 14, scale: 3 }),
  description:   text('description'),
  targetYear:    integer('target_year'),

  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ── Onboarding Submissions ───────────────────────────────────────────────────
// Multi-step generator onboarding. Flat columns — only photos remain JSONB.
// Document URLs point to R2 objects (uploaded directly from browser).

export const onboardingSubmissions = pgTable('onboarding_submissions', {
  id:     serial('id').primaryKey(),
  uuid:   uuid('uuid').defaultRandom().notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id),

  status: varchar('status', { length: 20 }).default('draft').notNull(),
  // 'draft' | 'pending' | 'approved' | 'rejected'

  // Step 1 — Project info
  projectName:              varchar('project_name', { length: 255 }),
  projectType:              varchar('project_type', { length: 100 }),
  // 'Utility' | 'Grid-Connected C&I' | 'Off-Grid Mini-Grid/Mesh-Grid' | 'Home System'
  expectedAnnualGeneration: numeric('expected_annual_generation', { precision: 14, scale: 3 }),

  // Step 2 — Generation type
  genGenerationType:  varchar('gen_generation_type', { length: 50 }),
  // 'solar' | 'wind' | 'hydro' | 'other'
  genDocUrl:          varchar('gen_doc_url', { length: 500 }),
  genDocType:         varchar('gen_doc_type', { length: 255 }),
  genSecondarySrc:    varchar('gen_secondary_src', { length: 100 }),
  genSecondaryDesc:   varchar('gen_secondary_desc', { length: 500 }),
  genTertiarySrc:     varchar('gen_tertiary_src', { length: 100 }),
  genTertiaryDesc:    varchar('gen_tertiary_desc', { length: 500 }),
  genLlmDocTypeMatch: boolean('gen_llm_doc_type_match'),
  genLlmContentMatch: boolean('gen_llm_content_match'),
  genLlmReason:       text('gen_llm_reason'),

  // Step 3 — Capacity
  capCapacity:        numeric('cap_capacity', { precision: 14, scale: 3 }),
  capDocUrl:          varchar('cap_doc_url', { length: 500 }),
  capDocType:         varchar('cap_doc_type', { length: 255 }),
  capLlmDocTypeMatch: boolean('cap_llm_doc_type_match'),
  capLlmContentMatch: boolean('cap_llm_content_match'),
  capLlmReason:       text('cap_llm_reason'),

  // Step 4 — Location
  locPhysicalAddress: varchar('loc_physical_address', { length: 500 }),
  locLat:             doublePrecision('loc_lat'),
  locLon:             doublePrecision('loc_lon'),
  locDocUrl:          varchar('loc_doc_url', { length: 500 }),
  locDocType:         varchar('loc_doc_type', { length: 255 }),
  locLlmDocTypeMatch: boolean('loc_llm_doc_type_match'),
  locLlmContentMatch: boolean('loc_llm_content_match'),
  locLlmReason:       text('loc_llm_reason'),

  // Step 5 — Date of first operation
  dateDateOfFirstOperation: varchar('date_date_of_first_operation', { length: 10 }),
  dateDocUrl:               varchar('date_doc_url', { length: 500 }),
  dateDocType:              varchar('date_doc_type', { length: 255 }),
  dateLlmDocTypeMatch:      boolean('date_llm_doc_type_match'),
  dateLlmContentMatch:      boolean('date_llm_content_match'),
  dateLlmReason:            text('date_llm_reason'),

  // Step 6 — Generation equipment photos
  photosGen:          jsonb('photos_gen').$type<Array<{ url: string; caption: string }>>(),
  photosGenLlmMatch:  boolean('photos_gen_llm_match'),
  photosGenLlmReason: text('photos_gen_llm_reason'),

  // Step 7 — Metering photos
  photosMeter:          jsonb('photos_meter').$type<Array<{ url: string; caption: string }>>(),
  photosMeterLlmMatch:  boolean('photos_meter_llm_match'),
  photosMeterLlmReason: text('photos_meter_llm_reason'),

  // Review
  reviewNotes: text('review_notes'),
  reviewedAt:  timestamp('reviewed_at'),
  reviewedBy:  integer('reviewed_by').references(() => users.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Futures Submissions ──────────────────────────────────────────────────────
// Pre-commissioning onboarding for projects under development.
// Documents follow the Sale of Future Generation chapter of the R-REC Standard.

export const futuresSubmissions = pgTable('futures_submissions', {
  id:     serial('id').primaryKey(),
  uuid:   uuid('uuid').defaultRandom().notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id),

  status: varchar('status', { length: 20 }).default('draft').notNull(),
  // 'draft' | 'pending' | 'approved' | 'rejected'

  // Step 1 — Project info
  projectName:              varchar('project_name', { length: 255 }),
  projectType:              varchar('project_type', { length: 100 }),
  // 'Utility' | 'Grid-Connected C&I' | 'Off-Grid Mini-Grid/Mesh-Grid' | 'Home System'
  expectedAnnualGeneration: numeric('expected_annual_generation', { precision: 14, scale: 3 }),
  expectedCompletionDate:   varchar('expected_completion_date', { length: 10 }),

  // Step 2 — Development License and Permissions
  devLicenseDocUrl:    varchar('dev_license_doc_url', { length: 500 }),
  devLicenseDocType:   varchar('dev_license_doc_type', { length: 255 }),
  devLicenseLlmMatch:  boolean('dev_license_llm_match'),
  devLicenseLlmReason: text('dev_license_llm_reason'),

  // Step 3 — Land Rights
  landRightsDocUrl:    varchar('land_rights_doc_url', { length: 500 }),
  landRightsDocType:   varchar('land_rights_doc_type', { length: 255 }),
  landRightsLlmMatch:  boolean('land_rights_llm_match'),
  landRightsLlmReason: text('land_rights_llm_reason'),

  // Step 4 — Equipment Procurement
  equipProcurementDocUrl:    varchar('equip_procurement_doc_url', { length: 500 }),
  equipProcurementDocType:   varchar('equip_procurement_doc_type', { length: 255 }),
  equipProcurementLlmMatch:  boolean('equip_procurement_llm_match'),
  equipProcurementLlmReason: text('equip_procurement_llm_reason'),

  // Step 5 — Project Timeline
  projTimelineDocUrl:    varchar('proj_timeline_doc_url', { length: 500 }),
  projTimelineDocType:   varchar('proj_timeline_doc_type', { length: 255 }),
  projTimelineLlmMatch:  boolean('proj_timeline_llm_match'),
  projTimelineLlmReason: text('proj_timeline_llm_reason'),

  // Step 6 — Engineering Specifications
  engSpecsDocUrl:    varchar('eng_specs_doc_url', { length: 500 }),
  engSpecsDocType:   varchar('eng_specs_doc_type', { length: 255 }),
  engSpecsLlmMatch:  boolean('eng_specs_llm_match'),
  engSpecsLlmReason: text('eng_specs_llm_reason'),

  // Step 7 — Funding Commitment
  fundingCommitmentDocUrl:    varchar('funding_commitment_doc_url', { length: 500 }),
  fundingCommitmentDocType:   varchar('funding_commitment_doc_type', { length: 255 }),
  fundingCommitmentLlmMatch:  boolean('funding_commitment_llm_match'),
  fundingCommitmentLlmReason: text('funding_commitment_llm_reason'),

  // Step 8 — Grid Connection Documentation or Offtake Agreement
  // Only required for Utility or Grid-Connected C&I project types
  gridConnectionDocUrl:    varchar('grid_connection_doc_url', { length: 500 }),
  gridConnectionDocType:   varchar('grid_connection_doc_type', { length: 255 }),
  gridConnectionLlmMatch:  boolean('grid_connection_llm_match'),
  gridConnectionLlmReason: text('grid_connection_llm_reason'),

  // Review
  reviewNotes: text('review_notes'),
  reviewedAt:  timestamp('reviewed_at'),
  reviewedBy:  integer('reviewed_by').references(() => users.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  orders:               many(orders),
  onboardingSubmissions:many(onboardingSubmissions),
  futuresSubmissions:   many(futuresSubmissions),
}))

export const ordersRelations = relations(orders, ({ one }) => ({
  user:      one(users, { fields: [orders.userId], references: [users.id] }),
  processor: one(users, { fields: [orders.processedBy], references: [users.id] }),
}))

export const onboardingRelations = relations(onboardingSubmissions, ({ one }) => ({
  user:     one(users, { fields: [onboardingSubmissions.userId],   references: [users.id] }),
  reviewer: one(users, { fields: [onboardingSubmissions.reviewedBy], references: [users.id] }),
}))

export const futuresRelations = relations(futuresSubmissions, ({ one }) => ({
  user:     one(users, { fields: [futuresSubmissions.userId],   references: [users.id] }),
  reviewer: one(users, { fields: [futuresSubmissions.reviewedBy], references: [users.id] }),
}))

// ── TypeScript helpers ────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

export type Goal = typeof goals.$inferSelect
export type NewGoal = typeof goals.$inferInsert

export type OnboardingSubmission = typeof onboardingSubmissions.$inferSelect
export type NewOnboardingSubmission = typeof onboardingSubmissions.$inferInsert

export type FuturesSubmission = typeof futuresSubmissions.$inferSelect
export type NewFuturesSubmission = typeof futuresSubmissions.$inferInsert
