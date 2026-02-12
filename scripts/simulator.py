import asyncio
import httpx
import time
import uuid
import random

# Configuración
API_BASE = "http://localhost:3000/v1/api"
TOTAL_REQUESTS = 400
DURATION_SECONDS = 600  # 10 minutos
CONCURRENCY = 10        # Peticiones simultáneas máximas

# Constantes de dominio
OPERADORES = ["MOVISTAR", "BITEL", "CLARO", "ENTEL"]
VIAS = ["S", "W"]

async def run_scenario(name, func, *args):
    """Ejecuta un escenario y reporta resultado."""
    try:
        start = time.perf_counter()
        res = await func(*args)
        end = time.perf_counter()
        return {"name": name, "success": res[0], "msg": res[1], "time": end - start}
    except Exception as e:
        return {"name": name, "success": False, "msg": str(e), "time": 0}

# --- ESCENARIOS ---

async def scenario_success_flow(client):
    """Flujo completo exitoso."""
    doc = str(random.randint(10000000, 99999999))
    r1 = await client.post(f"{API_BASE}/client", json={
        "tipo_documento": "DNI", "documento": doc, "digito_verificador": "1",
        "nombres": "Sim", "apellido_paterno": "Exito", "apellido_materno": "Test"
    })
    if r1.status_code not in [201, 200]: return False, f"Step 1 Fail: {r1.text}"
    cid = r1.json()["data"]["id"]

    r2 = await client.post(f"{API_BASE}/client/{cid}/token", json={
        "telefono": "9" + str(random.randint(10000000, 99999999)),
        "operador": "MOVISTAR", "via": "S"
    })
    if r2.status_code != 200: return False, f"Step 2 Fail: {r2.text}"
    return True, "Flujo iniciado correctamente"

async def scenario_validation_errors(client):
    """Prueba de validaciones estrictas."""
    # 1. Formato ID Inválido (Debe dar 400, ya no 500)
    r1 = r2 = None
    r1 = await client.post(f"{API_BASE}/client/any-id/token", json={
        "telefono": "987654321", "operador": "BITEL", "via": "S"
    })
    if r1.status_code != 400 or "Formato" not in r1.text:
        return False, f"Falló validación de ID inválido. Status: {r1.status_code}"

    # 2. Letra en teléfono
    # Necesitamos un ID real de un cliente real para pasar el check de UUID
    dummy_doc = str(random.randint(10000000, 99999999))
    reg = await client.post(f"{API_BASE}/client", json={"tipo_documento":"DNI", "documento":dummy_doc, "digito_verificador":"1"})
    real_id = reg.json()["data"]["id"]

    r2 = await client.post(f"{API_BASE}/client/{real_id}/token", json={
        "telefono": "98765432a", "operador": "BITEL", "via": "S"
    })
    if r2.status_code != 400 or ("numerico" not in r2.text.lower() and "numérico" not in r2.text.lower()):
        return False, f"Falló validación de teléfono con letras. Status: {r2.status_code}, Resp: {r2.text}"

    return True, "Validaciones de entrada funcionan correctamente"

async def scenario_ip_mismatch(client):
    doc = str(random.randint(10000000, 99999999))
    r1 = await client.post(f"{API_BASE}/client", json={"tipo_documento":"DNI", "documento":doc, "digito_verificador":"5"})
    cid = r1.json()["data"]["id"]
    await client.post(f"{API_BASE}/client/{cid}/token", json={"telefono":"999888777", "operador":"CLARO", "via":"W"}, headers={"X-Forwarded-For": "1.1.1.1"})
    r3 = await client.get(f"{API_BASE}/client/{cid}/verify/1234", headers={"X-Forwarded-For": "2.2.2.2"})
    if r3.status_code == 403: return True, "IP Pinning bloqueó acceso"
    return False, f"IP Pinning falló: {r3.status_code}"

async def main():
    print("="*60)
    print("      SIMULADOR DE TRÁFICO - PRUEBA DE 10 MINUTOS (400 REQS)")
    print("="*60)
    
    delay_between_requests = DURATION_SECONDS / TOTAL_REQUESTS # ~1.5s
    
    async with httpx.AsyncClient() as client:
        scenarios = [
            ("Flujo Exitoso", scenario_success_flow),
            ("Validaciones Estrictas", scenario_validation_errors),
            ("Seguridad: IP Pinning", scenario_ip_mismatch)
        ]
        
        results = []
        for i in range(TOTAL_REQUESTS):
            name, func = random.choice(scenarios)
            res = await run_scenario(name, func, client)
            results.append(res)
            
            if i % 10 == 0:
                print(f"[{i}/{TOTAL_REQUESTS}] Procesados... " + ("✅" if res["success"] else "❌"))
            
            await asyncio.sleep(delay_between_requests)
            
    success_count = sum(1 for r in results if r["success"])
    print("\n" + "="*60)
    print(f"SIMULACIÓN FINALIZADA")
    print(f"Total: {TOTAL_REQUESTS} | Éxitos: {success_count} | Fallos: {TOTAL_REQUESTS - success_count}")
    print(f"Eficiencia: {(success_count/TOTAL_REQUESTS)*100:.1f}%")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
