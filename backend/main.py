import os
import json
import uuid
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

try:
    from backend.database import get_db, init_db
    from backend.autocount_client import AutoCountInterfaceEngine, VALID_REASON_CODES
except ImportError:
    from database import get_db, init_db
    from autocount_client import AutoCountInterfaceEngine, VALID_REASON_CODES

app = FastAPI(title="AutoCount Interface & e-Tax Admin WebApp", version="2.0.0")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
is_vercel = bool(os.environ.get("VERCEL"))

if is_vercel:
    INBOUND_DIR = "/tmp/inbound"
    OUTBOUND_DIR = "/tmp/outbound"
else:
    INBOUND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "inbound")
    OUTBOUND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outbound")

os.makedirs(INBOUND_DIR, exist_ok=True)
os.makedirs(OUTBOUND_DIR, exist_ok=True)

# Ensure database is initialized
try:
    init_db()
except Exception as e:
    print("Database init note:", e)

def get_engine() -> AutoCountInterfaceEngine:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_config")
    cfg = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return AutoCountInterfaceEngine(
        developer_id=cfg.get("developer_id", "Piyarathl@gmail.com"),
        developer_password=cfg.get("developer_password", "X#f04vj7Ku3"),
        api_endpoint=cfg.get("api_endpoint", "https://accounting-api.autocountcloud.com"),
        account_book_id=cfg.get("account_book_id", "ACC-TH-EUROFINS-01")
    )

# --- Models ---
class ConfigUpdateModel(BaseModel):
    developer_id: str
    developer_password: Optional[str] = None
    api_endpoint: str
    account_book_id: str
    company_name: str
    company_tax_id: str
    company_branch: str
    sync_interval_mins: str
    auto_sync_enabled: str
    inbound_dir: Optional[str] = None
    outbound_dir: Optional[str] = None

class PocRunRequest(BaseModel):
    scenario: str = "MIXED"  # "STANDARD", "MIXED", "CREDIT_DEBIT_NOTE"
    count: int = 5

class SingleDocRequest(BaseModel):
    doc_no: Optional[str] = None
    doc_type: str = "Sales Invoice"
    doc_date: Optional[str] = None
    debtor_code: str
    reason_code: Optional[str] = None
    items: List[Dict[str, Any]]
    tax_rate: float = 7.0

# --- Endpoints ---

@app.get("/api/stats")
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    # Total counts
    cursor.execute("SELECT COUNT(*) as total FROM interface_logs")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as passed FROM interface_logs WHERE status = 'PASSED'")
    passed = cursor.fetchone()["passed"]

    cursor.execute("SELECT COUNT(*) as failed FROM interface_logs WHERE status = 'FAILED'")
    failed = cursor.fetchone()["failed"]

    cursor.execute("SELECT COUNT(*) as pending FROM interface_logs WHERE status = 'PENDING'")
    pending = cursor.fetchone()["pending"]

    pass_rate = round((passed / total * 100.0), 1) if total > 0 else 0.0

    # Today's counts
    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(*) as total FROM interface_logs WHERE doc_date = ?", (today_str,))
    today_total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as passed FROM interface_logs WHERE doc_date = ? AND status = 'PASSED'", (today_str,))
    today_passed = cursor.fetchone()["passed"]

    cursor.execute("SELECT COUNT(*) as failed FROM interface_logs WHERE doc_date = ? AND status = 'FAILED'", (today_str,))
    today_failed = cursor.fetchone()["failed"]

    cursor.execute("SELECT COUNT(*) as pending FROM interface_logs WHERE doc_date = ? AND status = 'PENDING'", (today_str,))
    today_pending = cursor.fetchone()["pending"]

    # Total Amount Interfaced
    cursor.execute("SELECT SUM(total_amount) as total_val FROM interface_logs WHERE status = 'PASSED'")
    val_row = cursor.fetchone()
    total_value = val_row["total_val"] or 0.0

    # Daily trends (last 7 days)
    cursor.execute("""
    SELECT doc_date,
           SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
    FROM interface_logs
    GROUP BY doc_date
    ORDER BY doc_date ASC
    LIMIT 14
    """)
    daily_rows = cursor.fetchall()
    daily_trends = [
        {"date": r["doc_date"], "passed": r["passed"], "failed": r["failed"], "pending": r["pending"]}
        for r in daily_rows
    ]

    # Type breakdown
    cursor.execute("""
    SELECT doc_type, COUNT(*) as count,
           SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed
    FROM interface_logs
    GROUP BY doc_type
    """)
    type_breakdown = [
        {"doc_type": r["doc_type"], "count": r["count"], "passed": r["passed"]}
        for r in cursor.fetchall()
    ]

    # Top Error Distribution
    cursor.execute("""
    SELECT error_code, error_message, COUNT(*) as count
    FROM interface_logs
    WHERE status = 'FAILED' AND error_code != ''
    GROUP BY error_code
    ORDER BY count DESC
    LIMIT 5
    """)
    top_errors = [
        {"code": r["error_code"], "message": r["error_message"].split(";")[0], "count": r["count"]}
        for r in cursor.fetchall()
    ]

    conn.close()
    return {
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pending": pending,
            "pass_rate": pass_rate,
            "total_value": round(total_value, 2)
        },
        "today": {
            "total": today_total,
            "passed": today_passed,
            "failed": today_failed,
            "pending": today_pending
        },
        "daily_trends": daily_trends,
        "type_breakdown": type_breakdown,
        "top_errors": top_errors
    }

