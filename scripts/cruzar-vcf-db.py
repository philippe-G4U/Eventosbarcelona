#!/usr/bin/env python3
"""
Cruza contactos del VCF de Xavi (móvil) con el CSV validado por Xavi.
- Normaliza teléfonos
- Cruza por teléfono y nombre
- Genera CSVs: matched, unmatched, y uno combinado para GHL
"""

import csv
import re
import os

VCF_PATH = "/Users/philippesaint-hubert/Downloads/Javi Pintor Timo y 2199.vcf"
DB_PATH = "/Users/philippesaint-hubert/Eventos-Barcelona/Contactos a clasificar - Contactos.csv"
OUTPUT_DIR = "/Users/philippesaint-hubert/Eventos-Barcelona/data"


def normalize_phone(phone):
    if not phone:
        return ""
    digits = re.sub(r'[^\d]', '', str(phone))
    if digits.startswith('34') and len(digits) > 9:
        digits = digits[2:]
    if digits.startswith('0') and len(digits) > 9:
        digits = digits[1:]
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


def name_tokens(name):
    n = normalize_name(name)
    noise = {'dj','mago','mag','info','admin','correo','eventos','barcelona',
             'bcn','band','music','productions','events','booking','comercial',
             'ventas','administracion','factures','gmail','hotmail','yahoo',
             'the','de','del','la','el','los','las','y','i','a'}
    return set(n.split()) - noise


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


def parse_db(path):
    contacts = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            contacts.append(row)
    return contacts


def format_phone_ghl(digits):
    """Format normalized digits as +34XXXXXXXXX for GHL."""
    if not digits:
        return ""
    if len(digits) == 9:  # Spanish number without prefix
        return f"+34{digits}"
    elif len(digits) > 9:
        return f"+{digits}"
    return digits


