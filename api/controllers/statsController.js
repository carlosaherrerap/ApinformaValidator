const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Client = require('../models/Client');
const Token = require('../models/Token');
const ResultSend = require('../models/ResultSend');

//DASHBOARD DE ESTADISTICAS
const getDashboardStats = async (req, res) => {
    try {
        const totalClientes = await Client.count();
        const clientesCompletos = await Client.count({ where: { estado: true } });
        const clientesEnProceso = await Client.count({ where: { estado: false } });

        const tokensValidados = await Token.count({ where: { status: 'V' } });
        const tokensExpirados = await Token.count({ where: { status: 'E' } });
        const tokensCancelados = await Token.count({ where: { status: 'X' } });
        const tokensPendientes = await Token.count({ where: { status: 'P' } });
        const totalTokens = await Token.count();

        // Registros de las últimas 24h
        const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const registrosHoy = await Client.count({
            where: { created_at: { [Op.gte]: ayer } }
        });

        return res.status(200).json({
            data: {
                clientes: {
                    total: totalClientes,
                    completos: clientesCompletos,
                    en_proceso: clientesEnProceso
                },
                tokens: {
                    total: totalTokens,
                    validados: tokensValidados,
                    expirados: tokensExpirados,
                    cancelados: tokensCancelados,
                    pendientes: tokensPendientes
                },
                actividad: {
                    registros_24h: registrosHoy
                }
            }
        });

    } catch (error) {
        console.error('[ERROR] getDashboardStats:', error);
        return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

///PAGiNACION DE CLIENTES TOTALES
const getClients = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const estado = req.query.estado; // 'true', 'false', undefined

        const where = {};
        if (search) {
            where[Op.or] = [
                { documento: { [Op.iLike]: `%${search}%` } },
                { nombres: { [Op.iLike]: `%${search}%` } },
                { ap_paterno: { [Op.iLike]: `%${search}%` } }
            ];
        }
        if (estado !== undefined) {
            where.estado = estado === 'true';
        }

        const { count, rows } = await Client.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Token,
                    attributes: ['id', 'via', 'status', 'ip_solicitante', 'created_at'],
                    required: false
                }
            ]
        });

        return res.status(200).json({
            data: rows,
            pagination: {
                page,
                limit,
                total: count,
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('[ERROR] getClients:', error);
        return res.status(500).json({ error: 'Error al obtener clientes' });
    }
};

//DETALLES DE CLIENTE
const getClientDetail = async (req, res) => {
    const { id } = req.params;

    try {
        const client = await Client.findByPk(id, {
            include: [
                {
                    model: Token,
                    attributes: ['id', 'codigo_hash', 'via', 'status', 'ip_solicitante', 'created_at', 'updated_at']
                },
                {
                    model: ResultSend,
                    attributes: ['via', 'intentos', 'ultimo_intento', 'bloqueado']
                }
            ]
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        return res.status(200).json({ data: client });
    } catch (error) {
        console.error('[ERROR] getClientDetail:', error);
        return res.status(500).json({ error: 'Error al obtener detalle' });
    }
};

//ENCRIPTAR TOKEN
const getTokenPlaintext = async (req, res) => {
    const { tokenId } = req.params;

    try {
        const tokenRecord = await Token.findByPk(tokenId);
        if (!tokenRecord) {
            return res.status(404).json({ error: 'Token no encontrado' });
        }

        // El código se almacena en texto plano en el campo 'codigo'-->TK9h
        // y el hash en 'codigo_hash' para verificación -->asfsdf#$5sDfsd3
        console.log(`[ADMIN] Token ${tokenId} visualizado por ${req.user.username}`);

        return res.status(200).json({
            data: {
                token_id: tokenRecord.id,
                codigo: tokenRecord.codigo,
                via: tokenRecord.via,
                status: tokenRecord.status,
                ip: tokenRecord.ip_solicitante,
                created_at: tokenRecord.created_at,
                viewed_by: req.user.username
            }
        });

    } catch (error) {
        console.error('[ERROR] getTokenPlaintext:', error);
        return res.status(500).json({ error: 'Error al obtener token' });
    }
};

module.exports = {
    getDashboardStats,
    getClients,
    getClientDetail,
    getTokenPlaintext
};
