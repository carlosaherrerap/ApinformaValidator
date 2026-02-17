"""
╔══════════════════════════════════════════════════════════════╗
║  SIMULADOR DE CARGA — TOKENIZER HUANCAYO                    ║
║  200 conexiones simultáneas | 50,000 peticiones              ║
║  Métricas: Throughput, Latencia P50/P95/P99, Tasa de éxito  ║
╚══════════════════════════════════════════════════════════════╝
"""
import argparse
import asyncio
import httpx
import time
import random
import csv
import sys
import logging
import statistics
from faker import Faker

DEFAULT_API_BASE = "http://localhost:3000/v1/api"
DEFAULT_TOTAL = 50000
DEFAULT_CONCURRENCY = 200

OPERADORES = ["MOVISTAR", "BITEL", "CLARO", "ENTEL"]
VIAS = ["S", "W"]
TIPOS_DOC = [("DNI", 8), ("RUC", 11), ("CDE", 9)]

faker = Faker('es_PE')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("simulator")


async def do_request(client, method, url, **kwargs):
    try:
        return await getattr(client, method)(url, **kwargs)
    except Exception as e:
        class Fake:
            status_code = 999
            text = str(e)
            def json(self): return {"error": self.text}
        return Fake()


# ──── ESCENARIOS ────

async def scenario_full_flow(client, api_base, verbose=False):
    """Flujo completo: registro → solicitar token → (verificación simulada)"""
    tipo, size = random.choice(TIPOS_DOC)
    doc = ''.join([str(random.randint(0, 9)) for _ in range(size)])

    r1 = await do_request(client, 'post', f"{api_base}/client", json={
        "tipo_documento": tipo,
        "documento": doc,
        "dv": str(random.randint(0, 9)),
        "nombres": faker.first_name(),
        "ap_paterno": faker.last_name(),
        "ap_materno": faker.last_name()
    }, timeout=30.0)

    if r1.status_code == 400:
        body = r1.json()
        if body.get('code') == 'ALREADY_REGISTERED':
            return True, "Ya registrado (esperado en alta carga)"
        return False, f"Registro rechazado: {body.get('error', '')[:100]}"
    if r1.status_code == 429:
        return True, "Rate limited (429)"
    if r1.status_code not in (200, 201):
        return False, f"Registro falló: {r1.status_code}"

    cid = r1.json().get("data", {}).get("id")
    if not cid:
        return False, "No se obtuvo client ID"

    # Paso 2: Solicitar token
    r2 = await do_request(client, 'post', f"{api_base}/client/{cid}/token", json={
        "celular": str(random.randint(900000000, 999999999)),
        "operador": random.choice(OPERADORES),
        "via": random.choice(VIAS)
    }, timeout=30.0)

    if r2.status_code == 429:
        return True, "Cooldown activo (esperado)"
    if r2.status_code not in (200, 201):
        return False, f"Token falló: {r2.status_code} {r2.text[:100]}"

    return True, "Flujo registro+token OK"


async def scenario_validation(client, api_base, verbose=False):
    """Pruebas de validación: datos inválidos."""
    test = random.choice(["bad_phone", "bad_tipo", "bad_doc", "empty"])

    if test == "bad_phone":
        doc = ''.join([str(random.randint(0, 9)) for _ in range(8)])
        r = await do_request(client, 'post', f"{api_base}/client", json={
            "tipo_documento": "DNI", "documento": doc, "dv": "0",
            "nombres": "Test", "ap_paterno": "Test", "ap_materno": "Test"
        })
        if r.status_code not in (200, 201): return False, f"Setup falló: {r.status_code}"
        cid = r.json().get("data", {}).get("id")
        if not cid: return False, "No ID"
        r2 = await do_request(client, 'post', f"{api_base}/client/{cid}/token", json={
            "celular": "abc", "operador": "CLARO", "via": "S"
        })
        return r2.status_code == 400, f"Validación phone: {r2.status_code}"

    elif test == "bad_tipo":
        r = await do_request(client, 'post', f"{api_base}/client", json={
            "tipo_documento": "XYZ", "documento": "12345678", "dv": "0",
            "nombres": "Test", "ap_paterno": "Test", "ap_materno": "Test"
        })
        return r.status_code == 400, f"Validación tipo: {r.status_code}"

    elif test == "bad_doc":
        r = await do_request(client, 'post', f"{api_base}/client", json={
            "tipo_documento": "DNI", "documento": "123", "dv": "0",
            "nombres": "Test", "ap_paterno": "Test", "ap_materno": "Test"
        })
        return r.status_code == 400, f"Validación doc len: {r.status_code}"

    else:
        r = await do_request(client, 'post', f"{api_base}/client", json={})
        return r.status_code == 400, f"Validación empty: {r.status_code}"