@app.get("/api/logs")
def get_interface_logs(
    status: Optional[str] = Query("ALL"),
    doc_type: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100)
):
    conn = get_db()
    cursor = conn.cursor()

    conditions = []
    params = []

    if status and status != "ALL":
        conditions.append("status = ?")
        params.append(status)

    if doc_type and doc_type != "ALL":
        conditions.append("doc_type = ?")
        params.append(doc_type)

    if search:
        search_like = f"%{search}%"
        conditions.append("(doc_no LIKE ? OR debtor_name LIKE ? OR debtor_code LIKE ? OR error_message LIKE ?)")
        params.extend([search_like, search_like, search_like, search_like])

    if start_date:
        conditions.append("doc_date >= ?")
        params.append(start_date)

    if end_date:
        conditions.append("doc_date <= ?")
        params.append(end_date)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Count total matching rows
    cursor.execute(f"SELECT COUNT(*) as total FROM interface_logs {where_clause}", params)
    total_records = cursor.fetchone()["total"]

    # Fetch paginated rows
    offset = (page - 1) * page_size
    query = f"""
    SELECT id, batch_id, doc_no, doc_type, doc_date, debtor_code, debtor_name,
           debtor_tax_id, debtor_branch, total_amount, tax_amount, net_amount,
           status, error_code, error_message, autocount_doc_guid, etax_uuid,
           interface_duration_ms, created_at
    FROM interface_logs
    {where_clause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
    """
    params.extend([page_size, offset])
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "page": page,
        "page_size": page_size,
        "total_records": total_records,
        "total_pages": (total_records + page_size - 1) // page_size if total_records > 0 else 1,
        "items": rows
    }

@app.get("/api/logs/{log_id}")
def get_log_detail(log_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM interface_logs WHERE id = ?", (log_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Log entry not found")

    data = dict(row)
    data["validation_details"] = json.loads(data["validation_details"]) if data.get("validation_details") else []
    data["request_payload"] = json.loads(data["request_payload"]) if data.get("request_payload") else {}
    data["response_payload"] = json.loads(data["response_payload"]) if data.get("response_payload") else {}
    return data

