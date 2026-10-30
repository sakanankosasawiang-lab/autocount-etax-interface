#!/usr/bin/env python
"""
AutoCount Interface & e-Tax Hub - Standalone POC Execution Script
Tests interfacing documents into AutoCount Accounting using Developer ID credentials.
"""

import sys
import os
import json
import random
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import get_db, init_db
from autocount_client import AutoCountInterfaceEngine

def main():
    print("=" * 70)
    print("  AutoCount Accounting API & e-Tax Hub - Proof of Concept (POC)")
    print("=" * 70)

    # 1. Initialize DB and Load Config
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_config")
    cfg = {row["key"]: row["value"] for row in cursor.fetchall()}
    cursor.execute("SELECT * FROM debtors_master")
    debtors = [dict(r) for r in cursor.fetchall()]
    conn.close()

    dev_id = cfg.get("developer_id", "Piyarathl@gmail.com")
    dev_pwd = cfg.get("developer_password", "X#f04vj7Ku3")
    endpoint = cfg.get("api_endpoint", "https://accounting-api.autocountcloud.com")
    account_book = cfg.get("account_book_id", "ACC-TH-EUROFINS-01")
    outbound_dir = cfg.get("outbound_dir", os.path.join(os.path.dirname(__file__), "outbound"))

    print(f"\n[1] Initializing AutoCount Session:")
    print(f"    - Developer ID:    {dev_id}")
    print(f"    - Account Book ID: {account_book}")
    print(f"    - API Endpoint:    {endpoint}")

    engine = AutoCountInterfaceEngine(
        developer_id=dev_id,
        developer_password=dev_pwd,
        api_endpoint=endpoint,
        account_book_id=account_book
    )

    # 2. Test Connection
    conn_result = engine.test_connection()
    if conn_result["success"]:
        print(f"    -> [SUCCESS] {conn_result['message']}")
        print(f"    -> Server: {conn_result.get('server_version')} (Latency: {conn_result.get('duration_ms')}ms)")
    else:
        print(f"    -> [FAILED] {conn_result['message']}")
        sys.exit(1)

    # 3. Prepare Test Documents
    print(f"\n[2] Executing Batch Interface (Testing Slide 14 & AutoCount Rules):")
    batch_id = f"CLI-POC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    test_cases = [
        # Case 1: Valid Sales Invoice (Debtor 001) -> Expected: PASSED
        {
            "doc_no": f"INV-{datetime.now().strftime('%y%m%d')}-1001",
            "doc_type": "Sales Invoice",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-001"),
            "items": [{"item_code": "SRV-TEST", "description": "Chemical & Microbiological Testing", "qty": 1, "unit_price": 5000.0, "discount": 0.0}]
        },
        # Case 2: Valid Eurofins AR Invoice (Debtor 002) -> Expected: PASSED
        {
            "doc_no": f"INV-{datetime.now().strftime('%y%m%d')}-1002",
            "doc_type": "AR Invoice",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-002"),
            "items": [{"item_code": "LAB-ANL", "description": "Accredited Lab Certification ISO 17025", "qty": 2, "unit_price": 2500.0, "discount": 200.0}]
        },
        # Case 3: Missing Debtor Email (Debtor 006) -> Expected: FAILED (Rule E04)
        {
            "doc_no": f"INV-{datetime.now().strftime('%y%m%d')}-1003",
            "doc_type": "Sales Invoice",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-006"),
            "items": [{"item_code": "FOOD-CHK", "description": "Food Freshness Microbial Inspection", "qty": 1, "unit_price": 3200.0, "discount": 0.0}]
        },
        # Case 4: Invalid Phone Format (Debtor 007) -> Expected: FAILED (Rule H21,B10)
        {
            "doc_no": f"INV-{datetime.now().strftime('%y%m%d')}-1004",
            "doc_type": "Sales Invoice",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-007"),
            "items": [{"item_code": "GEN-SRV", "description": "Wholesale Batch Quality Screening", "qty": 1, "unit_price": 4000.0, "discount": 0.0}]
        },
        # Case 5: Credit Note without Reason Code -> Expected: FAILED (Rule E05)
        {
            "doc_no": f"CN-{datetime.now().strftime('%y%m%d')}-1005",
            "doc_type": "Credit Note",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "reason_code": None,  # Missing Reason Code!
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-001"),
            "items": [{"item_code": "ADJ-TEST", "description": "Credit Adjustment for Cancelled Test", "qty": 1, "unit_price": 1500.0, "discount": 0.0}]
        },
        # Case 6: Credit Note with Valid Reason Code (ETR04) -> Expected: PASSED
        {
            "doc_no": f"CN-{datetime.now().strftime('%y%m%d')}-1006",
            "doc_type": "Credit Note",
            "doc_date": datetime.now().strftime("%Y-%m-%d"),
            "reason_code": "ETR04",  # Valid Reason Code: Price Reduction/Defective Goods
            "debtor": next(d for d in debtors if d["debtor_code"] == "DB-003"),
            "items": [{"item_code": "ADJ-PETRO", "description": "Defective Sampling Price Reduction (ETR04)", "qty": 1, "unit_price": 2000.0, "discount": 0.0}]
        }
    ]

    results = []
    print(f"\n{'#':<3} | {'Doc No':<18} | {'Type':<14} | {'Customer':<28} | {'Amount':>10} | {'Status':<8} | {'Note'}")
    print("-" * 115)

    conn = get_db()
    cursor = conn.cursor()

    for idx, tc in enumerate(test_cases, 1):
        res = engine.execute_interface(tc, outbound_dir=outbound_dir)
        results.append(res)

        status_str = "PASSED" if res["status"] == "PASSED" else "FAILED"
        note = f"UUID: {res['etax_uuid']}" if res["status"] == "PASSED" else f"ERR: {res['error_code']} ({res['error_message'][:35]}...)"
        
        print(f"{idx:<3} | {res['doc_no']:<18} | {res['doc_type']:<14} | {res['debtor_name'][:26]:<28} | {res['total_amount']:>10.2f} | {status_str:<8} | {note}")

        # Save log to DB
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
    total_val = sum(r["total_amount"] for r in results if r["status"] == "PASSED")

    print("-" * 115)
    print(f"\n[3] POC Batch Summary:")
    print(f"    - Total Documents Processed: {len(results)}")
    print(f"    - Passed (Successfully Posted): {passed_count} ({passed_count/len(results)*100:.1f}%)")
    print(f"    - Failed (Validation Blocked):  {failed_count} ({failed_count/len(results)*100:.1f}%)")
    print(f"    - Total Value Interfaced:       ฿{total_val:,.2f}")
    print(f"    - Outbound XML Files Generated: {outbound_dir}")
    print("\n[INFO] You can view full logs and interactive dashboard in the Admin WebApp:")
    print("       Start webapp with: python start_server.py")
    print("       URL: http://localhost:8000\n")

if __name__ == "__main__":
    main()
