# Philippine Basic Daily Wage Rules

`src/services/payroll/philippineDailyWage.ts` is a pure, backend-portable module
for reviewed, covered daily-paid employees. It does not write attendance, approve
payroll, or post deductions. The existing ordinary-day preview still blocks
holidays until its repositories supply reviewed holiday and preceding-day evidence.
This module is intentionally not switched on in that preview yet.

## Client Configuration

Every calculation requires a `ClientDailyWagePolicy` and a separately maintained
`StatutoryDailyWageRules` version. There are NO embedded numeric wage multipliers
or automatic runtime defaults. The matrix below is the verified statutory
baseline to register as reviewed configuration, not a fixed client calculation.

Client policies configure the worked and unworked rate for every resolved day
type, full-day regular minutes, and whether preceding attendance is required for
unworked regular-holiday eligibility. Disabling that condition is a favorable
client benefit, not a way to deny holiday pay. All matrix entries are mandatory.
Rates are integer basis points: 130% is 13000, 260% is 26000.

Both versions include an ID, reference, review state and effectivity range. The
client policy also identifies its client and statutory rule version. Configured
rates cannot be below the supplied reviewed statutory floors. Those floors must
come from a protected, authorized statutory register, never the encoder's payload.
Client full-day minutes cannot exceed that register's standard-day minutes.

`resolveClientDailyWagePolicy` selects the latest effective version for the target
client/work date. An unreviewed newest version blocks calculation; it does not
fall back to older rates. Same-client versions with the same start date are
ambiguous and rejected. Policies from another client are rejected. The result
includes both rule-version IDs for future immutable payroll audit snapshots.

Persistence, policy-management UI, branch/client authorization and repository
wiring are a separate integration step. This change provides the configuration
contract, resolution, validation and mathematical functions, not a settings screen.

## Statutory Worked-Day Baseline

| Calendar classification | Not rest day | Rest day |
| --- | ---: | ---: |
| Ordinary / special working day | 100% | 130% |
| Special non-working holiday | 130% | 150% |
| Regular holiday | 200% | 260% |
| Double regular holiday | 300% | 390% |

`resolveWorkdayType` selects ONE classification from the reviewed holiday master
and the employee's effective-dated rest-day schedule. The final multiplier is a
lookup in the selected client policy, not an accumulation of premiums. With the
statutory baseline, regular holiday + rest day uses 260% once, never 260%
multiplied by another 130%. Higher reviewed client premiums are supported. Double regular holiday
means two distinct regular holidays on the same date, not two duplicate imports.
Reject conflicting/unsupported holiday-master combinations during calendar setup.

`multiplyDailyCentavos` multiplies integer centavos by integer basis points with
BigInt arithmetic and half-up rounding once at the final amount. For example,
60000 centavos x 26000 / 10000 = 156000 centavos (PHP 1,560.00).

## Unworked Days And Eligibility

Special non-working holiday: zero by default. A favorable reviewed company
practice, contract or CBA benefit may override this. Do not remove existing
benefits. Paid-leave payments need their own entitlement/allocation policy and
must not be added twice to holiday pay.

The statutory baseline is 100% for an eligible unworked regular holiday and 200%
for an eligible unworked double regular holiday. Client policies can grant higher
unworked benefits. Unworked pay uses its own configured matrix, never the worked
holiday/rest-day premium.

`regularHolidayEligibility` checks reviewed, approved attendance for the preceding
qualifying day. Present or paid leave qualifies; unpaid absence, unpaid leave and
AWOL on a scheduled workday do not. It skips documented intervening rest days,
special non-working days and establishment non-working days, but never skips an
absent scheduled ordinary workday. Successive unworked regular holidays inherit
the earlier eligibility; working the first holiday qualifies the next even when
the employee was absent before the first holiday.

History must contain contiguous dated calendar evidence back to the qualifying
day, even outside the payroll cutoff or across December/January. Missing,
unreviewed or pending evidence returns `needs_review`, with `payCentavos: null`,
not zero. History is employee-specific, duplicate-free, and strictly before the
target date. Array order does not affect the result.

## Backend Integration Contract

1. Authenticate and enforce branch/client RBAC before fetching or saving anything.
   Pure mathematical functions do not replace repository authorization.
2. Resolve the employee's actual dated client/worksite assignment, applicable
   region/city holiday declaration, client-specific rest-day changes, and effective
   basic daily rate. Resolve the effective reviewed client policy and its protected
   statutory rule version. Never trust browser-supplied rates, rule objects or a
   coverage flag. Use one statutory profile applicable to the assigned location.
3. Supply reviewed calendar evidence and current non-archived approved attendance.
   Normalize actual worked minutes after unpaid breaks; a `Present` label alone
   does not prove eight hours of work. Paid leave must represent an approved paid
   entitlement, not merely an encoder's selected status.
4. Fetch preceding evidence outside the cutoff when calculating an unworked
   regular holiday. Use that day's actual assignment/calendar, including transfers.
5. Call `calculatePhilippineDailyWage`. Reject invalid data; stop posting whenever
   it returns `needs_review`. Persist rate/calendar/attendance IDs alongside any
   future approved calculation snapshot for auditability.
6. Add separately reviewed COLA/allowances, overtime, night differential, leave
   benefits and lawful deductions. This function returns BASIC daily wages, not
   total employee compensation, gross/net payroll, or statutory contributions.

The function currently supports a worked full configured regular day (no longer
than the statutory standard) or an unworked day.
Short/partial shifts, overtime and monthly salaries return `needs_review`, rather
than inventing proration or duplicating holiday pay already included in salary.
It does not certify full Philippine payroll compliance. Coverage/exemptions,
monthly salary inclusions, establishment closures, unusual holiday combinations,
and more favorable agreements require reviewed applicable rules.

```ts
// policy and statutoryRules are resolved from trusted backend configuration;
// this example assumes the registered statutory-baseline client policy.
const result = calculatePhilippineDailyWage({
  payBasis: "daily",
  basicDailyCentavos: 60000,
  statutoryCoverageConfirmed: true,
  policy,
  statutoryRules,
  day: {
    employeeId: "employee-id", clientId: policy.clientId, date: "2026-01-01",
    calendarReviewed: true, holiday: "regular_holiday",
    restDay: true, scheduledWorkday: false,
    attendance: { status: "present", approved: true, workedMinutes: 480 },
  },
  history: [], // Worked holiday does not require preceding-day eligibility.
});
// calculated, regular_holiday_rest_day, payCentavos: 156000 (PHP 1,560)
```

## Official References

- [DOLE BWC 2024 Handbook](https://nwpc.dole.gov.ph/wp-content/uploads/2024/11/Workers-Statutory-Monetary-Benefits-Handbook-2024-Edition.pdf): computation matrix, holiday absences, successive regular holidays and premium-pay coverage.
- [DOLE August holiday pay rules](https://dole.gov.ph/news/dole-sets-august-holiday-pay-rules-/): ordinary regular/special holiday multipliers, preceding workday/paid leave and favorable company/CBA exceptions.
- [DOLE-CAR double regular holiday advisory](https://car.dole.gov.ph/news/deferment-of-holiday-pay-for-the-april-2020-holidays/): 200% unworked, 300% worked, additional rest-day premium. Its exceptional ECQ eligibility date is NOT used by this module.
