from __future__ import annotations

from copy import deepcopy
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


SOURCE = Path(
    "/Users/diginav/Downloads/"
    "DS_AIMS_AGR_001_Digital_Natives_Services_Agreement_v1_1.docx"
)
OUTPUT = Path(
    "/Users/diginav/Dev/Zinj/Tshelo/output/"
    "DS_AIMS_AGR_001_Digital_Natives_Services_Agreement_v1_1_supplier_responses.docx"
)

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
XML_NS = "http://www.w3.org/XML/1998/namespace"


def qn(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def register_namespaces(xml_bytes: bytes) -> None:
    for _, pair in ET.iterparse(BytesIO(xml_bytes), events=("start-ns",)):
        prefix, uri = pair
        ET.register_namespace(prefix, uri)


def element_text(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.iter(qn(W_NS, "t")))


def set_text(element: ET.Element, value: str) -> None:
    text_nodes = list(element.iter(qn(W_NS, "t")))
    if text_nodes:
        text_nodes[0].text = value
        text_nodes[0].set(qn(XML_NS, "space"), "preserve")
        for node in text_nodes[1:]:
            node.text = ""
        return

    paragraph = element.find(f".//{{{W_NS}}}p")
    if paragraph is None:
        paragraph = ET.SubElement(element, qn(W_NS, "p"))
    run = paragraph.find(qn(W_NS, "r"))
    if run is None:
        run = ET.SubElement(paragraph, qn(W_NS, "r"))
    text = ET.SubElement(run, qn(W_NS, "t"))
    text.set(qn(XML_NS, "space"), "preserve")
    text.text = value


def keep_with_next(paragraph: ET.Element) -> None:
    paragraph_properties = paragraph.find(qn(W_NS, "pPr"))
    if paragraph_properties is None:
        paragraph_properties = ET.Element(qn(W_NS, "pPr"))
        paragraph.insert(0, paragraph_properties)
    if paragraph_properties.find(qn(W_NS, "keepNext")) is None:
        insertion_index = 1 if paragraph_properties.find(qn(W_NS, "pStyle")) is not None else 0
        paragraph_properties.insert(insertion_index, ET.Element(qn(W_NS, "keepNext")))


def start_on_new_page(paragraph: ET.Element) -> None:
    paragraph_properties = paragraph.find(qn(W_NS, "pPr"))
    if paragraph_properties is None:
        paragraph_properties = ET.Element(qn(W_NS, "pPr"))
        paragraph.insert(0, paragraph_properties)
    if paragraph_properties.find(qn(W_NS, "pageBreakBefore")) is None:
        children = list(paragraph_properties)
        insertion_index = 0
        allowed_predecessors = {qn(W_NS, "pStyle"), qn(W_NS, "keepNext"), qn(W_NS, "keepLines")}
        for index, child in enumerate(children):
            if child.tag in allowed_predecessors:
                insertion_index = index + 1
        paragraph_properties.insert(insertion_index, ET.Element(qn(W_NS, "pageBreakBefore")))


def edit_document_xml(xml_bytes: bytes) -> bytes:
    register_namespaces(xml_bytes)
    root = ET.fromstring(xml_bytes)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        raise RuntimeError("The agreement does not contain a Word document body")

    background_updated = False
    data_position_updated = False
    fee_term_added = False
    ai_disclosure_updated = False
    annex_scope_updated = False
    annex_preexisting_updated = False
    annex_data_updated = False

    for paragraph in root.iter(qn(W_NS, "p")):
        text = element_text(paragraph)
        if text.startswith("The Supplier began providing development services to Data Sentinels"):
            set_text(
                paragraph,
                "The Supplier began providing general Tshelo development services to Data "
                "Sentinels on or around May 2026 under an informal arrangement agreed verbally "
                "and through messaging, email and Slack. Those initial services did not include "
                "development of the Tshelo AI receipt-scanning system. This agreement records in "
                "writing the terms on which the Services were and are provided. It is signed on "
                "the date shown in the signature block and governs the relationship from that "
                "date onward. Prior communications remain valid evidence of what was agreed; "
                "where they conflict with this agreement, this agreement prevails.",
            )
            background_updated = True
        elif text.startswith("Because personal information may have been processed during that informal period"):
            set_text(
                paragraph,
                "Before signature, the Supplier received no end-user personal information or "
                "receipt data. The only Data Sentinels information received was an API credential "
                "for the Anthropic Claude service. That credential is Confidential Information "
                "and is not User Data. Within 10 business days of signature, the Supplier will "
                "provide a written statement identifying where the credential is held and "
                "confirming deletion of any copy no longer required. Data Sentinels records the "
                "position under DS-AIMS-PRO-009.",
            )
            data_position_updated = True
        elif " ".join(text.split()) == "4. Confidentiality":
            keep_with_next(paragraph)
            start_on_new_page(paragraph)

    body_children = list(body)
    for index, child in enumerate(body_children):
        if child.tag != qn(W_NS, "p"):
            continue
        if element_text(child).startswith("Fees include consideration for all rights assigned under clause 5"):
            new_paragraph = deepcopy(child)
            new_paragraph.attrib.pop(qn(W14_NS, "paraId"), None)
            set_text(
                new_paragraph,
                "Data Sentinels will provide and pay for all Anthropic Claude Haiku API usage "
                "required by the System's receipt-scanning function. Those third-party API "
                "charges are Data Sentinels' responsibility and are not included in the Fees "
                "payable to the Supplier.",
            )
            body.insert(index + 1, new_paragraph)
            fee_term_added = True
            break

    for table in root.iter(qn(W_NS, "tbl")):
        table_text = element_text(table)
        if "Deliverable" in table_text and "Handover pack" in table_text:
            rows = table.findall(qn(W_NS, "tr"))
            if len(rows) < 2:
                raise RuntimeError("The Annex A scope table has no data row")
            header_row = next(
                (row for row in rows if element_text(row).strip().startswith("Deliverable")),
                None,
            )
            if header_row is None:
                raise RuntimeError("The Annex A scope table has no header row")
            data_rows = [row for row in rows if row is not header_row]
            template_row = data_rows[0]
            scope_rows = [
                (
                    "Receipt-image upload and storage",
                    "Users can upload a receipt image; the image is stored in the Data Sentinels-controlled Supabase receipt store and can be retrieved for review.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Claude Haiku extraction",
                    "The System sends the receipt image to Anthropic's Claude Haiku API and returns structured receipt data for review; unreadable or non-receipt images do not produce a committed extraction.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Mobile and web review and correction",
                    "Extracted fields are shown to the user on mobile and web and can be corrected before saving.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Saving corrected receipt data",
                    "Corrected receipt data is saved into Tshelo only after the user's review and confirmation.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Testing and bug fixing",
                    "Receipt-scanning flows are tested and defects identified during the agreed support and operating period are corrected.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Documentation, deployment scripts and handover",
                    "Documentation, deployment configuration and scripts, AI model/prompt/schema/configuration and handover materials are delivered under clause 11.",
                    "",
                    "Delivery Lead",
                ),
                (
                    "Scope boundary",
                    "Anything not involving the Tshelo AI receipt-scanning feature is outside scope, including unrelated fund or event-platform features, payment processing and unrelated enhancements.",
                    "",
                    "Delivery Lead",
                ),
            ]
            for offset, values in enumerate(scope_rows):
                new_row = deepcopy(template_row)
                cells = new_row.findall(qn(W_NS, "tc"))
                if len(cells) != 4:
                    raise RuntimeError("The Annex A scope table does not have four columns")
                for cell, value in zip(cells, values):
                    set_text(cell, value)
                scope_rows[offset] = new_row
            for row in list(table):
                if row.tag == qn(W_NS, "tr"):
                    table.remove(row)
            table.append(header_row)
            for row in scope_rows:
                table.append(row)
            for row in data_rows:
                table.append(row)
            annex_scope_updated = True
            continue

        if "Material" in table_text and "Owner and licence position" in table_text:
            rows = table.findall(qn(W_NS, "tr"))
            if len(rows) < 2:
                raise RuntimeError("The Annex A2 table has no data row")
            cells = rows[1].findall(qn(W_NS, "tc"))
            if len(cells) != 3:
                raise RuntimeError("The Annex A2 table does not have three columns")
            values = (
                "None",
                "No pre-existing Digital Natives material is embedded in or required to operate the System.",
                "N/A",
            )
            for cell, value in zip(cells, values):
                set_text(cell, value)
            annex_preexisting_updated = True
            continue

        if "Development data" in table_text and "Retention" in table_text:
            rows = table.findall(qn(W_NS, "tr"))
            for row in rows:
                cells = row.findall(qn(W_NS, "tc"))
                if not cells:
                    continue
                label = element_text(cells[0]).strip()
                if label == "Development data" and len(cells) >= 2:
                    set_text(
                        cells[1],
                        "Testing uses real receipts belonging to Digital Natives developers. "
                        "They are not Data Sentinels end-user receipts. Data Sentinels/legal "
                        "approval and the applicable retention position must be confirmed before "
                        "production use.",
                    )
                    annex_data_updated = True
            continue

        if "Tool / service" not in table_text or "User Data? (Y/N)" not in table_text:
            continue
        rows = table.findall(qn(W_NS, "tr"))
        if len(rows) < 4:
            raise RuntimeError("The Annex C3 disclosure table does not have three data rows")
        disclosure_rows = (
            ("Claude Haiku API", "Anthropic", "In the System - receipt image extraction", "Y"),
            ("Supabase", "Supabase", "In the System - receipt image storage", "Y"),
            ("Codex", "OpenAI", "Coding assistant - generating implementation code", "N"),
        )
        for row, values in zip(rows[1:4], disclosure_rows):
            cells = row.findall(qn(W_NS, "tc"))
            if len(cells) != 4:
                raise RuntimeError("The Annex C3 disclosure table does not have four columns")
            for cell, value in zip(cells, values):
                set_text(cell, value)
        ai_disclosure_updated = True

    checks = {
        "Section 1 background": background_updated,
        "Section 1 data position": data_position_updated,
        "Section 3 API fee term": fee_term_added,
        "Annex C3 AI disclosure": ai_disclosure_updated,
        "Annex A scope": annex_scope_updated,
        "Annex A2 pre-existing material": annex_preexisting_updated,
        "Annex B development data": annex_data_updated,
    }
    missing = [label for label, complete in checks.items() if not complete]
    if missing:
        raise RuntimeError("Required edits were not applied: " + ", ".join(missing))

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = OUTPUT.with_suffix(".tmp.docx")

    with ZipFile(SOURCE, "r") as source_zip:
        document_xml = source_zip.read("word/document.xml")
        updated_xml = edit_document_xml(document_xml)
        with ZipFile(temporary_output, "w") as output_zip:
            for info in source_zip.infolist():
                payload = updated_xml if info.filename == "word/document.xml" else source_zip.read(info.filename)
                output_zip.writestr(info, payload)

    with ZipFile(temporary_output, "r") as check_zip:
        ET.fromstring(check_zip.read("word/document.xml"))
        if check_zip.testzip() is not None:
            raise RuntimeError("The updated DOCX archive failed its integrity check")

    temporary_output.replace(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
