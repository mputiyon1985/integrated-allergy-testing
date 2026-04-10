#!/usr/bin/env python3
"""Seed AllergyTestResult data + add allowedLocations column + set BJ Hockney's restrictions"""
import json, random, uuid, requests, sys

DB_URL = "https://integrated-allergy-mputiyon1985.aws-us-east-1.turso.io"
TOKEN  = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQ0NzU1NzAsImlkIjoiMDE5ZDI2ZmMtMGIwMS03MzVmLThkODEtNWRlYzA1ZmI2MGQyIiwicmlkIjoiYjYwYjg5NzMtNGJlYy00MGNiLThkYjItOTIyNzExN2M0OWJjIn0.S91wj7247eU8omocZwiZhBkQ7BUSOtI0vlUXTmY2rFzwEYInAw0e9Nk7OfRWWFESusL1TuxZsrUnsxDRL_G_AA"

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def pipeline(requests_list):
    resp = requests.post(f"{DB_URL}/v2/pipeline", headers=HEADERS,
                         json={"requests": requests_list})
    resp.raise_for_status()
    return resp.json()

def execute(sql, args=None):
    stmt = {"sql": sql}
    if args:
        stmt["args"] = [{"type": "text", "value": str(a)} if a is not None else {"type": "null"} for a in args]
    result = pipeline([{"type": "execute", "stmt": stmt}, {"type": "close"}])
    r = result["results"][0]
    if r["type"] == "error":
        raise RuntimeError(f"SQL error: {r['error']['message']}\nSQL: {sql}")
    return r["response"]["result"]

# ── Allergens (all 20, not just showOnPrickTest=1) ──────────────────────────
ALLERGENS = [
    ("j752n2naafpt66vac5st", "Oak Mix"),
    ("t2wghcwyw8rcnjm7gvh1", "Elm"),
    ("52mtjsrfmvcntlyq34h9", "Maple Mix"),
    ("o6wnzlsw8qpumsxevkkg", "Birch"),
    ("8ccs1i1khs9hytwc863j", "Ash Mix"),
    ("rb5z8rawwtzjjqpiuody", "Cedar/Juniper Mix"),
    ("saeonzsdh7rgjft770sw", "Cottonwood"),
    ("b5w060puktoy45w5yhuw", "Hickory/Pecan Mix"),
    ("usxb18kebx1dlurty8va", "Mulberry"),
    ("chj6o4mn0gw84cmjv8cg", "Pine Mix"),
    ("vugg9elcpmz1qyx68fou", "Sycamore"),
    ("3b0sc6jf6nuxkukz9na0", "Willow"),
    ("prajaeshvq8eo4j39v1n", "Hackberry"),
    ("7a0e6nk6j0y34bprufzl", "Walnut"),
    ("0jghvimhzwksotp5qdc3", "Poplar Mix"),
    ("6k83cpwzixjrfzzwbo48", "Timothy Grass"),
    ("903n5occ802r7uqsbvgi", "Kentucky Bluegrass"),
    ("xl3ooubikd8f7606zx31", "Bermuda Grass"),
    ("2c7s4nx3jdnw8dv8gf7t", "Orchard Grass"),
    ("e5v80m0xt82t9w8ajkep", "Perennial Ryegrass"),
]

# ── Patients per location (up to 5 each) ────────────────────────────────────
PATIENTS_BY_LOC = {
    "loc-caac-001": ["m2ysncnueqhpoex3cjhl","xrbw32bh53xx5d1g858g","vows1g8k5pt61pnsq6cc","13j67l8fotbgs5m66f3u","1d7450xgu2jtjn49t0q5"],
    "loc-caac-002": ["d03fw6ohcmf14bvc687v","yycqcjkman545l5cty2t","tjj7cey73tt3v1dxd7t7","8cwuw4honzc597wwnk1c","z3alw9r5uu55cbd7d0ut"],
    "loc-caac-003": ["kzqkex36xehtefnosvnf","0j3gpotmwt9ylbuilgjz","dudi63t224zwy4h82uhq","g68bn70xn74zzjvqsyma","g47ai39gvmelxncwu5nq"],
    "loc-iat-001":  ["cmn6p5qb1000204ju4wuu8u8m","cmn6t0ep7000004lag155gi0a","pat-iat-001","pat-iat-002","pat-iat-003"],
    "loc-map-002":  ["rkjjkfexb6ud3xnw1405","lvlvd3msk4x707sjsn1d","ragptlctmhe9msqx1c33","0xnkacekhnl0dmlu9yu3","ejx931zsxf3udwf8cj5a"],
    "loc-map-003":  ["j944dagl9jmg6jfuvt99","jt1jala7azl5m8jgc7ar","mbzmcx2v1zf6rd80c87i","3twlbkkm5emv7nedou91","j27dhl265fammv775fcm"],
    "loc-map-004":  ["q2h4rcm0nukkoc8fkdtf","q1j7e96ktkl9sjrxj2ju","fduqgaqp1rp7zq6640bte","cs7sunf9puv4oherwfu5","sq7oc58qrk87fuy2gk8q"],
    "loc-nvaa-001": ["ylnn7iqz6teuzuy3c276","y12prfs78r313deph329","z8nsvsqm6t51kyrguuui","dswt77ssyvcndmu45y9d","hi09bpot12325fm4ydwt"],
    "loc-nvaa-002": ["j0924c7wowqhsr4rgqtm","06f6mg72p370ygzyqbjk","vbn8z413bd71hs5pkcxi","hb36e9guc7y6az7h68zf","7lnbx9k2u9v6mf5bff2i"],
    "loc-nvaa-003": ["nj8kim44v11ajepu26cs","nl64rroplkmbfogvz2hd","7czvh1pv9aiczm3eycw1","vyg9ynuuq1yu8wywjp2k","201iwvx0x9eqc8rprug0"],
    "loc-nvaa-004": ["dxiuxbtpq0az9gs3srca","kwk8neqxq7iqhjggcc7g","74515i9apsdz7vll2sex","54ag6b93iazg44i6x2rw","j69p80uh6q6rcu4wt5m8"],
}

