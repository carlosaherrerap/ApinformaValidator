import argparse
import asyncio
import httpx
import time
import random
import csv
import sys
import logging
from faker import Faker

# Optional: psycopg2 for direct DB checks
try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

# Defaults
DEFAULT_API_BASE = "http://localhost:3000/v1/api"
DEFAULT_TOTAL = 50000
DEFAULT_CONCURRENCY = 250

OPERADORES = ["MOVISTAR", "BITEL", "CLARO", "ENTEL"]
VIAS = ["S", "W"]

faker = Faker()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("simulator")


def check_doc_in_db(doc, db_url):
    """Checks if a document already exists in the database."""
    if not db_url or not HAS_PSYCOPG2:
        return False
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM client_token WHERE document = %s", (doc,))
            exists = cur.fetchone() is not None
        conn.close()
        return exists
    except Exception as e:
        logger.error(f"DB Check Error: {e}")
        return False


async def do_request(client, method, url, **kwargs):
    """Helper to perform requests and handle basic errors."""
    try:
        response = await getattr(client, method)(url, **kwargs)
        return response
    except Exception as e:
        # Mock a failed response if exception occurs
        class FakeResponse:
            def __init__(self, err):
                self.status_code = 999
                self.text = str(err)
            def json(self):
                return {"error": self.text}
        return FakeResponse(e)


async def run_scenario(name, func, *args, verbose=False):
    start = time.perf_counter()
    try:
        success, msg = await func(*args, verbose=verbose)
    except Exception as e:
        success, msg = False, f"Exception: {e}"
    end = time.perf_counter()
    duration = end - start
    
    if not success and verbose:
        logger.error(f"Scenario '{name}' failed: {msg}")
        
    return {"name": name, "success": bool(success), "msg": str(msg), "time": duration}


async def scenario_success_flow(client, api_base, db_url=None, verbose=False):
    # Step 1: Create Client (with retry for uniqueness)
    cid = None
    attempts = 0
    max_setup_attempts = 20
    
    while not cid and attempts < max_setup_attempts:
        attempts += 1
        doc = str(random.randint(10000000, 99999999))
        
        # PROACTIVE DB CHECK (requested by user)
        if db_url:
            if check_doc_in_db(doc, db_url):
                if verbose: logger.info(f"DB Collision detected for {doc}. Skipping...")
                attempts -= 1 # Don't count as failure
                continue

        payload = {
            "tipo_documento": "DNI",
            "documento": doc,
            "digito_verificador": str(random.randint(0, 9)),
            "nombres": faker.first_name(),
            "apellido_paterno": faker.last_name(),
            "apellido_materno": faker.last_name()
        }

        r1 = await do_request(client, 'post', f"{api_base}/client", json=payload, timeout=30.0)
        
        if r1.status_code in (200, 201):
            try:
                data = r1.json().get("data")
                cid = data.get("id") if data else None
            except Exception as e:
                return False, f"JSON Parse Error Step 1: {e} | Body: {r1.text[:100]}"
        elif r1.status_code == 400:
            try:
                err_json = r1.json()
                if err_json.get("code") == "ALREADY_VALIDATED":
                    # Fallback API-level collision handling
                    continue 
                else:
                    return False, f"Step 1 Fail (400): {err_json.get('error')}"
            except:
                return False, f"Step 1 Fail (400): {r1.text[:200]}"
        elif r1.status_code == 429:
            # Hit rate limit, wait a bit and retry this attempt
            if verbose: logger.warning("Rate limit hit (429). Sleeping 3s...")
            await asyncio.sleep(3.0)
            attempts -= 1 
            continue
        else:
            if verbose: logger.error(f"Step 1 Fail: {r1.status_code} | Body: {r1.text}")
            return False, f"Step 1 Fail: {r1.status_code} {r1.text[:200]}"

    if not cid:
        return False, f"Failed to get unique client ID after {max_setup_attempts} attempts"

    # Step 2: Request Token
    token_payload = {
        "telefono": str(random.randint(900000000, 999999999)),
        "operador": random.choice(OPERADORES),
        "via": random.choice(VIAS)
    }
    r2 = await do_request(client, 'post', f"{api_base}/client/{cid}/token", json=token_payload, timeout=30.0)
    
    if r2.status_code != 200:
        if verbose: logger.error(f"Step 2 Fail: {r2.status_code} | Body: {r2.text}")
        return False, f"Step 2 Fail: {r2.status_code} {r2.text[:200]}"

    return True, "Flujo de éxito completado"