@app.post("/api/interface/run-poc")
def run_poc_interface(req: PocRunRequest):
    """Executes a live POC Interface Batch into AutoCount"""
    conn = get_db()
    cursor = conn.cursor()

    # Get debtors
    cursor.execute("SELECT * FROM debtors_master")
    debtors = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if not debtors:
        raise HTTPException(status_code=400, detail="No debtors found. Please seed debtors first.")

    engine = get_engine()
    batch_id = f"POC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    results = []

    sample_items = [
        {"item_code": "LAB-ANL-01", "description": "Chemical Residue & Heavy Metal Laboratory Analysis", "qty": 1, "unit_price": 5500.0, "discount": 0.0},
        {"item_code": "LAB-MIC-02", "description": "Microbiological Pathogen Culture Detection", "qty": 2, "unit_price": 3800.0, "discount": 200.0},
        {"item_code": "DOC-CERT-03", "description": "Official ISO/IEC 17025 e-Tax Certified Analysis Report", "qty": 1, "unit_price": 1200.0, "discount": 0.0},
        {"item_code": "SAM-EXPR-04", "description": "Rapid Cold-Chain Specimen Logistics Fee", "qty": 1, "unit_price": 950.0, "discount": 0.0}
    ]

    import random
    count = min(max(req.count, 1), 20)

    for i in range(count):
        inv_no = f"POC-INV-{datetime.now().strftime('%y%m%d')}-{random.randint(1000, 9999)}"
        doc_date = datetime.now().strftime("%Y-%m-%d")
        
        if req.scenario == "STANDARD":
            # 100% valid scenario
            doc_type = "Sales Invoice"
            debtor = random.choice([d for d in debtors if d["is_etax_ready"] == 1])
            reason_code = None
        elif req.scenario == "CREDIT_DEBIT_NOTE":
            # CN/DN testing reason codes
            doc_type = random.choice(["Credit Note", "Debit Note"])
            debtor = random.choice(debtors[:5])
            # 50% valid reason, 50% missing reason to show validation
            reason_code = random.choice(["ETR01", "ETR04", "ETR05"]) if i % 2 == 0 else None
        else: # "MIXED"
            # Mixed scenarios: Valid, Missing Email, Invalid Phone H21, Missing Reason
            if i % 3 == 0:
                doc_type = "Sales Invoice"
                debtor = random.choice([d for d in debtors if d["is_etax_ready"] == 1])
                reason_code = None
            elif i % 3 == 1:
                doc_type = random.choice(["Credit Note", "Debit Note"])
                debtor = random.choice(debtors[:4])
                reason_code = None  # Will fail CN/DN reason code
            else:
                doc_type = "Sales Invoice"
                debtor = random.choice([d for d in debtors if d["is_etax_ready"] == 0] or debtors)
                reason_code = None

        doc = {
            "doc_no": inv_no,
            "doc_type": doc_type,
            "doc_date": doc_date,
            "reason_code": reason_code,
            "debtor": debtor,
            "items": random.sample(sample_items, random.randint(1, 2)),
            "tax_rate": 7.0
        }

        res = engine.execute_interface(doc, outbound_dir=OUTBOUND_DIR)
        results.append(res)

        # Save to database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO interface_logs (
            batch_id, doc_no, doc_type, doc_date, debtor_code, debtor_name,
            debtor_tax_id, debtor_branch, total_amount, tax_amount, net_amount,
            status, error_code, error_message, validation_details, request_payload,
            response_payload, autocount_doc_guid, etax_uuid, interface_duration_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            batch_id, res["doc_no"], res["doc_type"], res["doc_date"], res["debtor_code"], res["debtor_name"],
            res["debtor_tax_id"], res["debtor_branch"], res["total_amount"], res["tax_amount"], res["net_amount"],
            res["status"], res["error_code"], res["error_message"], json.dumps(res["validation_details"], ensure_ascii=False),
            json.dumps(res["request_payload"], ensure_ascii=False), json.dumps(res["response_payload"], ensure_ascii=False),
            res["autocount_doc_guid"], res["etax_uuid"], res["interface_duration_ms"], datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        conn.close()

    passed_count = sum(1 for r in results if r["status"] == "PASSED")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")

    return {
        "success": True,
        "batch_id": batch_id,
        "total_executed": len(results),
        "passed": passed_count,
        "failed": failed_count,
        "scenario": req.scenario,
        "items": results
    }

