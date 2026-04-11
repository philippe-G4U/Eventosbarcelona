#!/usr/bin/env python3
"""
1. Identifica contactos del CSV que no tienen teléfono pero hay match en VCF → les agrega el teléfono
2. Identifica contactos con nombres muy parecidos (posibles duplicados)
3. Genera CSV enriquecido
"""

import csv
import re
import os
from difflib import SequenceMatcher

VCF_PATH = "/Users/philippesaint-hubert/Downloads/Javi Pintor Timo y 2199.vcf"
DB_PATH = "/Users/philippesaint-hubert/Eventos-Barcelona/Contactos a clasificar - Contactos.csv"
OUTPUT_DIR = "/Users/philippesaint-hubert/Eventos-Barcelona/data"


def normalize_phone(phone):
    if not phone:
        return ""
    digits = re.sub(r'[^\d]', '', str(phone))
    if digits.startswith('34') and len(digits) > 9:
        digits = digits[2:]
    return digits


def format_phone_ghl(digits):
    if not digits:
        return ""
    if len(digits) == 9:
        return f"+34{digits}"
    elif len(digits) > 9:
        return f"+{digits}"
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
             'the','de','del','la','el','los','las','y','i','a','via','rent'}
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


def main():
    # Parse both sources
    print("Parseando fuentes...")
    vcf_contacts = parse_vcf(VCF_PATH)
    print(f"  VCF: {len(vcf_contacts)} contactos")

    db_contacts = []
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            db_contacts.append(row)
    print(f"  CSV: {len(db_contacts)} contactos")

    # ═══════════════════════════════════════════════════════════════
    # PARTE 1: Enriquecer CSV con teléfonos del VCF
    # ═══════════════════════════════════════════════════════════════
    print("\n" + "="*60)
    print("PARTE 1: ENRIQUECER TELÉFONOS")
    print("="*60)

    # Build VCF indexes
    vcf_by_name = {}
    vcf_by_name_norm = {}
    for vc in vcf_contacts:
        n = normalize_name(vc.get('name', ''))
        if n:
            vcf_by_name_norm[n] = vc
            vcf_by_name[vc['name']] = vc

    enriched = []
    enriched_count = 0
    db_sin_tel = 0

    for db in db_contacts:
        db_name = db.get('Nombre', '')
        db_phone = db.get('Teléfono', '').strip()
        db_name_norm = normalize_name(db_name)
        telefono_nuevo = ''

        if not db_phone:
            db_sin_tel += 1

            # Try exact name match
            match = vcf_by_name_norm.get(db_name_norm)

            # Try fuzzy name match
            if not match:
                db_tokens = name_tokens(db_name)
                if db_tokens:
                    best_score = 0
                    for vc in vcf_contacts:
                        vc_tokens = name_tokens(vc.get('name', ''))
                        if not vc_tokens:
                            continue
                        overlap = db_tokens & vc_tokens
                        min_t = min(len(db_tokens), len(vc_tokens))
                        if len(overlap) >= 2 or (len(overlap) == 1 and min_t == 1 and len(list(overlap)[0]) > 4):
                            score = len(overlap) / max(len(db_tokens), len(vc_tokens))
                            if score > best_score and score >= 0.5:
                                best_score = score
                                match = vc

            if match and match.get('phone'):
                phone_norm = normalize_phone(match['phone'])
                telefono_nuevo = format_phone_ghl(phone_norm)
                enriched_count += 1

        enriched.append({
            **db,
            'Teléfono VCF': telefono_nuevo,
            'VCF Match Name': match.get('name', '') if not db_phone and match else '',
        })

    print(f"  Contactos CSV sin teléfono: {db_sin_tel}")
    print(f"  Enriquecidos con tel VCF:   {enriched_count}")

    # Show enrichments
    print(f"\n── Contactos enriquecidos con teléfono ──")
    enriched_list = [e for e in enriched if e['Teléfono VCF']]
    for e in enriched_list[:50]:
        xavi = '✓' if e.get('Subir (X)', '').strip().lower() == 'x' else ' '
        print(f"  [{xavi}] {e['Nombre']:<40} ← VCF: {e['VCF Match Name']:<35} Tel: {e['Teléfono VCF']}")

    # Write enriched CSV
    enrich_path = os.path.join(OUTPUT_DIR, 'csv-enriquecido-telefonos.csv')
    fields = list(db_contacts[0].keys()) + ['Teléfono VCF', 'VCF Match Name']
    with open(enrich_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(enriched)
    print(f"\n✓ CSV enriquecido → {enrich_path}")

    # ═══════════════════════════════════════════════════════════════
    # PARTE 2: Detectar duplicados por nombre similar
    # ═══════════════════════════════════════════════════════════════
    print("\n" + "="*60)
    print("PARTE 2: POSIBLES DUPLICADOS")
    print("="*60)

    # Check within CSV for similar names
    duplicates = []
    names_checked = set()

    for i, c1 in enumerate(db_contacts):
        n1 = normalize_name(c1.get('Nombre', ''))
        if not n1 or len(n1) < 3:
            continue
        t1 = name_tokens(c1.get('Nombre', ''))
        if not t1:
            continue

        for j, c2 in enumerate(db_contacts):
            if j <= i:
                continue
            n2 = normalize_name(c2.get('Nombre', ''))
            if not n2 or len(n2) < 3:
                continue

            pair_key = tuple(sorted([n1, n2]))
            if pair_key in names_checked:
                continue
            names_checked.add(pair_key)

            t2 = name_tokens(c2.get('Nombre', ''))
            if not t2:
                continue

            overlap = t1 & t2
            if len(overlap) >= 2:
                score = len(overlap) / max(len(t1), len(t2))
                if score >= 0.5:
                    # Also check sequence similarity
                    seq_score = SequenceMatcher(None, n1, n2).ratio()
                    if seq_score >= 0.5:
                        e1 = c1.get('Email', '')
                        e2 = c2.get('Email', '')
                        same_email = e1 and e2 and e1.lower() == e2.lower()
                        p1 = normalize_phone(c1.get('Teléfono', ''))
                        p2 = normalize_phone(c2.get('Teléfono', ''))
                        same_phone = p1 and p2 and p1 == p2
                        duplicates.append({
                            'Nombre 1': c1.get('Nombre', ''),
                            'Email 1': e1,
                            'Tel 1': c1.get('Teléfono', ''),
                            'Cat 1': c1.get('Categoría (auto)', ''),
                            'Convs 1': c1.get('Conversaciones', ''),
                            'Nombre 2': c2.get('Nombre', ''),
                            'Email 2': e2,
                            'Tel 2': c2.get('Teléfono', ''),
                            'Cat 2': c2.get('Categoría (auto)', ''),
                            'Convs 2': c2.get('Conversaciones', ''),
                            'Mismo email': 'SI' if same_email else '',
                            'Mismo tel': 'SI' if same_phone else '',
                            'Score': f"{seq_score:.2f}",
                        })

    # Also check VCF-to-VCF duplicates by phone
    vcf_phones = {}
    vcf_dupes = []
    for vc in vcf_contacts:
        p = normalize_phone(vc.get('phone', ''))
        if p and len(p) >= 6:
            if p in vcf_phones:
                vcf_dupes.append((vcf_phones[p], vc))
            else:
                vcf_phones[p] = vc

    print(f"  Posibles duplicados en CSV: {len(duplicates)}")
    print(f"  Teléfonos duplicados en VCF: {len(vcf_dupes)}")

    # Show duplicates
    if duplicates:
        print(f"\n── Posibles duplicados en CSV ──")
        for d in sorted(duplicates, key=lambda x: float(x['Score']), reverse=True)[:40]:
            flags = []
            if d['Mismo email']:
                flags.append('MISMO EMAIL')
            if d['Mismo tel']:
                flags.append('MISMO TEL')
            flag_str = f" *** {', '.join(flags)} ***" if flags else ""
            print(f"  {d['Nombre 1']:<35} ({d['Email 1']:<30}) ↔ {d['Nombre 2']:<35} ({d['Email 2']:<30}) [{d['Score']}]{flag_str}")

    if vcf_dupes:
        print(f"\n── Teléfonos duplicados en VCF ──")
        for v1, v2 in vcf_dupes[:20]:
            print(f"  {v1['name']:<35} ↔ {v2['name']:<35} Tel: {v1.get('phone', '')}")

    # Write duplicates CSV
    if duplicates:
        dup_path = os.path.join(OUTPUT_DIR, 'posibles-duplicados.csv')
        with open(dup_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(duplicates[0].keys()))
            w.writeheader()
            w.writerows(sorted(duplicates, key=lambda x: float(x['Score']), reverse=True))
        print(f"\n✓ Duplicados → {dup_path}")

    # ═══════════════════════════════════════════════════════════════
    # PARTE 3: Resumen final
    # ═══════════════════════════════════════════════════════════════
    print("\n" + "="*60)
    print("RESUMEN FINAL")
    print("="*60)
    print(f"  VCF contactos:               {len(vcf_contacts)}")
    print(f"  CSV contactos:               {len(db_contacts)}")
    print(f"  CSV marcados X:              {sum(1 for c in db_contacts if c.get('Subir (X)', '').strip().lower() == 'x')}")
    print(f"  CSV sin teléfono:            {db_sin_tel}")
    print(f"  Enriquecidos con tel VCF:    {enriched_count}")
    print(f"  Posibles duplicados en CSV:  {len(duplicates)}")

    # Archivos generados
    print(f"\n  Archivos generados:")
    print(f"    data/csv-enriquecido-telefonos.csv  ← CSV con teléfonos del VCF agregados")
    print(f"    data/posibles-duplicados.csv         ← Contactos con nombres similares")
    print(f"    data/vcf-cruce-matched.csv           ← Detalle del cruce VCF↔CSV")
    print(f"    data/vcf-cruce-unmatched.csv          ← Contactos VCF sin match en CSV")
    print(f"    data/vcf-ghl-import-final.csv         ← Combinado listo para GHL")


if __name__ == '__main__':
    main()