async def scenario_validation_custom(client, api_base, db_url=None, verbose=False):
    """Tests custom validation failures: repetitive numbers, many digits, letters."""
    # We also need a client for this, try to find a unique doc
    doc = None
    for _ in range(10):
        d = str(random.randint(10000000, 99999999))
        if db_url and check_doc_in_db(d, db_url): continue
        doc = d
        break
    
    if not doc: doc = str(random.randint(10000000, 99999999))

    reg = await do_request(client, 'post', f"{api_base}/client", json={
        "tipo_documento": "DNI", 
        "documento": doc, 
        "digito_verificador": "0", 
        "nombres": "Test", 
        "apellido_paterno": "Test", 
        "apellido_materno": "Test"
    }, timeout=20.0)
    
    if reg.status_code not in (200, 201):
        return False, f"Setup Fail: {reg.status_code} {reg.text[:100]}"
    
    cid = reg.json().get("data", {}).get("id")
    
    # Randomly pick a failure type
    fail_type = random.choice(["letters", "too_long", "repetitive"])
    
    if fail_type == "letters":
        phone = "9" + "".join(random.choices("0123456789abc", k=8))
    elif fail_type == "too_long":
        phone = "9" + str(random.randint(1000000000, 9999999999))
    else: # repetitive
        digit = str(random.randint(0, 9))
        phone = digit * 9

    r2 = await do_request(client, 'post', f"{api_base}/client/{cid}/token", json={
        "telefono": phone, 
        "operador": random.choice(OPERADORES), 
        "via": random.choice(VIAS)
    }, timeout=10.0)
    
    if r2.status_code == 400:
        return True, f"Fallo esperado ({fail_type}) capturado correctamente"
    
    if verbose: logger.error(f"Expected 400 for {fail_type} but got {r2.status_code} | Body: {r2.text}")
    return False, f"Fallo esperado ({fail_type}) NO detectado. Status: {r2.status_code}"


async def scenario_ip_mismatch(client, api_base, db_url=None, verbose=False):
    doc = str(random.randint(10000000, 99999999))
    r1 = await do_request(client, 'post', f"{api_base}/client", json={"tipo_documento": "DNI", "documento": doc, "digito_verificador": str(random.randint(0,9)), "nombres": faker.first_name(), "apellido_paterno": faker.last_name(), "apellido_materno": faker.last_name()}, timeout=20.0)
    if r1.status_code not in (200, 201):
        return False, f"No se creó cliente: {r1.status_code}"
    cid = r1.json().get("data", {}).get("id")
    if not cid:
        return False, "No client id"

    await do_request(client, 'post', f"{api_base}/client/{cid}/token", json={"telefono": str(random.randint(900000000, 999999999)), "operador": "CLARO", "via": "W"}, headers={"X-Forwarded-For": "1.1.1.1"}, timeout=10.0)
    r3 = await do_request(client, 'get', f"{api_base}/client/{cid}/verify/1234", headers={"X-Forwarded-For": "2.2.2.2"}, timeout=10.0)
    if r3.status_code == 403:
        return True, "IP Pinning bloqueó acceso"
    
    if verbose: logger.error(f"Expected 403 for IP Mismatch but got {r3.status_code} | Body: {r3.text}")
    return False, f"IP Pinning falló: {r3.status_code}"


