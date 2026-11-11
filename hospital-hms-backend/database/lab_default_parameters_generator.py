"""Writes 068_lab_default_parameters.sql and its read-only _preview.sql.

    python3 database/lab_default_parameters_generator.py database/migrations

Default report rows for common Clinic lab tests (owner, 2026-11-11): test
lines with unit and a free-text reference range (printed exactly as written;
a plain range also drives the H/L flag), headings, and fixed notes. Standard
textbook ranges — the hospital's pathologist reviews them on the Parameters
screen. Tests are matched by their exact Clinic LABORATORY name.
"""
import sys

OUT = sys.argv[1]
NUM, TXT, SEL = 'number', 'text', 'select'


def P(name, unit=None, ref=None, typ=NUM, options=()):
    return dict(kind='param', name=name, unit=unit, ref=ref, note=None, type=typ, options=list(options))


def H(name):
    return dict(kind='heading', name=name, unit=None, ref=None, note=None, type=NUM, options=[])


def NOTE(label, text):
    return dict(kind='note', name=label, unit=None, ref=None, note=text, type=NUM, options=[])


def mfc(m, f, c=None):
    lines = [f'Male: {m}', f'Female: {f}']
    if c:
        lines.append(f'Children: {c}')
    return '\n'.join(lines)


HB = P('Haemoglobin (Hb)', 'g/dL', mfc('13.0-17.0', '12.0-15.0', '11.0-14.5'))
RBC = P('Total RBC Count', 'x10^12/L', mfc('4.5-5.5', '3.8-4.8', '4.0-5.2'))
HCT = P('Haematocrit (HCT)', '%', mfc('40-50', '36-46', '33-43'))
MCV = P('MCV', 'fL', '80-100')
MCH = P('MCH', 'pg', '27-32')
MCHC = P('MCHC', 'g/dL', '31.5-34.5')
RDW = P('RDW-CV', '%', '11.6-14.0')
TLC = P('Total Leucocyte Count (TLC)', 'x10^9/L', '4.0-11.0\nChildren: 5.0-15.0')
PLT = P('Platelet Count', 'x10^9/L', '150-400')
DLC = [H('Differential Count'),
       P('Neutrophils', '%', '40-75'),
       P('Lymphocytes', '%', '20-45'),
       P('Monocytes', '%', '2-10'),
       P('Eosinophils', '%', '1-6'),
       P('Basophils', '%', '0-1')]
ESR = P('ESR', 'mm/1st hr', mfc('0-15', '0-20', '0-10'))

TBIL = P('Total Bilirubin', 'mg/dL', '0.1-1.2')
DBIL = P('Direct Bilirubin', 'mg/dL', '0.0-0.3')
IBIL = P('Indirect Bilirubin', 'mg/dL', '0.1-0.9')
ALT = P('ALT (SGPT)', 'U/L', mfc('Up to 41', 'Up to 33'))
AST = P('AST (SGOT)', 'U/L', mfc('Up to 40', 'Up to 32'))
ALP = P('Alkaline Phosphatase (ALP)', 'U/L', mfc('40-129', '35-104'))
GGT = P('Gamma GT (GGT)', 'U/L', mfc('10-71', '6-42'))
TP = P('Total Protein', 'g/dL', '6.6-8.3')
ALB = P('Albumin', 'g/dL', '3.5-5.2')
GLOB = P('Globulin', 'g/dL', '2.0-3.5')
AG = P('A/G Ratio', None, '1.0-2.2')
UREA = P('Urea', 'mg/dL', '15-45')
CREA = P('Creatinine', 'mg/dL', mfc('0.7-1.3', '0.6-1.1', '0.3-0.7'))
URIC = P('Uric Acid', 'mg/dL', mfc('3.4-7.0', '2.4-5.7'))
CHOL = P('Total Cholesterol', 'mg/dL', 'Desirable < 200\nBorderline 200-239\nHigh >= 240')
TG = P('Triglycerides', 'mg/dL', 'Normal < 150\nBorderline 150-199\nHigh >= 200')
HDL = P('HDL Cholesterol', 'mg/dL', mfc('> 40', '> 50'))
LDL = P('LDL Cholesterol', 'mg/dL', 'Optimal < 100\nNear optimal 100-129\nBorderline 130-159\nHigh >= 160')
VLDL = P('VLDL Cholesterol', 'mg/dL', '5-40')
NA = P('Sodium (Na)', 'mmol/L', '135-145')
K = P('Potassium (K)', 'mmol/L', '3.5-5.1')
CL = P('Chloride (Cl)', 'mmol/L', '98-107')
HCO3 = P('Bicarbonate (HCO3)', 'mmol/L', '22-29')
GRADE = ['Nil', 'Trace', '+', '++', '+++']


