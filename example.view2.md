## VISUALIZAR TODOS LOS CLIENTES
# /api/v1/clients (GET)

## VISUALIZAR UN SOLO RESULTADO BUSCADO
# /api/v1/client/:id/:number (GET)
- EJEMPLO 1: /api/v1/client/documento/75747335 
- EJEMPLO 2: /api/v1/client/telefono/900124654

## VISUALIZAR TODOS LOS USUARIOS
# /api/v1/users (GET)

## AGREGAR UN USUARIO
# /api/v1/user (POST)
    Payload{
        "id": "string",
        "nombres": "string",
        "ape_pat": "string",
        "ape_mat": "string",
        "usuario": "string",
        "clave": "string",
        "documento": "string",
        "telefono": "string",
        "email": "string",
        "dept": "string",
        "prov": "string",
        "distrito": "string",
        "rol": "char(1)",
        "estado":"char(1)"
    }

## EDITAR DATOS DE UN USUARIO
# /api/v1/user/:id (PUT)
    Payload{
        "nombres": "string",
        "ape_pat": "string",
        "ape_mat": "string",
        "usuario": "string",
        "clave": "string",
        "documento": "string",
        "telefono": "string",
        "email": "string",
        "dept": "string",
        "prov": "string",
        "distrito": "string",
        "photo": "string"
        "rol": "char(1)",
        "estado":"char(1)"
    }

## ELIMINAR UN USUARIO
# /api/v1/user/:id (DELETE)


---------------------------

## LOGIN
# /api/v1/login/auth (POST)
    Payload{
        "usuario": "string",
        "clave": "string"
    }

## LOGOUT
# /api/v1/logout/auth (POST)

-------------------------


## GENERAR QR
# /api/v1/qr/generate (POST)
    Payload{
        "usuario": "string",
        "clave": "string"
    }

## INVALIDAR QR
# /api/v1/qr/invalidate (POST)
    Payload{
        "usuario": "string",
        "clave": "string"
    }