async def worker(name, queue, client, api_base, db_url, results, results_lock, scenarios, progress, verbose=False):
    while True:
        i = await queue.get()
        if i is None:
            queue.task_done()
            break
        scen_name, scen_func = random.choice(scenarios)
        res = await run_scenario(scen_name, scen_func, client, api_base, db_url=db_url, verbose=verbose)
        async with results_lock:
            results.append(res)
            progress[0] += 1
            if progress[0] % 100 == 0:
                print(f"[{progress[0]}] Procesados... Éxitos: {sum(1 for r in results if r['success'])} Fallos: {progress[0]-sum(1 for r in results if r['success'])}")
        queue.task_done()


async def main():
    parser = argparse.ArgumentParser(description="Simulador de tráfico hacia la API")
    parser.add_argument("--base-url", default=DEFAULT_API_BASE, help="Base URL de la API")
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL, help="Total de peticiones a generar")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="Peticiones simultáneas")
    parser.add_argument("--mode", choices=["success", "validation", "ip", "all"], default="all", help="Modo de prueba")
    parser.add_argument("--db", help="URL de conexión a PostgreSQL (ej. postgres://user:pass@localhost/db)")
    parser.add_argument("--verbose", action="store_true", help="Mostrar detalles de errores y progreso")
    parser.add_argument("--save", default=None, help="Archivo CSV para guardar resultados (opcional)")
    args = parser.parse_args()

    api_base = args.base_url.rstrip("/")
    total = args.total
    concurrency = args.concurrency

    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    if args.db and not HAS_PSYCOPG2:
        print("ADVERTENCIA: Se solicitó verificación por DB pero 'psycopg2' no está instalado.")
        print("Ejecuta: pip install psycopg2-binary")
        sys.exit(1)

    print("=" * 60)
    print(f"SIMULADOR - Modo={args.mode} Total={total} Concurrency={concurrency} Base={api_base}")
    if args.db: print(f"VERIFICACIÓN DB ACTIVA")
    if args.verbose: print("MODO VERBOSE ACTIVADO")
    print("=" * 60)

    queue = asyncio.Queue()
    for i in range(total):
        queue.put_nowait(i)

    results = []
    results_lock = asyncio.Lock()
    progress = [0]

    if args.mode == "success":
        scenarios = [("Flujo Exitoso", scenario_success_flow)]
    elif args.mode == "validation":
        scenarios = [("Validaciones Personalizadas", scenario_validation_custom)]
    elif args.mode == "ip":
        scenarios = [("IP Mismatch", scenario_ip_mismatch)]
    else:
        scenarios = [
            ("Flujo Exitoso", scenario_success_flow),
            ("Validaciones Personalizadas", scenario_validation_custom),
            ("IP Mismatch", scenario_ip_mismatch)
        ]

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    timeout = httpx.Timeout(40.0, connect=10.0)

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        workers = [asyncio.create_task(worker(f"w{i}", queue, client, api_base, args.db, results, results_lock, scenarios, progress, verbose=args.verbose)) for i in range(concurrency)]

        await queue.join()

        for _ in workers:
            queue.put_nowait(None)
        await asyncio.gather(*workers)

    success_count = sum(1 for r in results if r["success"]) if results else 0
    print("\n" + "=" * 60)
    print(f"SIMULACIÓN FINALIZADA")
    print(f"Total solicitadas: {total} | Procesadas: {len(results)} | Éxitos: {success_count} | Fallos: {len(results)-success_count}")
    print(f"Eficiencia: {(success_count/len(results))*100 if results else 0:.1f}%")
    print("=" * 60)

    if args.save:
        with open(args.save, "w", newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["name", "success", "msg", "time"] )
            writer.writeheader()
            for r in results:
                writer.writerow({"name": r["name"], "success": r["success"], "msg": r["msg"], "time": f'{r["time"]:.4f}'})


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSimulación interrumpida por el usuario.")
        sys.exit(0)
