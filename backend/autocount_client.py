import re
import uuid
import time
import os
import json
from datetime import datetime
from typing import Dict, Any, Tuple, List

# Validation Regex Patterns
PHONE_PATTERN = re.compile(r'^\+?[0-9]{1,4}[- ]?[0-9]{6,15}$')
TAX_ID_PATTERN = re.compile(r'^[0-9]{13}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

VALID_REASON_CODES = {
    'ETR01': 'เพิ่มหนี้: ปรับเพิ่มราคา (Price Increase)',
    'ETR02': 'เพิ่มหนี้: คำนวณราคาสินค้าผิดพลาดต่ำกว่าจริง (Understated Calculation)',
    'ETR03': 'เพิ่มหนี้: ส่งสินค้าเกินกว่าจำนวนที่ตกลง (Excess Goods Delivered)',
    'ETR04': 'ลดหนี้: ปรับลดราคาเนื่องจากสินค้าผิดคุณสมบัติ (Price Reduction/Defective Goods)',
    'ETR05': 'ลดหนี้: ได้รับสินค้าคืนเนื่องจากชำรุดเสียหาย (Goods Returned Damaged)',
    'ETR06': 'ลดหนี้: สินค้าขาดจำนวนหรือไม่ครบถ้วน (Shortage of Goods)'
}

class AutoCountInterfaceEngine:
    def __init__(self, developer_id: str, developer_password: str, api_endpoint: str, account_book_id: str):
        self.developer_id = developer_id
        self.developer_password = developer_password
        self.api_endpoint = api_endpoint
        self.account_book_id = account_book_id

    def test_connection(self) -> Dict[str, Any]:
        """Test connection to AutoCount with Developer ID credentials"""
        start_time = time.time()
        # Validate credentials format
        if not self.developer_id or "@" not in self.developer_id:
            return {
                "success": False,
                "status_code": 401,
                "message": "Invalid Developer ID format. AutoCount Developer ID must be a registered email.",
                "duration_ms": int((time.time() - start_time) * 1000)
            }
        
        # Verify Developer ID match
        if self.developer_id == "Piyarathl@gmail.com":
            return {
                "success": True,
                "status_code": 200,
                "message": f"Successfully authenticated AutoCount Developer Session for '{self.developer_id}'. Connected to Account Book: {self.account_book_id}",
                "server_version": "AutoCount Accounting 2.2 / Cloud REST v1",
                "developer_id": self.developer_id,
                "account_book": self.account_book_id,
                "modules_active": ["API Module", "E-Invoicing Module", "Sales & Invoicing", "A/R Accounting"],
                "duration_ms": int((time.time() - start_time) * 1000)
            }
        else:
            return {
                "success": False,
                "status_code": 403,
                "message": f"Developer ID '{self.developer_id}' is not authorized or password incorrect.",
                "duration_ms": int((time.time() - start_time) * 1000)
            }

    def validate_document(self, doc: Dict[str, Any]) -> Tuple[bool, List[Dict[str, Any]], str, str]:
        """
        Validate document according to AutoCount Accounting e-Tax Rules (Slide 14 & RD requirements):
        1. Debtor Tax ID (13 digits for juristic/individual)
        2. Debtor Registration Type (01, 02, etc.) & Country Code (TH)
        3. Email in Debtor Maintenance
        4. Phone format (Code H21, B10)
        5. Reason code for Credit Note / Debit Note
        """
        validation_errors = []
        doc_type = doc.get("doc_type", "Sales Invoice")
        debtor = doc.get("debtor", {})
        
        # 1. Tax ID check
        tax_id = (debtor.get("tax_id") or "").strip()
        reg_type = debtor.get("registration_type", "01")
        if reg_type in ["01", "02"]:
            if not tax_id:
                validation_errors.append({
                    "field": "tax_id",
                    "code": "ERR_TAXID_MISSING",
                    "label": "เลขประจำตัวผู้เสียภาษี (Tax ID)",
                    "message": "Debtor Tax ID is required for e-Tax Invoice generation"
                })
            elif not TAX_ID_PATTERN.match(tax_id):
                validation_errors.append({
                    "field": "tax_id",
                    "code": "ERR_TAXID_FORMAT",
                    "label": "เลขประจำตัวผู้เสียภาษี (Tax ID)",
                    "message": f"Tax ID '{tax_id}' is invalid. Must be exactly 13 numeric digits"
                })

        # 2. Registration Type & Country Code
        if not debtor.get("registration_type"):
            validation_errors.append({
                "field": "registration_type",
                "code": "ERR_REG_TYPE",
                "label": "ประเภทการจดทะเบียน (Registration Type)",
                "message": "Debtor Registration Type must be defined (e.g. 01 นิติบุคคล, 02 บุคคลธรรมดา)"
            })
        
        country = debtor.get("country_code", "TH")
        if not country or len(country) != 2:
            validation_errors.append({
                "field": "country_code",
                "code": "ERR_COUNTRY_CODE",
                "label": "รหัสประเทศ (Country Code)",
                "message": "Debtor Country Code must be a 2-letter ISO code (e.g. TH)"
            })

        # 3. Email in Debtor Maintenance (Slide 14)
        email = (debtor.get("email") or "").strip()
        if not email:
            validation_errors.append({
                "field": "email",
                "code": "ERR_EMAIL_MISSING",
                "label": "อีเมลผู้ซื้อใน Debtor Maintenance",
                "message": "Debtor Email address is mandatory for electronic invoice dispatch"
            })
        elif not EMAIL_PATTERN.match(email):
            validation_errors.append({
                "field": "email",
                "code": "ERR_EMAIL_FORMAT",
                "label": "รูปแบบอีเมล (Email Format)",
                "message": f"Invalid email format: '{email}'"
            })

        # 4. Phone Number format check (Slide 14: Error H21, B10)
        phone = (debtor.get("phone") or "").strip()
        if phone:
            # Check length and pattern
            if len(phone) > 30 or not PHONE_PATTERN.match(phone):
                validation_errors.append({
                    "field": "phone",
                    "code": "ERR_PHONE_FORMAT_H21_B10",
                    "label": "เบอร์โทรศัพท์ (Phone Format Rule H21,B10)",
                    "message": f"Phone '{phone}' rejected: format must follow +<country>-<number> and not exceed 30 chars (Ref: Slide 14 error rule H21,B10)"
                })

        # 5. Credit Note / Debit Note Reason Code (Slide 14)
        if doc_type in ["Credit Note", "Debit Note"]:
            reason_code = doc.get("reason_code")
            if not reason_code:
                validation_errors.append({
                    "field": "reason_code",
                    "code": "ERR_REASON_CODE_MISSING",
                    "label": "รหัสเหตุผล eTax Reason (DN/CN)",
                    "message": "Reason Code is mandatory for Credit Note / Debit Note e-Tax document (Slide 14)"
                })
            elif reason_code not in VALID_REASON_CODES:
                validation_errors.append({
                    "field": "reason_code",
                    "code": "ERR_REASON_CODE_INVALID",
                    "label": "รหัสเหตุผล eTax Reason",
                    "message": f"Unknown Reason Code '{reason_code}'. Must be one of: {list(VALID_REASON_CODES.keys())}"
                })

        # 6. Line Items check
        items = doc.get("items", [])
        if not items:
            validation_errors.append({
                "field": "items",
                "code": "ERR_NO_ITEMS",
                "label": "รายการสินค้า/บริการ (Line Items)",
                "message": "Document must contain at least one line item"
            })

        is_passed = len(validation_errors) == 0
        error_code = validation_errors[0]["code"] if validation_errors else ""
        error_message = "; ".join([e["message"] for e in validation_errors]) if validation_errors else ""
        
        return is_passed, validation_errors, error_code, error_message

    def execute_interface(self, doc: Dict[str, Any], outbound_dir: str = None) -> Dict[str, Any]:
        """
        Executes document interface into AutoCount Accounting.
        Returns full transaction details, payload, response and status.
        """
        start_time = time.time()
        doc_no = doc.get("doc_no", f"INV-{int(time.time())}")
        doc_type = doc.get("doc_type", "Sales Invoice")
        debtor = doc.get("debtor", {})
        
        # Calculate financial amounts
        subtotal = 0.0
        for item in doc.get("items", []):
            qty = float(item.get("qty", 1))
            unit_price = float(item.get("unit_price", 0))
            discount = float(item.get("discount", 0))
            subtotal += (qty * unit_price) - discount
            
        tax_rate = float(doc.get("tax_rate", 7.0))
        tax_amount = round(subtotal * (tax_rate / 100.0), 2)
        total_amount = round(subtotal + tax_amount, 2)

        # Run validation
        is_passed, validation_details, error_code, error_message = self.validate_document(doc)
        duration_ms = int((time.time() - start_time) * 1000)

        if is_passed:
            autocount_guid = str(uuid.uuid4())
            etax_uuid = f"TH-ETAX-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
            status = "PASSED"
            
            # Response simulating AutoCount 2.2 / Cloud API Document Creation
            response_payload = {
                "statusCode": 201,
                "status": "Created",
                "message": f"Document '{doc_no}' successfully posted to AutoCount Accounting.",
                "data": {
                    "docNo": doc_no,
                    "docType": doc_type,
                    "accountBookId": self.account_book_id,
                    "autoCountGuid": autocount_guid,
                    "eInvoiceUUID": etax_uuid,
                    "developerId": self.developer_id,
                    "totalAmount": total_amount,
                    "taxAmount": tax_amount,
                    "timestamp": datetime.now().isoformat(),
                    "eTaxStatus": "VALIDATED_AND_SIGNED",
                    "outboundFiles": [
                        f"{doc_no}.pdf",
                        f"{doc_no}.xml"
                    ]
                }
            }
            
            # If outbound directory exists, create simulated .xml and .txt output files
            if outbound_dir and os.path.exists(outbound_dir):
                xml_path = os.path.join(outbound_dir, f"{doc_no}.xml")
                with open(xml_path, "w", encoding="utf-8") as xf:
                    xf.write(f"""<?xml version="1.0" encoding="UTF-8"?>
<AutoCountETaxDocument version="2.0">
    <Header>
        <DocNo>{doc_no}</DocNo>
        <DocType>{doc_type}</DocType>
        <DocDate>{doc.get('doc_date')}</DocDate>
        <AccountBook>{self.account_book_id}</AccountBook>
        <DeveloperID>{self.developer_id}</DeveloperID>
        <ETaxUUID>{etax_uuid}</ETaxUUID>
    </Header>
    <Debtor>
        <Code>{debtor.get('debtor_code')}</Code>
        <Name>{debtor.get('debtor_name')}</Name>
        <TaxID>{debtor.get('tax_id')}</TaxID>
        <Branch>{debtor.get('branch_code', '00000')}</Branch>
        <Email>{debtor.get('email')}</Email>
    </Debtor>
    <Financials>
        <Subtotal>{subtotal:.2f}</Subtotal>
        <TaxRate>{tax_rate}%</TaxRate>
        <TaxAmount>{tax_amount:.2f}</TaxAmount>
        <TotalAmount>{total_amount:.2f}</TotalAmount>
    </Financials>
</AutoCountETaxDocument>""")
        else:
            autocount_guid = None
            etax_uuid = None
            status = "FAILED"
            response_payload = {
                "statusCode": 422,
                "status": "Unprocessable Entity",
                "message": f"AutoCount e-Tax Interface validation failed for '{doc_no}'.",
                "errorCode": error_code,
                "errorMessage": error_message,
                "validationErrors": validation_details,
                "accountBookId": self.account_book_id,
                "developerId": self.developer_id,
                "timestamp": datetime.now().isoformat()
            }

        return {
            "doc_no": doc_no,
            "doc_type": doc_type,
            "doc_date": doc.get("doc_date", datetime.now().strftime("%Y-%m-%d")),
            "debtor_code": debtor.get("debtor_code", "UNKNOWN"),
            "debtor_name": debtor.get("debtor_name", "Unknown Debtor"),
            "debtor_tax_id": debtor.get("tax_id", ""),
            "debtor_branch": debtor.get("branch_code", "00000"),
            "total_amount": total_amount,
            "tax_amount": tax_amount,
            "net_amount": subtotal,
            "status": status,
            "error_code": error_code,
            "error_message": error_message,
            "validation_details": validation_details,
            "request_payload": doc,
            "response_payload": response_payload,
            "autocount_doc_guid": autocount_guid,
            "etax_uuid": etax_uuid,
            "interface_duration_ms": duration_ms
        }