def qual(name):
    return P(name, None, 'Non-Reactive', SEL, ['Non-Reactive', 'Reactive'])


def negpos(name, opts=('Negative', 'Positive')):
    return P(name, None, 'Negative', SEL, opts)


HBA1C = P('HbA1c', '%', 'Normal < 5.7\nPre-diabetes 5.7-6.4\nDiabetes >= 6.5')

TESTS = [
    # (clinic test name, category, sample, report rows)
    ('(C.B.C.) COMPLETE BLOOD COUNT', 'Haematology', 'Blood', [HB, RBC, HCT, MCV, MCH, MCHC, RDW, TLC, PLT, *DLC]),
    ('HAEMOGLOBIN ( H.B.)', 'Haematology', 'Blood', [HB]),
    ('(T.L.C./W.B.C ) TOTAL LEUCOCYTE ...', 'Haematology', 'Blood', [TLC]),
    ('(D.L.C.) DIFFRENCIAL LEUCOCYTE C...', 'Haematology', 'Blood', DLC[1:]),
    ('PLATELET COUNT (P.L.T.)', 'Haematology', 'Blood', [PLT]),
    ('(E.S.R.) ERYTHROCYTE SEDIMENTA...', 'Haematology', 'Blood', [ESR]),
    ('RETIC COUNT', 'Haematology', 'Blood', [P('Reticulocyte Count', '%', '0.5-2.5')]),
    ('BLOOD GROUP ( B.G/ R.H.)', 'Haematology', 'Blood', [P('ABO Group', None, None, SEL, ['A', 'B', 'AB', 'O']), P('Rh Factor', None, None, SEL, ['Positive', 'Negative'])]),
    ('(B.T.) BLEEDING TIME', 'Haematology', 'Blood', [P('Bleeding Time', 'min', '2-7')]),
    ('(C.T.) CLOTING TIME', 'Haematology', 'Blood', [P('Clotting Time', 'min', '4-10')]),
    ('PROTHROMBIN TIME ( P.T.)', 'Haematology', 'Plasma', [P('Prothrombin Time (Patient)', 'sec', '11-13.5'), P('Control', 'sec'), P('INR', None, '0.8-1.2')]),
    ('A.P.T.T. TEST', 'Haematology', 'Plasma', [P('APTT (Patient)', 'sec', '25-35'), P('Control', 'sec')]),

    ('LIVER FUNCTION TEST ( L.F.T.)', 'Biochemistry', 'Serum', [TBIL, DBIL, IBIL, ALT, AST, ALP, GGT, TP, ALB, GLOB, AG]),
    ('S.G.P.T (S.G.P.T. / ALT)', 'Biochemistry', 'Serum', [ALT]),
    ('S.G.O.T.', 'Biochemistry', 'Serum', [AST]),
    ('( A . P ) ALKALINE PHOSPHATE', 'Biochemistry', 'Serum', [ALP]),
    ('GAMA G.T.', 'Biochemistry', 'Serum', [GGT]),
    ('Serum Albumin', 'Biochemistry', 'Serum', [ALB]),
    ('Serum Protine', 'Biochemistry', 'Serum', [TP]),
    ('Serum Protine A G Ratio', 'Biochemistry', 'Serum', [TP, ALB, GLOB, AG]),
    ('SERUM UREA', 'Biochemistry', 'Serum', [UREA]),
    ('UREA ( UR)', 'Biochemistry', 'Serum', [UREA]),
    ('CREATININE ( S. C.R.T.)', 'Biochemistry', 'Serum', [CREA]),
    ('URIC ACID', 'Biochemistry', 'Serum', [URIC]),
    ('(B.S.F.) BLOOD SUGAR FASTING', 'Biochemistry', 'Blood', [P('Blood Sugar (Fasting)', 'mg/dL', '70-100')]),
    ('(B.S.R.) BLOOD SUGAR RANDOM', 'Biochemistry', 'Blood', [P('Blood Sugar (Random)', 'mg/dL', '70-140')]),
    ('HBA1C', 'Biochemistry', 'Blood', [HBA1C]),
    ('HBAIC', 'Biochemistry', 'Blood', [HBA1C]),
    ('LIPID PROFILE (L.P.)', 'Biochemistry', 'Serum', [CHOL, TG, HDL, LDL, VLDL, NOTE('Note', 'Sample after 10-12 hours fasting.')]),
    ('CHOLESTEROL ( CHOLES)', 'Biochemistry', 'Serum', [CHOL]),
    ('TRIGLYCERIDES (TG.)', 'Biochemistry', 'Serum', [TG]),
    ('HIGH DENSITY LIPID (H.D.L.)', 'Biochemistry', 'Serum', [HDL]),
    ('LOW DENSITY LIPID (L.D.L)', 'Biochemistry', 'Serum', [LDL]),
    ('V.L.D.L.', 'Biochemistry', 'Serum', [VLDL]),
    ('S. ELECTROLYTE ( ELECT)', 'Biochemistry', 'Serum', [NA, K, CL, HCO3]),
    ('S. SODIUM ( Na)', 'Biochemistry', 'Serum', [NA]),
    ('S.POTASSIUM ( K)', 'Biochemistry', 'Serum', [K]),
    ('S. CHOLORIDE (Cl)', 'Biochemistry', 'Serum', [CL]),
    ('S.BICARBONATE ( BICARB)', 'Biochemistry', 'Serum', [HCO3]),
    ('CALCIUM ( Ca)', 'Biochemistry', 'Serum', [P('Calcium', 'mg/dL', '8.6-10.2')]),
    ('MEGNISIUM', 'Biochemistry', 'Serum', [P('Magnesium', 'mg/dL', '1.6-2.6')]),
    ('PHOSPHORAS (PH)', 'Biochemistry', 'Serum', [P('Phosphorus', 'mg/dL', '2.5-4.5\nChildren: 4.0-7.0')]),
    ('AMYLASE BLOOD/ SERUM', 'Biochemistry', 'Serum', [P('Amylase', 'U/L', '28-100')]),
    ('Serum Lipase', 'Biochemistry', 'Serum', [P('Lipase', 'U/L', '13-60')]),
    ('IRON', 'Biochemistry', 'Serum', [P('Serum Iron', 'µg/dL', mfc('65-175', '50-170'))]),
    ('SERUM FERRITIN', 'Biochemistry', 'Serum', [P('Ferritin', 'ng/mL', mfc('30-400', '13-150'))]),
    ('LDH', 'Biochemistry', 'Serum', [P('LDH', 'U/L', '135-225')]),

    ('TSH', 'Hormones', 'Serum', [P('TSH', 'µIU/mL', '0.27-4.2')]),
    ('T4', 'Hormones', 'Serum', [P('Total T4', 'µg/dL', '5.1-14.1')]),
    ('T3 ELA', 'Hormones', 'Serum', [P('Total T3', 'ng/dL', '80-200')]),
    ('F.T.3', 'Hormones', 'Serum', [P('Free T3', 'pg/mL', '2.0-4.4')]),
    ('F.T.4.', 'Hormones', 'Serum', [P('Free T4', 'ng/dL', '0.93-1.7')]),
    ('PROLACTIN', 'Hormones', 'Serum', [P('Prolactin', 'ng/mL', mfc('4.0-15.2', '4.8-23.3'))]),
    ('VITAMIN D3', 'Hormones', 'Serum', [P('Vitamin D (25-OH)', 'ng/mL', 'Deficient < 20\nInsufficient 20-29\nSufficient 30-100')]),
    ('B 12', 'Hormones', 'Serum', [P('Vitamin B12', 'pg/mL', '197-771')]),

    ('Hbs ANTIGEN ( AUSTRALIA ANTIGE...', 'Serology / Immunology', 'Serum', [qual('HBsAg')]),
    ('ANTI HCV HEPATITIS C  ( H.C.V.)', 'Serology / Immunology', 'Serum', [qual('Anti HCV')]),
    ('H.I.V. TEST', 'Serology / Immunology', 'Serum', [qual('HIV 1 & 2')]),
    ('HIV', 'Serology / Immunology', 'Serum', [qual('HIV 1 & 2')]),
    ('V.D.R.L.', 'Serology / Immunology', 'Serum', [qual('VDRL')]),
    ('MALARIA I.C.T.', 'Serology / Immunology', 'Blood', [negpos('Malaria Antigen (ICT)', ('Negative', 'Positive (P. falciparum)', 'Positive (P. vivax)'))]),
    ('DENGUE NS 1', 'Serology / Immunology', 'Serum', [negpos('Dengue NS1 Antigen')]),
    ('H. PYLORI', 'Serology / Immunology', 'Serum', [negpos('H. pylori Antibody')]),
    ('TUBEX', 'Serology / Immunology', 'Serum', [P('Tubex Score', None, '<= 2 Negative\n3 Borderline\n>= 4 Positive')]),
    ('C Reactive Protien', 'Serology / Immunology', 'Serum', [P('CRP', 'mg/L', '< 5')]),
    ('RA FACTOR ( R.A.)', 'Serology / Immunology', 'Serum', [P('RA Factor', 'IU/mL', '< 14')]),
    ('PREGNANCY [ UCG ] ( P.T.)', 'Serology / Immunology', 'Urine', [P('Pregnancy Test (Urine hCG)', None, None, SEL, ['Negative', 'Positive'])]),

    ('URINE D/R', 'Urine & Stool', 'Urine', [
        H('Physical Examination'),
        P('Colour', None, 'Pale Yellow', TXT),
        P('Appearance', None, 'Clear', SEL, ['Clear', 'Slightly Turbid', 'Turbid']),
        P('Specific Gravity', None, '1.005-1.030'),
        P('pH', None, '4.5-8.0'),
        H('Chemical Examination'),
        P('Protein', None, 'Nil', SEL, GRADE),
        P('Glucose', None, 'Nil', SEL, GRADE),
        P('Ketones', None, 'Nil', SEL, ['Nil', '+', '++', '+++']),
        P('Blood', None, 'Nil', SEL, GRADE),
        P('Bilirubin', None, 'Nil', SEL, ['Nil', '+', '++']),
        P('Urobilinogen', None, 'Normal', SEL, ['Normal', 'Increased']),
        P('Nitrite', None, 'Negative', SEL, ['Negative', 'Positive']),
        H('Microscopic Examination'),
        P('Pus Cells', '/HPF', '0-5'),
        P('Red Blood Cells', '/HPF', '0-2'),
        P('Epithelial Cells', '/HPF', 'Few', TXT),
        P('Casts', None, 'Nil', TXT),
        P('Crystals', None, 'Nil', TXT),
        P('Bacteria', None, 'Nil', TXT),
        P('Yeast Cells', None, 'Nil', TXT),
    ]),
    ('URINE SUGAR', 'Urine & Stool', 'Urine', [P('Urine Sugar', None, 'Nil', SEL, GRADE)]),
    ('STOOL D/R', 'Urine & Stool', 'Stool', [
        H('Physical Examination'),
        P('Colour', None, 'Brown', TXT),
        P('Consistency', None, 'Formed', SEL, ['Formed', 'Semi-formed', 'Loose', 'Watery']),
        P('Mucus', None, 'Nil', SEL, ['Nil', '+', '++']),
        P('Blood', None, 'Nil', SEL, ['Nil', '+']),
        H('Microscopic Examination'),
        P('Pus Cells', '/HPF', 'Nil', TXT),
        P('Red Blood Cells', '/HPF', 'Nil', TXT),
        P('Ova', None, 'Not seen', TXT),
        P('Cysts', None, 'Not seen', TXT),
        P('Trophozoites', None, 'Not seen', TXT),
    ]),
    # Culture reports are written out: the test goes in, no rows (free-text box).
    ('URINE C/S', 'Microbiology', 'Urine', []),
    ('BLOOD C/S', 'Microbiology', 'Blood', []),
    ('STOOL C/S', 'Microbiology', 'Stool', []),
    ('PUSS FOR C/S', 'Microbiology', 'Swab', []),
]
CATS = ['Haematology', 'Biochemistry', 'Hormones', 'Serology / Immunology', 'Urine & Stool', 'Microbiology']


