import httpx
import asyncio

API_BASE = "http://localhost:3000/v1/api"

async def diagnose():
    limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
    timeout = httpx.Timeout(10.0, connect=5.0)
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        print(f"Probar GET base: {API_BASE}")
        try:
            r = await client.get(API_BASE)
            print(f"GET {API_BASE} -> {r.status_code}\n{r.text[:500]}\n---")
        except Exception as e:
            print(f"GET fallo: {e}")

        # Probar POST /client
        payload = {
            "tipo_documento": "DNI",
            "documento": "12345678",
            "digito_verificador": "1",
            "nombres": "Test",
            "apellido_paterno": "Test",
            "apellido_materno": "Test"
        }
        try:
            r2 = await client.post(f"{API_BASE}/client", json=payload)
            print(f"POST /client -> {r2.status_code}\n{r2.text[:500]}\n---")
        except Exception as e:
            print(f"POST /client fallo: {e}")

        # Probar ruta que debe devolver 400 (id inválido)
        try:
            r3 = await client.post(f"{API_BASE}/client/any-id/token", json={"telefono":"987654321","operador":"BITEL","via":"S"})
            print(f"POST /client/any-id/token -> {r3.status_code}\n{r3.text[:500]}\n---")
        except Exception as e:
            print(f"POST /client/any-id/token fallo: {e}")

if __name__ == '__main__':
    asyncio.run(diagnose())