@app.post("/api/interface/retry/{log_id}")
def retry_interface_log(log_id: int):
    """Retries interfacing a document (e.g. after debtor update)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM interface_logs WHERE id = ?", (log_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Log entry not found")

    req_payload = json.loads(row["request_payload"])
    debtor_code = req_payload.get("debtor", {}).get("debtor_code")

    # Check if debtor in master has been updated
    if debtor_code:
        cursor.execute("SELECT * FROM debtors_master WHERE debtor_code = ?", (debtor_code,))
        latest_debtor = cursor.fetchone()
        if latest_debtor:
            req_payload["debtor"] = dict(latest_debtor)

    engine = get_engine()
    res = engine.execute_interface(req_payload, outbound_dir=OUTBOUND_DIR)

    # Update log entry
    cursor.execute("""
    UPDATE interface_logs
    SET status = ?, error_code = ?, error_message = ?, validation_details = ?,
        response_payload = ?, autocount_doc_guid = ?, etax_uuid = ?,
        interface_duration_ms = ?, created_at = ?
    WHERE id = ?
    """, (
        res["status"], res["error_code"], res["error_message"],
        json.dumps(res["validation_details"], ensure_ascii=False),
        json.dumps(res["response_payload"], ensure_ascii=False),
        res["autocount_doc_guid"], res["etax_uuid"], res["interface_duration_ms"],
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"), log_id
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "id": log_id,
        "doc_no": res["doc_no"],
        "new_status": res["status"],
        "error_message": res["error_message"],
        "result": res
    }

@app.get("/api/debtors")
def list_debtors():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM debtors_master ORDER BY debtor_code ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/debtors/{debtor_code}/fix")
def fix_debtor_master(debtor_code: str):
    """Quick-fix an incomplete debtor to make it compliant with AutoCount e-Tax rules"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM debtors_master WHERE debtor_code = ?", (debtor_code,))
    debtor = cursor.fetchone()
    if not debtor:
        conn.close()
        raise HTTPException(status_code=404, detail="Debtor not found")

    new_email = debtor["email"] or f"tax.{debtor_code.lower()}@autocount-sample.th"
    new_phone = "+66-29876543" if "INVALID" in (debtor["phone"] or "") or len(debtor["phone"] or "") > 30 else debtor["phone"]
    new_tax_id = "0105559876543" if len(debtor["tax_id"] or "") != 13 else debtor["tax_id"]

    cursor.execute("""
    UPDATE debtors_master
    SET email = ?, phone = ?, tax_id = ?, is_etax_ready = 1, missing_fields = 'None (Corrected)', updated_at = CURRENT_TIMESTAMP
    WHERE debtor_code = ?
    """, (new_email, new_phone, new_tax_id, debtor_code))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Debtor {debtor_code} updated successfully and marked as e-Tax compliant.",
        "updated": {
            "email": new_email,
            "phone": new_phone,
            "tax_id": new_tax_id
        }
    }

@app.get("/api/config")
def get_system_config():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value, description FROM system_config")
    rows = cursor.fetchall()
    conn.close()
    res = {r["key"]: r["value"] for r in rows}
    # Mask password for display
    if "developer_password" in res and res["developer_password"]:
        res["developer_password_masked"] = res["developer_password"][:2] + "********"
    return res

@app.post("/api/config")
def update_system_config(cfg: ConfigUpdateModel):
    conn = get_db()
    cursor = conn.cursor()
    
    updates = [
        ("developer_id", cfg.developer_id),
        ("api_endpoint", cfg.api_endpoint),
        ("account_book_id", cfg.account_book_id),
        ("company_name", cfg.company_name),
        ("company_tax_id", cfg.company_tax_id),
        ("company_branch", cfg.company_branch),
        ("sync_interval_mins", cfg.sync_interval_mins),
        ("auto_sync_enabled", cfg.auto_sync_enabled)
    ]
    if cfg.developer_password:
        updates.append(("developer_password", cfg.developer_password))
    if cfg.inbound_dir:
        updates.append(("inbound_dir", cfg.inbound_dir))
    if cfg.outbound_dir:
        updates.append(("outbound_dir", cfg.outbound_dir))

    for key, val in updates:
        cursor.execute("""
        INSERT INTO system_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
        """, (key, val, val))

    conn.commit()
    conn.close()
    return {"success": True, "message": "System configuration updated successfully"}

@app.post("/api/config/test-connection")
def test_connection():
    engine = get_engine()
    res = engine.test_connection()
    return res

# --- Serve Frontend ---
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

if os.path.exists(PUBLIC_DIR):
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")

@app.get("/")
def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "AutoCount Interface API Backend running"}

@app.get("/flex")
def serve_flex():
    flex_file = os.path.join(PUBLIC_DIR, "index.html")
    if os.path.exists(flex_file):
        return FileResponse(flex_file)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