def q(s):
    if s is None:
        return 'NULL'
    s = str(s).replace("'", "''")
    return f"E'{s}'".replace('\n', '\\n') if '\n' in s else f"'{s}'"


def arr(xs):
    return "'{}'::text[]" if not xs else 'ARRAY[' + ','.join(q(x) for x in xs) + ']::text[]'


out = ["""-- Laboratories: default categories, tests and report rows (owner, 2026-11-11).
-- Test lines with unit and a free-text reference range (printed as written; a
-- plain range also drives the H/L flag), headings and notes. Standard textbook
-- ranges as a starting point — the hospital's pathologist must review them on
-- the Parameters screen before reports go out. Tests are matched by their exact
-- Clinic LABORATORY name, so this fits any PC whatever the ids. Safe to re-run:
--   * a category is added only if no category has that name
--   * a test is placed only if it isn't in any category yet
--   * rows are added only to a test that has none
-- Run 068_lab_default_parameters_preview.sql first to see what matches.
-- Needs 067_laboratory.sql. Generated by database/lab_default_parameters_generator.py
-- (python3 that-file database/migrations); edit the generator, not this file.

BEGIN;

CREATE FUNCTION pg_temp.lab_seed_test(p_test text, p_cat text, p_sample text, p_sort int) RETURNS int AS $$
DECLARE sid int; cid int; tid int;
BEGIN
  SELECT s.id INTO sid
    FROM "ClinicSubDepartment" s JOIN "ClinicDepartment" d ON d.id = s."departmentId"
   WHERE lower(regexp_replace(d.name, '[^a-zA-Z0-9]', '', 'g')) = 'laboratory' AND s.name = p_test
   LIMIT 1;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO cid FROM "LabCategory" WHERE lower(name) = lower(p_cat) LIMIT 1;
  INSERT INTO "LabTest" ("subDeptId", "categoryId", "sampleType", "sortOrder")
    SELECT sid, cid, p_sample, p_sort WHERE NOT EXISTS (SELECT 1 FROM "LabTest" WHERE "subDeptId" = sid);
  SELECT id INTO tid FROM "LabTest" WHERE "subDeptId" = sid;
  IF EXISTS (SELECT 1 FROM "LabParameter" WHERE "labTestId" = tid) THEN RETURN NULL; END IF;
  RETURN tid;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.lab_seed_row(p_tid int, p_sort int, p_kind text, p_name text, p_unit text, p_ref text, p_note text, p_type text, p_options text[]) RETURNS void AS $$
BEGIN
  IF p_tid IS NULL THEN RETURN; END IF;
  INSERT INTO "LabParameter" ("labTestId", "kind", "name", "unit", "referenceRange", "noteText", "resultType", "options", "sortOrder")
    VALUES (p_tid, p_kind, p_name, p_unit, p_ref, p_note, p_type, p_options, p_sort);
END $$ LANGUAGE plpgsql;
"""]
for i, c in enumerate(CATS, 1):
    out.append(f"""INSERT INTO "LabCategory" ("name", "sortOrder") SELECT {q(c)}, {i} WHERE NOT EXISTS (SELECT 1 FROM "LabCategory" WHERE lower(name) = lower({q(c)}));""")
