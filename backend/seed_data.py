import json
import uuid
import random
from datetime import datetime, timedelta
from database import get_db, init_db
from autocount_client import AutoCountInterfaceEngine

DEBTORS = [
    {
        "debtor_code": "DB-001",
        "debtor_name": "Siam Commercial Distribution Co., Ltd.",
        "tax_id": "0105551029384",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00000",
        "email": "finance@scdist.co.th",
        "phone": "+66-22345678",
        "address": "88/1 Sukhumvit Rd, Khlong Toei, Bangkok 10110",
        "is_etax_ready": 1,
        "missing_fields": "None"
    },
    {
        "debtor_code": "DB-002",
        "debtor_name": "Eurofins Scientific Testing (Thailand)",
        "tax_id": "0105558091234",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00001",
        "email": "ap-thailand@eurofins.com",
        "phone": "+66-26789012",
        "address": "159 Serm-Mit Tower, Asoke, Bangkok 10110",
        "is_etax_ready": 1,
        "missing_fields": "None"
    },
    {
        "debtor_code": "DB-003",
        "debtor_name": "Apex Petrochemical Public Co., Ltd.",
        "tax_id": "0107559001827",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00000",
        "email": "invoice.tax@apexpetro.th",
        "phone": "+66-28901234",
        "address": "123 Vibhavadi Rangsit Rd, Chatuchak, Bangkok 10900",
        "is_etax_ready": 1,
        "missing_fields": "None"
    },
    {
        "debtor_code": "DB-004",
        "debtor_name": "Boonrawd Agri-Logistics Partnership",
        "tax_id": "0103554098172",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00002",
        "email": "account@boonrawdagri.com",
        "phone": "+66-23456789",
        "address": "45 Bangna-Trad Km.12, Samut Prakan 10540",
        "is_etax_ready": 1,
        "missing_fields": "None"
    },
    {
        "debtor_code": "DB-005",
        "debtor_name": "นายสมชาย ประเสริฐยิ่ง (Somchai Trading)",
        "tax_id": "3100500987654",
        "registration_type": "02",
        "country_code": "TH",
        "branch_code": "00000",
        "email": "somchai.prs@gmail.com",
        "phone": "+66-812345678",
        "address": "12/4 Phahonyothin Rd, Phayathai, Bangkok 10400",
        "is_etax_ready": 1,
        "missing_fields": "None"
    },
    {
        "debtor_code": "DB-006",
        "debtor_name": "Bangkok Fresh Food Mart Co., Ltd.",
        "tax_id": "0105556012876",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00000",
        "email": "",  # Missing Email!
        "phone": "+66-24567890",
        "address": "90 Charoen Krung Rd, Bang Kho Laem, Bangkok 10120",
        "is_etax_ready": 0,
        "missing_fields": "Email address missing in Debtor Maintenance"
    },
    {
        "debtor_code": "DB-007",
        "debtor_name": "Mega Wholesale Hub Co., Ltd.",
        "tax_id": "0105557023910",
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00003",
        "email": "tax@megawholesale.co.th",
        "phone": "+66(0)2-999-999-EXT#889-INVALID-PHONE-EXCEED-CHAR-LIMIT",  # Invalid Phone!
        "address": "77 Rama 9 Rd, Huai Khwang, Bangkok 10310",
        "is_etax_ready": 0,
        "missing_fields": "Phone number violates H21,B10 format rule (>30 chars or invalid characters)"
    },
    {
        "debtor_code": "DB-008",
        "debtor_name": "Quick Express Delivery Ltd.",
        "tax_id": "010555",  # Invalid short Tax ID!
        "registration_type": "01",
        "country_code": "TH",
        "branch_code": "00000",
        "email": "billing@quickexp.co.th",
        "phone": "+66-27890123",
        "address": "33/2 Phetchaburi Rd, Ratchathewi, Bangkok 10400",
        "is_etax_ready": 0,
        "missing_fields": "Tax ID must be exactly 13 digits"
    }
]

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Clear existing data for fresh demo seed
    cursor.execute("DELETE FROM debtors_master")
    cursor.execute("DELETE FROM interface_logs")

    # Insert Debtors
    for d in DEBTORS:
        cursor.execute("""
        INSERT INTO debtors_master (debtor_code, debtor_name, tax_id, registration_type, country_code, branch_code, email, phone, address, is_etax_ready, missing_fields)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            d["debtor_code"], d["debtor_name"], d["tax_id"], d["registration_type"],
            d["country_code"], d["branch_code"], d["email"], d["phone"], d["address"],
            d["is_etax_ready"], d["missing_fields"]
        ))

    # Initialize Engine
    engine = AutoCountInterfaceEngine(
        developer_id="Piyarathl@gmail.com",
        developer_password="X#f04vj7Ku3",
        api_endpoint="https://accounting-api.autocountcloud.com",
        account_book_id="ACC-TH-EUROFINS-01"
    )

    # Generate realistic historical batches over the last 7 days
    now = datetime.now()
    batch_counter = 101

    sample_items = [
        {"item_code": "SRV-TEST-001", "description": "Chemical & Microbiological Testing Service", "qty": 1, "unit_price": 4500.0, "discount": 0.0},
        {"item_code": "SRV-INSP-002", "description": "Food Quality & Safety Inspection Fee", "qty": 2, "unit_price": 3200.0, "discount": 400.0},
        {"item_code": "LAB-REPT-003", "description": "Accredited Laboratory Certificate & Audit Report", "qty": 1, "unit_price": 1800.0, "discount": 0.0},
        {"item_code": "CONS-ENV-004", "description": "Environmental Sampling & Analysis Consultation", "qty": 3, "unit_price": 2500.0, "discount": 500.0},
        {"item_code": "EXP-EXPR-005", "description": "Express Sample Courier & Handling Charge", "qty": 1, "unit_price": 850.0, "discount": 0.0}
    ]

    for days_ago in range(6, -1, -1):
        target_date = now - timedelta(days=days_ago)
        batch_id = f"BATCH-{target_date.strftime('%Y%m%d')}-{batch_counter}"
        batch_counter += 1

        # Generate 4-8 documents per day
        doc_count = random.randint(5, 9)
        for i in range(doc_count):
            inv_num = f"INV-26{target_date.strftime('%m%d')}-{random.randint(1000, 9999)}"
            doc_type = random.choice(["Sales Invoice", "Sales Invoice", "Sales Invoice", "AR Invoice", "Credit Note", "Debit Note"])
            
            # Select debtor: 75% valid debtors, 25% problematic debtors
            if random.random() < 0.75:
                debtor = random.choice(DEBTORS[:5])  # Valid debtors
            else:
                debtor = random.choice(DEBTORS[5:])  # Debtors with issues

            # For Credit Note / Debit Note, randomly supply or omit Reason Code to show validation
            reason_code = None
            if doc_type in ["Credit Note", "Debit Note"]:
                if random.random() < 0.6:
                    reason_code = random.choice(["ETR01", "ETR02", "ETR04", "ETR05"])
                else:
                    reason_code = None  # Will fail Rule E05

            items = random.sample(sample_items, random.randint(1, 3))
            doc = {
                "doc_no": inv_num,
                "doc_type": doc_type,
                "doc_date": target_date.strftime("%Y-%m-%d"),
                "reason_code": reason_code,
                "debtor": debtor,
                "items": items,
                "tax_rate": 7.0
            }

            # 5% chance of keeping a record as PENDING in today's batch
            if days_ago == 0 and random.random() < 0.2:
                # Calculate amounts
                subtotal = sum(float(it["qty"]) * float(it["unit_price"]) - float(it["discount"]) for it in items)
                tax_amt = round(subtotal * 0.07, 2)
                tot_amt = round(subtotal + tax_amt, 2)
                
                cursor.execute("""
                INSERT INTO interface_logs (
                    batch_id, doc_no, doc_type, doc_date, debtor_code, debtor_name,
                    debtor_tax_id, debtor_branch, total_amount, tax_amount, net_amount,
                    status, error_code, error_message, validation_details, request_payload,
                    response_payload, autocount_doc_guid, etax_uuid, interface_duration_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id, inv_num, doc_type, target_date.strftime("%Y-%m-%d"), debtor["debtor_code"], debtor["debtor_name"],
                    debtor["tax_id"], debtor["branch_code"], tot_amt, tax_amt, subtotal,
                    "PENDING", "", "Inbound file received. Waiting for scheduled AutoCount batch sweep.", json.dumps([]),
                    json.dumps(doc, ensure_ascii=False), json.dumps({"status": "Queued in Inbound folder"}),
                    None, None, 0, (target_date + timedelta(hours=random.randint(8, 18), minutes=random.randint(1, 59))).strftime("%Y-%m-%d %H:%M:%S")
                ))
            else:
                result = engine.execute_interface(doc)
                created_ts = (target_date + timedelta(hours=random.randint(8, 18), minutes=random.randint(1, 59))).strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute("""
                INSERT INTO interface_logs (
                    batch_id, doc_no, doc_type, doc_date, debtor_code, debtor_name,
                    debtor_tax_id, debtor_branch, total_amount, tax_amount, net_amount,
                    status, error_code, error_message, validation_details, request_payload,
                    response_payload, autocount_doc_guid, etax_uuid, interface_duration_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id, result["doc_no"], result["doc_type"], result["doc_date"], result["debtor_code"], result["debtor_name"],
                    result["debtor_tax_id"], result["debtor_branch"], result["total_amount"], result["tax_amount"], result["net_amount"],
                    result["status"], result["error_code"], result["error_message"], json.dumps(result["validation_details"], ensure_ascii=False),
                    json.dumps(result["request_payload"], ensure_ascii=False), json.dumps(result["response_payload"], ensure_ascii=False),
                    result["autocount_doc_guid"], result["etax_uuid"], result["interface_duration_ms"], created_ts
                ))

    conn.commit()
    conn.close()
    print("Database successfully seeded with realistic AutoCount debtors and interface logs.")

if __name__ == "__main__":
    seed_database()
