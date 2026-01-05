import logging
import os
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

logger = logging.getLogger(__name__)


def parse_database_url(url: str) -> dict:
    """
    Parse database URL to extract components

    Args:
        url: Database connection URL

    Returns:
        Dictionary with database connection components
    """
    # Example: mysql+pymysql://user:pass@host:port/dbname
    try:
        # Remove the driver part
        if "://" in url:
            driver, rest = url.split("://", 1)
        else:
            raise ValueError("Invalid database URL format")

        # Extract credentials and host
        if "@" in rest:
            credentials, host_part = rest.rsplit("@", 1)
            if ":" in credentials:
                username, password = credentials.split(":", 1)
            else:
                username = credentials
                password = ""
        else:
            raise ValueError("Invalid database URL format")

        # Extract host, port, and database name
        if "/" in host_part:
            host_port, dbname = host_part.split("/", 1)
            # Remove query parameters if any
            if "?" in dbname:
                dbname = dbname.split("?")[0]
        else:
            raise ValueError("Invalid database URL format")

        if ":" in host_port:
            host, port = host_port.split(":", 1)
        else:
            host = host_port
            port = "3306"  # Default MySQL port

        return {
            "driver": driver,
            "username": username,
            "password": password,
            "host": host,
            "port": port,
            "database": dbname,
        }
    except Exception as e:
        logger.error(f"Error parsing database URL: {str(e)}")
        raise


def wait_for_db(engine, max_retries: int = 30, retry_interval: int = 2):
    """
    Wait for database server to be ready

    Args:
        engine: SQLAlchemy engine
        max_retries: Maximum number of connection attempts
        retry_interval: Seconds between retries
    """
    logger.info("Waiting for database server to be ready...")

    for attempt in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database server is ready!")
            return True
        except OperationalError:
            if attempt < max_retries - 1:
                logger.warning(
                    f"Database not ready (attempt {attempt + 1}/{max_retries}). "
                    f"Retrying in {retry_interval} seconds..."
                )
                time.sleep(retry_interval)
            else:
                logger.error(
                    f"Failed to connect to database after {max_retries} attempts"
                )
                raise

    return False


def create_database_if_not_exists():
    """
    Create the database if it doesn't exist
    """
    try:
        logger.info("Checking if database exists...")

        # Parse the database URL
        db_config = parse_database_url(settings.DATABASE_URL)
        database_name = db_config["database"]

        # Create connection URL without database name (connect to MySQL server)
        server_url = (
            f"{db_config['driver']}://{db_config['username']}:{db_config['password']}"
            f"@{db_config['host']}:{db_config['port']}"
        )

        # Create engine for server connection
        server_engine = create_engine(
            server_url, isolation_level="AUTOCOMMIT", echo=False
        )

        # Wait for database server to be ready
        wait_for_db(server_engine)

        # Check if database exists and create if not
        with server_engine.connect() as conn:
            # Check if database exists
            result = conn.execute(
                text(
                    f"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA "
                    f"WHERE SCHEMA_NAME = '{database_name}'"
                )
            )
            exists = result.fetchone() is not None

            if not exists:
                logger.info(f"Database '{database_name}' does not exist. Creating...")
                conn.execute(
                    text(
                        f"CREATE DATABASE `{database_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                    )
                )
                logger.info(f"Database '{database_name}' created successfully!")
            else:
                logger.info(f"Database '{database_name}' already exists.")

        server_engine.dispose()
        return True

    except Exception as e:
        logger.error(f"Error creating database: {str(e)}", exc_info=True)
        raise


def create_tables_directly():
    """
    Create database tables directly using SQLAlchemy (bypass Alembic)
    This is faster and doesn't have the blocking issues of Alembic
    """
    try:
        logger.info("Creating database tables...")

        # Import Base and models
        from db import models  # noqa: F401
        from db.session import Base, engine

        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)

        logger.info("✓ Database tables created successfully!")

        # Create alembic_version table and mark as at HEAD
        try:
            with engine.connect() as conn:
                # Check if alembic_version table exists
                result = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = DATABASE() AND table_name = 'alembic_version'"
                    )
                )
                table_exists = result.fetchone()[0] > 0

                if not table_exists:
                    # Create alembic_version table
                    conn.execute(
                        text(
                            "CREATE TABLE alembic_version ("
                            "version_num VARCHAR(32) NOT NULL, "
                            "PRIMARY KEY (version_num))"
                        )
                    )
                    # Insert current HEAD revision
                    conn.execute(
                        text(
                            "INSERT INTO alembic_version (version_num) VALUES ('f1f91d4c55ac')"
                        )
                    )
                    conn.commit()
                    logger.info("✓ Alembic version table created and marked at HEAD")
                else:
                    logger.info("Alembic version table already exists")
        except Exception as alembic_err:
            logger.warning(
                f"Could not create alembic_version table: {str(alembic_err)}"
            )

        return True

    except Exception as e:
        logger.error(f"Error creating tables: {str(e)}", exc_info=True)
        raise


def run_migrations():
    """
    Initialize database schema using SQLAlchemy's metadata.create_all()

    Note: This bypasses Alembic to avoid blocking issues with its logging.
    Tables are created directly from SQLAlchemy models in db/models.py
    """
    try:
        logger.info("Initializing database schema...")

        # Check if tables already exist
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 10},
        )

        try:
            with engine.connect() as conn:
                # Check if users table exists (as indicator of schema)
                result = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = DATABASE() AND table_name = 'users'"
                    )
                )
                tables_exist = result.fetchone()[0] > 0

                if tables_exist:
                    logger.info("Database tables already exist, skipping creation")
                else:
                    logger.info("Database is empty, creating tables...")
                    create_tables_directly()
        except Exception as check_err:
            logger.warning(f"Could not check existing tables: {str(check_err)}")
            # Try to create tables anyway
            create_tables_directly()

        engine.dispose()
        return True

    except Exception as e:
        logger.error(f"Error running migrations: {str(e)}", exc_info=True)
        raise


def initialize_database():
    """
    Main initialization function for database setup

    Steps:
    1. Creates database if it doesn't exist
    2. Creates all tables from SQLAlchemy models
    3. Sets up alembic_version table for compatibility

    Note: Document seeding is handled separately in main.py lifespan
    """
    try:
        logger.info("=" * 60)
        logger.info("Starting database initialization...")
        logger.info("=" * 60)

        # Step 1: Create database if it doesn't exist
        create_database_if_not_exists()

        # Step 2: Create database schema (tables, indexes, etc.)
        run_migrations()

        logger.info("=" * 60)
        logger.info("Database initialization completed successfully!")
        logger.info("=" * 60)

        return True

    except Exception as e:
        logger.error("=" * 60)
        logger.error("Database initialization FAILED!")
        logger.error("=" * 60)
        logger.error(f"Error: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    """
    Allow running this script directly for manual database initialization
    (Primarily for development/testing - production uses main.py lifespan)
    """
    # Setup basic logging if not already configured
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logger.info("Running database initialization script...")

    try:
        initialize_database()
        logger.info("✓ Database initialization successful!")
        sys.exit(0)
    except Exception as e:
        logger.error(f"✗ Database initialization failed: {str(e)}")
        sys.exit(1)
