-- MySQL dump 10.13  Distrib 8.0.33, for Win64 (x86_64)
--
-- Host: localhost    Database: inventory_traceability_db
-- ------------------------------------------------------
-- Server version	8.0.33

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `app_users`
--

DROP TABLE IF EXISTS `app_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_users` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('ADMIN','INVENTORY_STAFF','QUALITY_STAFF') NOT NULL DEFAULT 'INVENTORY_STAFF',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_users`
--

LOCK TABLES `app_users` WRITE;
/*!40000 ALTER TABLE `app_users` DISABLE KEYS */;
INSERT INTO `app_users` VALUES (1,'Admin User','admin@test.com','$2b$12$P5AXBNI0uELM2Ck7TV.u0Oxrc4VLgTXOHqE/BNQpxYFsofLmQcdSG','ADMIN',1,'2026-10-14 15:35:10'),(2,'Inventory Staff','inventory@test.com','$2b$12$7b4SWGr62.TGYmGWzod.u.m2jHIViZXkB8UyJ1aHqkrz0.suGos8G','INVENTORY_STAFF',1,'2026-10-25 07:05:47'),(3,'Quality Staff','quality@test.com','$2b$12$OEUDqzTzgVasip/7TGJY9epOQ/sKwcS6TZNgzvoU0vQr7QH1BXQ2S','QUALITY_STAFF',1,'2026-10-25 07:07:21');
/*!40000 ALTER TABLE `app_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batches`
--

DROP TABLE IF EXISTS `batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batches` (
  `batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(80) NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `supplier_id` bigint unsigned NOT NULL,
  `manufacture_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('ACTIVE','QUARANTINED','RECALLED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`),
  UNIQUE KEY `batch_code` (`batch_code`),
  KEY `idx_batch_product` (`product_id`),
  KEY `idx_batch_supplier` (`supplier_id`),
  KEY `idx_batch_expiry` (`expiry_date`),
  KEY `idx_batch_status` (`status`),
  CONSTRAINT `fk_batch_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_batch_cost` CHECK ((`unit_cost` >= 0)),
  CONSTRAINT `chk_batch_dates` CHECK (((`manufacture_date` is null) or (`expiry_date` is null) or (`expiry_date` >= `manufacture_date`)))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batches`
--

LOCK TABLES `batches` WRITE;
/*!40000 ALTER TABLE `batches` DISABLE KEYS */;
INSERT INTO `batches` VALUES (3,'RICE-B001',1,1,'2026-09-01','2027-09-01',60.00,'RECALLED','2026-10-14 15:36:34'),(4,'FLOUR-B001',2,2,'2026-09-15','2027-03-15',40.00,'RECALLED','2026-10-14 15:36:34'),(5,'RICE-DEMO-001',1,1,'2026-10-01','2027-10-01',50.00,'RECALLED','2026-10-25 07:52:32');
/*!40000 ALTER TABLE `batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `defect_reports`
--

DROP TABLE IF EXISTS `defect_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `defect_reports` (
  `defect_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `defect_code` varchar(80) NOT NULL,
  `batch_id` bigint unsigned NOT NULL,
  `defect_type` enum('CONTAMINATION','DAMAGED_PACKAGING','QUALITY_FAILURE','EXPIRY_ISSUE','LABELING_ERROR','OTHER') NOT NULL,
  `description` text NOT NULL,
  `affected_quantity` int unsigned NOT NULL,
  `severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `status` enum('REPORTED','UNDER_REVIEW','CONFIRMED','REJECTED','RECALL_INITIATED') NOT NULL DEFAULT 'REPORTED',
  `reported_by` bigint unsigned DEFAULT NULL,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `review_notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`defect_id`),
  UNIQUE KEY `defect_code` (`defect_code`),
  KEY `fk_defect_reporter` (`reported_by`),
  KEY `fk_defect_reviewer` (`reviewed_by`),
  KEY `idx_defect_status` (`status`,`created_at`),
  KEY `idx_defect_batch` (`batch_id`),
  CONSTRAINT `fk_defect_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`),
  CONSTRAINT `fk_defect_reporter` FOREIGN KEY (`reported_by`) REFERENCES `app_users` (`user_id`),
  CONSTRAINT `fk_defect_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `app_users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `defect_reports`
--