NURSES = ["Mary Johnson RN", "Patricia Davis RN", "Linda Martinez RN", "Barbara Wilson RN", "Susan Anderson RN"]

def weighted_reaction():
    """Weighted: 40% 0, 30% 1, 20% 2, 8% 3, 2% 4"""
    r = random.random()
    if r < 0.40: return 0
    if r < 0.70: return 1
    if r < 0.90: return 2
    if r < 0.98: return 3
    return 4

def wheal_for_reaction(rxn):
    if rxn == 0: return None
    if rxn == 1: return f"{random.randint(2,4)}mm"
    if rxn == 2: return f"{random.randint(5,8)}mm"
    if rxn == 3: return f"{random.randint(9,12)}mm"
    return f"{random.randint(13,18)}mm"

def make_id():
    return str(uuid.uuid4()).replace("-","")[:20]

TESTED_AT = "2026-04-10T09:00:00.000Z"
READ_AT   = "2026-04-10T09:20:00.000Z"
NOW       = "2026-04-10T09:00:00.000Z"

print("=== Step 1: Add allowedLocations column to StaffUser ===")
try:
    execute("ALTER TABLE StaffUser ADD COLUMN allowedLocations TEXT")
    print("  ✓ Column added")
except Exception as e:
    if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
        print("  ✓ Column already exists")
    else:
        raise

print("\n=== Step 2: Seed AllergyTestResult data ===")
total_inserted = 0
total_skipped  = 0

for loc_id, patient_ids in PATIENTS_BY_LOC.items():
    nurse = random.choice(NURSES)
    for patient_id in patient_ids:
        # Pick 8-12 random allergens
        count = random.randint(8, 12)
        chosen = random.sample(ALLERGENS, count)

        for (allergen_id, allergen_name) in chosen:
            rxn = weighted_reaction()
            wheal = wheal_for_reaction(rxn)
            rid = make_id()
            try:
                execute(
                    """INSERT INTO AllergyTestResult
                       (id, patientId, allergenId, testType, reaction, wheal, nurseName,
                        testedAt, readAt, active, createdAt, updatedAt, deletedAt)
                       VALUES (?,?,?,?,?,?,?,?,?,1,?,?,NULL)""",
                    [rid, patient_id, allergen_id, "scratch", str(rxn), wheal, nurse,
                     TESTED_AT, READ_AT, NOW, NOW]
                )
                total_inserted += 1
            except Exception as e:
                if "UNIQUE constraint" in str(e):
                    total_skipped += 1
                else:
                    print(f"  ⚠ Failed {patient_id}/{allergen_id}: {e}")
                    total_skipped += 1

    print(f"  ✓ {loc_id}: {len(patient_ids)} patients seeded")

print(f"\n  Total inserted: {total_inserted}, skipped: {total_skipped}")

print("\n=== Step 3: Set BJ Hockney allowedLocations (MAP only) ===")
MAP_LOCATIONS = json.dumps(["loc-iat-001","loc-map-002","loc-map-003","loc-map-004"])
execute(
    "UPDATE StaffUser SET allowedLocations=? WHERE id='staff-bjhockney-001'",
    [MAP_LOCATIONS]
)
print(f"  ✓ BJ Hockney restricted to MAP locations: {MAP_LOCATIONS}")

print("\n✅ All DB seed tasks complete!")