async def scenario_cooldown(client, api_base, verbose=False):
    """Simula verificaciones incorrectas para probar cooldown."""
    doc = ''.join([str(random.randint(0, 9)) for _ in range(8)])
    r1 = await do_request(client, 'post', f"{api_base}/client", json={
        "tipo_documento": "DNI", "documento": doc, "dv": "0",
        "nombres": faker.first_name(), "ap_paterno": faker.last_name(), "ap_materno": faker.last_name()
    })
    if r1.status_code not in (200, 201): return True, "Colisión doc"
    cid = r1.json().get("data", {}).get("id")
    if not cid: return False, "No ID"

    via = random.choice(VIAS)
    r2 = await do_request(client, 'post', f"{api_base}/client/{cid}/token", json={
        "celular": str(random.randint(900000000, 999999999)),
        "operador": "MOVISTAR", "via": via
    })
    if r2.status_code == 429: return True, "Cooldown"
    if r2.status_code != 200: return False, f"Token: {r2.status_code}"

    # 2 intentos incorrectos
    for _ in range(2):
        await do_request(client, 'get', f"{api_base}/client/{cid}/verify/XXXX")

    # Consultar cooldown
    r3 = await do_request(client, 'get', f"{api_base}/client/{cid}/cooldown")
    return r3.status_code == 200, "Flujo cooldown OK"


# ──── WORKER ────

async def worker(name, queue, client, api_base, results, lock, scenarios, progress, verbose):
    while True:
        i = await queue.get()
        if i is None:
            queue.task_done()
            break

        scen_name, scen_func = random.choice(scenarios)
        start = time.perf_counter()
        try:
            success, msg = await scen_func(client, api_base, verbose=verbose)
        except Exception as e:
            success, msg = False, f"Exception: {e}"
        duration = time.perf_counter() - start

        async with lock:
            results.append({"name": scen_name, "success": bool(success), "msg": str(msg), "time": duration})
            progress[0] += 1
            done = progress[0]
            total = progress[1]
            if done % 500 == 0 or done == total:
                pct = (done / total) * 100
                ok = sum(1 for r in results if r['success'])
                elapsed = time.perf_counter() - progress[2]
                rps = done / elapsed if elapsed > 0 else 0
                print(f"  [{done:>6}/{total}] {pct:5.1f}% | ✓ {ok} ✗ {done-ok} | {rps:.0f} req/s")

        queue.task_done()


# ──── REPORTE ────