LOCK TABLES `defect_reports` WRITE;
/*!40000 ALTER TABLE `defect_reports` DISABLE KEYS */;
INSERT INTO `defect_reports` VALUES (1,'DEF-1792865110023-2953',4,'DAMAGED_PACKAGING','Demo defect: damaged packaging found during quality inspection.',2,'HIGH','RECALL_INITIATED',1,3,'critically defective..','2026-10-24 18:05:10','2026-10-25 12:39:07'),(2,'DEF-1792865442737-6508',4,'QUALITY_FAILURE','TEST-02: Product quality failure detected during routine inspection. Demo only.',3,'CRITICAL','REJECTED',1,1,'..','2026-10-24 18:10:42','2026-10-25 00:28:23'),(3,'DEF-1792914831793-9373',5,'DAMAGED_PACKAGING','rice were of poor quality.',1,'MEDIUM','RECALL_INITIATED',2,3,'defective item..','2026-10-25 07:53:51','2026-10-25 13:24:39');
/*!40000 ALTER TABLE `defect_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_outbox`
--

DROP TABLE IF EXISTS `event_outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_outbox` (
  `event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) NOT NULL,
  `aggregate_type` varchar(80) NOT NULL,
  `aggregate_id` bigint unsigned NOT NULL,
  `payload` json NOT NULL,
  `delivery_status` enum('PENDING','PROCESSING','DELIVERED','FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at` datetime DEFAULT NULL,
  `last_error` text,
  `processing_started_at` datetime DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `idx_outbox_delivery` (`delivery_status`,`created_at`),
  KEY `idx_outbox_aggregate` (`aggregate_type`,`aggregate_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_outbox`
--

LOCK TABLES `event_outbox` WRITE;
/*!40000 ALTER TABLE `event_outbox` DISABLE KEYS */;
INSERT INTO `event_outbox` VALUES (1,'INVENTORY_CREATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 100, \"quantity_reserved\": 0, \"available_quantity\": 100}','DELIVERED',1,'2026-10-14 15:37:03','2026-10-15 19:15:52',NULL,NULL),(2,'INVENTORY_CREATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 20, \"quantity_reserved\": 0, \"available_quantity\": 20}','DELIVERED',1,'2026-10-14 15:37:03','2026-10-15 19:15:52',NULL,NULL),(3,'INVENTORY_UPDATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 90, \"quantity_reserved\": 0, \"available_quantity\": 90}','DELIVERED',1,'2026-10-14 15:37:29','2026-10-15 19:15:52',NULL,NULL),(4,'INVENTORY_CREATED','INVENTORY',3,'{\"batch_id\": 3, \"inventory_id\": 3, \"warehouse_id\": 2, \"quantity_on_hand\": 10, \"quantity_reserved\": 0, \"available_quantity\": 10}','DELIVERED',1,'2026-10-14 15:37:29','2026-10-15 19:15:52',NULL,NULL),(5,'STOCK_TRANSFER_COMPLETED','STOCK_TRANSFER',1,'{\"batch_id\": 3, \"quantity\": 10, \"transfer_id\": 1, \"source_warehouse_id\": 1, \"destination_warehouse_id\": 2}','DELIVERED',1,'2026-10-14 15:37:29','2026-10-15 19:15:52',NULL,NULL),(6,'INVENTORY_UPDATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 90, \"quantity_reserved\": 5, \"available_quantity\": 85}','DELIVERED',1,'2026-10-14 15:38:26','2026-10-15 19:15:52',NULL,NULL),(7,'STOCK_RESERVED','STOCK_RESERVATION',1,'{\"batch_id\": 3, \"quantity\": 5, \"warehouse_id\": 1, \"reservation_id\": 1}','DELIVERED',1,'2026-10-14 15:38:26','2026-10-15 19:15:52',NULL,NULL),(8,'INVENTORY_UPDATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 90, \"quantity_reserved\": 0, \"available_quantity\": 90}','DELIVERED',1,'2026-10-14 18:08:48','2026-10-15 19:15:52',NULL,NULL),(9,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 20, \"quantity_reserved\": 2, \"available_quantity\": 18}','DELIVERED',1,'2026-10-14 18:12:22','2026-10-15 19:15:52',NULL,NULL),(10,'STOCK_RESERVED','STOCK_RESERVATION',2,'{\"batch_id\": 4, \"quantity\": 2, \"warehouse_id\": 2, \"reservation_id\": 2}','DELIVERED',1,'2026-10-14 18:12:22','2026-10-15 19:15:52',NULL,NULL),(11,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 20, \"quantity_reserved\": 0, \"available_quantity\": 20}','DELIVERED',1,'2026-10-14 18:12:40','2026-10-15 19:15:52',NULL,NULL),(12,'RESERVATION_CANCELLED','STOCK_RESERVATION',2,'{\"notes\": \"Testing reservation cancellation\", \"batch_id\": 4, \"quantity\": 2, \"cancelled_by\": 1, \"warehouse_id\": 2, \"reservation_id\": 2}','DELIVERED',1,'2026-10-14 18:12:40','2026-10-15 19:15:52',NULL,NULL),(13,'RECALL_QUARANTINED','RECALL_BATCH',3,'{\"notes\": \"Initial quarantine test for recalled rice\", \"batch_id\": 3, \"quantity\": 10, \"recall_id\": 1, \"recorded_by\": 1, \"warehouse_id\": 1}','DELIVERED',1,'2026-10-14 18:17:23','2026-10-15 19:15:52',NULL,NULL),(14,'INVENTORY_UPDATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 90, \"quantity_reserved\": 0, \"available_quantity\": 80}','DELIVERED',1,'2026-10-15 07:56:43','2026-10-15 19:15:52',NULL,NULL),(15,'INVENTORY_UPDATED','INVENTORY',1,'{\"batch_id\": 3, \"inventory_id\": 1, \"warehouse_id\": 1, \"quantity_on_hand\": 90, \"quantity_reserved\": 0, \"available_quantity\": 75}','DELIVERED',1,'2026-10-15 08:00:42','2026-10-15 19:15:52',NULL,NULL),(16,'RECALL_QUARANTINED','RECALL_BATCH',3,'{\"notes\": \"Testing updated quarantine procedure\", \"batch_id\": 3, \"quantity\": 5, \"recall_id\": 1, \"recorded_by\": 1, \"warehouse_id\": 1}','DELIVERED',1,'2026-10-15 08:00:42','2026-10-15 19:15:52',NULL,NULL),(17,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 15, \"quantity_reserved\": 0, \"available_quantity\": 15}','DELIVERED',1,'2026-10-22 17:10:37','2026-10-24 23:19:16',NULL,NULL),(18,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 15, \"quantity_reserved\": 1, \"available_quantity\": 14}','DELIVERED',1,'2026-10-23 06:49:49','2026-10-24 23:19:16',NULL,NULL),(19,'STOCK_RESERVED','STOCK_RESERVATION',3,'{\"batch_id\": 4, \"quantity\": 1, \"warehouse_id\": 2, \"reservation_id\": 3}','DELIVERED',1,'2026-10-23 06:49:49','2026-10-24 23:19:16',NULL,NULL),(20,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 15, \"quantity_reserved\": 0, \"available_quantity\": 15}','DELIVERED',1,'2026-10-23 06:58:33','2026-10-24 23:19:16',NULL,NULL),(21,'RESERVATION_CANCELLED','STOCK_RESERVATION',3,'{\"notes\": \"Cancelled through TraceStock UI\", \"batch_id\": 4, \"quantity\": 1, \"cancelled_by\": 1, \"warehouse_id\": 2, \"reservation_id\": 3}','DELIVERED',1,'2026-10-23 06:58:33','2026-10-24 23:19:16',NULL,NULL),(22,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 15, \"quantity_reserved\": 1, \"available_quantity\": 14}','DELIVERED',1,'2026-10-24 17:30:09','2026-10-24 23:19:16',NULL,NULL),(23,'STOCK_RESERVED','STOCK_RESERVATION',4,'{\"batch_id\": 4, \"quantity\": 1, \"warehouse_id\": 2, \"reservation_id\": 4}','DELIVERED',1,'2026-10-24 17:30:09','2026-10-24 23:19:16',NULL,NULL),(24,'INVENTORY_UPDATED','INVENTORY',2,'{\"batch_id\": 4, \"inventory_id\": 2, \"warehouse_id\": 2, \"quantity_on_hand\": 15, \"quantity_reserved\": 0, \"available_quantity\": 15}','DELIVERED',1,'2026-10-24 17:51:08','2026-10-24 23:22:06',NULL,NULL),(25,'RESERVATION_CANCELLED','STOCK_RESERVATION',4,'{\"notes\": \"Cancelled through StockSync UI\", \"batch_id\": 4, \"quantity\": 1, \"cancelled_by\": 1, \"warehouse_id\": 2, \"reservation_id\": 4}','DELIVERED',1,'2026-10-24 17:51:08','2026-10-24 23:22:06',NULL,NULL),(26,'INVENTORY_CREATED','INVENTORY',4,'{\"batch_id\": 5, \"inventory_id\": 4, \"warehouse_id\": 1, \"quantity_on_hand\": 100, \"quantity_reserved\": 0, \"available_quantity\": 100}','PENDING',0,'2026-10-25 07:52:32',NULL,NULL,NULL);
/*!40000 ALTER TABLE `event_outbox` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `inventory_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned NOT NULL,
  `quantity_on_hand` int unsigned NOT NULL DEFAULT '0',
  `quantity_reserved` int unsigned NOT NULL DEFAULT '0',
  `quantity_quarantined` int unsigned NOT NULL DEFAULT '0',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `available_quantity` int unsigned GENERATED ALWAYS AS (((`quantity_on_hand` - `quantity_reserved`) - `quantity_quarantined`)) STORED,
  PRIMARY KEY (`inventory_id`),
  UNIQUE KEY `uq_inventory_batch_warehouse` (`batch_id`,`warehouse_id`),
  KEY `idx_inventory_warehouse` (`warehouse_id`),
  KEY `idx_inventory_available` (`available_quantity`),
  CONSTRAINT `fk_inventory_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_inventory_reserved` CHECK ((`quantity_reserved` <= `quantity_on_hand`)),
  CONSTRAINT `chk_inventory_reserved_quarantined` CHECK (((`quantity_reserved` + `quantity_quarantined`) <= `quantity_on_hand`))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
INSERT INTO `inventory` (`inventory_id`, `batch_id`, `warehouse_id`, `quantity_on_hand`, `quantity_reserved`, `quantity_quarantined`, `updated_at`) VALUES (1,3,1,90,0,15,'2026-10-15 08:00:42'),(2,4,2,15,0,0,'2026-10-24 17:51:08'),(3,3,2,10,0,0,'2026-10-14 15:37:29'),(4,5,1,100,0,0,'2026-10-25 07:52:32');
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_inventory_insert_outbox` AFTER INSERT ON `inventory` FOR EACH ROW BEGIN
    INSERT INTO event_outbox (
        event_type, aggregate_type, aggregate_id, payload
    )
    VALUES (
        'INVENTORY_CREATED',
        'INVENTORY',
        NEW.inventory_id,
        JSON_OBJECT(
            'inventory_id', NEW.inventory_id,
            'batch_id', NEW.batch_id,
            'warehouse_id', NEW.warehouse_id,
            'quantity_on_hand', NEW.quantity_on_hand,
            'quantity_reserved', NEW.quantity_reserved,
            'available_quantity', NEW.available_quantity
        )
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_inventory_update_outbox` AFTER UPDATE ON `inventory` FOR EACH ROW BEGIN
    INSERT INTO event_outbox (
        event_type, aggregate_type, aggregate_id, payload
    )
    VALUES (
        'INVENTORY_UPDATED',
        'INVENTORY',
        NEW.inventory_id,
        JSON_OBJECT(
            'inventory_id', NEW.inventory_id,
            'batch_id', NEW.batch_id,
            'warehouse_id', NEW.warehouse_id,
            'quantity_on_hand', NEW.quantity_on_hand,
            'quantity_reserved', NEW.quantity_reserved,
            'available_quantity', NEW.available_quantity
        )
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sku` varchar(60) NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text,
  `unit_of_measure` varchar(30) NOT NULL DEFAULT 'unit',
  `reorder_level` int unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `sku` (`sku`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'RICE-001','Organic Rice','Grains','Premium organic rice','kg',20,1,'2026-10-14 15:36:27','2026-10-14 15:36:27'),(2,'FLOUR-001','Wheat Flour','Flour','Whole wheat flour','kg',15,1,'2026-10-14 15:36:27','2026-10-14 15:36:27');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recall_batches`
--

DROP TABLE IF EXISTS `recall_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recall_batches` (
  `recall_id` bigint unsigned NOT NULL,
  `batch_id` bigint unsigned NOT NULL,
  `affected_quantity` int unsigned DEFAULT NULL,
  `quarantine_quantity` int unsigned NOT NULL DEFAULT '0',
  `recovered_quantity` int unsigned NOT NULL DEFAULT '0',
  `notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`recall_id`,`batch_id`),
  KEY `fk_recall_batch_batch` (`batch_id`),
  CONSTRAINT `fk_recall_batch_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_recall_batch_recall` FOREIGN KEY (`recall_id`) REFERENCES `recalls` (`recall_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recall_batches`
--

LOCK TABLES `recall_batches` WRITE;
/*!40000 ALTER TABLE `recall_batches` DISABLE KEYS */;
INSERT INTO `recall_batches` VALUES (1,3,100,15,0,'Demo recall affecting rice batch RICE-B001'),(2,4,2,0,0,'Initiated from defect DEF-1792865110023-2953'),(3,5,1,0,0,'Initiated from defect DEF-1792914831793-9373');
/*!40000 ALTER TABLE `recall_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recall_recoveries`
--

DROP TABLE IF EXISTS `recall_recoveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recall_recoveries` (
  `recovery_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recall_id` bigint unsigned NOT NULL,
  `batch_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned DEFAULT NULL,
  `recipient_id` bigint unsigned DEFAULT NULL,
  `quantity` int unsigned NOT NULL,
  `action_type` enum('QUARANTINED','RETURNED','DESTROYED','RELEASED') NOT NULL,
  `recorded_by` bigint unsigned DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`recovery_id`),
  KEY `fk_recovery_recall_batch` (`recall_id`,`batch_id`),
  KEY `fk_recovery_warehouse` (`warehouse_id`),
  KEY `fk_recovery_recipient` (`recipient_id`),
  KEY `fk_recovery_user` (`recorded_by`),
  KEY `idx_recovery_recall` (`recall_id`,`created_at`),
  CONSTRAINT `fk_recovery_recall_batch` FOREIGN KEY (`recall_id`, `batch_id`) REFERENCES `recall_batches` (`recall_id`, `batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_recovery_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `recipients` (`recipient_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`recorded_by`) REFERENCES `app_users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recovery_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_recovery_quantity` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recall_recoveries`
--

LOCK TABLES `recall_recoveries` WRITE;
/*!40000 ALTER TABLE `recall_recoveries` DISABLE KEYS */;
INSERT INTO `recall_recoveries` VALUES (1,1,3,1,NULL,10,'QUARANTINED',1,'Initial quarantine test for recalled rice','2026-10-14 18:17:23'),(2,1,3,1,NULL,5,'QUARANTINED',1,'Testing updated quarantine procedure','2026-10-15 08:00:42');
/*!40000 ALTER TABLE `recall_recoveries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recalls`
--

DROP TABLE IF EXISTS `recalls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recalls` (
  `recall_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recall_code` varchar(80) NOT NULL,
  `title` varchar(180) NOT NULL,
  `reason` text NOT NULL,
  `severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'HIGH',
  `status` enum('OPEN','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `initiated_by` bigint unsigned DEFAULT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`recall_id`),
  UNIQUE KEY `recall_code` (`recall_code`),
  KEY `fk_recall_user` (`initiated_by`),
  KEY `idx_recall_status` (`status`,`started_at`),
  CONSTRAINT `fk_recall_user` FOREIGN KEY (`initiated_by`) REFERENCES `app_users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recalls`
--

LOCK TABLES `recalls` WRITE;
/*!40000 ALTER TABLE `recalls` DISABLE KEYS */;
INSERT INTO `recalls` VALUES (1,'RECALL-TEST-001','Rice Batch Quality Recall','Demo quality issue for recall-tracing tests','HIGH','OPEN',1,'2026-10-14 17:17:27',NULL),(2,'REC-dac18b21-9b7f-4062-b7b6-a12628001574','Damaged Packaging Recall - Flour','High severity damaged packaging defect confirmed. Recalling the affected flour batch for investigation.\nDefect: DEF-1792865110023-2953','HIGH','OPEN',3,'2026-10-25 07:21:15',NULL),(3,'REC-a47e6ea2-9086-48af-8bbf-47683f571c7d','Recall for RICE-DEMO-001','defective,poor quality\nDefect: DEF-1792914831793-9373','MEDIUM','OPEN',1,'2026-10-25 07:55:16',NULL);
/*!40000 ALTER TABLE `recalls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recipients`
--

DROP TABLE IF EXISTS `recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recipients` (
  `recipient_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recipient_name` varchar(150) NOT NULL,
  `organization_name` varchar(180) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `delivery_address` varchar(500) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`recipient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recipients`
--

LOCK TABLES `recipients` WRITE;
/*!40000 ALTER TABLE `recipients` DISABLE KEYS */;
INSERT INTO `recipients` VALUES (1,'Ananya Sharma','Demo Retail Store','ananya@test.com','9876543212','MG Road','Bengaluru','2026-10-14 17:17:11');
/*!40000 ALTER TABLE `recipients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment_items`
--

DROP TABLE IF EXISTS `shipment_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipment_items` (
  `shipment_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shipment_id` bigint unsigned NOT NULL,
  `batch_id` bigint unsigned NOT NULL,
  `quantity_dispatched` int unsigned NOT NULL,
  `quantity_received` int unsigned DEFAULT NULL,
  `discrepancy_notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`shipment_item_id`),
  UNIQUE KEY `uq_shipment_batch` (`shipment_id`,`batch_id`),
  KEY `idx_shipment_item_batch` (`batch_id`),
  CONSTRAINT `fk_shipment_item_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_shipment_item_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`shipment_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_dispatched_quantity` CHECK ((`quantity_dispatched` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_items`
--

LOCK TABLES `shipment_items` WRITE;
/*!40000 ALTER TABLE `shipment_items` DISABLE KEYS */;
INSERT INTO `shipment_items` VALUES (1,1,3,20,18,'2 kg missing during delivery'),(2,2,4,5,NULL,NULL);
/*!40000 ALTER TABLE `shipment_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipments`
--

DROP TABLE IF EXISTS `shipments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipments` (
  `shipment_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shipment_code` varchar(80) NOT NULL,
  `recipient_id` bigint unsigned NOT NULL,
  `source_warehouse_id` bigint unsigned NOT NULL,
  `status` enum('PREPARING','DISPATCHED','IN_TRANSIT','DELIVERED','CANCELLED','DISCREPANCY') NOT NULL DEFAULT 'PREPARING',
  `dispatched_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`shipment_id`),
  UNIQUE KEY `shipment_code` (`shipment_code`),
  KEY `fk_shipment_warehouse` (`source_warehouse_id`),
  KEY `fk_shipment_user` (`created_by`),
  KEY `idx_shipment_status_date` (`status`,`created_at`),
  KEY `idx_shipment_recipient` (`recipient_id`),
  CONSTRAINT `fk_shipment_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `recipients` (`recipient_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_shipment_user` FOREIGN KEY (`created_by`) REFERENCES `app_users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipment_warehouse` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_shipment_dates` CHECK (((`delivered_at` is null) or (`dispatched_at` is null) or (`delivered_at` >= `dispatched_at`)))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipments`
--

LOCK TABLES `shipments` WRITE;
/*!40000 ALTER TABLE `shipments` DISABLE KEYS */;
INSERT INTO `shipments` VALUES (1,'SHIP-TEST-001',1,1,'DELIVERED','2026-10-14 22:47:11',NULL,'Demo shipment for discrepancy testing',1,'2026-10-14 17:17:11'),(2,'ship-2024-005',1,2,'PREPARING',NULL,NULL,NULL,1,'2026-10-22 17:10:37');
/*!40000 ALTER TABLE `shipments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_reservations`
--

DROP TABLE IF EXISTS `stock_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_reservations` (
  `reservation_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `reserved_by` bigint unsigned DEFAULT NULL,
  `status` enum('ACTIVE','FULFILLED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`reservation_id`),
  KEY `fk_reservation_warehouse` (`warehouse_id`),
  KEY `fk_reservation_user` (`reserved_by`),
  KEY `idx_reservation_status` (`status`,`expires_at`),
  KEY `idx_reservation_inventory` (`batch_id`,`warehouse_id`),
  CONSTRAINT `fk_reservation_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_reservation_user` FOREIGN KEY (`reserved_by`) REFERENCES `app_users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reservation_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_reservation_quantity` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_reservations`
--

LOCK TABLES `stock_reservations` WRITE;
/*!40000 ALTER TABLE `stock_reservations` DISABLE KEYS */;
INSERT INTO `stock_reservations` VALUES (1,3,1,5,1,'CANCELLED','2026-10-20 23:59:59','2026-10-14 15:38:26','2026-10-14 18:08:48'),(2,4,2,2,1,'CANCELLED','2026-10-20 23:59:59','2026-10-14 18:12:22','2026-10-14 18:12:40'),(3,4,2,1,1,'CANCELLED',NULL,'2026-10-23 06:49:49','2026-10-23 06:58:33'),(4,4,2,1,1,'CANCELLED',NULL,'2026-10-24 17:30:09','2026-10-24 17:51:08');
/*!40000 ALTER TABLE `stock_reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfers`
--

DROP TABLE IF EXISTS `stock_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfers` (
  `transfer_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `source_warehouse_id` bigint unsigned NOT NULL,
  `destination_warehouse_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `status` enum('COMPLETED','CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  `initiated_by` bigint unsigned DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transfer_id`),
  KEY `fk_transfer_user` (`initiated_by`),
  KEY `idx_transfer_batch_date` (`batch_id`,`created_at`),
  KEY `idx_transfer_source` (`source_warehouse_id`),
  KEY `idx_transfer_destination` (`destination_warehouse_id`),
  CONSTRAINT `fk_transfer_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_transfer_destination` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_transfer_source` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`warehouse_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_transfer_user` FOREIGN KEY (`initiated_by`) REFERENCES `app_users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `chk_transfer_quantity` CHECK ((`quantity` > 0)),
  CONSTRAINT `chk_transfer_warehouses` CHECK ((`source_warehouse_id` <> `destination_warehouse_id`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfers`
--

LOCK TABLES `stock_transfers` WRITE;
/*!40000 ALTER TABLE `stock_transfers` DISABLE KEYS */;
INSERT INTO `stock_transfers` VALUES (1,3,1,2,10,'COMPLETED',1,'Test transfer Bengaluru to Mysuru','2026-10-14 15:37:29');
/*!40000 ALTER TABLE `stock_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `supplier_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(150) NOT NULL,
  `contact_name` varchar(120) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`supplier_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,'FreshSupply Ltd','Asha Rao','fresh@test.com','9876543210','Bengaluru, Karnataka','ACTIVE','2026-10-14 15:36:27'),(2,'GlobalGoods Ltd','Rahul Mehta','global@test.com','9876543211','Mysuru, Karnataka','ACTIVE','2026-10-14 15:36:27');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `vw_inventory_overview`
--

DROP TABLE IF EXISTS `vw_inventory_overview`;
/*!50001 DROP VIEW IF EXISTS `vw_inventory_overview`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_inventory_overview` AS SELECT 
 1 AS `product_id`,
 1 AS `sku`,
 1 AS `product_name`,
 1 AS `batch_id`,
 1 AS `batch_code`,
 1 AS `expiry_date`,
 1 AS `batch_status`,
 1 AS `warehouse_id`,
 1 AS `warehouse_code`,
 1 AS `warehouse_name`,
 1 AS `quantity_on_hand`,
 1 AS `quantity_reserved`,
 1 AS `available_quantity`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_low_stock`
--

DROP TABLE IF EXISTS `vw_low_stock`;
/*!50001 DROP VIEW IF EXISTS `vw_low_stock`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_low_stock` AS SELECT 
 1 AS `product_id`,
 1 AS `sku`,
 1 AS `product_name`,
 1 AS `warehouse_id`,
 1 AS `warehouse_name`,
 1 AS `available_stock`,
 1 AS `reorder_level`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_recall_recipient_trace`
--

DROP TABLE IF EXISTS `vw_recall_recipient_trace`;
/*!50001 DROP VIEW IF EXISTS `vw_recall_recipient_trace`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_recall_recipient_trace` AS SELECT 
 1 AS `recall_id`,
 1 AS `recall_code`,
 1 AS `batch_id`,
 1 AS `batch_code`,
 1 AS `shipment_id`,
 1 AS `shipment_code`,
 1 AS `shipment_status`,
 1 AS `recipient_id`,
 1 AS `recipient_name`,
 1 AS `organization_name`,
 1 AS `email`,
 1 AS `phone`,
 1 AS `quantity_dispatched`,
 1 AS `quantity_received`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_shipment_discrepancies`
--

DROP TABLE IF EXISTS `vw_shipment_discrepancies`;
/*!50001 DROP VIEW IF EXISTS `vw_shipment_discrepancies`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_shipment_discrepancies` AS SELECT 
 1 AS `shipment_id`,
 1 AS `shipment_code`,
 1 AS `recipient_name`,
 1 AS `batch_id`,
 1 AS `batch_code`,
 1 AS `quantity_dispatched`,
 1 AS `quantity_received`,
 1 AS `quantity_difference`,
 1 AS `discrepancy_notes`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `warehouse_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `warehouse_code` varchar(30) NOT NULL,
  `warehouse_name` varchar(150) NOT NULL,
  `address` varchar(500) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `capacity_units` bigint unsigned DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`warehouse_id`),
  UNIQUE KEY `warehouse_code` (`warehouse_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES (1,'BLR-01','Bengaluru Warehouse','Industrial Area','Bengaluru',10000,'ACTIVE','2026-10-14 15:36:27'),(2,'MYS-01','Mysuru Warehouse','Warehouse Road','Mysuru',5000,'ACTIVE','2026-10-14 15:36:27');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'inventory_traceability_db'
--

--
-- Dumping routines for database 'inventory_traceability_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_cancel_reservation` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_cancel_reservation`(
    IN p_reservation_id BIGINT UNSIGNED,
    IN p_user_id BIGINT UNSIGNED,
    IN p_notes VARCHAR(500)
)
BEGIN
    DECLARE v_batch_id BIGINT UNSIGNED;
    DECLARE v_warehouse_id BIGINT UNSIGNED;
    DECLARE v_quantity INT UNSIGNED;
    DECLARE v_status VARCHAR(20);
    DECLARE v_inventory_id BIGINT UNSIGNED;
    DECLARE v_reserved INT UNSIGNED;
    DECLARE v_found BOOLEAN DEFAULT TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    
    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_found = FALSE;

        SELECT batch_id, warehouse_id, quantity, status
        INTO v_batch_id, v_warehouse_id, v_quantity, v_status
        FROM stock_reservations
        WHERE reservation_id = p_reservation_id
        FOR UPDATE;
    END;

    IF NOT v_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reservation does not exist';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reservation is not active';
    END IF;

    
    SET v_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_found = FALSE;

        SELECT inventory_id, quantity_reserved
        INTO v_inventory_id, v_reserved
        FROM inventory
        WHERE batch_id = v_batch_id
          AND warehouse_id = v_warehouse_id
        FOR UPDATE;
    END;

    IF NOT v_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory row does not exist';
    END IF;

    IF v_reserved < v_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reserved quantity is inconsistent';
    END IF;

    
    UPDATE inventory
    SET quantity_reserved = quantity_reserved - v_quantity
    WHERE inventory_id = v_inventory_id;

    
    UPDATE stock_reservations
    SET status = 'CANCELLED'
    WHERE reservation_id = p_reservation_id
      AND status = 'ACTIVE';

    
    INSERT INTO event_outbox (
        event_type,
        aggregate_type,
        aggregate_id,
        payload
    )
    VALUES (
        'RESERVATION_CANCELLED',
        'STOCK_RESERVATION',
        p_reservation_id,
        JSON_OBJECT(
            'reservation_id', p_reservation_id,
            'batch_id', v_batch_id,
            'warehouse_id', v_warehouse_id,
            'quantity', v_quantity,
            'cancelled_by', p_user_id,
            'notes', p_notes
        )
    );

    COMMIT;

    SELECT
        p_reservation_id AS reservation_id,
        'CANCELLED' AS status,
        v_quantity AS released_quantity;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_record_quarantine` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_record_quarantine`(
    IN p_recall_id BIGINT UNSIGNED,
    IN p_batch_id BIGINT UNSIGNED,
    IN p_warehouse_id BIGINT UNSIGNED,
    IN p_quantity INT UNSIGNED,
    IN p_user_id BIGINT UNSIGNED,
    IN p_notes VARCHAR(500)
)
BEGIN
    DECLARE v_recall_status VARCHAR(20);
    DECLARE v_affected_quantity INT UNSIGNED;
    DECLARE v_quarantine_quantity INT UNSIGNED;
    DECLARE v_inventory_id BIGINT UNSIGNED;
    DECLARE v_available INT UNSIGNED;
    DECLARE v_found BOOLEAN DEFAULT TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantity IS NULL OR p_quantity = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Quarantine quantity must be positive';
    END IF;

    START TRANSACTION;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_found = FALSE;

        SELECT status
        INTO v_recall_status
        FROM recalls
        WHERE recall_id = p_recall_id
        FOR UPDATE;
    END;

    IF NOT v_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Recall does not exist';
    END IF;

    IF v_recall_status NOT IN ('OPEN', 'IN_PROGRESS') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Recall is not open for quarantine';
    END IF;

    SET v_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_found = FALSE;

        SELECT affected_quantity, quarantine_quantity
        INTO v_affected_quantity, v_quarantine_quantity
        FROM recall_batches
        WHERE recall_id = p_recall_id
          AND batch_id = p_batch_id
        FOR UPDATE;
    END;

    IF NOT v_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Batch is not linked to this recall';
    END IF;

    IF v_affected_quantity IS NOT NULL
       AND v_quarantine_quantity + p_quantity > v_affected_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Quarantine exceeds affected quantity';
    END IF;

    SET v_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_found = FALSE;

        SELECT inventory_id, available_quantity
        INTO v_inventory_id, v_available
        FROM inventory
        WHERE batch_id = p_batch_id
          AND warehouse_id = p_warehouse_id
        FOR UPDATE;
    END;

    IF NOT v_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory row does not exist';
    END IF;

    IF v_available < p_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient available stock';
    END IF;

    
    UPDATE inventory
    SET quantity_quarantined = quantity_quarantined + p_quantity
    WHERE inventory_id = v_inventory_id;

    
    INSERT INTO recall_recoveries (
        recall_id,
        batch_id,
        warehouse_id,
        quantity,
        action_type,
        recorded_by,
        notes
    )
    VALUES (
        p_recall_id,
        p_batch_id,
        p_warehouse_id,
        p_quantity,
        'QUARANTINED',
        p_user_id,
        p_notes
    );

    
    UPDATE recall_batches
    SET quarantine_quantity = quarantine_quantity + p_quantity
    WHERE recall_id = p_recall_id
      AND batch_id = p_batch_id;

    
    INSERT INTO event_outbox (
        event_type,
        aggregate_type,
        aggregate_id,
        payload
    )
    VALUES (
        'RECALL_QUARANTINED',
        'RECALL_BATCH',
        p_batch_id,
        JSON_OBJECT(
            'recall_id', p_recall_id,
            'batch_id', p_batch_id,
            'warehouse_id', p_warehouse_id,
            'quantity', p_quantity,
            'recorded_by', p_user_id,
            'notes', p_notes
        )
    );

    COMMIT;

    SELECT
        p_recall_id AS recall_id,
        p_batch_id AS batch_id,
        p_quantity AS quarantined_quantity,
        'RECORDED' AS result;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_reserve_stock` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_reserve_stock`(
    IN p_batch_id BIGINT UNSIGNED,
    IN p_warehouse_id BIGINT UNSIGNED,
    IN p_quantity INT UNSIGNED,
    IN p_user_id BIGINT UNSIGNED,
    IN p_expires_at DATETIME
)
BEGIN
    DECLARE v_inventory_id BIGINT UNSIGNED;
    DECLARE v_available INT UNSIGNED;
    DECLARE v_batch_status VARCHAR(20);
    DECLARE v_reservation_id BIGINT UNSIGNED;
    DECLARE v_row_found BOOLEAN DEFAULT TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantity IS NULL OR p_quantity = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reservation quantity must be positive';
    END IF;

    START TRANSACTION;

    SELECT status INTO v_batch_status
    FROM batches
    WHERE batch_id = p_batch_id
    FOR UPDATE;

    IF v_batch_status IS NULL OR v_batch_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Batch is not active';
    END IF;

    SET v_row_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_row_found = FALSE;

        SELECT inventory_id, available_quantity
        INTO v_inventory_id, v_available
        FROM inventory
        WHERE batch_id = p_batch_id
          AND warehouse_id = p_warehouse_id
        FOR UPDATE;
    END;

    IF NOT v_row_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory row does not exist';
    END IF;

    IF v_available < p_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient available stock';
    END IF;

    UPDATE inventory
    SET quantity_reserved = quantity_reserved + p_quantity
    WHERE inventory_id = v_inventory_id;

    INSERT INTO stock_reservations (
        batch_id, warehouse_id, quantity, reserved_by, status, expires_at
    )
    VALUES (
        p_batch_id, p_warehouse_id, p_quantity, p_user_id,
        'ACTIVE', p_expires_at
    );

    SET v_reservation_id = LAST_INSERT_ID();

    INSERT INTO event_outbox (
        event_type, aggregate_type, aggregate_id, payload
    )
    VALUES (
        'STOCK_RESERVED',
        'STOCK_RESERVATION',
        v_reservation_id,
        JSON_OBJECT(
            'reservation_id', v_reservation_id,
            'batch_id', p_batch_id,
            'warehouse_id', p_warehouse_id,
            'quantity', p_quantity
        )
    );

    COMMIT;

    SELECT v_reservation_id AS reservation_id,
           'ACTIVE' AS status;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_transfer_stock` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_transfer_stock`(
    IN p_batch_id BIGINT UNSIGNED,
    IN p_source_warehouse_id BIGINT UNSIGNED,
    IN p_destination_warehouse_id BIGINT UNSIGNED,
    IN p_quantity INT UNSIGNED,
    IN p_user_id BIGINT UNSIGNED,
    IN p_notes VARCHAR(500)
)
BEGIN
    DECLARE v_source_inventory_id BIGINT UNSIGNED;
    DECLARE v_destination_inventory_id BIGINT UNSIGNED;
    DECLARE v_available INT UNSIGNED;
    DECLARE v_batch_status VARCHAR(20);
    DECLARE v_transfer_id BIGINT UNSIGNED;
    DECLARE v_source_found BOOLEAN DEFAULT TRUE;
    DECLARE v_destination_found BOOLEAN DEFAULT TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantity IS NULL OR p_quantity = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transfer quantity must be positive';
    END IF;

    IF p_source_warehouse_id = p_destination_warehouse_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Source and destination must differ';
    END IF;

    START TRANSACTION;

    SELECT status INTO v_batch_status
    FROM batches
    WHERE batch_id = p_batch_id
    FOR UPDATE;

    IF v_batch_status IS NULL OR v_batch_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Batch is not active';
    END IF;

    SET v_source_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_source_found = FALSE;

        SELECT inventory_id, available_quantity
        INTO v_source_inventory_id, v_available
        FROM inventory
        WHERE batch_id = p_batch_id
          AND warehouse_id = p_source_warehouse_id
        FOR UPDATE;
    END;

    IF NOT v_source_found THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Source inventory row does not exist';
    END IF;

    IF v_available < p_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient available stock';
    END IF;

    
    SET v_destination_found = TRUE;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND
            SET v_destination_found = FALSE;

        SELECT inventory_id
        INTO v_destination_inventory_id
        FROM inventory
        WHERE batch_id = p_batch_id
          AND warehouse_id = p_destination_warehouse_id
        FOR UPDATE;
    END;

    
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - p_quantity
    WHERE inventory_id = v_source_inventory_id;

    
    IF v_destination_found THEN
        UPDATE inventory
        SET quantity_on_hand = quantity_on_hand + p_quantity
        WHERE inventory_id = v_destination_inventory_id;
    ELSE
        INSERT INTO inventory (
            batch_id, warehouse_id, quantity_on_hand, quantity_reserved
        )
        VALUES (
            p_batch_id, p_destination_warehouse_id, p_quantity, 0
        );
    END IF;

    INSERT INTO stock_transfers (
        batch_id, source_warehouse_id, destination_warehouse_id,
        quantity, status, initiated_by, notes
    )
    VALUES (
        p_batch_id, p_source_warehouse_id, p_destination_warehouse_id,
        p_quantity, 'COMPLETED', p_user_id, p_notes
    );

    SET v_transfer_id = LAST_INSERT_ID();

    INSERT INTO event_outbox (
        event_type, aggregate_type, aggregate_id, payload
    )
    VALUES (
        'STOCK_TRANSFER_COMPLETED',
        'STOCK_TRANSFER',
        v_transfer_id,
        JSON_OBJECT(
            'transfer_id', v_transfer_id,
            'batch_id', p_batch_id,
            'source_warehouse_id', p_source_warehouse_id,
            'destination_warehouse_id', p_destination_warehouse_id,
            'quantity', p_quantity
        )
    );

    COMMIT;

    SELECT v_transfer_id AS transfer_id,
           'COMPLETED' AS status;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `vw_inventory_overview`
--

/*!50001 DROP VIEW IF EXISTS `vw_inventory_overview`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_inventory_overview` AS select `p`.`product_id` AS `product_id`,`p`.`sku` AS `sku`,`p`.`product_name` AS `product_name`,`b`.`batch_id` AS `batch_id`,`b`.`batch_code` AS `batch_code`,`b`.`expiry_date` AS `expiry_date`,`b`.`status` AS `batch_status`,`w`.`warehouse_id` AS `warehouse_id`,`w`.`warehouse_code` AS `warehouse_code`,`w`.`warehouse_name` AS `warehouse_name`,`i`.`quantity_on_hand` AS `quantity_on_hand`,`i`.`quantity_reserved` AS `quantity_reserved`,`i`.`available_quantity` AS `available_quantity` from (((`inventory` `i` join `batches` `b` on((`b`.`batch_id` = `i`.`batch_id`))) join `products` `p` on((`p`.`product_id` = `b`.`product_id`))) join `warehouses` `w` on((`w`.`warehouse_id` = `i`.`warehouse_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_low_stock`
--

/*!50001 DROP VIEW IF EXISTS `vw_low_stock`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_low_stock` AS select `p`.`product_id` AS `product_id`,`p`.`sku` AS `sku`,`p`.`product_name` AS `product_name`,`w`.`warehouse_id` AS `warehouse_id`,`w`.`warehouse_name` AS `warehouse_name`,sum(`i`.`available_quantity`) AS `available_stock`,`p`.`reorder_level` AS `reorder_level` from (((`inventory` `i` join `batches` `b` on((`b`.`batch_id` = `i`.`batch_id`))) join `products` `p` on((`p`.`product_id` = `b`.`product_id`))) join `warehouses` `w` on((`w`.`warehouse_id` = `i`.`warehouse_id`))) where (`b`.`status` = 'ACTIVE') group by `p`.`product_id`,`p`.`sku`,`p`.`product_name`,`w`.`warehouse_id`,`w`.`warehouse_name`,`p`.`reorder_level` having (sum(`i`.`available_quantity`) <= `p`.`reorder_level`) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_recall_recipient_trace`
--

/*!50001 DROP VIEW IF EXISTS `vw_recall_recipient_trace`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_recall_recipient_trace` AS select `rb`.`recall_id` AS `recall_id`,`rc`.`recall_code` AS `recall_code`,`rb`.`batch_id` AS `batch_id`,`b`.`batch_code` AS `batch_code`,`s`.`shipment_id` AS `shipment_id`,`s`.`shipment_code` AS `shipment_code`,`s`.`status` AS `shipment_status`,`r`.`recipient_id` AS `recipient_id`,`r`.`recipient_name` AS `recipient_name`,`r`.`organization_name` AS `organization_name`,`r`.`email` AS `email`,`r`.`phone` AS `phone`,`si`.`quantity_dispatched` AS `quantity_dispatched`,`si`.`quantity_received` AS `quantity_received` from (((((`recall_batches` `rb` join `recalls` `rc` on((`rc`.`recall_id` = `rb`.`recall_id`))) join `batches` `b` on((`b`.`batch_id` = `rb`.`batch_id`))) join `shipment_items` `si` on((`si`.`batch_id` = `rb`.`batch_id`))) join `shipments` `s` on((`s`.`shipment_id` = `si`.`shipment_id`))) join `recipients` `r` on((`r`.`recipient_id` = `s`.`recipient_id`))) where (`s`.`status` <> 'CANCELLED') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_shipment_discrepancies`
--

/*!50001 DROP VIEW IF EXISTS `vw_shipment_discrepancies`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_shipment_discrepancies` AS select `s`.`shipment_id` AS `shipment_id`,`s`.`shipment_code` AS `shipment_code`,`r`.`recipient_name` AS `recipient_name`,`si`.`batch_id` AS `batch_id`,`b`.`batch_code` AS `batch_code`,`si`.`quantity_dispatched` AS `quantity_dispatched`,`si`.`quantity_received` AS `quantity_received`,(`si`.`quantity_dispatched` - `si`.`quantity_received`) AS `quantity_difference`,`si`.`discrepancy_notes` AS `discrepancy_notes` from (((`shipment_items` `si` join `shipments` `s` on((`s`.`shipment_id` = `si`.`shipment_id`))) join `recipients` `r` on((`r`.`recipient_id` = `s`.`recipient_id`))) join `batches` `b` on((`b`.`batch_id` = `si`.`batch_id`))) where ((`si`.`quantity_received` is not null) and (`si`.`quantity_received` <> `si`.`quantity_dispatched`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-26 14:13:57
