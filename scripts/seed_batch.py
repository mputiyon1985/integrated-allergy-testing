#!/usr/bin/env python3
"""Batch-seed AllergyTestResult data + allowedLocations in minimal API calls"""
import json, random, uuid, requests, sys

DB_URL = "https://integrated-allergy-mputiyon1985.aws-us-east-1.turso.io"
TOKEN  = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQ0NzU1NzAsImlkIjoiMDE5ZDI2ZmMtMGIwMS03MzVmLThkODEtNWRlYzA1ZmI2MGQyIiwicmlkIjoiYjYwYjg5NzMtNGJlYy00MGNiLThkYjItOTIyNzExN2M0OWJjIn0.S91wj7247eU8omocZwiZhBkQ7BUSOtI0vlUXTmY2rFzwEYInAw0e9Nk7OfRWWFESusL1TuxZsrUnsxDRL_G_AA"

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def pipeline(requests_list):
    resp = requests.post(f"{DB_URL}/v2/pipeline", headers=HEADERS,
                         json={"requests": requests_list}, timeout=60)
    resp.raise_for_status()
    return resp.json()

ALLERGENS = [
    "j752n2naafpt66vac5st","t2wghcwyw8rcnjm7gvh1","52mtjsrfmvcntlyq34h9",
    "o6wnzlsw8qpumsxevkkg","8ccs1i1khs9hytwc863j","rb5z8rawwtzjjqpiuody",
    "saeonzsdh7rgjft770sw","b5w060puktoy45w5yhuw","usxb18kebx1dlurty8va",
    "chj6o4mn0gw84cmjv8cg","vugg9elcpmz1qyx68fou","3b0sc6jf6nuxkukz9na0",
    "prajaeshvq8eo4j39v1n","7a0e6nk6j0y34bprufzl","0jghvimhzwksotp5qdc3",
    "6k83cpwzixjrfzzwbo48","903n5occ802r7uqsbvgi","xl3ooubikd8f7606zx31",
    "2c7s4nx3jdnw8dv8gf7t","e5v80m0xt82t9w8ajkep",
]

PATIENTS_BY_LOC = {
    "loc-caac-001": ["m2ysncnueqhpoex3cjhl","xrbw32bh53xx5d1g858g","vows1g8k5pt61pnsq6cc","13j67l8fotbgs5m66f3u","1d7450xgu2jtjn49t0q5"],
    "loc-caac-002": ["d03fw6ohcmf14bvc687v","yycqcjkman545l5cty2t","tjj7cey73tt3v1dxd7t7","8cwuw4honzc597wwnk1c","z3alw9r5uu55cbd7d0ut"],
    "loc-caac-003": ["kzqkex36xehtefnosvnf","0j3gpotmwt9ylbuilgjz","dudi63t224zwy4h82uhq","g68bn70xn74zzjvqsyma","g47ai39gvmelxncwu5nq"],
    "loc-iat-001":  ["cmn6p5qb1000204ju4wuu8u8m","cmn6t0ep7000004lag155gi0a","pat-iat-001","pat-iat-002","pat-iat-003"],
    "loc-map-002":  ["rkjjkfexb6ud3xnw1405","lvlvd3msk4x707sjsn1d","ragptlctmhe9msqx1c33","0xnkacekhnl0dmlu9yu3","ejx931zsxf3udwf8cj5a"],
    "loc-map-003":  ["j944dagl9jmg6jfuvt99","jt1jala7azl5m8jgc7ar","mbzmcx2v1zf6rd80c87i","3twlbkkm5emv7nedou91","j27dhl265fammv775fcm"],
    "loc-map-004":  ["q2h4rcm0nukkoc8fkdtf","q1j7e96ktkl9sjrxj2ju","fduqgqp1rp7zq6640bte","cs7sunf9puv4oherwfu5","sq7oc58qrk87fuy2gk8q"],
    "loc-nvaa-001": ["ylnn7iqz6teuzuy3c276","y12prfs78r313deph329","z8nsvsqm6t51kyrguuui","dswt77ssyvcndmu45y9d","hi09bpot12325fm4ydwt"],
    "loc-nvaa-002": ["j0924c7wowqhsr4rgqtm","06f6mg72p370ygzyqbjk","vbn8z413bd71hs5pkcxi","hb36e9guc7y6az7h68zf","7lnbx9k2u9v6mf5bff2i"],
    "loc-nvaa-003": ["nj8kim44v11ajepu26cs","nl64rroplkmbfogvz2hd","7czvh1pv9aiczm3eycw1","vyg9ynuuq1yu8wywjp2k","201iwvx0x9eqc8rprug0"],
    "loc-nvaa-004": ["dxiuxbtpq0az9gs3srca","kwk8neqxq7iqhjggcc7g","74515i9apsdz7vll2sex","54ag6b93iazg44i6x2rw","j69p80uh6q6rcu4wt5m8"],
}

