#!/usr/bin/env python3
"""
Cuenta total de contactos únicos entre VCF + CSV, deduplicando automáticamente.
"""

import csv
import re

VCF_PATH = "/Users/philippesaint-hubert/Downloads/Javi Pintor Timo y 2199.vcf"
DB_PATH = "/Users/philippesaint-hubert/Eventos-Barcelona/Contactos a clasificar - Contactos.csv"


def normalize_phone(phone):
    if not phone:
        return ""
    digits = re.sub(r'[^\d]', '', str(phone))
    if digits.startswith('34') and len(digits) > 9:
        digits = digits[2:]
    return digits


def normalize_name(name):
    if not name:
        return ""
    n = name.lower().strip()
    for old, new in {'á':'a','é':'e','í':'i','ó':'o','ú':'u','à':'a','è':'e',
                      'ì':'i','ò':'o','ù':'u','ä':'a','ë':'e','ï':'i','ö':'o',
                      'ü':'u','ñ':'n','ç':'c'}.items():
        n = n.replace(old, new)
    return re.sub(r'\s+', ' ', n).strip()


def parse_vcf(path):
    contacts = []
    current = {}
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if line == 'BEGIN:VCARD':
                current = {}
            elif line == 'END:VCARD':
                if current.get('name'):
                    contacts.append(current)
                current = {}
            elif line.startswith('FN:'):
                current['name'] = line[3:].strip()
            elif 'TEL' in line and ':' in line:
                phone = line.split(':', 1)[1].strip()
                if phone and 'phone' not in current:
                    current['phone'] = phone
            elif line.startswith('EMAIL') and ':' in line:
                current['email'] = line.split(':', 1)[1].strip()
    return contacts


def main():
    # Parse
    vcf = parse_vcf(VCF_PATH)
    db = []
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            db.append(row)

    print(f"VCF bruto: {len(vcf)}")
    print(f"CSV bruto: {len(db)}")
    print(f"Suma bruta: {len(vcf) + len(db)}")

    # Deduplicate using email + phone + normalized name as keys
    seen_emails = set()
    seen_phones = set()
    seen_names = set()
    unique_contacts = []

    # First pass: CSV (tiene más data)
    for c in db:
        email = c.get('Email', '').lower().strip()
        phone = normalize_phone(c.get('Teléfono', ''))
        name = normalize_name(c.get('Nombre', ''))

        is_dup = False
        if email and email in seen_emails:
            is_dup = True
        if phone and len(phone) >= 6 and phone in seen_phones:
            is_dup = True

        if not is_dup:
            unique_contacts.append({'source': 'CSV', 'name': c.get('Nombre', ''), 'email': email, 'phone': phone})
            if email:
                seen_emails.add(email)
            if phone and len(phone) >= 6:
                seen_phones.add(phone)
            if name:
                seen_names.add(name)

    csv_unique = len(unique_contacts)

    # Second pass: VCF (add only if not already in CSV)
    vcf_added = 0
    vcf_dup = 0
    for v in vcf:
        email = v.get('email', '').lower().strip() if v.get('email') else ''
        phone = normalize_phone(v.get('phone', ''))
        name = normalize_name(v.get('name', ''))

        is_dup = False
        if email and email in seen_emails:
            is_dup = True
        if phone and len(phone) >= 6 and phone in seen_phones:
            is_dup = True
        if not is_dup and name and name in seen_names:
            is_dup = True

        if not is_dup:
            unique_contacts.append({'source': 'VCF', 'name': v.get('name', ''), 'email': email, 'phone': phone})
            if email:
                seen_emails.add(email)
            if phone and len(phone) >= 6:
                seen_phones.add(phone)
            if name:
                seen_names.add(name)
            vcf_added += 1
        else:
            vcf_dup += 1

    print(f"\n{'='*50}")
    print(f"DEDUPLICACIÓN")
    print(f"{'='*50}")
    print(f"CSV únicos (después de dedup interno): {csv_unique}")
    print(f"  (eliminados {len(db) - csv_unique} duplicados internos)")
    print(f"VCF nuevos (no estaban en CSV):        {vcf_added}")
    print(f"VCF duplicados (ya en CSV):            {vcf_dup}")
    print(f"{'='*50}")
    print(f"TOTAL CONTACTOS ÚNICOS:                {len(unique_contacts)}")
    print(f"{'='*50}")

    # Breakdown by source
    csv_count = sum(1 for c in unique_contacts if c['source'] == 'CSV')
    vcf_count = sum(1 for c in unique_contacts if c['source'] == 'VCF')
    with_email = sum(1 for c in unique_contacts if c['email'])
    with_phone = sum(1 for c in unique_contacts if c['phone'])
    with_both = sum(1 for c in unique_contacts if c['email'] and c['phone'])

    print(f"\nDesglose:")
    print(f"  Con email:              {with_email}")
    print(f"  Con teléfono:           {with_phone}")
    print(f"  Con ambos:              {with_both}")
    print(f"  Solo email (sin tel):   {with_email - with_both}")
    print(f"  Solo teléfono (sin em): {with_phone - with_both}")
    print(f"  Sin email ni teléfono:  {len(unique_contacts) - with_email - (with_phone - with_both)}")


if __name__ == '__main__':
    main()
