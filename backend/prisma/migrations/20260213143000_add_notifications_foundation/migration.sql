-- Notifications foundation: in-app recipients, preferences, and email outbox deliveries

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "projectId" TEXT,
  "category" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "dedupeKey" TEXT,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRecipient" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "channelInApp" BOOLEAN NOT NULL DEFAULT true,
  "channelEmail" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "category" TEXT NOT NULL,
  "eventType" TEXT NOT NULL DEFAULT '*',
  "channelInApp" BOOLEAN NOT NULL DEFAULT true,
  "channelEmail" BOOLEAN NOT NULL DEFAULT false,
  "frequency" TEXT NOT NULL DEFAULT 'immediate',
  "minPriority" TEXT NOT NULL DEFAULT 'normal',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key"
ON "NotificationRecipient"("notificationId", "userId");

CREATE INDEX "Notification_instanceId_createdAt_idx"
ON "Notification"("instanceId", "createdAt");

CREATE INDEX "Notification_projectId_createdAt_idx"
ON "Notification"("projectId", "createdAt");

CREATE INDEX "Notification_dedupeKey_idx"
ON "Notification"("dedupeKey");

CREATE INDEX "NotificationRecipient_userId_createdAt_idx"
ON "NotificationRecipient"("userId", "createdAt");

CREATE INDEX "NotificationRecipient_userId_isRead_createdAt_idx"
ON "NotificationRecipient"("userId", "isRead", "createdAt");

CREATE INDEX "NotificationPreference_userId_projectId_idx"
ON "NotificationPreference"("userId", "projectId");

CREATE INDEX "NotificationPreference_userId_category_eventType_idx"
ON "NotificationPreference"("userId", "category", "eventType");

CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx"
ON "NotificationDelivery"("status", "nextAttemptAt");

CREATE INDEX "NotificationDelivery_userId_status_idx"
ON "NotificationDelivery"("userId", "status");

CREATE UNIQUE INDEX "NotificationDelivery_notificationId_userId_channel_key"
ON "NotificationDelivery"("notificationId", "userId", "channel");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationRecipient"
ADD CONSTRAINT "NotificationRecipient_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