out.append('')
for i, (test, cat, sample, rows) in enumerate(TESTS, 1):
    lines = [f"DO $$ DECLARE t int := pg_temp.lab_seed_test({q(test)}, {q(cat)}, {q(sample)}, {i}); BEGIN"]
    for j, r in enumerate(rows):
        lines.append(f"  PERFORM pg_temp.lab_seed_row(t, {j}, {q(r['kind'])}, {q(r['name'])}, {q(r['unit'])}, {q(r['ref'])}, {q(r['note'])}, {q(r['type'])}, {arr(r['options'])});")
    lines.append("END $$;")
    out.append('\n'.join(lines))
out.append('\nCOMMIT;\n')
with open(OUT + '/068_lab_default_parameters.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

prev = ["""-- Preview for 068_lab_default_parameters.sql — read-only. Shows each
-- default test, whether this PC's Clinic LABORATORY list has it (found), the
-- category it's already in, and how many report rows it has now.
WITH seed(sort, name) AS (VALUES"""]
prev.append(',\n'.join(f'  ({i}, {q(t[0])})' for i, t in enumerate(TESTS, 1)))
prev.append(""")
SELECT seed.name AS test, s.id IS NOT NULL AS found, c.name AS category_now,
       (SELECT count(*) FROM "LabParameter" p WHERE p."labTestId" = lt.id) AS rows_now
  FROM seed
  LEFT JOIN ("ClinicSubDepartment" s JOIN "ClinicDepartment" d ON d.id = s."departmentId"
             AND lower(regexp_replace(d.name, '[^a-zA-Z0-9]', '', 'g')) = 'laboratory') ON s.name = seed.name
  LEFT JOIN "LabTest" lt ON lt."subDeptId" = s.id
  LEFT JOIN "LabCategory" c ON c.id = lt."categoryId"
 ORDER BY found, seed.sort;
""")
with open(OUT + '/068_lab_default_parameters_preview.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(prev))
print(len(TESTS), 'tests,', sum(len(t[3]) for t in TESTS), 'rows')
