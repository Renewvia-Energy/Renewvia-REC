# Features to implement

## REC-CC Conversions
- Request form for R-REC → MCC conversion (mini-grid projects): input Type I-M/II customer counts, diesel usage, auto-calculate MCCs per the AMS-III.BB formula
- R-REC → AVERT-USCC conversion (US projects): region/year lookup, auto-apply AVERT emission rate
- R-REC → EGRCC conversion (African grid-tied): Ember dataset - CO2 intensity lookup by country/year
- Enforce the "whole project-year" exchange rule: no partial exchanges

## Public Transparency Page
- CSV Generation Data Validation given transaction hash

## Futures
- Workflow for pre-commissioned projects to list future R-REC supply
- Checklist to gate listing behind the required docs (development license, land rights, equipment procurement, project timeline, engineering specs, funding commitment, offtake agreement)
- Status tracker: "under development → commissioned → verified → minting"

## Retirement Center
- Dedicated UI to retire R-RECs (initiate transfer to retirement wallet)
- Retirement history with timestamps and amounts
- Exportable retirement certificate (for corporate sustainability reports)

## Digitized Site Verification Report
- Web form matching Appendix A exactly (REX staff can fill it in during site visits on mobile)
- Attach photos inline; generates a PDF that matches the appendix format
- Links the completed SVR to the corresponding onboarding submission

## Notification System
- Email/in-app alerts: order executed, onboarding status changed, CSV validation failed, document expiring soon