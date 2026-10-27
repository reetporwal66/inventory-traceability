# StockSync — Product Batch Traceability and Recall Management System

## Team:
Rekha Dhorigol, PES1UG24CS370
Reet Porwal, PES1UG24CS369
Section: G

StockSync is a web-based inventory traceability and management system designed to track products and supplier batches across warehouses, reservations, transfers, shipments, defect reports, and product recalls. It combines **MySQL** for structured operational data with **MongoDB** for event-document storage, synchronized through a MySQL event outbox.

This project was developed as a **DBMS Level 3 academic project** at PES University, Department of Computer Science and Engineering.

**Repository:** https://github.com/reetporwal66/inventory-traceability

**Project Report:** [StockSync DBMS Level 3 Report](docs/StockSync_DBMS_Level3_Report.pdf)

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Event Worker](#event-worker)
- [Validation and Testing](#validation-and-testing)
- [Application Routes](#application-routes)
- [Database Design](#database-design)
- [Project Structure](#project-structure)
- [Screenshots and Documentation](#screenshots-and-documentation)
- [Security Notes](#security-notes)
- [Limitations](#limitations)

## Key Features

- **Dashboard:** Displays inventory summaries and operational information.
- **Product Management:** Maintains product master information.
- **Batch Traceability:** Tracks products and supplier batches throughout inventory operations.
- **Inventory Management:** Displays stock by batch and warehouse, including on-hand, reserved, quarantined, and available quantities.
- **Stock Reservations:** Supports stock reservation and cancellation while maintaining quantity limits.
- **Warehouse Transfers:** Records stock transfers between warehouses.
- **Shipment Tracking:** Tracks shipment progress and dispatched, received, and discrepant quantities.
- **Defect Reporting:** Records product defects and supports quality-team review.
- **Recall Management:** Links affected batches to recall cases, quarantines stock, and records recovery actions.
- **Recipient Traceability:** Connects shipments and batches to recipients to help identify downstream destinations during recalls.
- **Role-Based Access Control:** Supports role-aware permissions for administrators, inventory staff, and quality staff.
- **Relational Integrity:** Uses database keys, constraints, indexes, views, stored procedures, and triggers.
- **Event Synchronization:** Uses a MySQL event outbox to transfer selected inventory events into MongoDB.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend and application framework | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Relational database | MySQL / InnoDB |
| Document database | MongoDB |
| Authentication and sessions | `bcryptjs`, `jose` |
| Input validation | Zod |
| Database connectivity | `mysql2`, `mongodb` |
| Code quality | ESLint |
| Version control | Git and GitHub |

## System Architecture

StockSync uses MySQL as the primary relational database and MongoDB as an event-document store.

```text
Browser
   |
   v
Next.js / React Application
   |
   v
Next.js API Route Handlers
   |
   +--------------------------+
   |                          |
   v                          v
MySQL Database             MongoDB
   |                       inventory_events
   |
   v
Inventory Triggers
   |
   v
MySQL event_outbox
   |
   v
Event Synchronization Worker
   |
   v
MongoDB events Collection
```

### Database Responsibilities

**MySQL**

- Stores structured operational entities and their relationships.
- Enforces primary keys, foreign keys, unique constraints, and other defined integrity rules.
- Supports inventory, reservation, transfer, shipment, defect, and recall workflows.
- Stores event-outbox records for synchronization.

**MongoDB**

- Stores event documents in the `inventory_events` database.
- Uses the `events` collection for synchronized inventory event records.
- Supports event-oriented document retrieval independently of the main relational records.

The event synchronization worker is a **one-shot process**. It processes eligible events and exits rather than running continuously as a background service.

## Prerequisites

The following software and services are required:

- Node.js and npm
- MySQL
- MongoDB
- Git, for cloning the repository

Both database services must be running and accessible to the application.

## Getting Started

### 1. Clone the Repository

Run the following commands in PowerShell or a terminal:

```powershell
git clone https://github.com/reetporwal66/inventory-traceability.git
cd inventory-traceability
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Configure Environment Variables

Create a local environment file from the example:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

Configure `.env.local` with the connection details for your local database services. For example:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=inventory_traceability_db
MONGODB_URI=mongodb://localhost:27017
```

Replace the example credentials with the values for your local environment. If MongoDB requires authentication, use the appropriate authenticated connection URI.

If MySQL is mapped to host port `3307`, set `MYSQL_PORT=3307` instead of `3306`.

**Never commit `.env.local`, database passwords, or other secrets to GitHub.**

## Database Setup

### MySQL

The repository includes `StockSync_Database_Setup.sql`, which defines the relational database schema and includes demonstration data.

1. Start the MySQL service.
2. Create or select the intended development database.
3. Review `StockSync_Database_Setup.sql`.
4. Execute the script against the intended database.
5. Confirm that the required tables, constraints, indexes, views, stored procedures, and triggers have been created.
6. Ensure that the application's MySQL configuration matches the database connection settings.

**Important:** The setup script contains `DROP TABLE IF EXISTS` statements. Running it against an existing database may delete tables and their data. Back up any required data and use a fresh, disposable development database when initializing the project.

The SQL dump may also contain `DEFINER` clauses, such as `root@localhost`. Importing it with a different MySQL account may require appropriate permissions or adjustments to the definers.

### MongoDB

Configure the MongoDB connection in `.env.local`.

| Setting | Value |
|---|---|
| Database | `inventory_events` |
| Collection | `events` |

MongoDB must be running and accessible for event synchronization.

## Running the Application

### Development Server

Start the development server:

```powershell
npm run dev
```

Open the application at:

http://localhost:3000

### Production Build

Create an optimized production build:

```powershell
npm run build
```

After a successful build, start the production server:

```powershell
npm run start
```

## Event Worker

StockSync includes a worker that processes eligible records from the MySQL event outbox and synchronizes them with MongoDB.

Run the worker from the project root:

```powershell
npm run worker
```

The worker loads environment variables from `.env.local`, connects to MySQL and MongoDB, processes eligible events, updates delivery status, and exits when the run is complete.

The number of events processed depends on the current outbox state. For example, `Found 0 events to deliver` indicates that no eligible pending events were found at that time; it does not by itself indicate a failure.

### Verifying Event Synchronization

In MySQL, inspect the outbox records and their delivery status:

```sql
SELECT event_id, event_type, delivery_status
FROM event_outbox
ORDER BY event_id;
```

In MongoDB, inspect the number of event documents:

```javascript
use inventory_events
db.events.countDocuments({})
```

To inspect a sample of the documents:

```javascript
db.events.find().limit(5)
```

These queries can be used to examine event delivery status and the synchronized event documents.

## Validation and Testing

The following commands and functional checks can be used to evaluate the application.

### 1. Lint

```powershell
npm run lint
```

Runs the project's configured ESLint checks.

### 2. Production Build

```powershell
npm run build
```

Checks whether the application can be compiled for production, including applicable TypeScript checks.

### 3. Worker and Database Connectivity

```powershell
npm run worker
```

Runs the event synchronization worker and checks its ability to connect to both databases and complete an event-delivery run.

When no pending events are available, existing outbox delivery statuses and MongoDB event documents can be inspected separately.

### 4. Functional Test Checklist

| Test Area | Verification |
|---|---|
| Authentication | Login functionality and role-based access restrictions |
| Inventory | Consistency of on-hand, reserved, quarantined, and available quantities |
| Reservations | Successful valid reservations, rejection of invalid quantities, and correct cancellation behavior |
| Transfers | Valid source and destination warehouses and transfer quantities |
| Shipments | Valid shipment status transitions and rejection of invalid transitions |
| Defects | Defect report creation and review according to permissions |
| Recalls | Association of affected batches with recalls and recording of quarantine or recovery actions |
| Recipient traceability | Identification of relevant shipments and recipients |
| SQL integrity | Enforcement of keys, constraints, and database rules |
| Event synchronization | Consistency between outbox delivery records and MongoDB event documents |

## Application Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard and operational summary |
| `/login` | Authentication |
| `/products` | Product management |
| `/inventory` | Inventory overview |
| `/warehouses` | Warehouse information |
| `/transfers` | Stock transfers |
| `/reservations` | Stock reservations |
| `/shipments` | Shipment tracking |
| `/defects` | Defect reporting and review |
| `/recalls` | Recall management and recovery |
| `/recipients` | Recipient traceability |

## Database Design

The relational schema contains the following 16 tables:

1. `app_users`
2. `products`
3. `suppliers`
4. `batches`
5. `warehouses`
6. `inventory`
7. `stock_reservations`
8. `stock_transfers`
9. `recipients`
10. `shipments`
11. `shipment_items`
12. `defect_reports`
13. `recalls`
14. `recall_batches`
15. `recall_recoveries`
16. `event_outbox`

### Integrity and Advanced SQL

The SQL setup defines relational integrity rules and database objects, including:

- Primary keys and foreign keys.
- Unique constraints for key business identifiers.
- Check constraints for defined quantity, date, and transfer rules.
- A generated `inventory.available_quantity` value calculated from on-hand, reserved, and quarantined quantities.

**Reporting views:**
- `vw_inventory_overview`
- `vw_low_stock`
- `vw_recall_recipient_trace`
- `vw_shipment_discrepancies`

**Stored procedures:**
- `sp_cancel_reservation` — cancels a stock reservation and releases the reserved quantity.
- `sp_record_quarantine` — records the quarantine of stock associated with a product recall.
- `sp_reserve_stock` — reserves available stock for an active batch.
- `sp_transfer_stock` — transfers stock between warehouses.

**Inventory triggers:**
- `trg_inventory_insert_outbox` — creates an outbox event when an inventory record is inserted.
- `trg_inventory_update_outbox` — creates an outbox event when an inventory record is updated.

The file `StockSync_Database_Setup.sql` contains the corresponding database definitions.

## Project Structure

```text
inventory-traceability/
├── docs/
│   ├── StockSync_DBMS_Level3_Report.pdf
│   └── screenshots
│       ├── dashboard_overview.png
│       ├── defect_reports.png
│       ├── inventory.png
│       ├── mysql_advanced.png
│       ├── mysql_join.png
│       ├── mysql_tables_1.png
│       ├── mysql_tables_2.png
│       ├── mongo_1.jpeg
│       ├── mongo_2.jpeg
│       ├── mongo_3.jpeg
│       ├── product_recalls_1.png
│       ├── product_recalls_2.png
│       ├── product_recalls_3.png
│       ├── shipments_1.png
│       ├── shipments_2.png
│       ├── stock_reservation_1.png
│       └── stock_reservation_2.png
├── src/
│   └── app/
├── worker/
│   └── worker.js
├── StockSync_Database_Setup.sql
├── .env.example
├── package.json
├── package-lock.json
└── README.md
```

This is a high-level overview of the project structure. The repository contains the complete source code.

## Screenshots and Documentation

The `docs/` directory contains screenshots and supporting documentation for the application's main workflows and database components.

### Application

- [Dashboard Overview](docs/dashboard_overview.png)
- [Inventory Overview](docs/inventory.png)
- [Defect Reports](docs/defect_reports.png)

### Database and Synchronization

- [MySQL Tables — Set 1](docs/mysql_tables_1.png)
- [MySQL Tables — Set 2](docs/mysql_tables_2.png)
- [MySQL JOIN Example](docs/mysql_join.png)
- [MySQL Advanced SQL](docs/mysql_advanced.png)
- [MongoDB Screenshot 1](docs/mongo_1.jpeg)
- [MongoDB Screenshot 2](docs/mongo_2.jpeg)
- [MongoDB Screenshot 3](docs/mongo_3.jpeg)

### Operational Workflows

- [Stock Reservation — Screenshot 1](docs/stock_reservation_1.png)
- [Stock Reservation — Screenshot 2](docs/stock_reservation_2.png)
- [Shipments — Screenshot 1](docs/shipments_1.png)
- [Shipments — Screenshot 2](docs/shipments_2.png)
- [Product Recalls — Screenshot 1](docs/product_recalls_1.png)
- [Product Recalls — Screenshot 2](docs/product_recalls_2.png)
- [Product Recalls — Screenshot 3](docs/product_recalls_3.png)

For detailed project documentation, see the [StockSync DBMS Level 3 Project Report](docs/StockSync_DBMS_Level3_Report.pdf).

## Security Notes

- Store credentials and session secrets in local environment configuration.
- Do not commit `.env.local` or real database credentials.
- Use appropriate database accounts and permissions.
- Apply role permissions to protected operations.
- Validate inputs and preserve database integrity.
- Avoid exposing secrets in client-side code, screenshots, logs, or the public repository.
- Use sample data for local development and demonstration.

## Limitations

- The event worker runs as a one-shot process rather than a continuously running background service.
- Event synchronization depends on valid MySQL and MongoDB configuration and the state of the MySQL outbox.
- The SQL initialization script is intended for controlled development setup and may drop existing tables.
- MongoDB is used as an event-document store; the project does not implement vector embeddings or vector similarity search.

## Project Status

StockSync demonstrates database-backed inventory traceability, relational integrity, stock reservation and transfer workflows, shipment tracking, defect and recall management, and event synchronization between MySQL and MongoDB.