def main():
    print("Parseando VCF...")
    vcf_contacts = parse_vcf(VCF_PATH)
    print(f"  → {len(vcf_contacts)} contactos en VCF")

    print("Parseando CSV validado por Xavi...")
    db_contacts = parse_db(DB_PATH)
    db_marked = [c for c in db_contacts if c.get('Subir (X)', '').strip().lower() == 'x']
    print(f"  → {len(db_contacts)} contactos total en CSV")
    print(f"  → {len(db_marked)} marcados con X para subir")

    # Build indexes from ALL DB contacts (not just marked)
    phone_index = {}
    name_index = {}
    email_index = {}

    for c in db_contacts:
        phone = normalize_phone(c.get('Teléfono', ''))
        if phone and len(phone) >= 6:
            phone_index[phone] = c
        name = normalize_name(c.get('Nombre', ''))
        if name:
            name_index[name] = c
        email = c.get('Email', '').lower().strip()
        if email:
            email_index[email] = c

    print(f"  → Índices: {len(phone_index)} tel, {len(name_index)} nombres, {len(email_index)} emails")

    # Cross-reference VCF against DB
    matched = []
    unmatched = []
    stats = {'phone': 0, 'name_exact': 0, 'name_fuzzy': 0, 'none': 0}

    for vc in vcf_contacts:
        vcf_phone = normalize_phone(vc.get('phone', ''))
        vcf_name_norm = normalize_name(vc.get('name', ''))
        match = None
        match_type = 'none'

        # 1. Phone match
        if vcf_phone and len(vcf_phone) >= 6 and vcf_phone in phone_index:
            match = phone_index[vcf_phone]
            match_type = 'phone'

        # 2. Exact name match
        if not match and vcf_name_norm and vcf_name_norm in name_index:
            match = name_index[vcf_name_norm]
            match_type = 'name_exact'

        # 3. Fuzzy name match (token overlap)
        if not match and vcf_name_norm:
            vcf_tokens = name_tokens(vc.get('name', ''))
            if len(vcf_tokens) >= 1:
                best_score = 0
                best_match = None
                for db_c in db_contacts:
                    db_tokens = name_tokens(db_c.get('Nombre', ''))
                    if not db_tokens:
                        continue
                    overlap = vcf_tokens & db_tokens
                    min_t = min(len(vcf_tokens), len(db_tokens))
                    if len(overlap) >= 2 or (len(overlap) == 1 and min_t == 1 and len(list(overlap)[0]) > 4):
                        score = len(overlap) / max(len(vcf_tokens), len(db_tokens))
                        if score > best_score and score >= 0.5:
                            best_score = score
                            best_match = db_c
                if best_match:
                    match = best_match
                    match_type = 'name_fuzzy'

        stats[match_type] += 1
        is_marked = match and match.get('Subir (X)', '').strip().lower() == 'x'

        if match:
            matched.append({
                'vcf_name': vc.get('name', ''),
                'vcf_phone': vc.get('phone', ''),
                'vcf_phone_norm': vcf_phone,
                'db_nombre': match.get('Nombre', ''),
                'db_email': match.get('Email', ''),
                'db_telefono': match.get('Teléfono', ''),
                'db_categoria': match.get('Categoría (auto)', ''),
                'db_tipo': match.get('Tipo (Cliente/Artista/Proveedor)', ''),
                'db_temperatura': match.get('Temperatura', ''),
                'db_actividad': match.get('Actividad artista', ''),
                'db_conversaciones': match.get('Conversaciones', ''),
                'db_ultimo_ano': match.get('Último año', ''),
                'db_origen': match.get('Origen', ''),
                'db_origen2': match.get('Origen 2', ''),
                'match_type': match_type,
                'validado_xavi': 'SI' if is_marked else 'NO',
            })
        else:
            unmatched.append({
                'vcf_name': vc.get('name', ''),
                'vcf_phone': vc.get('phone', ''),
                'vcf_phone_norm': vcf_phone,
                'vcf_email': vc.get('email', ''),
            })

    # ── Results ──
    print(f"\n{'='*50}")
    print(f"RESULTADOS DEL CRUCE")
    print(f"{'='*50}")
    print(f"  Match por teléfono:      {stats['phone']}")
    print(f"  Match por nombre exacto: {stats['name_exact']}")
    print(f"  Match por nombre fuzzy:  {stats['name_fuzzy']}")
    print(f"  Sin match:               {stats['none']}")
    print(f"  ─────────────────────────")
    print(f"  TOTAL matched:           {len(matched)}")
    print(f"  TOTAL sin match:         {len(unmatched)}")

    validated = sum(1 for m in matched if m['validado_xavi'] == 'SI')
    print(f"\n  De los matched:")
    print(f"    Validados por Xavi (X): {validated}")
    print(f"    No marcados:            {len(matched) - validated}")

    # ── Write CSVs ──
    # 1. Matched
    matched_path = os.path.join(OUTPUT_DIR, 'vcf-cruce-matched.csv')
    fields_m = ['vcf_name','vcf_phone','vcf_phone_norm','db_nombre','db_email',
                'db_telefono','db_categoria','db_tipo','db_temperatura','db_actividad',
                'db_conversaciones','db_ultimo_ano','db_origen','db_origen2',
                'match_type','validado_xavi']
    with open(matched_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields_m)
        w.writeheader()
        w.writerows(matched)
    print(f"\n✓ Matched → {matched_path}")

    # 2. Unmatched
    unmatched_path = os.path.join(OUTPUT_DIR, 'vcf-cruce-unmatched.csv')
    fields_u = ['vcf_name','vcf_phone','vcf_phone_norm','vcf_email']
    with open(unmatched_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields_u)
        w.writeheader()
        w.writerows(unmatched)
    print(f"✓ Sin match → {unmatched_path}")

    # 3. Combined GHL-ready import (only validated + has phone)
    ghl_path = os.path.join(OUTPUT_DIR, 'vcf-ghl-import-final.csv')
    ghl_fields = ['Nombre','Email','Teléfono','Categoría','Tipo',
                  'Temperatura','Actividad','Origen','Match','Validado Xavi']
    with open(ghl_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=ghl_fields)
        w.writeheader()
        # Matched contacts
        for m in matched:
            phone = format_phone_ghl(m['vcf_phone_norm'])
            w.writerow({
                'Nombre': m['db_nombre'] or m['vcf_name'],
                'Email': m['db_email'],
                'Teléfono': phone,
                'Categoría': m['db_categoria'],
                'Tipo': m['db_tipo'],
                'Temperatura': m['db_temperatura'],
                'Actividad': m['db_actividad'],
                'Origen': f"VCF+Email ({m['db_origen']})" if m['db_origen'] else 'VCF+DB',
                'Match': m['match_type'],
                'Validado Xavi': m['validado_xavi'],
            })
        # Unmatched contacts (solo VCF)
        for u in unmatched:
            phone = format_phone_ghl(u['vcf_phone_norm'])
            w.writerow({
                'Nombre': u['vcf_name'],
                'Email': u.get('vcf_email', ''),
                'Teléfono': phone,
                'Categoría': '',
                'Tipo': '',
                'Temperatura': '',
                'Actividad': '',
                'Origen': 'Solo VCF móvil',
                'Match': 'ninguno',
                'Validado Xavi': 'NO',
            })
    print(f"✓ GHL import → {ghl_path}")

    # Show examples
    print(f"\n── Ejemplos de matches por TELÉFONO ──")
    phone_matches = [m for m in matched if m['match_type'] == 'phone']
    for m in phone_matches[:10]:
        print(f"  VCF: {m['vcf_name']:<30} Tel: {m['vcf_phone']:<15} → DB: {m['db_nombre']:<30} [{m['db_categoria']}]")

    print(f"\n── Ejemplos de matches por NOMBRE ──")
    name_matches = [m for m in matched if 'name' in m['match_type']]
    for m in name_matches[:10]:
        print(f"  VCF: {m['vcf_name']:<30} → DB: {m['db_nombre']:<30} [{m['match_type']}]")

    print(f"\n── Primeros 30 sin match ──")
    for u in unmatched[:30]:
        print(f"  {u['vcf_name']:<40} Tel: {u['vcf_phone']}")


if __name__ == '__main__':
    main()
