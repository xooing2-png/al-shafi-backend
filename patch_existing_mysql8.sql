-- Patch for older MySQL dumps. Prefer: restart Node backend — it adds missing `users` columns automatically.
-- If you run this file in phpMyAdmin, skip any line that errors with "Duplicate column name".

-- Patch for databases created before clinic_staff existed (run once on existing DB).

CREATE TABLE IF NOT EXISTS `clinic_staff` (
  `id` VARCHAR(128) NOT NULL,
  `clinic_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `role` VARCHAR(32) NOT NULL,
  `specialty` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_clinic_staff_user` (`clinic_id`, `user_id`),
  KEY `idx_clinic_staff_clinic` (`clinic_id`),
  KEY `idx_clinic_staff_user` (`user_id`),
  CONSTRAINT `fk_clinic_staff_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_clinic_staff_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Node.js auth: bcrypt (إن غاب العمود يُضاف تلقائياً عند تشغيل backend)
ALTER TABLE `users`
  ADD COLUMN `password_hash` VARCHAR(255) NULL COMMENT 'bcrypt for mobile/Node auth';

-- Registration: real email from the app form
ALTER TABLE `users`
  ADD COLUMN `contact_email` VARCHAR(255) NULL COMMENT 'Real email from registration form';

-- طوابع التحديث
ALTER TABLE `users`
  ADD COLUMN `updated_at` DATETIME(3) NULL;