NURSES = ["Mary Johnson RN","Patricia Davis RN","Linda Martinez RN","Barbara Wilson RN","Susan Anderson RN"]

def weighted_reaction():
    r = random.random()
    if r < 0.40: return 0
    if r < 0.70: return 1
    if r < 0.90: return 2
    if r < 0.98: return 3
    return 4

def wheal_for(rxn):
    if rxn == 0: return "null"
    mm = {1: random.randint(2,4), 2: random.randint(5,8), 3: random.randint(9,12), 4: random.randint(13,18)}[rxn]
    return f"'{mm}mm'"

TESTED_AT = "2026-04-10T09:00:00.000Z"
READ_AT   = "2026-04-10T09:20:00.000Z"
NOW       = "2026-04-10T09:00:00.000Z"

# Step 1: Add column + set BJ restrictions in one pipeline
print("=== Step 1: Schema changes ===")
reqs = [
    {"type": "execute", "stmt": {"sql": "ALTER TABLE StaffUser ADD COLUMN allowedLocations TEXT"}},
    {"type": "execute", "stmt": {"sql": "UPDATE StaffUser SET allowedLocations='[\"loc-iat-001\",\"loc-map-002\",\"loc-map-003\",\"loc-map-004\"]' WHERE id='staff-bjhockney-001'"}},
    {"type": "close"},
]
result = pipeline(reqs)
r0 = result["results"][0]
if r0["type"] == "error":
    if "duplicate column" in r0["error"]["message"].lower():
        print("  Column already exists (OK)")
    else:
        print(f"  ⚠ ALTER error: {r0['error']['message']}")
else:
    print("  ✓ allowedLocations column added")

r1 = result["results"][1]
if r1["type"] == "error":
    print(f"  ⚠ UPDATE error: {r1['error']['message']}")
else:
    print("  ✓ BJ Hockney restricted to MAP locations")

# Step 2: Build all INSERT statements
print("\n=== Step 2: Building inserts ===")
inserts = []
for loc_id, patient_ids in PATIENTS_BY_LOC.items():
    nurse = random.choice(NURSES)
    for pid in patient_ids:
        count = random.randint(8, 12)
        chosen = random.sample(ALLERGENS, count)
        for allergen_id in chosen:
            rxn = weighted_reaction()
            wheal = wheal_for(rxn)
            rid = uuid.uuid4().hex[:20]
            sql = (f"INSERT OR IGNORE INTO AllergyTestResult "
                   f"(id,patientId,allergenId,testType,reaction,wheal,nurseName,testedAt,readAt,active,createdAt,updatedAt,deletedAt) "
                   f"VALUES ('{rid}','{pid}','{allergen_id}','scratch',{rxn},{wheal},'{nurse}','{TESTED_AT}','{READ_AT}',1,'{NOW}','{NOW}',NULL)")
            inserts.append({"type": "execute", "stmt": {"sql": sql}})

print(f"  Total inserts to run: {len(inserts)}")

# Chunk into batches of 50
BATCH_SIZE = 50
batches = [inserts[i:i+BATCH_SIZE] for i in range(0, len(inserts), BATCH_SIZE)]
print(f"  Sending {len(batches)} batches of {BATCH_SIZE}...")

ok_count = 0
err_count = 0
for i, batch in enumerate(batches):
    reqs = batch + [{"type": "close"}]
    result = pipeline(reqs)
    for r in result["results"][:-1]:  # exclude close
        if r["type"] == "ok":
            ok_count += 1
        else:
            err_count += 1
    if (i+1) % 10 == 0:
        print(f"  ... batch {i+1}/{len(batches)}")

print(f"\n  ✓ Inserted: {ok_count}, Errors: {err_count}")
print("\n✅ Seed complete!")
