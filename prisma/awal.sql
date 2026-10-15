-- CreateTable
CREATE TABLE "BusinessGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "legacyPms" TEXT,
    "address" TEXT,
    "roomCount" INTEGER NOT NULL DEFAULT 0,
    "openingCash" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessUnit_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BusinessGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "parentId" TEXT,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "cashflowCategory" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "unitId" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "projectId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "sharedGroup" TEXT,
    CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "description" TEXT,
    "fundingAmount" REAL NOT NULL DEFAULT 0,
    "fundingDate" DATETIME,
    "fundingType" TEXT NOT NULL DEFAULT 'NONE',
    "loanRatePct" REAL NOT NULL DEFAULT 0,
    "loanTenorMonths" INTEGER NOT NULL DEFAULT 0,
    "upliftRevenueMonthly" REAL NOT NULL DEFAULT 0,
    "upliftExpenseMonthly" REAL NOT NULL DEFAULT 0,
    "upliftStartDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectCostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "amount" REAL NOT NULL,
    "plannedDate" DATETIME NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProjectCostItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectCostItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "roomsSold" INTEGER NOT NULL DEFAULT 0,
    "roomsAvailable" INTEGER NOT NULL DEFAULT 0,
    "guests" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "MonthlyStat_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitScope" TEXT NOT NULL DEFAULT 'ALL',
    "horizonMonths" INTEGER NOT NULL DEFAULT 24,
    "method" TEXT NOT NULL DEFAULT 'WEIGHTED',
    "lookbackMonths" INTEGER NOT NULL DEFAULT 12,
    "useSeasonality" BOOLEAN NOT NULL DEFAULT true,
    "revenueGrowthPct" REAL NOT NULL DEFAULT 0,
    "expenseGrowthPct" REAL NOT NULL DEFAULT 0,
    "minCashBuffer" REAL NOT NULL DEFAULT 0,
    "includedProjects" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "incomePessimistic" REAL,
    "incomeNormal" REAL,
    "incomeOptimistic" REAL,
    "nextPessimistic" REAL,
    "nextNormal" REAL,
    "nextOptimistic" REAL,
    "monthlyOutflow" REAL,
    "salaryNeed" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CashCommitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "dueDay" INTEGER,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CashCommitment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "cashOnHand" REAL NOT NULL,
    "incomeToDate" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashCheckpoint_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpendCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SpendCategory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpendEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'TAMBAH',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpendEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpendEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpendCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delta" REAL NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonMonth" (
    "month" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seasonId" TEXT NOT NULL,
    CONSTRAINT "SeasonMonth_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "cadence" TEXT NOT NULL DEFAULT 'MONTHLY',
    "instalments" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MOBIL',
    "unitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledObligation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "repeat" TEXT NOT NULL DEFAULT 'TAHUNAN',
    "repeatEvery" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paidUntil" DATETIME,
    "vehicleId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledObligation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObligationPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObligationPayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ScheduledObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessGroup_code_key" ON "BusinessGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

-- CreateIndex
CREATE INDEX "BusinessUnit_groupId_idx" ON "BusinessUnit"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_unitId_idx" ON "JournalEntry"("unitId");

-- CreateIndex
CREATE INDEX "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_unitId_idx" ON "JournalLine"("unitId");

-- CreateIndex
CREATE INDEX "JournalLine_sharedGroup_idx" ON "JournalLine"("sharedGroup");

-- CreateIndex
CREATE INDEX "Project_unitId_idx" ON "Project"("unitId");

-- CreateIndex
CREATE INDEX "ProjectCostItem_projectId_idx" ON "ProjectCostItem"("projectId");

-- CreateIndex
CREATE INDEX "MonthlyStat_unitId_idx" ON "MonthlyStat"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyStat_unitId_period_key" ON "MonthlyStat"("unitId", "period");

-- CreateIndex
CREATE INDEX "Budget_period_idx" ON "Budget"("period");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_scope_period_key" ON "Budget"("scope", "period");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_accountId_idx" ON "BudgetLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_accountId_key" ON "BudgetLine"("budgetId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CashPlan_period_key" ON "CashPlan"("period");

-- CreateIndex
CREATE INDEX "CashCommitment_planId_idx" ON "CashCommitment"("planId");

-- CreateIndex
CREATE INDEX "CashCheckpoint_planId_idx" ON "CashCheckpoint"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "CashCheckpoint_planId_date_key" ON "CashCheckpoint"("planId", "date");

-- CreateIndex
CREATE INDEX "SpendCategory_planId_idx" ON "SpendCategory"("planId");

-- CreateIndex
CREATE INDEX "SpendEntry_planId_idx" ON "SpendEntry"("planId");

-- CreateIndex
CREATE INDEX "SpendEntry_categoryId_idx" ON "SpendEntry"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_code_key" ON "Season"("code");

-- CreateIndex
CREATE INDEX "SeasonMonth_seasonId_idx" ON "SeasonMonth"("seasonId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "Vehicle_unitId_idx" ON "Vehicle"("unitId");

-- CreateIndex
CREATE INDEX "ScheduledObligation_vehicleId_idx" ON "ScheduledObligation"("vehicleId");

-- CreateIndex
CREATE INDEX "ObligationPayment_obligationId_idx" ON "ObligationPayment"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

