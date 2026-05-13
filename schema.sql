-- Al-Shafi / الشافي — MySQL 8+ logical mirror of Firestore collections
-- Charset: utf8mb4 / InnoDB / timestamps UTC recommended (DATETIME(3))

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1) Identity & users
-- ---------------------------------------------------------------------------

CREATE TABLE `admins` (
  `admin_id` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NULL COMMENT 'Login identifier (often phone digits @ alshafi.app)',
  `contact_email` VARCHAR(255) NULL COMMENT 'Real email from registration form',
  `password_hash` VARCHAR(255) NULL COMMENT 'bcrypt for mobile/Node auth',
  `age` INT NULL,
  `role` ENUM('patient','clinic','nurse','lab','pharmacy','hospital','admin') NULL,
  `staff_role` ENUM('doctor','secretary') NULL,
  `created_at` DATETIME(3) NULL,
  `loyalty_points` INT NULL,
  `governorate` VARCHAR(128) NULL,
  `plan` ENUM('free','vip') NULL,
  `plan_expires_at` DATETIME(3) NULL,
  `plan_price` DECIMAL(12,2) NULL,
  `plan_updated_at` DATETIME(3) NULL,
  `blood_donor` TINYINT(1) NULL,
  `blood_type` VARCHAR(16) NULL,
  `last_blood_donation_at` DATETIME(3) NULL,
  `suspended` TINYINT(1) NULL,
  `suspended_at` DATETIME(3) NULL,
  `suspend_reason` TEXT NULL,
  `clinic_profile` JSON NULL COMMENT 'Firestore clinic map',
  `nurse_profile` JSON NULL,
  `lab_profile` JSON NULL,
  `pharmacy_profile` JSON NULL,
  `hospital_profile` JSON NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_tokens` (
  `user_id` VARCHAR(128) NOT NULL,
  `fcm_token` TEXT NOT NULL COMMENT 'Expo push token in practice',
  `platform` VARCHAR(32) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `medical_records` (
  `user_id` VARCHAR(128) NOT NULL,
  `blood_type` VARCHAR(16) NULL,
  `blood` VARCHAR(16) NULL COMMENT 'Legacy alias bloodType/blood',
  `extra` JSON NULL COMMENT 'Optional Firestore fields',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_medical_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_medical_file_documents` (
  `user_id` VARCHAR(128) NOT NULL,
  `doc_key` VARCHAR(32) NOT NULL COMMENT 'main | summary',
  `blood_type` VARCHAR(64) NULL,
  `height_cm` VARCHAR(32) NULL,
  `weight_kg` VARCHAR(32) NULL,
  `chronic_conditions` TEXT NULL,
  `allergies` TEXT NULL,
  `imaging_urls` JSON NULL,
  `allowed_doctors` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`user_id`, `doc_key`),
  CONSTRAINT `fk_umfd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_medical_file_prescriptions` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `prescription_id` VARCHAR(128) NOT NULL,
  `doctor_id` VARCHAR(128) NOT NULL,
  `doctor_name` VARCHAR(255) NULL,
  `clinic_name` VARCHAR(255) NULL,
  `medicines` JSON NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_umfp_user` (`user_id`),
  CONSTRAINT `fk_umfp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_umfp_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_medical_file_lab_results` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `lab_name` VARCHAR(255) NOT NULL,
  `test_type` VARCHAR(512) NOT NULL,
  `result_url` TEXT NOT NULL,
  `order_id` VARCHAR(128) NULL,
  `status` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_umflr_user` (`user_id`),
  CONSTRAINT `fk_umflr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_medical_file_imaging` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `url` TEXT NOT NULL,
  `image_type` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_umfi_user` (`user_id`),
  CONSTRAINT `fk_umfi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_reminders` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `prescription_id` VARCHAR(128) NOT NULL,
  `medicine_name` VARCHAR(255) NOT NULL,
  `dose` VARCHAR(128) NOT NULL,
  `frequency` VARCHAR(128) NOT NULL,
  `times` JSON NOT NULL COMMENT 'Array of HH:mm strings',
  `duration` INT NOT NULL COMMENT 'days',
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `active` TINYINT(1) NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ur_user` (`user_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_medical_file_access_requests` (
  `patient_id` VARCHAR(128) NOT NULL,
  `doctor_id` VARCHAR(128) NOT NULL,
  `doctor_name` VARCHAR(255) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `requested_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`patient_id`, `doctor_id`),
  CONSTRAINT `fk_umfar_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_umfar_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Platform settings & catalog (before pharmacy_products FK)
-- ---------------------------------------------------------------------------

CREATE TABLE `platform_settings` (
  `doc_id` VARCHAR(64) NOT NULL COMMENT 'pricing | fees | main',
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `platform_medicines` (
  `id` VARCHAR(128) NOT NULL,
  `trade_name` VARCHAR(512) NULL,
  `generic_name` VARCHAR(512) NULL,
  `category` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `unit` VARCHAR(64) NULL,
  `image_url` TEXT NULL,
  `default_price` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2) Clinics & appointments
-- ---------------------------------------------------------------------------

CREATE TABLE `clinics` (
  `id` VARCHAR(128) NOT NULL COMMENT 'organizationClinicId or shared id',
  `owner_uid` VARCHAR(128) NOT NULL,
  `clinic_name` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(255) NOT NULL,
  `consultation_price` DECIMAL(12,2) NULL,
  `doctor_photo_url` TEXT NULL,
  `clinic_photo_url` TEXT NULL,
  `certificate_url` TEXT NULL,
  `location` JSON NULL,
  `governorate` VARCHAR(128) NULL,
  `qadha` VARCHAR(128) NULL,
  `nahiya` VARCHAR(128) NULL,
  `address` VARCHAR(512) NULL,
  `address_detail` VARCHAR(512) NULL,
  `platform_fee_status` VARCHAR(32) NULL,
  `platform_fee_per_patient` DECIMAL(12,2) NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clinics_owner` (`owner_uid`),
  CONSTRAINT `fk_clinics_owner` FOREIGN KEY (`owner_uid`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_settings` (
  `clinic_id` VARCHAR(128) NOT NULL,
  `work_days` JSON NOT NULL,
  `open_time` VARCHAR(8) NOT NULL,
  `close_time` VARCHAR(8) NOT NULL,
  `session_duration` INT NOT NULL COMMENT 'minutes',
  `slot_duration` INT NULL COMMENT 'legacy alternate',
  `max_patients` INT NOT NULL,
  `doctor_delay_enabled` TINYINT(1) NOT NULL,
  `doctor_delay_minutes` INT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`clinic_id`),
  CONSTRAINT `fk_clinic_settings_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_staff` (
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

CREATE TABLE `clinic_appointments` (
  `id` VARCHAR(128) NOT NULL,
  `clinic_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `patient_phone` VARCHAR(64) NOT NULL,
  `time` VARCHAR(8) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `visit_date` DATE NOT NULL,
  `queue_number` INT NULL,
  `age` INT NULL,
  `visit_reason` TEXT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `arrived_at` DATETIME(3) NULL,
  `rated` TINYINT(1) NULL,
  `rating` TINYINT NULL,
  `comment` VARCHAR(200) NULL,
  `permission_requested` TINYINT(1) NULL,
  `permission_requested_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ca_clinic_date_time` (`clinic_id`, `visit_date`, `time`),
  KEY `idx_ca_patient` (`patient_id`),
  KEY `idx_ca_clinic_rated_created` (`clinic_id`, `rated`, `created_at`),
  CONSTRAINT `fk_ca_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ca_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_wallet_snapshots` (
  `clinic_id` VARCHAR(128) NOT NULL,
  `doc_name` VARCHAR(64) NOT NULL COMMENT 'balance | main — unified balance_value',
  `balance_value` DECIMAL(14,2) NOT NULL COMMENT 'maps Firestore amount OR balance',
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`clinic_id`, `doc_name`),
  CONSTRAINT `fk_cws_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_wallet_transactions` (
  `id` VARCHAR(128) NOT NULL,
  `clinic_id` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `type` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cwt_clinic_created` (`clinic_id`, `created_at`),
  CONSTRAINT `fk_cwt_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_platform_payments` (
  `id` VARCHAR(128) NOT NULL,
  `clinic_id` VARCHAR(128) NOT NULL,
  `payload` JSON NULL COMMENT 'Firestore remainder',
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cpp_clinic` (`clinic_id`),
  CONSTRAINT `fk_cpp_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_daily_billing` (
  `clinic_id` VARCHAR(128) NOT NULL,
  `billing_date` DATE NOT NULL,
  `patient_count` INT NOT NULL,
  `fee_per_patient` DECIMAL(12,2) NOT NULL,
  `total_amount` DECIMAL(14,2) NOT NULL,
  `status` ENUM('unpaid','paid','pending') NOT NULL,
  `receipt_number` VARCHAR(128) NULL,
  `payment_method` VARCHAR(128) NULL,
  `paid_at` DATETIME(3) NULL,
  `submitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`clinic_id`, `billing_date`),
  CONSTRAINT `fk_cdb_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clinic_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `clinic_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(200) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cr_clinic` (`clinic_id`),
  KEY `idx_cr_patient` (`patient_id`),
  CONSTRAINT `fk_cr_clinic` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cr_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3) Platform prescriptions
-- ---------------------------------------------------------------------------

CREATE TABLE `prescriptions` (
  `id` VARCHAR(128) NOT NULL,
  `doctor_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NULL,
  `doctor_name` VARCHAR(255) NULL,
  `clinic_name` VARCHAR(255) NULL,
  `medicines` JSON NOT NULL,
  `notes` TEXT NOT NULL,
  `created_at` DATETIME(3) NULL,
  `sent_to_patient` TINYINT(1) NOT NULL DEFAULT 0,
  `sent_to_pharmacy` TINYINT(1) NOT NULL DEFAULT 0,
  `pharmacy_id` VARCHAR(128) NULL,
  `prescription_image_url` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rx_patient` (`patient_id`),
  KEY `idx_rx_doctor` (`doctor_id`),
  CONSTRAINT `fk_rx_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rx_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rx_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fix: pharmacy_id FK references users — pharmacies.id may equal user UID; OK.

-- ---------------------------------------------------------------------------
-- 4) Labs
-- ---------------------------------------------------------------------------

CREATE TABLE `labs` (
  `id` VARCHAR(128) NOT NULL COMMENT 'Often lab owner UID',
  `owner_uid` VARCHAR(128) NOT NULL,
  `lab_name` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `lab_type` VARCHAR(128) NULL,
  `license_number` VARCHAR(255) NULL,
  `profile_complete` TINYINT(1) NULL,
  `governorate` VARCHAR(128) NULL,
  `address_detail` VARCHAR(512) NULL,
  `phone_public` VARCHAR(64) NULL,
  `lab_photo_url` TEXT NULL,
  `location` JSON NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `tests_legacy` JSON NULL COMMENT 'Optional legacy tests array',
  `extra` JSON NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_labs_owner` (`owner_uid`),
  CONSTRAINT `fk_labs_owner` FOREIGN KEY (`owner_uid`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_tests` (
  `id` VARCHAR(128) NOT NULL,
  `lab_id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `duration` VARCHAR(64) NOT NULL,
  `available` TINYINT(1) NOT NULL DEFAULT 1,
  `category` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lab_tests_lab` (`lab_id`),
  CONSTRAINT `fk_lab_tests_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_orders` (
  `id` VARCHAR(128) NOT NULL,
  `lab_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `doctor_id` VARCHAR(128) NULL,
  `doctor_name` VARCHAR(255) NULL,
  `tests` JSON NOT NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(32) NOT NULL,
  `result_url` TEXT NULL,
  `sent_to_doctor` TINYINT(1) NOT NULL,
  `sent_to_patient` TINYINT(1) NOT NULL,
  `date` DATE NULL,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lab_orders_lab_created` (`lab_id`, `created_at`),
  CONSTRAINT `fk_lab_orders_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lab_orders_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_lab_orders_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `lab_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(200) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lr_lab` (`lab_id`),
  CONSTRAINT `fk_lr_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lr_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_daily_billing` (
  `lab_id` VARCHAR(128) NOT NULL,
  `billing_date` DATE NOT NULL,
  `patient_count` INT NOT NULL DEFAULT 0,
  `fee_per_patient` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','paid','pending') NOT NULL,
  `receipt_number` VARCHAR(128) NULL,
  `payment_method` VARCHAR(128) NULL,
  `paid_at` DATETIME(3) NULL,
  `submitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`lab_id`, `billing_date`),
  CONSTRAINT `fk_ldb_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_wallet_transactions` (
  `id` VARCHAR(128) NOT NULL,
  `lab_id` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `type` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lwt_lab_created` (`lab_id`, `created_at`),
  CONSTRAINT `fk_lwt_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_settings` (
  `lab_id` VARCHAR(128) NOT NULL,
  `doc_id` VARCHAR(64) NOT NULL DEFAULT 'main',
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`lab_id`, `doc_id`),
  CONSTRAINT `fk_lset_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_wallet_snapshots` (
  `lab_id` VARCHAR(128) NOT NULL,
  `doc_name` VARCHAR(64) NOT NULL,
  `balance_value` DECIMAL(14,2) NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`lab_id`, `doc_name`),
  CONSTRAINT `fk_lws_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5) Pharmacies
-- ---------------------------------------------------------------------------

CREATE TABLE `pharmacies` (
  `id` VARCHAR(128) NOT NULL,
  `owner_uid` VARCHAR(128) NOT NULL,
  `delivery_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `delivery_radius` DECIMAL(6,2) NULL DEFAULT 10.00,
  `pharmacy_name` VARCHAR(255) NULL,
  `governorate` VARCHAR(128) NULL,
  `qadha` VARCHAR(128) NULL,
  `nahiya` VARCHAR(128) NULL,
  `address_detail` VARCHAR(512) NULL,
  `phone_public` VARCHAR(64) NULL,
  `pharmacy_photo_url` TEXT NULL,
  `location` JSON NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `extra` JSON NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacies_owner` (`owner_uid`),
  CONSTRAINT `fk_pharmacies_owner` FOREIGN KEY (`owner_uid`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_products` (
  `id` VARCHAR(128) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `trade_name` VARCHAR(512) NULL,
  `name` VARCHAR(512) NULL,
  `generic_name` VARCHAR(512) NULL,
  `category` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `image_url` TEXT NULL,
  `unit` VARCHAR(64) NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `quantity` INT NOT NULL,
  `available` TINYINT(1) NOT NULL DEFAULT 1,
  `platform_medicine_id` VARCHAR(128) NULL,
  `source` VARCHAR(32) NULL COMMENT 'openfda | library',
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pp_pharmacy` (`pharmacy_id`),
  CONSTRAINT `fk_pp_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pp_platform_med` FOREIGN KEY (`platform_medicine_id`) REFERENCES `platform_medicines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_medicines` (
  `id` VARCHAR(128) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `trade_name` VARCHAR(512) NULL,
  `name` VARCHAR(512) NULL,
  `generic_name` VARCHAR(512) NULL,
  `category` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `image_url` TEXT NULL,
  `unit` VARCHAR(64) NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `quantity` INT NOT NULL,
  `available` TINYINT(1) NOT NULL DEFAULT 1,
  `platform_medicine_id` VARCHAR(128) NULL,
  `source` VARCHAR(32) NULL COMMENT 'openfda | library',
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pm_pharmacy` (`pharmacy_id`),
  CONSTRAINT `fk_pm_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pm_platform_med` FOREIGN KEY (`platform_medicine_id`) REFERENCES `platform_medicines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_orders` (
  `id` VARCHAR(128) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `pharmacy_name` VARCHAR(255) NULL,
  `items` JSON NOT NULL,
  `total` DECIMAL(14,2) NOT NULL,
  `type` ENUM('delivery','pickup') NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `prescription_url` TEXT NULL,
  `prescription_id` VARCHAR(128) NULL,
  `source` VARCHAR(64) NULL COMMENT 'e.g. patient_app_cart',
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_po_pharmacy_created` (`pharmacy_id`, `created_at`),
  KEY `idx_po_patient` (`patient_id`),
  CONSTRAINT `fk_po_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_po_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescription_requests` (
  `id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `patient_phone` VARCHAR(64) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `image_url` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL COMMENT 'pending|reviewed|confirmed|ready|delivered|rejected',
  `items` JSON NULL,
  `total_price` DECIMAL(14,2) NULL,
  `delivery_type` VARCHAR(32) NULL,
  `notes` TEXT NULL,
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prx_pharmacy` (`pharmacy_id`),
  CONSTRAINT `fk_prx_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_prx_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescription_orders` (
  `id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `image_url` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_porder_pharmacy` (`pharmacy_id`),
  CONSTRAINT `fk_porder_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_porder_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(200) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phrev_pharmacy` (`pharmacy_id`),
  CONSTRAINT `fk_phrev_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_phrev_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_daily_billing` (
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `billing_date` DATE NOT NULL,
  `patient_count` INT NOT NULL DEFAULT 0,
  `fee_per_patient` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','paid','pending') NOT NULL,
  `receipt_number` VARCHAR(128) NULL,
  `payment_method` VARCHAR(128) NULL,
  `paid_at` DATETIME(3) NULL,
  `submitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`pharmacy_id`, `billing_date`),
  CONSTRAINT `fk_pdb_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_wallet_transactions` (
  `id` VARCHAR(128) NOT NULL,
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `type` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pwt_pharmacy_created` (`pharmacy_id`, `created_at`),
  CONSTRAINT `fk_pwt_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_wallet_snapshots` (
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `doc_name` VARCHAR(64) NOT NULL,
  `balance_value` DECIMAL(14,2) NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`pharmacy_id`, `doc_name`),
  CONSTRAINT `fk_pws_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pharmacy_settings` (
  `pharmacy_id` VARCHAR(128) NOT NULL,
  `doc_id` VARCHAR(64) NOT NULL DEFAULT 'main',
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`pharmacy_id`, `doc_id`),
  CONSTRAINT `fk_phset_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6) Nurses
-- ---------------------------------------------------------------------------

CREATE TABLE `nurses` (
  `id` VARCHAR(128) NOT NULL,
  `owner_uid` VARCHAR(128) NOT NULL,
  `available` TINYINT(1) NOT NULL DEFAULT 1,
  `specialty` VARCHAR(255) NULL,
  `governorate` VARCHAR(128) NULL,
  `qadha` VARCHAR(128) NULL,
  `nahiya` VARCHAR(128) NULL,
  `address_detail` VARCHAR(512) NULL,
  `phone_public` VARCHAR(64) NULL,
  `photo_url` TEXT NULL,
  `services` JSON NULL,
  `work_days` JSON NULL,
  `open_time` VARCHAR(8) NULL,
  `close_time` VARCHAR(8) NULL,
  `work_hours` JSON NULL COMMENT '{from,to}',
  `home_service` TINYINT(1) NULL,
  `location` JSON NULL,
  `coverage_radius` DECIMAL(10,2) NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `extra` JSON NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nurses_owner` (`owner_uid`),
  CONSTRAINT `fk_nurses_owner` FOREIGN KEY (`owner_uid`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_orders` (
  `id` VARCHAR(128) NOT NULL,
  `nurse_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NULL,
  `nurse_name` VARCHAR(255) NULL,
  `status` VARCHAR(32) NOT NULL,
  `payload` JSON NULL COMMENT 'mapNurseOrderDoc remainder',
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_no_nurse_status_created` (`nurse_id`, `status`, `created_at`),
  KEY `idx_no_patient` (`patient_id`),
  CONSTRAINT `fk_no_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_no_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_requests` (
  `id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `nurse_id` VARCHAR(128) NOT NULL,
  `nurse_name` VARCHAR(255) NULL,
  `visit_date` DATE NULL,
  `visit_time` VARCHAR(16) NULL,
  `address` VARCHAR(512) NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nr_nurse` (`nurse_id`),
  CONSTRAINT `fk_nr_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_nr_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_clinic_patients` (
  `id` VARCHAR(128) NOT NULL,
  `nurse_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NULL,
  `payload` JSON NULL COMMENT 'mapNurseClinicPatientDoc',
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ncp_nurse` (`nurse_id`),
  KEY `idx_ncp_patient` (`patient_id`),
  CONSTRAINT `fk_ncp_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ncp_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `nurse_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(200) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nrev_nurse` (`nurse_id`),
  CONSTRAINT `fk_nrev_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_nrev_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_daily_billing` (
  `nurse_id` VARCHAR(128) NOT NULL,
  `billing_date` DATE NOT NULL,
  `patient_count` INT NOT NULL DEFAULT 0,
  `fee_per_patient` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','paid','pending') NOT NULL,
  `receipt_number` VARCHAR(128) NULL,
  `payment_method` VARCHAR(128) NULL,
  `paid_at` DATETIME(3) NULL,
  `submitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`nurse_id`, `billing_date`),
  CONSTRAINT `fk_ndb_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_wallet_transactions` (
  `id` VARCHAR(128) NOT NULL,
  `nurse_id` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `type` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nwt_nurse_created` (`nurse_id`, `created_at`),
  CONSTRAINT `fk_nwt_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_wallet_snapshots` (
  `nurse_id` VARCHAR(128) NOT NULL,
  `doc_name` VARCHAR(64) NOT NULL,
  `balance_value` DECIMAL(14,2) NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`nurse_id`, `doc_name`),
  CONSTRAINT `fk_nws_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nurse_settings` (
  `nurse_id` VARCHAR(128) NOT NULL,
  `doc_id` VARCHAR(64) NOT NULL DEFAULT 'main',
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`nurse_id`, `doc_id`),
  CONSTRAINT `fk_nset_nurse` FOREIGN KEY (`nurse_id`) REFERENCES `nurses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7) Hospitals
-- ---------------------------------------------------------------------------

CREATE TABLE `hospitals` (
  `id` VARCHAR(128) NOT NULL,
  `owner_uid` VARCHAR(128) NOT NULL,
  `hospital_name` VARCHAR(255) NULL,
  `governorate` VARCHAR(128) NULL,
  `qadha` VARCHAR(128) NULL,
  `nahiya` VARCHAR(128) NULL,
  `address_detail` VARCHAR(512) NULL,
  `phone_public` VARCHAR(64) NULL,
  `photo_url` TEXT NULL,
  `location` JSON NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `extra` JSON NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hospitals_owner` (`owner_uid`),
  CONSTRAINT `fk_hospitals_owner` FOREIGN KEY (`owner_uid`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_beds` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `room_number` VARCHAR(64) NULL,
  `bed_number` VARCHAR(64) NULL,
  `floor` VARCHAR(64) NULL,
  `ward` VARCHAR(128) NULL,
  `number` VARCHAR(64) NULL COMMENT 'UI legacy field',
  `patient_name` VARCHAR(255) NULL,
  `status` VARCHAR(32) NOT NULL COMMENT 'available|occupied|cleaning',
  `admitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `payload` JSON NULL COMMENT 'mapHospitalBedDoc remainder',
  PRIMARY KEY (`id`),
  KEY `idx_hb_hospital` (`hospital_id`),
  CONSTRAINT `fk_hb_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_patients` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `age` INT NULL,
  `phone` VARCHAR(64) NULL,
  `diagnosis` TEXT NULL,
  `preliminary_diagnosis` TEXT NULL,
  `condition` VARCHAR(255) NULL,
  `doctor_id` VARCHAR(128) NULL,
  `doctor_name` VARCHAR(255) NULL,
  `doctor` VARCHAR(255) NULL COMMENT 'legacy combined',
  `doctor_specialty` VARCHAR(255) NULL,
  `bed_id` VARCHAR(128) NULL,
  `room_number` VARCHAR(64) NULL,
  `bed_number` VARCHAR(64) NULL,
  `floor` VARCHAR(64) NULL,
  `ward` VARCHAR(128) NULL,
  `status` VARCHAR(32) NOT NULL,
  `admitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hp_hospital` (`hospital_id`),
  CONSTRAINT `fk_hp_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hp_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_hp_bed` FOREIGN KEY (`bed_id`) REFERENCES `hospital_beds` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_operations` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hop_hospital` (`hospital_id`),
  CONSTRAINT `fk_hop_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_emergency` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_he_hospital` (`hospital_id`),
  CONSTRAINT `fk_he_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_staff` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NULL,
  `role` VARCHAR(64) NULL,
  `name` VARCHAR(255) NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hst_hospital` (`hospital_id`),
  KEY `idx_hst_user` (`user_id`),
  CONSTRAINT `fk_hst_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hst_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_settings` (
  `hospital_id` VARCHAR(128) NOT NULL,
  `doc_id` VARCHAR(64) NOT NULL DEFAULT 'main',
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`hospital_id`, `doc_id`),
  CONSTRAINT `fk_hset_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_daily_billing` (
  `hospital_id` VARCHAR(128) NOT NULL,
  `billing_date` DATE NOT NULL,
  `patient_count` INT NOT NULL DEFAULT 0,
  `fee_per_patient` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','paid','pending') NOT NULL,
  `receipt_number` VARCHAR(128) NULL,
  `payment_method` VARCHAR(128) NULL,
  `paid_at` DATETIME(3) NULL,
  `submitted_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`hospital_id`, `billing_date`),
  CONSTRAINT `fk_hdb_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_wallet_transactions` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `type` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwtx_hospital_created` (`hospital_id`, `created_at`),
  CONSTRAINT `fk_hwtx_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_wallet_snapshots` (
  `hospital_id` VARCHAR(128) NOT NULL,
  `doc_name` VARCHAR(64) NOT NULL,
  `balance_value` DECIMAL(14,2) NOT NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`hospital_id`, `doc_name`),
  CONSTRAINT `fk_hws_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hospital_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `hospital_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(200) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hrev_hospital` (`hospital_id`),
  CONSTRAINT `fk_hrev_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hrev_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8) Bookings & consultations
-- ---------------------------------------------------------------------------

CREATE TABLE `bookings` (
  `id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `patient_phone` VARCHAR(64) NULL,
  `type` VARCHAR(32) NOT NULL COMMENT 'lab | hospital | ...',
  `status` VARCHAR(32) NOT NULL,
  `lab_id` VARCHAR(128) NULL,
  `lab_name` VARCHAR(255) NULL,
  `test_id` VARCHAR(128) NULL,
  `test_name` VARCHAR(512) NULL,
  `visit_date` DATE NULL,
  `time_slot` VARCHAR(64) NULL,
  `time` VARCHAR(16) NULL,
  `hospital_id` VARCHAR(128) NULL,
  `hospital_name` VARCHAR(255) NULL,
  `department` VARCHAR(255) NULL,
  `amount` DECIMAL(14,2) NULL,
  `created_at` DATETIME(3) NULL,
  `arrived_at` DATETIME(3) NULL,
  `rated` TINYINT(1) NULL,
  `rating` TINYINT NULL,
  `comment` VARCHAR(512) NULL,
  `rated_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bookings_patient_created` (`patient_id`, `created_at`),
  KEY `idx_bookings_lab` (`lab_id`),
  KEY `idx_bookings_hospital` (`hospital_id`),
  CONSTRAINT `fk_bookings_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_lab` FOREIGN KEY (`lab_id`) REFERENCES `labs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_hospital` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `booking_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `booking_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(512) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `payload` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_br_booking` (`booking_id`),
  CONSTRAINT `fk_br_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_br_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consultations` (
  `id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(255) NULL,
  `doctor_id` VARCHAR(128) NOT NULL,
  `doctor_name` VARCHAR(255) NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `test_mode` TINYINT(1) NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(3) NULL,
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cons_patient` (`patient_id`),
  KEY `idx_cons_doctor` (`doctor_id`),
  CONSTRAINT `fk_cons_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cons_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consultation_providers` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NULL COMMENT 'linked account if any',
  `display_name` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(255) NULL,
  `governorate` VARCHAR(128) NULL,
  `location` JSON NULL,
  `avg_rating` DECIMAL(4,2) NULL,
  `review_count` INT NULL,
  `payload` JSON NULL COMMENT 'video provider search/geo fields',
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cp_user` (`user_id`),
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consultation_provider_reviews` (
  `id` VARCHAR(128) NOT NULL,
  `provider_id` VARCHAR(128) NOT NULL,
  `patient_id` VARCHAR(128) NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(512) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cpr_provider` (`provider_id`),
  CONSTRAINT `fk_cpr_provider` FOREIGN KEY (`provider_id`) REFERENCES `consultation_providers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cpr_patient` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9) Platform admin & content
-- ---------------------------------------------------------------------------

CREATE TABLE `discount_codes` (
  `id` VARCHAR(128) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `discount_percent` DECIMAL(5,2) NOT NULL COMMENT 'percentage',
  `expires_at` DATETIME(3) NULL,
  `max_uses` INT NULL,
  `used_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_discount_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `global_notifications` (
  `id` VARCHAR(128) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(128) NULL COMMENT 'admin Firebase UID (same as users.id when synced)',
  `extra` JSON NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gn_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `admin_activity_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `admin_uid` VARCHAR(128) NOT NULL,
  `admin_name` VARCHAR(255) NULL,
  `action` VARCHAR(128) NOT NULL,
  `detail` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_aal_admin_created` (`admin_uid`, `created_at`),
  CONSTRAINT `fk_aal_admin` FOREIGN KEY (`admin_uid`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_reports` (
  `id` VARCHAR(128) NOT NULL,
  `reporter_id` VARCHAR(128) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open',
  `category` VARCHAR(64) NULL,
  `description` TEXT NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ur_rep_status` (`status`),
  CONSTRAINT `fk_ur_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `awareness_videos` (
  `id` VARCHAR(128) NOT NULL,
  `title_ar` VARCHAR(512) NOT NULL,
  `short_desc` TEXT NULL,
  `doctor_name` VARCHAR(255) NULL,
  `specialty` VARCHAR(255) NULL,
  `video_url` TEXT NOT NULL,
  `category` VARCHAR(128) NULL,
  `thumbnail_url` TEXT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ads` (
  `id` VARCHAR(128) NOT NULL,
  `payload` JSON NOT NULL COMMENT 'Flexible setDoc mirror',
  `created_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blood_requests` (
  `id` VARCHAR(128) NOT NULL,
  `blood_type` VARCHAR(16) NOT NULL,
  `hospital` VARCHAR(255) NULL,
  `governorate` VARCHAR(128) NULL,
  `message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_br_created` (`created_at`),
  CONSTRAINT `fk_blood_req_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blood_bank` (
  `donor_id` VARCHAR(128) NOT NULL,
  `payload` JSON NULL COMMENT 'Extensible Firestore-only donor row',
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`donor_id`),
  CONSTRAINT `fk_blood_bank_donor` FOREIGN KEY (`donor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 10) Loyalty & notifications
-- ---------------------------------------------------------------------------

CREATE TABLE `loyalty_points` (
  `user_id` VARCHAR(128) NOT NULL,
  `points` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_lp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `loyalty_point_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(128) NOT NULL,
  `points` INT NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lph_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_lph_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `loyalty_activity_events` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lae_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_lae_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL COMMENT 'recipient',
  `title` TEXT NULL,
  `body` TEXT NULL,
  `type` VARCHAR(64) NOT NULL COMMENT 'NotificationType',
  `data` JSON NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user_read_created` (`user_id`, `read`, `created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 11) Doctor frequent medicines
-- ---------------------------------------------------------------------------

CREATE TABLE `doctor_frequent_medicines` (
  `doctor_id` VARCHAR(128) NOT NULL,
  `slug_key` VARCHAR(128) NOT NULL COMMENT 'Firestore document id',
  `trade_name` VARCHAR(512) NULL,
  `generic_name` VARCHAR(512) NULL,
  `dose` VARCHAR(128) NULL,
  `frequency` VARCHAR(128) NULL,
  `duration` VARCHAR(128) NULL,
  `category` VARCHAR(255) NULL,
  `count` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`doctor_id`, `slug_key`),
  CONSTRAINT `fk_dfm_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Generic document store (تطبيق الشافي — doc-store من Node/Expo)
-- ---------------------------------------------------------------------------

CREATE TABLE `generic_documents` (
  `doc_path` VARCHAR(768) NOT NULL,
  `payload` JSON NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`doc_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Optional integrity: admin UID should exist in users when linked app-wide
-- ---------------------------------------------------------------------------
-- ALTER TABLE `admins` ADD CONSTRAINT `fk_admins_user` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
