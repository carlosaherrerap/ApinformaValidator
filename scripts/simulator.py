
# SIMULADOR DE CARGA MEJORADO — TOKENIZER HUANCAYO
# 500 solicitudes | 100 simultáneas | 5 minutos
# Flujos: VALIDADO, PROCESADO, EXPIRADO, CANCELADO

import argparse
import asyncio
import httpx
import time
import random
import sys
import logging
from faker import Faker

# Configuración por defecto
DEFAULT_API_BASE = "http://localhost:3000/v1/api"
DEFAULT_TOTAL = 500
DEFAULT_CONCURRENCY = 100
ADMIN_USER = "admin"
ADMIN_PASS = "admin2026"

OPERADORES = ["MOVISTAR", "BITEL", "CLARO", "ENTEL"]
VIAS = ["S", "W"]
TIPOS_DOC = [("DNI", 8), ("RUC", 11), ("CDE", 9)]

faker = Faker('es_ES')

# Logging configurado para consola
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("simulator")

class LoadTestSession:
    def __init__(self, api_base):
        self.api_base = api_base
        self.jwt = None
        self.client = httpx.AsyncClient(
            timeout=60.0, 
            verify=False,
            headers={
                "x-simulator": "true",
                "User-Agent": "LoadTester/1.0"
            }
        )

    async def login_admin(self):
        try:
            r = await self.client.post(f"{self.api_base}/auth/login", json={
                "username": ADMIN_USER,
                "password": ADMIN_PASS
            })
            if r.status_code == 200:
                self.jwt = r.json().get("token")
                return True
            return False
        except Exception as e:
            logger.error(f"Error login admin: {e}")
            return False

    async def close(self):
        await self.client.aclose()

async def do_register(session):
    tipo, size = random.choice(TIPOS_DOC)
    doc = ''.join([str(random.randint(0, 9)) for _ in range(size)])
    payload = {
        "tipo_documento": tipo,
        "documento": doc,
        "dv": str(random.randint(0, 9)),
        "nombres": faker.first_name(),
        "ap_paterno": faker.last_name(),
        "ap_materno": faker.last_name()
    }
    r = await session.client.post(f"{session.api_base}/client", json=payload)
    if r.status_code in (200, 201):
        return r.json().get("data", {}).get("id"), doc
    return None, None

async def do_request_token(session, client_id):
    payload = {
        "celular": str(random.randint(900000000, 999999999)),
        "operador": random.choice(OPERADORES),
        "via": random.choice(VIAS)
    }
    r = await session.client.post(f"{session.api_base}/client/{client_id}/token", json=payload)
    if r.status_code == 200:
        return r.json().get("data", {}).get("token_id")
    
    logger.error(f"Fallo do_request_token: Status {r.status_code}, Body: {r.text}")
    return None

async def get_token_plaintext(session, token_id):
    if not session.jwt: await session.login_admin()
    headers = {"Authorization": f"Bearer {session.jwt}"}
    r = await session.client.get(f"{session.api_base}/stats/tokens/{token_id}", headers=headers)
    if r.status_code == 200:
        return r.json().get("data", {}).get("codigo")
    return None

async def scenario_full_flow(session):
    """Flujo: Registro -> Token -> Validar -> Finalizar (PROCESADO)"""
    cid, doc = await do_register(session)
    if not cid: return False, "Fallo Registro"
    
    tid = await do_request_token(session, cid)
    if not tid: return False, f"Fallo Token (ID:{doc})"
    
    code = await get_token_plaintext(session, tid)
    if not code: return False, f"Fallo GetToken (TID:{tid})"
    
    r_ver = await session.client.get(f"{session.api_base}/client/{cid}/verify/{code}")
    if r_ver.status_code != 200: return False, f"Fallo Verificación (Code:{code})"
    
    r_fin = await session.client.post(f"{session.api_base}/client/{cid}/finalize", json={
        "correo": faker.email(),
        "departamento": "JUNIN",
        "provincia": "HUANCAYO",
        "distrito": "HUANCAYO",
        "acepto_terminos": True
    })
    if r_fin.status_code == 200:
        return True, f"PROCESADO OK (Doc:{doc})"
    return False, f"Fallo Finalizar (ID:{cid})"

async def scenario_expire(session):
    """Flujo: Registro -> Token -> Expirar (EXPIRADO)"""
    cid, doc = await do_register(session)
    if not cid: return False, "Fallo Registro"
    tid = await do_request_token(session, cid)
    if not tid: return False, "Fallo Token"
    
    r = await session.client.post(f"{session.api_base}/client/{cid}/expire")
    if r.status_code == 200:
        return True, f"EXPIRADO OK (Doc:{doc})"
    return False, "Fallo Expire"

async def scenario_cancel(session):
    """Flujo: Registro -> Token -> Cancelar (CANCELADO)"""
    cid, doc = await do_register(session)
    if not cid: return False, "Fallo Registro"
    tid = await do_request_token(session, cid)
    if not tid: return False, "Fallo Token"
    
    r = await session.client.post(f"{session.api_base}/client/{cid}/cancel")
    if r.status_code == 200:
        return True, f"CANCELADO OK (Doc:{doc})"
    return False, "Fallo Cancel"

async def worker(queue, api_base, results):
    session = LoadTestSession(api_base)
    await session.login_admin()
    
    while True:
        job = await queue.get()
        if job is None: break
        
        scenarios = [scenario_full_flow, scenario_expire, scenario_cancel]
        weights = [0.7, 0.15, 0.15] # 70% éxito completo, 15% expire, 15% cancel
        scen = random.choices(scenarios, weights=weights)[0]
        
        start = time.perf_counter()
        try:
            success, msg = await scen(session)
            status = "SUCCESS" if success else "FAILED"
            logger.info(f"[{status}] {scen.__name__}: {msg}")
        except Exception as e:
            success, msg = False, str(e)
            logger.error(f"[ERROR] {scen.__name__}: {e}")
        
        duration = time.perf_counter() - start
        results.append({"success": success, "time": duration, "msg": msg})
        queue.task_done()
    
    await session.close()

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--base-url", default=DEFAULT_API_BASE)
    args = parser.parse_args()

    print(f"\n🚀 Iniciando Prueba de Carga: {args.total} req / {args.concurrency} simultáneos")
    print(f"🔗 API: {args.base_url}\n")
    
    queue = asyncio.Queue()
    for i in range(args.total):
        queue.put_nowait(i)
        
    results = []
    start_time = time.perf_counter()
    
    # Iniciar workers
    tasks = []
    for _ in range(args.concurrency):
        tasks.append(asyncio.create_task(worker(queue, args.base_url, results)))
        
    await queue.join()
    for _ in range(args.concurrency):
        queue.put_nowait(None)
    await asyncio.gather(*tasks)
    
    total_time = time.perf_counter() - start_time
    success_count = sum(1 for r in results if r["success"])
    fail_count = len(results) - success_count
    
    print("\n" + "="*50)
    print("📊 RESULTADOS FINALES")
    print("="*50)
    print(f"Peticiones Totales: {len(results)}")
    print(f"Exitosas:          {success_count}")
    print(f"Fallidas:          {fail_count}")
    print(f"Tiempo Total:      {total_time:.2f}s")
    print(f"Throughput:        {len(results)/total_time:.2f} req/s")
    if results:
        avg_lat = sum(r["time"] for r in results) / len(results)
        print(f"Latencia Media:    {avg_lat*1000:.2f} ms")
    print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