def print_report(results, elapsed):
    total = len(results)
    if not total: return print("Sin resultados.")

    success = sum(1 for r in results if r["success"])
    failed = total - success
    times = sorted(r["time"] for r in results)

    throughput = total / elapsed if elapsed > 0 else 0
    p50 = times[int(total * 0.50)]
    p95 = times[int(total * 0.95)]
    p99 = times[int(total * 0.99)]
    avg = statistics.mean(times)

    print()
    print("╔" + "═"*58 + "╗")
    print("║         REPORTE DE PRUEBA DE CARGA                      ║")
    print("╠" + "═"*58 + "╣")
    print(f"║  Total peticiones:     {total:>10,}                        ║")
    print(f"║  Exitosas:             {success:>10,}  ({success/total*100:.1f}%)              ║")
    print(f"║  Fallidas:             {failed:>10,}  ({failed/total*100:.1f}%)              ║")
    print(f"║  Tiempo total:         {elapsed:>10.2f}s                      ║")
    print("╠" + "═"*58 + "╣")
    print(f"║  Throughput:           {throughput:>10.1f} req/s                 ║")
    print("╠" + "═"*58 + "╣")
    print(f"║  Latencia MIN:         {min(times)*1000:>10.1f} ms                    ║")
    print(f"║  Latencia AVG:         {avg*1000:>10.1f} ms                    ║")
    print(f"║  Latencia P50:         {p50*1000:>10.1f} ms                    ║")
    print(f"║  Latencia P95:         {p95*1000:>10.1f} ms                    ║")
    print(f"║  Latencia P99:         {p99*1000:>10.1f} ms                    ║")
    print(f"║  Latencia MAX:         {max(times)*1000:>10.1f} ms                    ║")
    print("╚" + "═"*58 + "╝")

    # Distribución
    buckets = [0, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, float('inf')]
    labels = ["<50ms", "50-100ms", "100-250ms", "250-500ms", "0.5-1s", "1-2s", "2-5s", ">5s"]
    counts = [0] * len(labels)
    for t in times:
        for j in range(len(labels)):
            if t < buckets[j+1]:
                counts[j] += 1; break

    print("\n  Distribución de tiempos:")
    for label, count in zip(labels, counts):
        pct = count/total*100
        bar = "█" * int(pct / 100 * 40)
        print(f"  {label:>10} | {bar:<40} {count:>6} ({pct:.1f}%)")

    if failed > 0:
        errs = {}
        for r in results:
            if not r["success"]:
                k = r["msg"][:80]
                errs[k] = errs.get(k, 0) + 1
        print(f"\n  Top errores ({failed}):")
        for msg, cnt in sorted(errs.items(), key=lambda x: -x[1])[:5]:
            print(f"  [{cnt:>5}x] {msg}")


# ──── MAIN ────

async def main():
    parser = argparse.ArgumentParser(description="Simulador de carga — Tokenizer Huancayo")
    parser.add_argument("--base-url", default=DEFAULT_API_BASE)
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--mode", choices=["full", "validation", "cooldown", "all"], default="full")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--save", default=None, help="CSV output file")
    args = parser.parse_args()

    api_base = args.base_url.rstrip("/")
    total, concurrency = args.total, args.concurrency

    print()
    print("╔" + "═"*58 + "╗")
    print("║     SIMULADOR DE CARGA — TOKENIZER HUANCAYO             ║")
    print("╠" + "═"*58 + "╣")
    print(f"║  Modo:          {args.mode:<42}║")
    print(f"║  Total:         {total:>10,} peticiones                   ║")
    print(f"║  Concurrencia:  {concurrency:>10} conexiones                  ║")
    print(f"║  API:           {api_base:<42}║")
    print("╚" + "═"*58 + "╝")
    print()

    scenarios = {
        "full": [("Flujo Completo", scenario_full_flow)],
        "validation": [("Validación", scenario_validation)],
        "cooldown": [("Cooldown", scenario_cooldown)],
        "all": [
            ("Flujo Completo", scenario_full_flow),
            ("Validación", scenario_validation),
            ("Cooldown", scenario_cooldown)
        ]
    }[args.mode]

    queue = asyncio.Queue()
    for i in range(total):
        queue.put_nowait(i)

    results = []
    lock = asyncio.Lock()
    start = time.perf_counter()
    progress = [0, total, start]

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency*2)
    timeout = httpx.Timeout(60.0, connect=15.0)

    print(f"  Iniciando {concurrency} workers...\n")

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        workers = [asyncio.create_task(worker(f"w{i}", queue, client, api_base, results, lock, scenarios, progress, args.verbose)) for i in range(concurrency)]
        await queue.join()
        for _ in workers: queue.put_nowait(None)
        await asyncio.gather(*workers)

    elapsed = time.perf_counter() - start
    print_report(results, elapsed)

    if args.save:
        with open(args.save, "w", newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=["name","success","msg","time"])
            w.writeheader()
            for r in results:
                w.writerow({**r, "time": f"{r['time']:.4f}"})
        print(f"\n  Resultados guardados: {args.save}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n  Cancelado."); sys.exit(0)
