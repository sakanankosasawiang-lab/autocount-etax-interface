import sqlite3
import os
import shutil
import json
from datetime import datetime

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "autocount_interface.db")
is_vercel = bool(os.environ.get("VERCEL"))

if is_vercel:
    DB_PATH = "/tmp/autocount_interface.db"
    if not os.path.exists(DB_PATH) and os.path.exists(DEFAULT_DB_PATH):
        try:
            shutil.copy2(DEFAULT_DB_PATH, DB_PATH)
        except Exception as e:
            print("Could not copy default DB to /tmp:", e)
else:
    DB_PATH = DEFAULT_DB_PATH

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # System Config Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Interface Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interface_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT,
        doc_no TEXT,
        doc_type TEXT,
        doc_date TEXT,
        debtor_code TEXT,
        debtor_name TEXT,
        debtor_tax_id TEXT,
        debtor_branch TEXT,
        total_amount REAL,
        tax_amount REAL,
        net_amount REAL,
        status TEXT,
        error_code TEXT,
        error_message TEXT,
        validation_details TEXT,
        request_payload TEXT,
        response_payload TEXT,
        autocount_doc_guid TEXT,
        etax_uuid TEXT,
        interface_duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Debtors Master Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS debtors_master (
        debtor_code TEXT PRIMARY KEY,
        debtor_name TEXT,
        tax_id TEXT,
        registration_type TEXT,
        country_code TEXT,
        branch_code TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        is_etax_ready INTEGER,
        missing_fields TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Insert default configs if not exists
    default_configs = [
        ("developer_id", "Piyarathl@gmail.com", "AutoCount Registered Developer ID"),
        ("developer_password", "X#f04vj7Ku3", "AutoCount Developer Password"),
        ("api_endpoint", "https://accounting-api.autocountcloud.com", "AutoCount API Base Endpoint"),
        ("account_book_id", "ACC-TH-EUROFINS-01", "AutoCount Account Book / Database ID"),
        ("company_name", "Eurofins Food Testing (Thailand) Co., Ltd.", "Company Name"),
        ("company_tax_id", "0105557088921", "Company Tax Identification Number"),
        ("company_branch", "00000", "Company Branch Code"),
        ("sync_interval_mins", "15", "Automatic Sync Interval (Minutes)"),
        ("auto_sync_enabled", "true", "Enable Background Auto-Sync"),
        ("inbound_dir", os.path.join(os.path.dirname(os.path.dirname(__file__)), "inbound"), "Inbound Folder Path (.pdf & .txt)"),
        ("outbound_dir", os.path.join(os.path.dirname(os.path.dirname(__file__)), "outbound"), "Outbound Folder Path (.pdf & .xml)")
    ]

    for key, val, desc in default_configs:
        cursor.execute("""
        INSERT OR IGNORE INTO system_config (key, value, description)
        VALUES (?, ?, ?)
        """, (key, val, desc))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
