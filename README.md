# StockSync — Inventory Traceability System

StockSync is a web-based inventory traceability and management system designed to track inventory, manage stock reservations and transfers, monitor shipments, record product defects, and support product recalls. It combines a relational database for structured inventory operations with a document database for inventory event tracking.

## Key Features

- **Dashboard:** Inventory summaries and operational insights.
- **Inventory management:** View stock levels and inventory availability.
- **Product and batch traceability:** Track products and batches through the inventory lifecycle.
- **Stock reservations:** Reserve available stock, enforce quantity limits, and cancel reservations.
- **Stock transfers:** Manage transfers between warehouses.
- **Shipment tracking:** Update shipment statuses while enforcing valid status transitions.
- **Defect reporting:** Record product defects and support quality-team reviews.
- **Recall management:** Track recalled batches and record controlled stock recovery.
- **Recipient traceability:** Support traceability of products and recall recipients.
- **Role-based access control:** Distinguish administrative, inventory, and quality staff permissions.
- **Event synchronization:** Use a MySQL event outbox and MongoDB to store and retrieve inventory event records.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend and application framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS |
| Relational database | MySQL |
| Document database | MongoDB |
| Authentication | `bcryptjs`, `jose` |
| Validation | Zod |
| Database connectivity | `mysql2`, `mongodb` |
| Charts and visualizations | Recharts |
| Code quality | ESLint |

## Prerequisites

Install the following before running the application:

- Node.js and npm
- MySQL
- MongoDB
- Git (if cloning the repository)

Ensure both database services are running and accessible from the application.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/reetporwal66/inventory-traceability.git
cd inventory-traceability
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file by copying the example:

**PowerShell**
```powershell
Copy-Item .env.example .env.local
```

**Linux/macOS**
```bash
cp .env.example .env.local
```

Update `.env.local` with the connection details for your local database services:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=inventory_traceability_db

MONGODB_URI=mongodb://your_mongo_username:your_mongo_password@localhost:27017/?authSource=admin
```

Replace the placeholder credentials with your own values. The MongoDB URI must match your MongoDB authentication configuration. For a local MongoDB instance without authentication, use the appropriate unauthenticated connection URI instead.

**Port configuration:** If MySQL is mapped to host port `3307` rather than its default port `3306`, set `MYSQL_PORT=3307`.

Never commit `.env.local` or real database credentials to version control.

### 4. Initialize the database

1. Start MySQL and MongoDB.
2. Create or select the MySQL database `inventory_traceability_db`.
3. Review `StockSync_Database_Setup.sql`.
4. Execute the SQL setup script against the intended database.
5. Verify that the required tables, constraints, indexes, views, stored procedures, and triggers have been created.
6. Ensure the MongoDB connection is configured correctly for the event synchronization functionality.

**Warning:** Review the SQL setup script before executing it. If it contains `DROP TABLE` statements, running it against an existing database may delete existing tables and data. Back up any data you need to preserve.

The setup script includes sample records for demonstration and testing. Importing it into a fresh database will populate these records. Review the sample user accounts and data before using the application in any environment beyond local development. The script also contains database triggers with a specified definer, so verify that the target MySQL account and permissions support importing them.

### Database Setup Notes

- `StockSync_Database_Setup.sql` creates the database tables, views, triggers, and stored procedures and includes sample data for demonstration and testing.
- **Warning:** The script contains `DROP TABLE IF EXISTS` statements. Back up any existing database before importing it.
- The SQL dump uses `root@localhost` as the definer for some triggers, views, and stored procedures. If you import it using a different MySQL account, you may need to adjust the definers and ensure the account has the required privileges.
- Import the script into a fresh development database first and verify that all tables, views, triggers, and stored procedures are created successfully.
- Configure the MySQL connection in `.env.local` to match your local setup. For the documented Docker configuration, the host port may be `3307` rather than the default `3306`.
- The included records are intended for local development and demonstration, not production use.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Run production checks

Check code quality:

```bash
npm run lint
```

Create an optimized production build:

```bash
npm run build
```

Start the production server after a successful build:

```bash
npm run start
```

## Application Routes

The application includes the following primary pages:

| Route | Purpose |
|---|---|
| `/` | Dashboard |
| `/login` | Authentication |
| `/products` | Product management interface |
| `/inventory` | Inventory overview |
| `/warehouses` | Warehouse-related information |
| `/transfers` | Stock transfers |
| `/reservations` | Stock reservations |
| `/shipments` | Shipment tracking |
| `/defects` | Defect reporting and review |
| `/recalls` | Recall management and recovery |
| `/recipients` | Recipient traceability |

## Database Design

StockSync uses two database systems for different responsibilities.

### MySQL

MySQL stores structured operational data and supports relational integrity through primary keys, foreign keys, constraints, indexes, views, stored procedures, and triggers.

The application uses database-side operations for critical workflows such as stock reservation and cancellation, shipment transitions, and recall recovery.

### MongoDB

MongoDB stores inventory event documents synchronized from the MySQL event outbox. This supports event-oriented record retrieval independently of the primary relational inventory data.

## Project Structure

The repository contains a Next.js application, API route handlers, database setup SQL, environment configuration examples, and application components.

- `src/app/` — application pages and API routes
- `StockSync_Database_Setup.sql` — database initialization script
- `.env.example` — environment-variable template
- `package.json` — dependencies and development scripts

## Security Notes

- Keep credentials in local environment configuration.
- Do not commit `.env.local`.
- Use appropriate database permissions and secure passwords.
- Enforce role permissions for protected operations.
- Validate user input and preserve database integrity.
- Do not expose database credentials or session secrets in client-side code.

## Project Status

StockSync is an academic software project demonstrating inventory traceability, database integration, transactional operations, role-based access control, and event synchronization.

Additional implementation details, test results, screenshots, and database design documentation should be included in the accompanying project report.
